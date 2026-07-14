import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { resolveContactIdByPhone, sendWhatsapp } from '../_shared/whatsappSend.ts';

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

// Service-role client bypasses RLS for inserts into ai_usage_log
function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

async function logUsage(
  _supabase: ReturnType<typeof createClient>,
  userId: string | null,
  businessId: string | null,
  model: string,
  promptType: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  try {
    const costUsd = calcCost(model, inputTokens, outputTokens);
    // Use service role client — ai_usage_log has no anon INSERT policy (RLS)
    await getServiceClient().from('ai_usage_log').insert({
      user_id: userId,
      business_id: businessId,
      model,
      prompt_type: promptType,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
    });
  } catch (err) {
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
  - If ambiguous, pick most likely and set confidence: "low"

IMPORTANT: A single prompt can touch multiple sections at once. Read the whole prompt and enumerate every distinct thing it asks for — sections_needed must list all of them, not just the first or most obvious one.

WORKED EXAMPLES:

Prompt: "add a new client called Xin Ju. +15551239876. Xinj@yopmail.com\nAlso add a new service called site evaluation photo shoot, price is $2000, only in Texas and AZ"
This asks for two distinct things — a new client AND a new service — so both sections are needed:
{"prompt_type":"additive","complexity":"medium","token_estimate":500,"sections_needed":["contacts","services"],"has_pricing":true,"language":"en","confidence_map":{"identity":"low","services":"high","pricing":"high","location":"high","niche":"low","brand":"low"},"business_profile":{"motion":"b2c","industry_vertical":"photography","sale_type":"direct_search","client_decision_maker":"property owner or manager","sales_cycle":"urgency_driven","presence_tier":"b2c_local","confidence":"medium"}}

Prompt: "change my photography package price to $1500"
This only touches pricing on an existing service — a revision, not an addition:
{"prompt_type":"revision","complexity":"simple","token_estimate":300,"sections_needed":["services"],"has_pricing":true,"language":"en","confidence_map":{"identity":"low","services":"high","pricing":"high","location":"low","niche":"low","brand":"low"},"business_profile":{"motion":"b2c","industry_vertical":"photography","sale_type":"direct_search","client_decision_maker":"individual client","sales_cycle":"urgency_driven","presence_tier":"b2c_local","confidence":"low"}}

Rely on genuinely reading and understanding the prompt's intent — the phrase list below is a backstop for phrasing the model has historically mis-read, not the primary way to decide sections_needed:
- "I now offer", "I also offer", "I'm adding", "we now offer", "starting to offer", "add a service", "add a new service", "new service called" → prompt_type MUST be "additive"; sections_needed MUST include "services"
- "add a client", "add a new client", "new client called", "add a contact", "add a new contact", "sign a new client" → prompt_type MUST be "additive"; sections_needed MUST include "contacts"
- "my brand colors are", "my colors are", "brand colors are", "brand color is" → sections_needed MUST include "brand"
- Any dollar amount in the prompt (e.g. $800, $1,200) → has_pricing MUST be true
- For "additive" and "revision" prompts: sections_needed must NEVER be empty`;

// The full schema (sections_needed + has_pricing + language + a 6-field
// confidence_map + a 7-field business_profile) runs well past 200 tokens once
// populated — a tight budget was silently truncating valid JSON on anything
// but the simplest prompts, which surfaced as "the classifier missed this"
// when the model may have understood fine and just never got to finish
// writing the answer. Retry once with more room before falling back, and
// fail OPEN (request every section) rather than closed (request none) if it
// still can't produce valid JSON — a slightly more expensive extraction call
// is far better than silently dropping a real update on the floor.
async function runClassifier(prompt: string): Promise<ClassifierOutput> {
  async function attempt(maxTokens: number): Promise<ClassifierOutput> {
    const result = await callAnthropic({
      model: HAIKU,
      max_tokens: maxTokens,
      temperature: 0,
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = result.content[0]?.text ?? '{}';
    return JSON.parse(stripFences(text));
  }

  try {
    return await attempt(500);
  } catch (err) {
    console.error('Classifier JSON parse failed at 500 tokens, retrying at 900. Prompt:', prompt.slice(0, 300), 'Error:', err);
    try {
      return await attempt(900);
    } catch (err2) {
      console.error('Classifier failed again after retry — falling back to all sections rather than none. Prompt:', prompt.slice(0, 300), 'Error:', err2);
      return {
        prompt_type: 'additive',
        complexity: 'medium',
        token_estimate: 1200,
        sections_needed: [...STRUCTURAL_SECTIONS, ...CREATIVE_SECTIONS],
        has_pricing: true,
        language: 'en',
      };
    }
  }
}

// ─── Freeda intent router ───────────────────────────────────────────────────
// The single entry point for the merged Freeda surface (mode: 'freeda').
// Every message is routed into exactly one bucket before anything else
// happens. This is a separate, minimal classifier from runClassifier above —
// it has one job (pick a bucket) and a tiny output schema on purpose, so it
// can never hit the token-truncation failure mode that runClassifier used to.

type FreedaIntent = 'update' | 'query' | 'action' | 'support' | 'off_topic';
const FREEDA_INTENTS: FreedaIntent[] = ['update', 'query', 'action', 'support', 'off_topic'];

const INTENT_ROUTER_SYSTEM = `You are an intent router for Freeda, the AI assistant inside Forgefly — a business OS for freelancers. Classify the user's message into exactly one bucket.

Buckets:
- "update": the user wants to ADD or CHANGE their stored business data — add a client, add/reprice a service, change a brand detail, add a pipeline lead. This bucket can only add or edit fields — it cannot remove/delete anything. Never route a removal request here.
- "query": a question answerable from THEIR OWN stored business data — revenue, client counts, invoice status, project stats.
- "action": the user wants Freeda to SEND or MESSAGE something to one or more of their clients over WhatsApp — a reminder, a follow-up, a service announcement, or general text. This covers messages to explicitly named clients, to "all clients", or to a clear rule like "clients with pending/overdue invoices". It does NOT cover creating a proposal or invoice (that's "support" — different mechanism) or anything not about messaging a client.
- "support": everything else Freeda can help with conversationally — creating/drafting a proposal, generating or explaining an invoice, how-to questions about Forgefly, work-related judgment calls (pricing research, industry rates, drafting a message, sourcing costs), or a request to REMOVE/DELETE a client, service, or other stored record (deletion isn't automatable yet — Freeda explains that conversationally and points to the right page). This bucket already has its own handling for proposal/invoice creation and deletion requests — do not route those to "action" or "update".
- "off_topic": unrelated to running their freelance business — general trivia, math, coding help unrelated to Forgefly, or anything a generic assistant would answer identically regardless of what business the person runs.

Lean toward "support" over "off_topic" when a request is ambiguous but plausibly in service of running their business (pricing research, supply costs, drafting a client message) — a false refusal is worse than the rare off-topic answer.

COMPOUND MESSAGES: a single message can contain multiple asks at once (e.g. "add a client X, email them a proposal, and I now offer service Y for $Z"). If ANY part of the message is a concrete update instruction (add/change a client, service, price, brand detail, or pipeline lead), classify the WHOLE message as "update" — even if other parts of the same message ask for something Freeda can't do directly (like emailing a proposal). The update pipeline extracts and applies only the parts it understands; do not downgrade a real update to "support" just because the message also contains an unsupported request alongside it.

Return ONLY JSON: {"bucket": "update"|"query"|"action"|"support"|"off_topic"}

Examples:
"add a new client called Xin Ju" → {"bucket":"update"}
"what's my average revenue per project" → {"bucket":"query"}
"message a reminder to all clients with pending invoices" → {"bucket":"action"}
"send a follow-up to clients who haven't paid yet" → {"bucket":"action"}
"send Xin Zu and Lina Santini a message about my new service" → {"bucket":"action"}
"let all my clients know I now offer a new package" → {"bucket":"action"}
"message a few of my clients about the schedule change" → {"bucket":"action"} (who exactly is unresolved — that's handled by asking the user to pick, not by this router)
"create a proposal" / "create a proposal for Xin Zu" → {"bucket":"support"}
"generate an invoice" / "help me send an invoice" → {"bucket":"support"}
"remove client Xin Zu" / "delete the service called X" → {"bucket":"support"}
"how do I change my public profile background" → {"bucket":"support"}
"where can I get the lowest price for a dozen roses" → {"bucket":"support"}
"what should I charge for a 2-hour headshot session in Austin" → {"bucket":"support"}
"add a new client Sanjay Roy, phone and email. Email him a proposal titled 'UX toolkit dev'. Also I now offer Networking event branding for $2400" → {"bucket":"update"} (the client + service parts are real update instructions; the "email a proposal" part is simply not extracted, but that must not block the update)
"what's the square root of pi" → {"bucket":"off_topic"}
"write me a bubble sort algorithm" → {"bucket":"off_topic"}`;

async function routeIntent(prompt: string): Promise<FreedaIntent> {
  try {
    const result = await callAnthropic({
      model: HAIKU,
      max_tokens: 60,
      temperature: 0,
      system: INTENT_ROUTER_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const parsed = JSON.parse(stripFences(result.content[0]?.text ?? '{}')) as { bucket?: string };
    if (parsed.bucket && FREEDA_INTENTS.includes(parsed.bucket as FreedaIntent)) {
      return parsed.bucket as FreedaIntent;
    }
  } catch (err) {
    console.error('Intent router failed, defaulting to support. Prompt:', prompt.slice(0, 200), 'Error:', err);
  }
  // Fail open to the safest bucket — read-only, no data write, no send. Never
  // default to "update" or "action" on a classification failure.
  return 'support';
}

// ─── Extraction ─────────────────────────────────────────────────────────────

const SCHEMA_MAP: Record<string, string> = {
  identity: `"identity": { "name": string, "businessName": string, "initials": string (2 chars), "tagline": string, "location": string, "niche": string, "accentColor": string (hex) }`,
  services: `"services": [{ "name": string, "price": string, "type": "project"|"retainer"|"hourly", "description": string, "deliverables": [string] }]`,
  pipeline: `"pipeline": { "stages": ["Prospect","Qualified","Proposal Sent","Negotiating","Closed Won"], "leads": [{ "name": string, "stage": string, "value": string, "service": string }] }`,
  invoices: `"invoices": [{ "client": string, "service": string, "amount": string, "status": "Draft"|"Outstanding"|"Paid"|"Overdue", "date": string, "number": string }]`,
  metrics: `"metrics": { "monthlyRevenue": string, "activeClients": number, "pipelineValue": string, "avgProjectValue": string }`,
  contacts: `"contacts": [{ "name": string, "email": string, "phone": string, "company": string, "role": string, "status": "Active client"|"Prospect"|"Past client" }]`,
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
- BRAND COLORS — CRITICAL: If the user explicitly names any colors (e.g. "navy blue", "light blue", "white", "black", "teal", "gold"), convert them to hex and use them as primaryColor/secondaryColor/accentColor. User-specified colors ALWAYS override niche-inferred colors. Approximate mappings: navy blue → #1B3A6B, light blue → #AED6F1, sky blue → #5BA4CF, white → #F8F8F8, black → #111111, dark blue → #1E3A8A, royal blue → #2563EB, teal → #0D9488, forest green → #15803D, gold → #D97706, red → #DC2626, coral → #F97316, purple → #7C3AED, burgundy → #9F1239. If no colors are specified, pick a professional hex that fits the niche.
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
    const usage = {
      input_tokens: result.usage.input_tokens + fallback.usage.input_tokens,
      output_tokens: result.usage.output_tokens + fallback.usage.output_tokens,
    };
    try {
      return { data: JSON.parse(stripFences(fallbackText)), usage };
    } catch (err) {
      // Both attempts returned non-JSON (e.g. the model broke character and
      // replied conversationally to a part of the prompt outside the
      // extraction schema, like "send them a message ..."). Degrade to an
      // empty update for this section rather than throwing — an uncaught
      // error here previously propagated all the way to the top-level
      // handler as a raw 500, surfacing a cryptic "Unexpected token" error
      // and dropping the entire request (including parts of a compound
      // message that WOULD have extracted fine on their own).
      console.error('Extraction retry also returned non-JSON, degrading to empty section. Raw text:', fallbackText.slice(0, 300), 'Error:', err);
      return { data: {}, usage };
    }
  }
}

// Keys whose arrays are upserted (matched by name, updated in place, new
// ones appended) rather than replaced outright — regardless of whether the
// classifier decided this prompt was "additive" or "revision". Gating this
// behind prompt_type was the bug: a single misclassification (e.g. "I now
// offer X" landing as "revision" instead of "additive") caused the whole
// services array to be wholesale replaced with just the one new item,
// silently deleting every other service. Losing existing business data
// because of a classifier guess is a much worse failure than an occasional
// unwanted merge, so this path never replaces — only merges.
const APPEND_ARRAY_KEYS = new Set(['services', 'contacts', 'pipeline', 'invoices']);

function deepMerge(base: Record<string, unknown>, diff: Record<string, unknown>, additive = false): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(diff)) {
    if (Array.isArray(diff[key])) {
      if (APPEND_ARRAY_KEYS.has(key) && Array.isArray(base[key])) {
        // Upsert by name: update any existing item whose name matches
        // (so price/detail revisions to an existing service actually take
        // effect), append anything genuinely new, and never drop an
        // existing item that the incoming diff didn't mention.
        type Named = { name?: string };
        const existing = base[key] as Named[];
        const incoming = diff[key] as Named[];
        const incomingByName = new Map(
          incoming.filter(item => item.name).map(item => [item.name!.toLowerCase(), item]),
        );
        const merged = existing.map(item => {
          const itemKey = item.name?.toLowerCase();
          const match = itemKey ? incomingByName.get(itemKey) : undefined;
          if (match) {
            incomingByName.delete(itemKey!);
            return { ...item, ...match };
          }
          return item;
        });
        result[key] = [...merged, ...incomingByName.values()];
      } else {
        result[key] = diff[key]; // arrays replace, not merge
      }
    } else if (
      typeof diff[key] === 'object' &&
      diff[key] !== null &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key] as Record<string, unknown>, diff[key] as Record<string, unknown>, additive);
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

  let { prompt_type, complexity, token_estimate, sections_needed } = classification;
  let isDiff = prompt_type === 'additive' || prompt_type === 'revision';

  // Seed prompts always need all sections regardless of classifier output
  if (prompt_type === 'seed') {
    sections_needed = [...STRUCTURAL_SECTIONS, ...CREATIVE_SECTIONS];
  }

  // Guard: classifier found no business sections — prompt is not a business update.
  // Only fire when there IS prior business context (business_id or non-empty current_data).
  // Fresh seed calls with no context should always extract — never return not_applicable.
  const hasPriorContext = !!(
    business_id ||
    (current_data && Object.keys(current_data as object).length > 0)
  );

  // Keyword safety net: phrases like "I now offer X", "add a new client Y", or
  // "my brand colors are Z" are always business updates even if the classifier
  // incorrectly returned sections_needed = []. Each clause below is checked
  // independently (not one combined pattern) so a single prompt that touches
  // multiple sections — e.g. "add a client... also add a service..." — infers
  // all of them, not just whichever matched first.
  const SERVICE_PATTERN = /\b(i now offer|i also offer|i'?m adding|we now offer|starting to offer|add(?:ing)? a (?:new )?(?:service|package))\b/i;
  const CONTACT_PATTERN = /\b(add(?:ing)? a (?:new )?(?:client|customer|contact)|new client called|new contact called|sign(?:ed|ing)? a new client)\b/i;
  const BRAND_PATTERN = /\b(my brand colors|my colors are|brand colors are|brand color is)\b/i;
  if (sections_needed.length === 0 && !isDiff && hasPriorContext) {
    const inferred: string[] = [];
    if (SERVICE_PATTERN.test(prompt)) inferred.push('services');
    if (CONTACT_PATTERN.test(prompt)) inferred.push('contacts');
    if (BRAND_PATTERN.test(prompt)) inferred.push('brand');
    if (inferred.length > 0) {
      sections_needed = inferred;
      prompt_type = 'additive';
      isDiff = true;
    }
  }

  if (sections_needed.length === 0 && !isDiff) {
    if (hasPriorContext) {
      return new Response(
        JSON.stringify({
          extracted_data: current_data ?? {},
          is_diff: false,
          prompt_type: 'scoped',
          sections_updated: [],
          classification,
          confidence_map: confidenceMap,
          completeness_score: completenessScore,
          not_applicable: true,
          message: "That doesn't look like a business update. Try asking the AI Copilot instead.",
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    // No prior context — treat as a fresh seed and extract everything
    sections_needed = [...STRUCTURAL_SECTIONS, ...CREATIVE_SECTIONS];
    prompt_type = 'seed';
  }

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

  // Step 4: Merge with existing data whenever there IS existing data.
  // Previously this only merged when isDiff was true (prompt_type resolved
  // to 'additive'/'revision'), so any other classification — 'scoped', or a
  // classifier miss on a phrasing like "I offer X now" that didn't exactly
  // match an override trigger — skipped deepMerge entirely and fell back to
  // the raw extraction output, which in diff mode only contains the fields
  // that changed. That silently replaced the whole business record with
  // just the new service, deleting everything else. Whether to merge should
  // depend on "is there existing data to merge with," not on a classifier
  // guess about prompt intent — the only case for a wholesale replace is a
  // genuine first-time seed, which by definition has no current_data yet.
  let finalData = current_data
    ? deepMerge(current_data, extractedData, prompt_type === 'additive')
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

// ─── Generate proposal mode ──────────────────────────────────────────────────

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://www.forgefly.io';

interface ProposalDraft {
  title: string;
  introduction: string;
  services: string[];
  deliverables: string;
  timeline: string;
  terms: string;
  ai_generation_tone: 'outbound' | 'response' | 'b2b_tailored';
  ai_model_used: string;
}

async function handleGenerateProposal(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Response> {
  const {
    proposal_id,
    initiated_by,
    request_context,
    company_intel,
    extra_context,
    business_id,
  } = body as {
    proposal_id?: string;
    initiated_by: 'freelancer' | 'client' | 'pipeline';
    request_context?: Record<string, unknown>;
    company_intel?: Record<string, unknown>;
    extra_context?: string;
    business_id?: string;
  };

  if (!initiated_by) {
    return new Response(JSON.stringify({ error: 'initiated_by is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch business context (services, bio, slug, motion)
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, bio, slug, extracted_data')
    .eq(business_id ? 'id' : 'user_id', business_id ?? userId)
    .eq('status', 'active')
    .maybeSingle();

  const extracted = business?.extracted_data as Record<string, unknown> | null;
  const services = extracted?.services as Array<{ name: string; price: string; description?: string }> | null;
  const motion = (extracted?.business_profile as Record<string, string> | null)?.motion ?? 'b2b';
  const portfolioUrl = business?.slug ? `${SITE_URL}/p/${business.slug}` : null;

  const servicesBlock = services?.length
    ? services.map(s => `- ${s.name}${s.price ? ` (${s.price})` : ''}${s.description ? `: ${s.description}` : ''}`).join('\n')
    : 'Services not specified';

  const bioBlock = business?.bio ?? '';
  const businessName = business?.name ?? 'the freelancer';

  // Fetch proposal row for client_name / title if proposal_id given
  let clientName = 'the client';
  let proposalTitle = '';
  let resolvedRequestContext = request_context;
  if (proposal_id) {
    const { data: p } = await supabase
      .from('proposals')
      .select('client_name, title, request_context')
      .eq('id', proposal_id)
      .maybeSingle();
    if (p) {
      clientName = p.client_name ?? clientName;
      proposalTitle = p.title ?? '';
      if (!resolvedRequestContext && p.request_context) {
        resolvedRequestContext = p.request_context as Record<string, unknown>;
      }
    }
  }

  // ── Branch system prompts ────────────────────────────────────────────────

  let systemPrompt: string;
  let userContent: string;
  let tone: ProposalDraft['ai_generation_tone'];

  if (initiated_by === 'client') {
    tone = 'response';
    const rc = resolvedRequestContext ?? {};

    systemPrompt = `You are writing a business proposal in response to a client's inbound request.
The client has already reached out — this is a response, not a cold pitch. They want this.

Tone: reassuring, specific, professional. Acknowledge exactly what they asked for. Show you understood.
Do NOT oversell. Do NOT use "I hope this finds you well". Do NOT use the word "deliverables" as a heading.
Lead by confirming you can solve their specific problem. Then scope, timeline, close with a clear next step.

NEVER generate a price. Use [amount] as the investment placeholder — the freelancer will fill this in.
${portfolioUrl ? `Include this portfolio URL naturally in the terms/next steps: ${portfolioUrl}` : ''}

Return ONLY valid JSON, no markdown fences:
{
  "title": string,
  "introduction": string (2–3 paragraphs acknowledging their brief and confirming fit),
  "services": [string] (3–5 bullet points describing scope — start each with an action verb),
  "deliverables": string (short summary of what they receive),
  "timeline": string (realistic estimate e.g. "3–4 weeks"),
  "terms": string (2–3 sentences: why you are the right fit + next step for the client)
}`;

    userContent = `Client: ${clientName}${rc.company ? ` (${rc.company})` : ''}
Service requested: ${rc.service_name ?? proposalTitle ?? 'general services'}
Their problem: ${rc.problem ?? 'not specified'}
Timeline they mentioned: ${rc.timeline ?? 'flexible'}
Budget flexible: ${rc.budget_flexible ? 'yes' : 'no'}
Notes: ${rc.notes ?? 'none'}

My business: ${businessName}
${bioBlock ? `Bio: ${bioBlock}` : ''}
My services:
${servicesBlock}
${extra_context ? `\nAdditional context: ${extra_context}` : ''}`;

  } else if (initiated_by === 'pipeline' && company_intel) {
    tone = 'b2b_tailored';
    const intel = company_intel;
    const matchedServices = services?.filter(s =>
      (intel.matched_services as string[] | null)?.some(
        ms => s.name.toLowerCase().includes(ms.toLowerCase())
      )
    );

    systemPrompt = `You are writing a B2B proposal for a specific target company you have researched.
You have intelligence on this company. USE IT. Be specific — name their product, their industry, their apparent need.
Generic proposals lose to specific ones. Show you did your homework.

Tone: peer-level, direct, researched. No fluff. This person gets pitched constantly.
Do NOT use "I hope this finds you well". Do NOT use "deliverables" as a heading.
Lead with something specific about THEM before talking about yourself.
Only mention services that are a strong match — never list everything.

NEVER generate a price. Use [amount] as the investment placeholder.
${portfolioUrl ? `Include this portfolio URL naturally in the proposal: ${portfolioUrl}` : ''}

Return ONLY valid JSON, no markdown fences:
{
  "title": string,
  "introduction": string (2–3 paragraphs — lead with something specific about them, then position your solution),
  "services": [string] (3–5 bullets — matched services only, no unmatched ones),
  "deliverables": string,
  "timeline": string,
  "terms": string (why you specifically, mention their industry or context, include portfolio URL)
}`;

    userContent = `Target company: ${intel.company_name ?? 'Unknown'}
What they do: ${intel.description ?? 'not specified'}
Industry: ${intel.industry ?? 'not specified'}
Brand approach: ${intel.brand_approach ?? 'not specified'}
Best contact: ${intel.best_contact_point ?? 'not specified'}
Matched services: ${(intel.matched_services as string[] | null)?.join(', ') ?? 'not specified'}
Recent signals: ${(intel.recent_signals as string[] | null)?.join('; ') ?? 'none'}

My business: ${businessName}
${bioBlock ? `Bio: ${bioBlock}` : ''}
My matched services:
${matchedServices?.length ? matchedServices.map(s => `- ${s.name}: ${s.description ?? ''}`).join('\n') : servicesBlock}
${extra_context ? `\nAdditional context: ${extra_context}` : ''}`;

  } else {
    // freelancer-initiated (outbound)
    tone = 'outbound';
    const isB2B = motion === 'b2b' || motion === 'hybrid';

    systemPrompt = `You are writing an outbound business proposal. The freelancer is initiating contact.
Tone: confident, specific, peer-level. ${isB2B ? 'Frame around ROI and business outcomes.' : 'Frame around results and outcomes for the client.'}
Not pitchy. Not humble. Lead with demonstrating you understand the client's situation.
Then position the solution. Then scope, timeline, investment, CTA.
Do NOT use "I hope this finds you well". Do NOT use "deliverables" as a section heading.
Never say "I would like to" or "I am excited to".

NEVER generate a price. Use [amount] as the investment placeholder — the freelancer fills this in.
${portfolioUrl ? `Include this portfolio URL naturally in the proposal: ${portfolioUrl}` : ''}

Return ONLY valid JSON, no markdown fences:
{
  "title": string,
  "introduction": string (2–3 paragraphs — demonstrate understanding of their situation, then position solution),
  "services": [string] (3–5 bullet points describing scope — action verbs, specific outcomes),
  "deliverables": string,
  "timeline": string,
  "terms": string (why you specifically, include portfolio URL, clear next step)
}`;

    userContent = `Client: ${clientName}
My business: ${businessName}
${bioBlock ? `Bio: ${bioBlock}` : ''}
My services:
${servicesBlock}
${extra_context ? `\nContext for this proposal: ${extra_context}` : ''}`;
  }

  // ── Call Sonnet ──────────────────────────────────────────────────────────

  const result = await callAnthropic({
    model: SONNET,
    max_tokens: 1200,
    temperature: 0.5,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = result.content[0]?.text ?? '{}';
  let draft: Omit<ProposalDraft, 'ai_generation_tone' | 'ai_model_used'>;
  try {
    draft = JSON.parse(stripFences(text));
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to parse AI draft. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await logUsage(
    supabase,
    userId,
    business?.id ?? business_id ?? null,
    SONNET,
    'generate_proposal',
    result.usage.input_tokens,
    result.usage.output_tokens,
  );

  const response: ProposalDraft = {
    ...draft,
    ai_generation_tone: tone,
    ai_model_used: SONNET,
  };

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Social content generation ──────────────────────────────────────────────

async function handleGenerateSocialContent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Response> {
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, slug, extracted_data')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!business) {
    return new Response(JSON.stringify({ error: 'No active business found' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const extracted = business.extracted_data as Record<string, unknown> | null;
  const identity = extracted?.identity as Record<string, string> | null;
  const brand = extracted?.brand as Record<string, unknown> | null;
  const tone = (brand?.tone as string) || 'warm and professional';
  const keywords = (brand?.keywords as string[] | null) ?? [];
  const businessName = identity?.businessName || business.name || 'this business';
  const niche = identity?.niche || 'freelance services';
  const portfolioUrl = business.slug ? `${SITE_URL}/p/${business.slug}?src=ig_promo` : null;

  // Pull one recent completed project to give the draft something concrete to reference
  const { data: recentProject } = await supabase
    .from('projects')
    .select('name, client:clients(name)')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const winLine = recentProject
    ? `Recent completed work: "${recentProject.name}"${(recentProject.client as { name?: string } | null)?.name ? ` for ${(recentProject.client as { name?: string }).name}` : ''}`
    : 'No recent completed project on file — write a general availability/booking post instead.';

  const systemPrompt = `You are a social media copywriter drafting Instagram captions for a freelancer/small agency.

Write ORGANIC captions only — these are for the business's own feed/story, not paid ads. Never write ad copy, never mention installing an app, never use a "Learn More"/"Shop Now" style CTA.
Every caption must end with a natural "link in bio" style call-to-action (do not include the actual URL — Instagram doesn't allow clickable links in captions).

Tone: ${tone}
Brand keywords to weave in naturally (don't force all of them): ${keywords.join(', ') || 'none specified'}

Return ONLY valid JSON, no markdown fences:
{
  "captions": [string, string, string]
}
Each caption should be 2-4 short sentences, no more than 2 emoji, no hashtag spam (max 3 relevant hashtags at the end).`;

  const userContent = `Business: ${businessName}
Niche: ${niche}
${winLine}

Draft 3 distinct caption options promoting this business and driving profile visitors to check out their work / request a proposal.`;

  const aiResponse = await callAnthropic({
    model: HAIKU,
    max_tokens: 800,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  await logUsage(supabase, userId, business.id, HAIKU, 'generate_social_content', aiResponse.usage.input_tokens, aiResponse.usage.output_tokens);

  const raw = aiResponse.content[0]?.text ?? '{}';
  let parsed: { captions?: string[] };
  try {
    parsed = JSON.parse(raw.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim());
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const captions = (parsed.captions ?? []).filter((c) => typeof c === 'string' && c.trim().length > 0);
  if (captions.length === 0) {
    return new Response(JSON.stringify({ error: 'No captions generated' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rows = captions.map((caption) => ({
    business_id: business.id,
    platform: 'instagram',
    caption: portfolioUrl ? `${caption}\n\n---\n📌 Reminder: set your Instagram bio link to ${portfolioUrl} before posting this (don't paste the URL into the caption itself).` : caption,
    status: 'draft',
    source: 'ai_generated',
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('social_posts')
    .insert(rows)
    .select();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ posts: inserted }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
    { data: paidInvoiceAmounts, error: paidInvoiceError },
    { count: projectCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('clients').select('id, name, email, company').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('projects').select('id, name, status, client:clients(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('proposals').select('id, title, status').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('invoices').select('id, invoice_number, amount, payment_status').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('subscriptions').select('tier, status, billing_cycle').eq('user_id', userId).single(),
    supabase.from('businesses').select('id, name, extracted_data').eq('user_id', userId).eq('status', 'active').maybeSingle(),
    // Deliberately NOT using PostgREST's embedded aggregate syntax
    // (`amount.sum()`) here — it depends on db-aggregates-enabled being on
    // for this project, which isn't guaranteed, and a rejected/misconfigured
    // aggregate call silently returns no rows rather than an obvious error.
    // Summing client-side has no such dependency and invoice counts per
    // freelancer are small enough that this is cheap either way.
    supabase.from('invoices').select('amount').eq('user_id', userId).eq('payment_status', 'paid'),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  if (paidInvoiceError) {
    console.error('Failed to fetch paid invoices for revenue stats:', paidInvoiceError);
  }
  const totalPaidRevenue = (paidInvoiceAmounts ?? []).reduce((sum, inv) => sum + Number(inv.amount), 0);
  const safeProjectCount = projectCount ?? 0;

  return {
    profile,
    clients: clients ?? [],
    projects: projects ?? [],
    proposals: proposals ?? [],
    invoices: invoices ?? [],
    subscription,
    business,
    stats: {
      totalPaidRevenue,
      projectCount: safeProjectCount,
      avgRevenuePerProject: safeProjectCount > 0 ? totalPaidRevenue / safeProjectCount : 0,
    },
  };
}

function buildChatSystem(
  context: ReturnType<typeof fetchUserContext> extends Promise<infer T> ? T : never,
  currentPage?: string,
  intent?: 'query' | 'support',
): string {
  const { profile, clients, projects, proposals, invoices, subscription, business, stats } = context;
  const extracted = business?.extracted_data as Record<string, unknown> | null;

  const identity = extracted?.identity as Record<string, string> | null;
  const services = extracted?.services as Array<{ name: string; price: string }> | null;

  return `You are Freeda, the AI assistant inside Forgefly, a business OS for freelancers. You're currently helping ${profile?.username || 'this freelancer'}.

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

COMPUTED STATS (real aggregates — use these numbers as-is, do not recompute from the lists below):
Total paid revenue (all time): $${stats.totalPaidRevenue.toLocaleString()}
Project count: ${stats.projectCount}
Average revenue per project: $${stats.avgRevenuePerProject.toFixed(2)}

CLIENTS (recent, capped at 10 — do not state a total count from this list, use "Clients: N total" above instead):
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
- "navigate": { "path": string } — path MUST be one of these exact values (every real page lives under /dashboard, never a bare path like "/clients"): "/dashboard", "/dashboard/calendar", "/dashboard/visibility", "/dashboard/automations", "/dashboard/brand", "/dashboard/outreach", "/dashboard/clients", "/dashboard/messages", "/dashboard/reviews", "/dashboard/leads", "/dashboard/services", "/dashboard/proposals", "/dashboard/finances", "/dashboard/finances?tab=invoices", "/dashboard/project", "/dashboard/social", "/dashboard/settings", "/dashboard/portfolio"

Any action you set is shown to the user as a "Take me there" button, not performed automatically — the user must click it. Only set an action when there's something concrete to navigate to or create; leave it null for a plain conversational answer.

IMPORTANT RULES:
- Be concise and helpful
- If the user is asking to update business identity/services/pricing ("add a service", "change my rate", "I now offer X") and you're seeing this message, that means it wasn't automatically caught — gently ask them to phrase it as a direct instruction (e.g. "add a service called X for $Y") so it can be reviewed and applied. Do not attempt to describe or perform the update yourself, and do not reference any "command bar" — this is the same input you're already replying in
- If the user asks to REMOVE or DELETE a client, service, or other stored record: say plainly that isn't automatable yet, and set action: "navigate" with the right page for what they want to remove — { "path": "/dashboard/clients" } for a client, { "path": "/dashboard/services" } for a service. Don't imply that rephrasing the request would make it work
- You are read-mostly: you surface info, drafts content, and answer questions. You never silently write to business data
${intent === 'query' ? '- This message was classified as a data question. Answer using the numbers already given to you above — if a number isn\'t present in this context, say you don\'t have that broken down yet rather than estimating or guessing.' : ''}
- Current page: ${currentPage || 'dashboard'}

Your entire reply must be a single valid JSON object matching RESPONSE FORMAT above — nothing before it, nothing after it, no markdown code fence around it. Do not write conversational text outside the "message" field's string value.`;
}

// When the model's JSON response fails to parse (truncation, a stray
// unescaped character, etc.), showing the raw un-decoded text to the user is
// worse than showing nothing — it still contains literal JSON escape
// sequences like \n and trailing structure fragments, which reads as
// completely broken. Try to salvage just the human-readable "message" field
// via a targeted regex, then let JSON.parse do the actual escape-decoding
// (reusing its own string-literal parser rather than hand-rolling one).
function extractMessageField(raw: string): string | null {
  const match = raw.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return null;
  }
}

async function handleChat(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Response> {
  const { message, current_page, _intent } = body as { message?: string; current_page?: string; _intent?: 'query' | 'support' };

  if (!message) {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const context = await fetchUserContext(supabase, userId);

  // Route quick lookups to Haiku, freeform to Sonnet. Query-intent messages
  // always get Sonnet — a wrong number is worse than a wrong nudge suggestion.
  const quickKeywords = ['show', 'navigate', 'go to', 'open', 'list', 'how many', 'what is', 'how much'];
  const isQuick = quickKeywords.some(kw => message.toLowerCase().includes(kw)) && message.length < 80;
  const model = _intent === 'query' ? SONNET : (isQuick ? HAIKU : SONNET);

  const result = await callAnthropic({
    model,
    max_tokens: 1000,
    temperature: 0.5,
    system: buildChatSystem(context, current_page, _intent),
    messages: [{ role: 'user', content: message }],
  });

  const text = result.content[0]?.text ?? '{}';

  let aiResponse: Record<string, unknown>;
  try {
    aiResponse = JSON.parse(stripFences(text));
  } catch (err) {
    console.error('Chat response JSON parse failed. Raw text:', text.slice(0, 500), 'Error:', err);
    aiResponse = {
      message: extractMessageField(text) ?? "Sorry, I had trouble putting that response together — try asking again.",
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

// ─── KPI catalog matching ───────────────────────────────────────────────────
// "query" intent messages try this first, before falling through to the
// general chat pipeline. Every entry here corresponds 1:1 to something
// already rendered on the Dashboard (src/services/dashboardService.ts +
// src/config/freedaKpiCatalog.ts on the frontend — ids must match exactly,
// kept in sync by hand since edge functions can't import from src/). On a
// match, the backend returns only the id — it never computes or states the
// actual number itself. The frontend fetches the live value via the exact
// same loadOverviewData() call the Dashboard uses, so a number Freeda states
// can never drift from what's shown on screen. Cheaper than the chat
// pipeline too: a hit skips the Sonnet call entirely.
const KPI_CATALOG: { id: string; label: string; description: string }[] = [
  { id: 'cash_position', label: 'Cash position', description: 'revenue/money received this month, and how much is outstanding or overdue' },
  { id: 'overdue_invoices', label: 'Overdue invoices', description: 'which invoices are overdue and their amounts' },
  { id: 'active_projects', label: 'Active projects', description: 'which projects are currently in progress or in review' },
  { id: 'lead_momentum', label: 'Lead momentum', description: 'how many pipeline leads exist and how many proposals were sent this month' },
  { id: 'upcoming', label: 'Upcoming', description: 'a calendar-style list of what is coming up in the next ~2 weeks — specific project deadlines, specific invoice due dates, proposal expirations, or calendar events by name/date. NOT a general count like "how many invoices are due" — that is a different question this entry does not answer; leave unmatched for those.' },
  { id: 'win_rate', label: 'Win rate', description: 'percentage of proposals that were accepted' },
  { id: 'avg_project_value', label: 'Average project value', description: 'average revenue per project or per paid invoice, average deal size' },
  { id: 'repeat_client_rate', label: 'Repeat client rate', description: 'percentage of clients who hired again / repeat business' },
  { id: 'review_score', label: 'Review score', description: 'average client review rating and number of reviews' },
  { id: 'portfolio_funnel', label: 'Portfolio funnel', description: 'portfolio visits, proposals, and projects started in the last 30 days' },
];

async function matchKpiCatalog(prompt: string): Promise<string | null> {
  const catalogList = KPI_CATALOG.map(k => `- "${k.id}": ${k.label} — ${k.description}`).join('\n');
  try {
    const result = await callAnthropic({
      model: HAIKU,
      max_tokens: 40,
      temperature: 0,
      system: `Match the user's question to one entry in this catalog of things already shown on their business dashboard, if it genuinely asks for the same thing:

${catalogList}

Only match on genuine equivalence — the question must be asking for the same underlying number or list, not just a topically similar one. If the question asks for something not in this list (e.g. "which client owes me the most", "revenue this quarter" when only "this month" exists, "how many clients do I have"), return null rather than guessing at the closest-sounding entry. A wrong match that confidently states the wrong number is worse than admitting no match.

Return ONLY JSON: {"id": "<catalog id>"} or {"id": null}`,
      messages: [{ role: 'user', content: prompt }],
    });
    const parsed = JSON.parse(stripFences(result.content[0]?.text ?? '{}')) as { id?: string | null };
    if (parsed.id && KPI_CATALOG.some(k => k.id === parsed.id)) {
      return parsed.id;
    }
  } catch (err) {
    console.error('KPI catalog match failed, falling through to chat. Prompt:', prompt.slice(0, 200), 'Error:', err);
  }
  return null;
}

// ─── Action proposals ───────────────────────────────────────────────────────
// "action" intent messages land here. This function only reads and drafts —
// it never sends anything. WHO the message reaches is resolved through a
// fixed, allow-listed selector shape (named / filter / all / ambiguous) —
// the model only ever picks one of these modes and supplies parameter
// values (names to look up, which of two fixed filters); app code runs the
// actual lookup query. It never guesses a subset of clients when the
// request is ambiguous ("3 of my clients") — that returns needs_selection
// instead, so the user picks explicitly. The model only ever drafts message
// copy; who gets it is app-resolved and every send requires the user to
// explicitly confirm the exact recipient list and message first — see the
// AI-to-database security boundary section in CLAUDE.md.

interface RecipientSelector {
  mode: 'named' | 'filter' | 'all' | 'ambiguous';
  names?: string[];
  filter?: 'pending_invoices' | 'overdue_invoices';
}

const RECIPIENT_SELECTOR_SYSTEM = `You are resolving WHO a freelancer's message should go to. Read their request and classify how the recipients are specified — you never choose recipients yourself, only identify how they were specified so app code can look them up safely.

Return ONLY JSON matching one of these shapes:
- Named specific clients: {"mode":"named","names":["Xin Zu","Lina Santini"]} — use the names/client references exactly as the user wrote them
- A clear rule: {"mode":"filter","filter":"pending_invoices"} or {"mode":"filter","filter":"overdue_invoices"} — only these two filters exist, do not invent others
- Explicitly all clients: {"mode":"all"}
- Anything else — a vague count with no names ("3 of my clients", "a few clients"), or unclear who: {"mode":"ambiguous"}

Never guess specific names or a specific subset when the user didn't name anyone or reference one of the two fixed filters — return "ambiguous" instead. Guessing who receives a real message is worse than asking.

Examples:
"message a reminder to all clients with pending invoices" → {"mode":"filter","filter":"pending_invoices"}
"send a follow-up to overdue clients" → {"mode":"filter","filter":"overdue_invoices"}
"send Xin Zu and Lina Santini a message about my new service" → {"mode":"named","names":["Xin Zu","Lina Santini"]}
"let all my clients know about the new service" → {"mode":"all"}
"message 3 of my clients" → {"mode":"ambiguous"}
"send a follow-up to a few clients" → {"mode":"ambiguous"}`;

async function resolveRecipientSelector(prompt: string): Promise<RecipientSelector> {
  try {
    const result = await callAnthropic({
      model: HAIKU,
      max_tokens: 150,
      temperature: 0,
      system: RECIPIENT_SELECTOR_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const parsed = JSON.parse(stripFences(result.content[0]?.text ?? '{}')) as RecipientSelector;
    if (parsed.mode === 'named' && Array.isArray(parsed.names) && parsed.names.length > 0) return parsed;
    if (parsed.mode === 'filter' && (parsed.filter === 'pending_invoices' || parsed.filter === 'overdue_invoices')) return parsed;
    if (parsed.mode === 'all') return parsed;
  } catch (err) {
    console.error('Recipient selector resolution failed, defaulting to ambiguous. Prompt:', prompt.slice(0, 200), 'Error:', err);
  }
  // Fail closed: never guess recipients on a parse/classification failure.
  return { mode: 'ambiguous' };
}

interface ResolvedRecipient {
  client_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  invoice_id?: string;
  invoice_number?: string;
  amount?: number;
  due_date?: string | null;
}

async function lookupRecipientsBySelector(
  selector: RecipientSelector,
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{
  recipients: ResolvedRecipient[];
  unresolvedNames: string[];
  needsSelection: boolean;
  candidates?: { id: string; name: string }[];
}> {
  if (selector.mode === 'filter') {
    // "Pending" = actually sent to the client (not still a draft) and not
    // yet paid. status/payment_status are two separate columns —
    // draft/sent/paid/overdue vs. unpaid/processing/paid/failed.
    const statuses = selector.filter === 'overdue_invoices' ? ['overdue'] : ['sent', 'overdue'];
    const { data: pending } = await supabase
      .from('invoices')
      .select('id, invoice_number, amount, due_date, status, payment_status, client:clients(id, name, email, phone)')
      .eq('user_id', userId)
      .in('status', statuses)
      .in('payment_status', ['unpaid', 'failed'])
      .order('due_date', { ascending: true })
      .limit(25);

    type PendingInvoice = {
      id: string; invoice_number: string; amount: number; due_date: string | null;
      client: { id: string; name: string; email: string | null; phone: string | null } | null;
    };
    const recipients = ((pending ?? []) as PendingInvoice[])
      .filter(inv => inv.client && (inv.client.phone || inv.client.email))
      .map(inv => ({
        client_id: inv.client!.id, name: inv.client!.name, phone: inv.client!.phone, email: inv.client!.email,
        invoice_id: inv.id, invoice_number: inv.invoice_number, amount: inv.amount, due_date: inv.due_date,
      }));
    return { recipients, unresolvedNames: [], needsSelection: false };
  }

  if (selector.mode === 'all') {
    const { data: clients } = await supabase.from('clients').select('id, name, email, phone').eq('user_id', userId).order('name');
    const recipients = (clients ?? [])
      .filter(c => c.phone || c.email)
      .map(c => ({ client_id: c.id, name: c.name, phone: c.phone, email: c.email }));
    return { recipients, unresolvedNames: [], needsSelection: false };
  }

  if (selector.mode === 'named' && selector.names) {
    const { data: allClients } = await supabase.from('clients').select('id, name, email, phone').eq('user_id', userId);
    const recipients: ResolvedRecipient[] = [];
    const unresolvedNames: string[] = [];
    for (const requestedName of selector.names) {
      const needle = requestedName.toLowerCase().trim();
      const match = (allClients ?? []).find(c => c.name.toLowerCase().trim() === needle)
        ?? (allClients ?? []).find(c => c.name.toLowerCase().includes(needle));
      if (match && (match.phone || match.email)) {
        recipients.push({ client_id: match.id, name: match.name, phone: match.phone, email: match.email });
      } else {
        unresolvedNames.push(requestedName);
      }
    }
    return { recipients, unresolvedNames, needsSelection: false };
  }

  // ambiguous — never guess; hand back the full client list so the frontend
  // can render an explicit picker instead.
  const { data: clients } = await supabase.from('clients').select('id, name').eq('user_id', userId).order('name');
  return { recipients: [], unresolvedNames: [], needsSelection: true, candidates: clients ?? [] };
}

async function handleActionPropose(
  prompt: string,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  selectedClientIds?: string[],
): Promise<Response> {
  let recipients: ResolvedRecipient[];
  let unresolvedNames: string[] = [];

  if (selectedClientIds && selectedClientIds.length > 0) {
    // The user already picked exactly who from an earlier "ambiguous"
    // response — skip selector resolution entirely and use those IDs as-is.
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, phone')
      .eq('user_id', userId)
      .in('id', selectedClientIds);
    recipients = (clients ?? [])
      .filter(c => c.phone || c.email)
      .map(c => ({ client_id: c.id, name: c.name, phone: c.phone, email: c.email }));
  } else {
    const selector = await resolveRecipientSelector(prompt);
    const resolved = await lookupRecipientsBySelector(selector, supabase, userId);

    if (resolved.needsSelection) {
      return new Response(JSON.stringify({
        kind: 'action',
        needs_selection: true,
        candidate_clients: resolved.candidates,
        note: "I wasn't sure exactly who this should go to — pick the clients below.",
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    recipients = resolved.recipients;
    unresolvedNames = resolved.unresolvedNames;
  }

  if (recipients.length === 0) {
    return new Response(JSON.stringify({
      kind: 'action',
      recipients: [],
      message_draft: null,
      requires_confirmation: false,
      note: unresolvedNames.length > 0
        ? `I couldn't find a client matching: ${unresolvedNames.join(', ')}.`
        : 'No matching clients right now — nothing to send.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const draftResult = await callAnthropic({
    model: SONNET,
    max_tokens: 300,
    temperature: 0.4,
    system: `Draft a short, friendly WhatsApp message for a freelancer to send to their client(s), based on their request below. Use {client_name} for personalization. If the request is about an unpaid or overdue invoice, you may also use {invoice_number}, {amount}, {payment_link} as placeholders — never invent real values for any placeholder. Return ONLY the message text, no preamble, no markdown.`,
    messages: [{ role: 'user', content: prompt }],
  });

  const messageDraft = draftResult.content[0]?.text?.trim() ?? '';
  await logUsage(supabase, userId, null, SONNET, 'action_propose', draftResult.usage.input_tokens, draftResult.usage.output_tokens);

  return new Response(JSON.stringify({
    kind: 'action',
    recipients,
    message_draft: messageDraft,
    requires_confirmation: true,
    unresolved_names: unresolvedNames.length > 0 ? unresolvedNames : undefined,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── Action execution ───────────────────────────────────────────────────────
// The only place a WhatsApp message actually gets sent from Freeda. Takes
// the EXACT recipient list and message text the user reviewed and confirmed
// in the UI — never re-derives either from the original prompt — and sends
// one message per recipient via the same sendWhatsapp() helper every other
// lifecycle notification in this app already uses. Reports per-recipient
// results rather than a single pass/fail, since partial failure (bad
// number, WhatsApp not connected) is common and the user needs to know
// exactly who did and didn't get the message.
async function handleActionExecute(
  body: Record<string, unknown>,
  userId: string,
): Promise<Response> {
  const { recipients, message } = body as {
    recipients?: {
      client_id: string; name: string; phone: string | null; email: string | null;
      invoice_number?: string; amount?: number;
    }[];
    message?: string;
  };

  if (!recipients || recipients.length === 0 || !message) {
    return new Response(JSON.stringify({ error: 'recipients and message are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const service = getServiceClient();

  const { data: business } = await service
    .from('businesses')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!business) {
    return new Response(JSON.stringify({ error: 'No active business found' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: { client_id: string; name: string; sent: boolean; reason?: string }[] = [];

  for (const r of recipients) {
    if (!r.phone) {
      results.push({ client_id: r.client_id, name: r.name, sent: false, reason: 'No phone number on file' });
      continue;
    }

    // Resolve (or create) the contacts row this client maps to, so the sent
    // message threads correctly with any future WhatsApp conversation —
    // same resolution pattern used when sending invoice payment links.
    let contactId = await resolveContactIdByPhone(service, business.id, r.phone);
    if (!contactId && r.email) {
      const { data: existingByEmail } = await service
        .from('contacts')
        .select('id')
        .eq('business_id', business.id)
        .ilike('email', r.email)
        .maybeSingle();
      contactId = existingByEmail?.id ?? null;
    }
    if (!contactId) {
      const { data: created, error: contactErr } = await service
        .from('contacts')
        .insert({ business_id: business.id, name: r.name, email: r.email ?? null, phone: r.phone })
        .select('id')
        .single();
      if (contactErr || !created) {
        results.push({ client_id: r.client_id, name: r.name, sent: false, reason: 'Failed to prepare contact' });
        continue;
      }
      contactId = created.id;
    }

    // Fill known placeholders with real values only — never a fabricated
    // payment link. {payment_link} is left blank if present, since
    // invoice-based portal-link generation isn't wired into this path yet —
    // sending a broken literal "{payment_link}" would be worse.
    const personalized = message
      .replaceAll('{client_name}', r.name)
      .replaceAll('{invoice_number}', r.invoice_number ?? '')
      .replaceAll('{amount}', r.amount != null ? `$${r.amount.toLocaleString()}` : '')
      .replaceAll('{payment_link}', '');

    const result = await sendWhatsapp(service, {
      businessId: business.id,
      toPhone: r.phone,
      bodyText: personalized,
      clientId: contactId,
    });

    results.push({ client_id: r.client_id, name: r.name, sent: result.sent, reason: result.reason });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Freeda: unified single-surface entry point ────────────────────────────
// One endpoint for the merged Freeda UI. Every message is routed to exactly
// one bucket, then handled by the narrowest existing pipeline for that
// bucket — "update" and "support"/"query" reuse handleExtract/handleChat
// unchanged; nothing here re-implements data access those already own.
async function handleFreeda(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Response> {
  const { prompt, selected_client_ids: selectedClientIds } = body as { prompt?: string; selected_client_ids?: string[] };
  if (!prompt) {
    return new Response(JSON.stringify({ error: 'prompt is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // A confirmed manual recipient selection from an earlier "ambiguous"
  // action response — skip intent routing entirely, this is already known
  // to be an action continuation, not a fresh message to classify.
  if (selectedClientIds && selectedClientIds.length > 0) {
    return await handleActionPropose(prompt, supabase, userId, selectedClientIds);
  }

  const bucket = await routeIntent(prompt);

  if (bucket === 'update') {
    const res = await handleExtract(body, supabase, userId);
    const data = await res.json();
    return new Response(JSON.stringify({ kind: 'update', ...data }), {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (bucket === 'action') {
    return await handleActionPropose(prompt, supabase, userId);
  }

  if (bucket === 'off_topic') {
    const result = await callAnthropic({
      model: HAIKU,
      max_tokens: 120,
      temperature: 0.4,
      system: `You are Freeda, the AI assistant inside Forgefly, a business OS for freelancers. The user just asked something unrelated to running their business. Reply in one short, warm sentence redirecting them — no lecture, no apology essay — then on a new line briefly note what you can help with (clients, pricing, invoices, business questions).`,
      messages: [{ role: 'user', content: prompt }],
    });
    await logUsage(supabase, userId, null, HAIKU, 'off_topic', result.usage.input_tokens, result.usage.output_tokens);
    return new Response(JSON.stringify({
      kind: 'off_topic',
      message: result.content[0]?.text?.trim()
        ?? "I'm focused on helping run your business — try asking about clients, pricing, or invoices.",
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (bucket === 'query') {
    const kpiId = await matchKpiCatalog(prompt);
    if (kpiId) {
      return new Response(JSON.stringify({ kind: 'query', matched: true, kpi_id: kpiId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // 'support', and 'query' when it didn't match the KPI catalog, both reuse
  // the existing chat pipeline — same business-context fetch, same response
  // shape the frontend already renders.
  const res = await handleChat({ ...body, message: prompt, _intent: bucket }, supabase, userId);
  const data = await res.json();
  return new Response(JSON.stringify({ kind: bucket, matched: false, ...data }), {
    status: res.status,
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

    if (mode === 'classify') {
      const { prompt } = body as { prompt?: string };
      if (!prompt) {
        return new Response(JSON.stringify({ error: 'prompt required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const classification = await runClassifier(prompt);
      await logUsage(supabase, userId, null, HAIKU, 'classify', 150, 80);
      return new Response(
        JSON.stringify({ business_profile: classification.business_profile ?? null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (mode === 'generate_proposal') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return await handleGenerateProposal(body, supabase, userId);
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

    if (mode === 'freeda') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return await handleFreeda(body, supabase, userId);
    }

    if (mode === 'freeda_execute_action') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return await handleActionExecute(body, userId);
    }

    if (mode === 'generate_social_content') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return await handleGenerateSocialContent(supabase, userId);
    }

    if (mode === 'nudge') {
      const ctx = (body as { context?: Record<string, unknown> }).context ?? {};
      const system = `You are a business coach for a freelancer. Given their current business state, respond with ONE specific, actionable nudge they should act on right now. Be direct, brief, and encouraging. Respond with valid JSON only — no markdown, no prose outside the JSON.

Priority order for nudge selection:
1. Tax urgency (large received amount, no set-aside reminder)
2. Overdue client action (overdue invoice or stalled viewed proposal)
3. Pipeline stall (no new leads or proposals in 14+ days)
4. Financial insight (positive trend or milestone)
5. Visibility (portfolio not yet shared)

Return this shape exactly:
{
  "title": "action-oriented title, max 8 words",
  "description": "one sentence explaining why this matters right now",
  "action": "button label max 3 words or null",
  "route": "/dashboard/... or null"
}`;

      const contextLines = Object.entries(ctx)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

      const res = await callAnthropic({
        model: HAIKU,
        max_tokens: 200,
        temperature: 0.4,
        system,
        messages: [{ role: 'user', content: `Business context:\n${contextLines}` }],
      });

      const raw = res.content[0]?.text?.trim() ?? '{}';
      let nudge: Record<string, unknown> = {};
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        nudge = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch { /* return empty */ }

      await logUsage(supabase, userId, null, HAIKU, 'nudge', res.usage.input_tokens, res.usage.output_tokens);

      return new Response(JSON.stringify({ nudge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (mode === 'target_personas') {
      const { niche, services } = body as { niche?: string; services?: string[] };

      const system = `You are a go-to-market strategist helping a freelancer who just signed up figure out who to reach out to first. Given their niche and services, produce 3-4 distinct target personas.

CRITICAL: Do NOT invent specific company names, contact names, or claim to have researched real companies. Only describe company ARCHETYPES/categories and where to look for them. This is a directional brainstorm, not a verified lead list.

Keep every field to one concise sentence (under 25 words). Brevity matters more than exhaustiveness — this must fit a strict token budget.

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "personas": [
    {
      "persona_label": "short name for this persona, e.g. 'Seed-stage founder without a design hire'",
      "company_profile": "company stage/size/vertical description, one sentence",
      "buyer_role": "who typically signs off on hiring a freelancer here, one sentence",
      "trigger": "what situation makes them likely to hire right now, one sentence",
      "where_to_find": "a concrete channel or search strategy, one sentence — e.g. a platform, search string, or community, not a named company"
    }
  ]
}`;

      const userMsg = `Niche: ${niche || 'general freelance services'}\nServices offered: ${(services ?? []).join(', ') || 'not specified'}`;

      const res = await callAnthropic({
        model: SONNET,
        max_tokens: 2000,
        temperature: 0.5,
        system,
        messages: [{ role: 'user', content: userMsg }],
      });

      const raw = res.content[0]?.text?.trim() ?? '{}';
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(raw.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim());
      } catch { /* fall through to empty */ }

      await logUsage(supabase, userId, null, SONNET, 'target_personas', res.usage.input_tokens, res.usage.output_tokens);

      return new Response(JSON.stringify({ personas: parsed.personas ?? [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'mode must be "extract", "classify", "generate_proposal", "chat", "freeda", "freeda_execute_action", "nudge", or "target_personas"' }),
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
