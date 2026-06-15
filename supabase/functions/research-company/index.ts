import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const SONNET = 'claude-sonnet-4-6';
const HAIKU = 'claude-haiku-4-5-20251001';

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
      action?: 'research' | 'prewarm_comment';
      company_input: string;  // URL or company name
      company_name?: string;  // for prewarm_comment
      services: string[];     // freelancer's service names
      freelancer_name: string;
      portfolio_url?: string | null;
    };

    if (!body.company_input) {
      return new Response(JSON.stringify({ error: 'company_input required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── prewarm_comment branch ────────────────────────────────────────────────
    if (body.action === 'prewarm_comment') {
      const companyName = body.company_name ?? body.company_input;

      // Try to find a recent LinkedIn post via a search-engine-style URL
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`"${companyName}" linkedin post`)}&num=3`;
      const searchHtml = await fetchPageText(searchUrl);

      // Try to extract a LinkedIn URL from the search results
      const linkedinMatch = searchHtml.match(/https?:\/\/(www\.)?linkedin\.com\/posts\/[^\s"'<>]+/);
      let postContent = '';
      let gated = false;

      if (linkedinMatch) {
        const postUrl = linkedinMatch[0].split('&')[0];
        const postHtml = await fetchPageText(postUrl);
        if (!postHtml || postHtml.length < 200) {
          gated = true;
        } else {
          // Extract text that looks like a post (strip nav/footer boilerplate)
          postContent = postHtml.slice(0, 3000);
        }
      } else {
        gated = true;
      }

      if (gated) {
        return new Response(JSON.stringify({ gated: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const preWarmSystem = `You draft peer-level comments on LinkedIn posts for freelancers who want to build a genuine relationship with a company before reaching out.

Rules (all mandatory):
- NEVER compliment the post ("Great post!", "Love this!", "Insightful!")
- Engage with ONE specific detail, decision, technique, or data point from the post
- Write as a peer who has relevant experience — not an admirer
- Maximum 3 sentences
- No emojis
- No hashtags
- Sound like something a thoughtful industry colleague would actually say
- Do not mention the freelancer's services or pitch anything

Return ONLY the comment text. No preamble, no explanation.`;

      const preWarmUser = `Company: ${companyName}
Freelancer: ${body.freelancer_name ?? 'the freelancer'}

Post content:
${postContent}

Draft a genuine peer comment on this post.`;

      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: HAIKU,
          max_tokens: 200,
          temperature: 0.5,
          system: preWarmSystem,
          messages: [{ role: 'user', content: preWarmUser }],
        }),
      });

      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
      const aiData = await res.json();
      const comment = aiData.content[0]?.text?.trim() ?? '';

      return new Response(JSON.stringify({ gated: false, comment }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Default: research branch ──────────────────────────────────────────────

    // Normalise input to a URL
    let companyUrl = body.company_input.trim();
    if (!companyUrl.startsWith('http')) {
      // Treat as company name — use as-is for the prompt; Sonnet can still extract intel
      companyUrl = '';
    }

    const pageText = companyUrl ? await fetchPageText(companyUrl) : '';

    const servicesStr = (body.services ?? []).join(', ') || 'general freelance services';
    const companyLabel = companyUrl || body.company_input;
    const portfolioLine = body.portfolio_url ? `\nFreelancer portfolio URL: ${body.portfolio_url}` : '';

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
- cold_email: lead ONLY with matched services, max 150 words, specific to this company. If a portfolio_url is provided, include it once naturally at the end
- linkedin_dm: max 300 chars, post-connection message. Do NOT include the portfolio URL here (character limit)
- connection_note: max 280 chars, for the connection request itself. Do NOT include the portfolio URL here (character limit)
- follow_up: day 5–7 follow-up assuming no reply, reference the first email. If a portfolio_url is provided, include it once naturally
- best_contact_point: who at the company to contact (role, not person name unless obvious)
- If page text is empty, infer from company name/URL — still produce the full object
- researched_at: current ISO timestamp`;

    const userContent = `Company: ${companyLabel}
${pageText ? `Website content:\n${pageText}\n\n` : ''}Freelancer services: ${servicesStr}
Freelancer name: ${body.freelancer_name ?? 'the freelancer'}${portfolioLine}

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
