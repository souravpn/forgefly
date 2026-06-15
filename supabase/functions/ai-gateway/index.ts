import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Model IDs
const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';

// Cost per 1M tokens (USD) — for ai_usage_log
const TOKEN_COST: Record<string, { input: number; output: number }> = {
  [HAIKU]: { input: 1.00, output: 5.00 },
  [SONNET]: { input: 3.00, output: 15.00 },
};

// ─── Types ──────────────────────────────────────────────────────────────────

type ConfidenceLevel = 'high' | 'medium' | 'low';

interface ConfidenceMap {
  identity: ConfidenceLevel;
  services: ConfidenceLevel;
  pricing: ConfidenceLevel;
  location: ConfidenceLevel;
  niche: ConfidenceLevel;
  brand: ConfidenceLevel;
}

interface BusinessProfile {
  motion: 'b2b' | 'b2c' | 'hybrid';
  industry_vertical: string;
  sale_type: 'portfolio_forward' | 'review_driven' | 'trust_referral' | 'direct_search';
  client_decision_maker: string;
  sales_cycle: 'async_long' | 'urgency_driven' | 'relationship_slow';
  presence_tier: 'b2b_creative' | 'b2c_local' | 'b2b_professional' | 'hybrid_professional';
  confidence?: ConfidenceLevel;
}

interface ClassifierOutput {
  prompt_type: 'seed' | 'additive' | 'revision' | 'scoped';
  complexity: 'simple' | 'medium' | 'rich';
  token_estimate: number;
  sections_needed: string[];
  has_pricing: boolean;
  language: string;
  confidence_map?: ConfidenceMap;
  business_profile?: BusinessProfile;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  temperature?: number;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
}

// ─── Anthropic API helper ───────────────────────────────────────────────────

async function callAnthropic(req: AnthropicRequest): Promise<AnthropicResponse> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${error}`);
  }

  return response.json();
}

function computeCompleteness(map: ConfidenceMap): number {
  const weights: Record<string, number> = {
    identity: 20, services: 25, pricing: 25, location: 10, niche: 10, brand: 10,
  };
  const scores: Record<ConfidenceLevel, number> = { high: 1, medium: 0.5, low: 0 };
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += weight * scores[map[key as keyof ConfidenceMap]];
  }
  return Math.round(total);
}

function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = TOKEN_COST[model] ?? TOKEN_COST[SONNET];
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

// ─── Usage logging ──────────────────────────────────────────────────────────

async function logUsage(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
  businessId: string | null,
  model: string,
  promptType: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  try {
    const costUsd = calcCost(model, inputTokens, outputTokens);
    await supabase.from('ai_usage_log').insert({
      user_id: userId,
      business_id: businessId,
      model,
      prompt_type: promptType,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
    });
  } catch (err) {
    // Non-fatal — table may not exist yet during migrations
    console.warn('ai_usage_log insert failed (non-fatal):', err);
  }
}

// Strip markdown code fences from LLM JSON responses
function stripFences(text: string): string {
  return text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
}

// ─── Classifier ─────────────────────────────────────────────────────────────

const CLASSIFIER_SYSTEM = `You are a classifier for a business portal generator. Analyze the user's prompt and return ONLY a JSON object with no markdown.

Output schema (return exactly this shape):
{
  "prompt_type": "seed" | "additive" | "revision" | "scoped",
  "complexity": "simple" | "medium" | "rich",
  "token_estimate": number,
  "sections_needed": ["identity","services","pipeline","invoices","contacts","metrics","brand","proposal"],
  "has_pricing": boolean,
  "language": string,
  "confidence_map": {
    "identity": "high" | "medium" | "low",
    "services": "high" | "medium" | "low",
    "pricing": "high" | "medium" | "low",
    "location": "high" | "medium" | "low",
    "niche": "high" | "medium" | "low",
    "brand": "high" | "medium" | "low"
  },
  "business_profile": {
    "motion": "b2b" | "b2c" | "hybrid",
    "industry_vertical": string,
    "sale_type": "portfolio_forward" | "review_driven" | "trust_referral" | "direct_search",
    "client_decision_maker": string,
    "sales_cycle": "async_long" | "urgency_driven" | "relationship_slow",
    "presence_tier": "b2b_creative" | "b2c_local" | "b2b_professional" | "hybrid_professional",
    "confidence": "high" | "medium" | "low"
  }
}

