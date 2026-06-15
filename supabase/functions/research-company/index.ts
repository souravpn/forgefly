import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const SONNET = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 12000);
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return '';
    const html = await res.text();
    return stripHtml(html);
  } catch {
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as {
      company_input: string;  // URL or company name
      services: string[];     // freelancer's service names
      freelancer_name: string;
    };

    if (!body.company_input) {
      return new Response(JSON.stringify({ error: 'company_input required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalise input to a URL
    let companyUrl = body.company_input.trim();
    if (!companyUrl.startsWith('http')) {
      // Treat as company name — use as-is for the prompt; Sonnet can still extract intel
      companyUrl = '';
    }

    const pageText = companyUrl ? await fetchPageText(companyUrl) : '';

    const servicesStr = (body.services ?? []).join(', ') || 'general freelance services';
    const companyLabel = companyUrl || body.company_input;

    const systemPrompt = `You are a B2B sales intelligence analyst. Given a company website text and a freelancer's services, produce a structured company intelligence brief AND personalised outreach copy.

Return ONLY a valid JSON object (no markdown, no preamble) with this exact shape:

{
  "intel": {
    "company_name": string,
    "company_url": string,
    "description": string,
    "industry": string,
    "size_estimate": string,
    "location": string,
    "brand_approach": string,
    "best_contact_point": string,
    "best_channel": "linkedin_dm" | "email" | "linkedin_then_email",
    "open_roles": [string],
    "recent_signals": [string],
    "service_overlap_score": number,
    "matched_services": [string],
    "unmatched_services": [string],
    "match_label": "Strong match" | "Partial match" | "Weak match",
    "researched_at": string
  },
  "copy_kit": {
    "cold_email": {
      "subject": string,
      "body": string
    },
    "linkedin_dm": string,
    "connection_note": string,
    "follow_up": {
      "subject": string,
      "body": string
    }
  }
}

Rules:
- service_overlap_score: 0.0–1.0, how well the freelancer's services match the company's likely needs
- match_label: Strong (>=0.6), Partial (0.3–0.59), Weak (<0.3)
- matched_services: which of the freelancer's services are relevant
- unmatched_services: which aren't
- cold_email: lead ONLY with matched services, max 150 words, specific to this company
- linkedin_dm: max 300 chars, post-connection message
- connection_note: max 280 chars, for the connection request itself
- follow_up: day 5–7 follow-up assuming no reply, reference the first email
- best_contact_point: who at the company to contact (role, not person name unless obvious)
- If page text is empty, infer from company name/URL — still produce the full object
- researched_at: current ISO timestamp`;

    const userContent = `Company: ${companyLabel}
${pageText ? `Website content:\n${pageText}\n\n` : ''}Freelancer services: ${servicesStr}
Freelancer name: ${body.freelancer_name ?? 'the freelancer'}

Today's date: ${new Date().toISOString()}`;

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: SONNET,
        max_tokens: 2000,
        temperature: 0.4,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const aiData = await res.json();
    const raw = aiData.content[0]?.text ?? '{}';

    let result: unknown;
    try {
      result = JSON.parse(raw.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      throw new Error('Failed to parse Anthropic response as JSON');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('research-company error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
