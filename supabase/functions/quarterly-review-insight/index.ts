import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HAIKU = 'claude-haiku-4-5-20251001';
const MIN_REVIEWS = 5; // don't generate insight until at least 5 reviews exist

// ── Haiku analysis ────────────────────────────────────────────────────────────

interface ReviewRow {
  rating: number;
  comment: string | null;
  submitted_at: string;
}

interface ReviewInsight {
  strengths: string[];
  friction: string | null;
  suggestion: string;
  generated_at: string;
}

async function analyzeReviews(reviews: ReviewRow[]): Promise<ReviewInsight> {
  const reviewsJson = reviews.map((r) => ({
    rating: r.rating,
    comment: r.comment ?? '',
    month: r.submitted_at.slice(0, 7),
  }));

  const prompt = `You are analyzing client reviews for a freelancer's business. Produce a concise quarterly insight.

Reviews (${reviews.length} total):
${JSON.stringify(reviewsJson, null, 2)}

Return a JSON object with exactly these keys:
- "strengths": array of 2–3 short strings (what clients consistently praise — be specific, e.g. "Fast turnaround" not just "Quality")
- "friction": a single short string describing the most common complaint or area to improve, or null if no clear friction pattern
- "suggestion": one actionable sentence the freelancer could do to improve their ratings

Return ONLY the JSON object. No markdown, no explanation.
Example: {"strengths":["Clear communication","Meets deadlines"],"friction":"Scope creep sometimes leads to budget overruns","suggestion":"Add a change-request clause to proposals so scope changes are billed separately."}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: HAIKU,
      max_tokens: 512,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = data.content.find((c) => c.type === 'text')?.text ?? '{}';

  const parsed = JSON.parse(text) as Partial<ReviewInsight>;

  return {
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
    friction: parsed.friction ?? null,
    suggestion: parsed.suggestion ?? '',
    generated_at: new Date().toISOString(),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch all active businesses
    const { data: businesses, error: bizErr } = await supabase
      .from('businesses')
      .select('id, name, extracted_data')
      .eq('status', 'active');

    if (bizErr) throw bizErr;
    if (!businesses?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const biz of businesses) {
      try {
        // Fetch all reviews for this business
        const { data: reviews, error: reviewErr } = await supabase
          .from('reviews')
          .select('rating, comment, submitted_at')
          .eq('business_id', biz.id)
          .order('submitted_at', { ascending: false });

        if (reviewErr) throw reviewErr;

        if (!reviews || reviews.length < MIN_REVIEWS) {
          skipped++;
          continue;
        }

        const insight = await analyzeReviews(reviews as ReviewRow[]);

        // Merge into extracted_data (preserves all existing keys)
        const currentData = (biz.extracted_data as Record<string, unknown>) ?? {};
        const updated = { ...currentData, review_insight: insight };

        const { error: updateErr } = await supabase
          .from('businesses')
          .update({ extracted_data: updated })
          .eq('id', biz.id);

        if (updateErr) throw updateErr;

        processed++;
        console.log(`quarterly-review-insight: processed ${biz.name} (${reviews.length} reviews)`);
      } catch (bizError) {
        console.error(`quarterly-review-insight: failed for ${biz.name}:`, bizError);
        errors.push(`${biz.name}: ${String(bizError)}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed, skipped, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('quarterly-review-insight error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