Rules:
- seed: first-time business description with no prior context
- additive: adding new service/product/info to an existing business
- revision: changing existing info (price, name, pivot)
- scoped: targeted single-field update
- simple: clear, brief, one service type
- medium: moderate detail, 2–3 service types
- rich: detailed, many services, complex pricing
- sections_needed: only include sections the prompt actually touches
- token_estimate: estimated output tokens needed (100–2500)
- confidence_map: rate how explicitly each field is mentioned (high=explicit, medium=implied, low=absent)
- business_profile: classify the business motion and presence tier (include on ALL prompt_types)
  - motion: b2b=sells to businesses, b2c=sells to consumers, hybrid=both
  - sale_type: portfolio_forward=work portfolio drives decisions, review_driven=reviews/ratings, trust_referral=credentials+referrals, direct_search=people search for the service
  - presence_tier: b2b_creative=design/creative B2B, b2c_local=local consumer services, b2b_professional=professional services B2B, hybrid_professional=both motions
  - If ambiguous, pick most likely and set confidence: "low"`;

async function runClassifier(prompt: string): Promise<ClassifierOutput> {
  const result = await callAnthropic({
    model: HAIKU,
    max_tokens: 200,
    temperature: 0,
    system: CLASSIFIER_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = result.content[0]?.text ?? '{}';
  return JSON.parse(stripFences(text));
}

// ─── Extraction ─────────────────────────────────────────────────────────────

const SCHEMA_MAP: Record<string, string> = {
  identity: `"identity": { "name": string, "businessName": string, "initials": string (2 chars), "tagline": string, "location": string, "niche": string, "accentColor": string (hex) }`,
  services: `"services": [{ "name": string, "price": string, "type": "project"|"retainer"|"hourly", "description": string, "deliverables": [string] }]`,
  pipeline: `"pipeline": { "stages": ["Prospect","Qualified","Proposal Sent","Negotiating","Closed Won"], "leads": [{ "name": string, "stage": string, "value": string, "service": string }] }`,
  invoices: `"invoices": [{ "client": string, "service": string, "amount": string, "status": "Draft"|"Outstanding"|"Paid"|"Overdue", "date": string, "number": string }]`,
  metrics: `"metrics": { "monthlyRevenue": string, "activeClients": number, "pipelineValue": string, "avgProjectValue": string }`,
  contacts: `"contacts": [{ "name": string, "email": string, "company": string, "role": string, "status": "Active client"|"Prospect"|"Past client" }]`,
  proposal: `"proposal": { "intro": string, "approach": string, "whyUs": string, "nextSteps": [string] }`,
  brand: `"brand": { "primaryColor": string (hex), "secondaryColor": string (hex), "accentColor": string (hex), "fonts": { "heading": string, "body": string }, "tone": string, "keywords": [string] }`,
};

function buildExtractionSystem(sections: string[], isDiff: boolean, currentData?: unknown): string {
  const schemaLines = sections.map(s => SCHEMA_MAP[s]).filter(Boolean).join(',\n  ');

  let prompt = `You are a business portal data extractor. Extract structured JSON from the user's business description.

Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  ${schemaLines}
}

Rules:
- Be specific and realistic — infer reasonable values from context
- For missing info, use sensible defaults or short placeholders
- accentColor: pick a professional hex color that fits the niche
- initials: first 2 letters of business name or owner initials
- pipeline.stages: always ["Prospect","Qualified","Proposal Sent","Negotiating","Closed Won"]

For fields where you have low confidence (not explicitly mentioned in the prompt):
- Still populate them with a reasonable inferred value
- Prefix the value with "[estimated] " so the UI can detect and style it differently
- Example: if no location is given, use "[estimated] Remote"
- Example: if no price is given, use "[estimated] Contact for pricing"
- Never leave a field null or empty — always provide something usable`;

  if (isDiff && currentData) {
    prompt += `\n\nEXISTING PORTAL DATA (do NOT repeat unchanged fields — return ONLY fields that are new or changed):
${JSON.stringify(currentData, null, 2)}

