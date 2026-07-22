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
const PHASE2_THRESHOLD = 20; // switch to Haiku selection above this count
const MAX_SELECTED = 5;

// ── Haiku selection ───────────────────────────────────────────────────────────

interface ReviewRow {
  id: string;
  client_name: string;
  rating: number;
  comment: string | null;
  submitted_at: string;
}

async function selectWithHaiku(reviews: ReviewRow[]): Promise<string[]> {
  const reviewsJson = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment ?? '',
    date: r.submitted_at.slice(0, 7), // YYYY-MM
    client: r.client_name,
  }));

  const prompt = `You are selecting the best ${MAX_SELECTED} client testimonials to display on a freelancer's public portfolio page.

Here are all eligible reviews (rating ≥ 3):
${JSON.stringify(reviewsJson, null, 2)}

Select exactly ${MAX_SELECTED} review IDs that together create the strongest, most credible portfolio impression. Prioritise:
1. High ratings (4–5 stars preferred)
2. Specific, authentic comments over vague praise
3. Diversity across time periods (spread across different months/years)
4. Variety in client names (avoid same client multiple times)

Return ONLY a JSON array of exactly ${MAX_SELECTED} review ID strings. No explanation, no markdown, just the array.
Example: ["uuid1","uuid2","uuid3","uuid4","uuid5"]`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: HAIKU,
      max_tokens: 256,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = data.content.find((c) => c.type === 'text')?.text ?? '[]';

  // Parse and validate — only keep IDs that actually exist in the eligible set
  const eligibleIds = new Set(reviews.map((r) => r.id));
  const parsed = JSON.parse(text) as string[];
  return parsed.filter((id) => eligibleIds.has(id)).slice(0, MAX_SELECTED);
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Internal, function-to-function only (invoked by submit-review) — the
    // anon key is public and doesn't gate anything, so require the service
    // role key explicitly rather than accepting any caller with business_id.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (authHeader !== `Bearer ${SERVICE_KEY}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { business_id } = await req.json();
    if (!business_id) {
      return new Response(JSON.stringify({ error: 'business_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all portal-eligible reviews for this business
    const { data: eligible, error: fetchErr } = await supabase
      .from('reviews')
      .select('id, client_name, rating, comment, submitted_at')
      .eq('business_id', business_id)
      .eq('portal_eligible', true)
      .order('submitted_at', { ascending: false });

    if (fetchErr) throw fetchErr;

    // Hard rule: fewer than 3 eligible = testimonials section won't render, skip
    if (!eligible || eligible.length < 3) {
      console.log(`select-portal-testimonials: only ${eligible?.length ?? 0} eligible reviews, skipping`);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'too_few' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let selectedIds: string[];

    if (eligible.length < PHASE2_THRESHOLD) {
      // Phase 1: top 5 by rating DESC, recency tiebreak
      selectedIds = [...eligible]
        .sort((a, b) =>
          b.rating - a.rating ||
          new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
        )
        .slice(0, MAX_SELECTED)
        .map((r) => r.id);

      console.log(`select-portal-testimonials: phase1, picked ${selectedIds.length} of ${eligible.length}`);
    } else {
      // Phase 2: Haiku diversity selection
      try {
        selectedIds = await selectWithHaiku(eligible as ReviewRow[]);
        // Fallback to phase 1 if Haiku returns nothing usable
        if (selectedIds.length < 3) {
          selectedIds = [...eligible]
            .sort((a, b) => b.rating - a.rating || new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
            .slice(0, MAX_SELECTED)
            .map((r) => r.id);
        }
        console.log(`select-portal-testimonials: phase2 haiku, picked ${selectedIds.length} of ${eligible.length}`);
      } catch (haikusErr) {
        // Haiku failed — fall back to phase 1 silently
        console.error('Haiku selection failed, using phase1 fallback:', haikusErr);
        selectedIds = [...eligible]
          .sort((a, b) => b.rating - a.rating || new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
          .slice(0, MAX_SELECTED)
          .map((r) => r.id);
      }
    }

    // Atomic swap: clear old selections, set new ones
    await supabase
      .from('reviews')
      .update({ ai_selected: false, ai_selected_at: null })
      .eq('business_id', business_id);

    if (selectedIds.length > 0) {
      await supabase
        .from('reviews')
        .update({ ai_selected: true, ai_selected_at: new Date().toISOString() })
        .in('id', selectedIds);
    }

    return new Response(
      JSON.stringify({ ok: true, selected: selectedIds.length, total_eligible: eligible.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('select-portal-testimonials error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
