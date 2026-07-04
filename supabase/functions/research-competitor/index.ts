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

async function callAnthropic(system: string, userContent: string, model: string, maxTokens: number) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0]?.text ?? '';
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim());
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as {
      action: 'discover_handles' | 'site_intel';
      niche?: string;
      competitor_id?: string;
      website_url?: string;
    };

    // ── Handle discovery — grounded in a real web search, never LLM recall ─────
    // (an exact @handle is exactly the kind of narrow fact an LLM will hallucinate
    // if asked to "just know" it, so we only ever extract handles that appear in
    // real search-result text, same trick research-company uses for LinkedIn posts)
    if (body.action === 'discover_handles') {
      if (!body.niche) {
        return new Response(JSON.stringify({ error: 'niche required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${body.niche} freelance instagram`)}&num=10`;
      const searchHtml = await fetchPageText(searchUrl);

      const handleMatches = [...searchHtml.matchAll(/instagram\.com\/([a-zA-Z0-9_.]{2,30})/g)]
        .map((m) => m[1])
        .filter((h) => !['p', 'reel', 'explore', 'accounts', 'about'].includes(h.toLowerCase()));

      const uniqueHandles = [...new Set(handleMatches)].slice(0, 8);

      if (uniqueHandles.length === 0) {
        return new Response(JSON.stringify({ candidates: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const candidates = uniqueHandles.map((handle) => ({
        handle,
        source_url: `https://www.instagram.com/${handle}/`,
      }));

      return new Response(JSON.stringify({ candidates }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Site intel — scrape + extract, same pipeline as research-company ───────
    if (body.action === 'site_intel') {
      if (!body.website_url) {
        return new Response(JSON.stringify({ error: 'website_url required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pageText = await fetchPageText(body.website_url);

      const systemPrompt = `You are a competitive intelligence analyst for a freelancer. Given the text of a competitor's public website, extract what's actually stated — do not invent pricing, turnaround times, or reviews that aren't present in the text.

Return ONLY valid JSON, no markdown fences:
{
  "pricing_notes": string | null,
  "turnaround_notes": string | null,
  "review_summary": string | null,
  "raw_extract": { "services_mentioned": [string], "notable_claims": [string] }
}

Rules:
- pricing_notes: null if no pricing information is visible on the page
- turnaround_notes: null if no turnaround/delivery time is mentioned
- review_summary: null if no testimonials/reviews are visible on the page
- Never fabricate a number or claim not present in the text`;

      const userContent = `Competitor website: ${body.website_url}
${pageText ? `Page text:\n${pageText}` : 'Page could not be fetched — return all nulls.'}`;

      const raw = await callAnthropic(systemPrompt, userContent, SONNET, 1200);
      const parsed = parseJson(raw) as {
        pricing_notes: string | null;
        turnaround_notes: string | null;
        review_summary: string | null;
        raw_extract: Record<string, unknown>;
      };

      return new Response(
        JSON.stringify({
          competitor_id: body.competitor_id,
          pricing_notes: parsed.pricing_notes,
          turnaround_notes: parsed.turnaround_notes,
          review_summary: parsed.review_summary,
          raw_extract: parsed.raw_extract,
          scraped_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('research-competitor error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