IMPORTANT: This is a diff update. Return only the fields/sections that change or are added. Omit everything that stays the same.`;
  }

  return prompt;
}

async function extractSection(
  prompt: string,
  sections: string[],
  model: string,
  maxTokens: number,
  temperature: number,
  isDiff: boolean,
  currentData?: unknown,
): Promise<{ data: unknown; usage: { input_tokens: number; output_tokens: number } }> {
  const result = await callAnthropic({
    model,
    max_tokens: maxTokens,
    temperature,
    system: buildExtractionSystem(sections, isDiff, currentData),
    messages: [{ role: 'user', content: prompt }],
  });

  const text = result.content[0]?.text ?? '{}';

  try {
    return { data: JSON.parse(stripFences(text)), usage: result.usage };
  } catch {
    // Retry with minimal sections on JSON parse failure
    console.warn('JSON parse failed, retrying with minimal sections');
    const fallback = await callAnthropic({
      model,
      max_tokens: 800,
      temperature: 0.2,
      system: buildExtractionSystem(['identity', 'services'], false),
      messages: [{ role: 'user', content: prompt }],
    });
    const fallbackText = fallback.content[0]?.text ?? '{}';
    return {
      data: JSON.parse(stripFences(fallbackText)),
      usage: {
        input_tokens: result.usage.input_tokens + fallback.usage.input_tokens,
        output_tokens: result.usage.output_tokens + fallback.usage.output_tokens,
      },
    };
  }
}

function deepMerge(base: Record<string, unknown>, diff: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(diff)) {
    if (Array.isArray(diff[key])) {
      result[key] = diff[key]; // arrays replace, not merge
    } else if (
      typeof diff[key] === 'object' &&
      diff[key] !== null &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key] as Record<string, unknown>, diff[key] as Record<string, unknown>);
    } else {
      result[key] = diff[key];
    }
  }
  return result;
}

// ─── Extract mode ────────────────────────────────────────────────────────────

const STRUCTURAL_SECTIONS = ['identity', 'services', 'pipeline', 'invoices', 'contacts', 'metrics'];
const CREATIVE_SECTIONS = ['brand', 'proposal'];

async function handleExtract(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
): Promise<Response> {
  const { prompt, current_data, business_id } = body as {
    prompt?: string;
    current_data?: Record<string, unknown>;
    business_id?: string;
  };

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'prompt is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Step 1: Classifier (Haiku, ~200 tokens)
  let classification: ClassifierOutput;
  try {
    classification = await runClassifier(prompt);
  } catch (err) {
    console.error('Classifier failed, using fallback:', err);
    classification = {
      prompt_type: 'seed',
      complexity: 'medium',
      token_estimate: 1200,
      sections_needed: [...STRUCTURAL_SECTIONS, ...CREATIVE_SECTIONS],
      has_pricing: true,
      language: 'en',
      confidence_map: {
        identity: 'medium', services: 'medium', pricing: 'medium',
        location: 'medium', niche: 'medium', brand: 'medium',
      },
    };
  }

  const defaultConfidenceMap: ConfidenceMap = {
    identity: 'medium', services: 'medium', pricing: 'medium',
    location: 'medium', niche: 'medium', brand: 'medium',
  };
  const confidenceMap: ConfidenceMap = classification.confidence_map ?? defaultConfidenceMap;
  const completenessScore = computeCompleteness(confidenceMap);

  await logUsage(supabase, userId, business_id ?? null, HAIKU, 'classifier', 150, 80);

  const { prompt_type, complexity, token_estimate, sections_needed } = classification;
  const isDiff = prompt_type === 'additive' || prompt_type === 'revision';

  // Step 2: Tier selection
  let model: string;
  let temperature: number;

  if (complexity === 'simple' || prompt_type === 'scoped') {
    model = HAIKU;
    temperature = 0.2;
  } else if (complexity === 'medium' || prompt_type === 'additive') {
    model = SONNET;
    temperature = 0.4;
  } else {
    model = SONNET;
    temperature = 0.5;
  }

  const maxTokens = Math.min(Math.round((token_estimate || 1200) * 1.3), 2500);

  // Step 3: Extraction — parallel fan-out for Sonnet, single call for Haiku
  const sectionsToUse = sections_needed.length > 0
    ? sections_needed
    : [...STRUCTURAL_SECTIONS, ...CREATIVE_SECTIONS];

  const structuralNeeded = sectionsToUse.filter(s => STRUCTURAL_SECTIONS.includes(s));
  const creativeNeeded = sectionsToUse.filter(s => CREATIVE_SECTIONS.includes(s));

  let extractedData: Record<string, unknown> = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  if (model === HAIKU || creativeNeeded.length === 0) {
    // Single call for Tier 1 or structure-only
    const { data, usage } = await extractSection(
      prompt, sectionsToUse, model, maxTokens, temperature, isDiff, current_data,
    );
    extractedData = data as Record<string, unknown>;
    totalInputTokens += usage.input_tokens;
    totalOutputTokens += usage.output_tokens;
  } else {
    // Parallel fan-out for Tier 2/3
    const [structural, creative] = await Promise.all([
      structuralNeeded.length > 0
        ? extractSection(prompt, structuralNeeded, model, Math.min(maxTokens, 1800), temperature, isDiff, current_data)
        : Promise.resolve({ data: {}, usage: { input_tokens: 0, output_tokens: 0 } }),
      creativeNeeded.length > 0
        ? extractSection(prompt, creativeNeeded, model, Math.min(maxTokens, 800), temperature, isDiff, current_data)
        : Promise.resolve({ data: {}, usage: { input_tokens: 0, output_tokens: 0 } }),
    ]);

    extractedData = {
      ...(structural.data as Record<string, unknown>),
      ...(creative.data as Record<string, unknown>),
    };
    totalInputTokens += structural.usage.input_tokens + creative.usage.input_tokens;
    totalOutputTokens += structural.usage.output_tokens + creative.usage.output_tokens;
  }

  // Step 4: Merge for diff mode
  let finalData = (isDiff && current_data)
    ? deepMerge(current_data, extractedData)
    : extractedData;

  // Embed business_profile from classifier into extracted_data on seed prompts
  // (non-seed prompts preserve whatever business_profile is already stored)
  if (classification.business_profile && prompt_type === 'seed') {
    finalData = { ...finalData, business_profile: classification.business_profile };
  }

  await logUsage(supabase, userId, business_id ?? null, model, prompt_type, totalInputTokens, totalOutputTokens);

  // Log prompt session for history tab (non-fatal)
  if (userId && business_id) {
    try {
      await supabase.from('prompt_sessions').insert({
        user_id: userId,
        business_id,
        prompt,
        prompt_type,
        extracted_data_snapshot: { diff_summary: { sections_updated: Object.keys(extractedData) } },
      });
    } catch (err) {
      console.warn('prompt_sessions insert failed (non-fatal):', err);
    }
  }

  return new Response(
    JSON.stringify({
      extracted_data: finalData,
      is_diff: isDiff,
      prompt_type,
      sections_updated: Object.keys(extractedData),
      classification,
      confidence_map: confidenceMap,
      completeness_score: completenessScore,
      usage: {
        model,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        cost_usd: calcCost(model, totalInputTokens, totalOutputTokens),
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

// ─── Chat mode ───────────────────────────────────────────────────────────────

async function fetchUserContext(supabase: ReturnType<typeof createClient>, userId: string) {
  const [
    { data: profile },
    { data: clients },
    { data: projects },
    { data: proposals },
    { data: invoices },
    { data: subscription },
    { data: business },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('clients').select('id, name, email, company').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('projects').select('id, name, status, client:clients(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('proposals').select('id, title, status').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('invoices').select('id, invoice_number, amount, payment_status').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('subscriptions').select('tier, status, billing_cycle').eq('user_id', userId).single(),
    supabase.from('businesses').select('id, name, extracted_data').eq('user_id', userId).eq('status', 'active').maybeSingle(),
  ]);

  return {
    profile,
    clients: clients ?? [],
    projects: projects ?? [],
    proposals: proposals ?? [],
    invoices: invoices ?? [],
    subscription,
    business,
  };
}

function buildChatSystem(context: ReturnType<typeof fetchUserContext> extends Promise<infer T> ? T : never, currentPage?: string): string {
  const { profile, clients, projects, proposals, invoices, subscription, business } = context;
  const extracted = business?.extracted_data as Record<string, unknown> | null;

  const identity = extracted?.identity as Record<string, string> | null;
  const services = extracted?.services as Array<{ name: string; price: string }> | null;

  return `You are Forgefly AI Copilot, an intelligent business assistant for ${profile?.username || 'this freelancer'}.

BUSINESS CONTEXT:
${identity ? `Business: ${identity.businessName || business?.name}
Tagline: ${identity.tagline || ''}
Niche: ${identity.niche || ''}
Services: ${(services || []).map(s => `${s.name} (${s.price})`).join(', ')}
` : ''}Subscription: ${subscription?.tier || 'freelancer'} tier (${subscription?.status || 'active'})
Clients: ${clients.length} total
Active Projects: ${projects.filter((p: Record<string, string>) => p.status === 'in_progress').length}
Pending Proposals: ${proposals.filter((p: Record<string, string>) => p.status === 'sent').length}
Unpaid Invoices: ${invoices.filter((i: Record<string, string>) => i.payment_status === 'unpaid').length}

CLIENTS (recent):
${clients.slice(0, 10).map((c: Record<string, string>) => `- ${c.name} (${c.email || 'no email'})`).join('\n')}

ACTIVE PROJECTS:
${projects.filter((p: Record<string, string>) => p.status === 'in_progress').slice(0, 5).map((p: Record<string, unknown>) => `- ${p.name} (Client: ${(p.client as Record<string, string>)?.name || 'Unknown'})`).join('\n')}

RESPONSE FORMAT — return ONLY this JSON object, no markdown:
{
  "message": string,
  "action": string | null,
  "actionData": object | null,
  "suggestions": [string, string, string]
}

AVAILABLE ACTIONS:
- "create_proposal": { "clientId": string }
- "create_invoice": { "projectId": string }
- "show_forecast": {}
- "upgrade_agency": {}
- "navigate": { "path": string }
- "open_command_bar": {}

IMPORTANT RULES:
- Be concise and helpful
- If the user wants to update business identity/services/pricing ("add a service", "change my rate", "I now offer X"), do NOT do it yourself. Reply warmly and set action: "open_command_bar" — the command bar handles business OS changes
- AICopilot is read-mostly: it surfaces info, drafts content, and answers questions. It never silently writes to business data
- Current page: ${currentPage || 'dashboard'}`;
}

async function handleChat(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Response> {
  const { message, current_page } = body as { message?: string; current_page?: string };

  if (!message) {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const context = await fetchUserContext(supabase, userId);

  // Route quick lookups to Haiku, freeform to Sonnet
  const quickKeywords = ['show', 'navigate', 'go to', 'open', 'list', 'how many', 'what is', 'how much'];
  const isQuick = quickKeywords.some(kw => message.toLowerCase().includes(kw)) && message.length < 80;
  const model = isQuick ? HAIKU : SONNET;

  const result = await callAnthropic({
    model,
    max_tokens: 600,
    temperature: 0.5,
    system: buildChatSystem(context, current_page),
    messages: [{ role: 'user', content: message }],
  });

  const text = result.content[0]?.text ?? '{}';

  let aiResponse: Record<string, unknown>;
  try {
    aiResponse = JSON.parse(stripFences(text));
  } catch {
    // If JSON parse fails, wrap as plain message
    aiResponse = {
      message: text,
      action: null,
      actionData: null,
      suggestions: ['Show my clients', 'View dashboard', 'Create a proposal'],
    };
  }

  const businessId = context.business?.id ?? null;
  await logUsage(supabase, userId, businessId, model, 'chat', result.usage.input_tokens, result.usage.output_tokens);

  return new Response(JSON.stringify(aiResponse), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const body = await req.json() as Record<string, unknown>;
    const { mode } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    if (mode === 'extract') {
      return await handleExtract(body, supabase, userId);
    }

    if (mode === 'chat') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return await handleChat(body, supabase, userId);
    }

    return new Response(
      JSON.stringify({ error: 'mode must be "extract" or "chat"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('ai-gateway error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        message: "I'm having trouble processing that request. Please try again.",
        suggestions: ['Show my clients', 'Create a proposal', 'View dashboard'],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
