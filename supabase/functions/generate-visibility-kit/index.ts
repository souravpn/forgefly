import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callAnthropic(model: string, system: string, userContent: string, maxTokens: number): Promise<string> {
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
      temperature: 0.6,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0]?.text ?? '';
}

// ─── Channel prompt builders ─────────────────────────────────────────────────

type BusinessContext = {
  name: string;
  niche: string;
  tagline: string;
  services: string;
  location: string;
  portfolioUrl?: string | null;
};

function ctx(b: BusinessContext) {
  const portfolioLine = b.portfolioUrl ? `\nPortfolio URL: ${b.portfolioUrl}` : '';
  return `Business: ${b.name}
Niche: ${b.niche}
Tagline: ${b.tagline}
Services: ${b.services}
Location: ${b.location}${portfolioLine}`;
}

const CHANNEL_GENERATORS: Record<string, {
  model: typeof HAIKU | typeof SONNET;
  maxTokens: number;
  system: string;
  userPrompt: (b: BusinessContext) => string;
}> = {
  behance_dribbble_bio: {
    model: HAIKU,
    maxTokens: 300,
    system: 'You write punchy portfolio bios for creative freelancers. Write in first person, under 120 words. Focus on what the freelancer makes, who they make it for, and one signal of credibility. No buzzwords. If a Portfolio URL is provided, end with it naturally (e.g. "See my work at [url]"). Return plain text, no markdown.',
    userPrompt: (b) => `${ctx(b)}\n\nWrite a Behance/Dribbble profile bio.`,
  },
  linkedin_kit: {
    model: SONNET,
    maxTokens: 800,
    system: 'You write LinkedIn profile copy for B2B creative freelancers. Return a JSON object with keys: headline (under 220 chars), about (3 short paragraphs, first-person, no buzzwords — if a Portfolio URL is provided, include it naturally in the About section), featured_caption (one line for the Featured section pointing to their portfolio, include the Portfolio URL if provided). No markdown fences.',
    userPrompt: (b) => `${ctx(b)}\n\nWrite the LinkedIn presence kit.`,
  },
  linkedin_authority: {
    model: SONNET,
    maxTokens: 1000,
    system: 'You write LinkedIn authority content for B2B professional service providers. Return a JSON object with keys: headline (under 220 chars), about (3 paragraphs establishing expertise and trust — if a Portfolio URL is provided, mention it naturally in the third paragraph), post_templates (array of 3 short thought leadership post templates, each under 150 words, plain text). No markdown fences.',
    userPrompt: (b) => `${ctx(b)}\n\nWrite the LinkedIn authority kit.`,
  },
  google_business: {
    model: HAIKU,
    maxTokens: 400,
    system: 'You write Google Business profile copy. Return a JSON object with keys: description (under 750 chars, local SEO optimised, ends with a call to action), services_tagline (under 100 chars). No markdown fences.',
    userPrompt: (b) => `${ctx(b)}\n\nWrite the Google Business description.`,
  },
  google_yelp_pro: {
    model: HAIKU,
    maxTokens: 400,
    system: 'You write Google Business and Yelp descriptions for professional service providers. Return a JSON object with keys: google_description (under 750 chars, trust-forward, ends with CTA), yelp_description (under 500 chars, more conversational). No markdown fences.',
    userPrompt: (b) => `${ctx(b)}\n\nWrite Google Business and Yelp descriptions.`,
  },
  instagram_kit: {
    model: SONNET,
    maxTokens: 700,
    system: 'You write Instagram presence copy for B2C local service providers. Return a JSON object with keys: bio (under 150 chars, emoji ok), highlights (array of 5 highlight names, 1–2 words each), caption_templates (array of 5 caption templates, each 50–80 words, conversational, include one CTA). No markdown fences.',
    userPrompt: (b) => `${ctx(b)}\n\nWrite the Instagram presence kit.`,
  },
  wedding_profile: {
    model: HAIKU,
    maxTokens: 400,
    system: 'You write wedding directory profile copy (The Knot, WeddingWire). Return a JSON object with keys: profile_blurb (under 200 words, warm and aspirational, ends with what couples get), package_descriptions_intro (one line introducing their packages). No markdown fences.',
    userPrompt: (b) => `${ctx(b)}\n\nWrite the wedding directory profile.`,
  },
  nextdoor_intro: {
    model: HAIKU,
    maxTokens: 250,
    system: 'You write Nextdoor neighborhood introduction posts for local service businesses. Write in first person, friendly and community-focused, under 100 words. Mention the neighborhood or local area. If a Portfolio URL is provided, include it at the end. End with a soft offer to help. Return plain text, no markdown.',
    userPrompt: (b) => `${ctx(b)}\n\nWrite the Nextdoor intro post.`,
  },
  alignable_referral: {
    model: HAIKU,
    maxTokens: 400,
    system: 'You write Alignable profile copy and referral messages for professional service providers. Return a JSON object with keys: alignable_bio (under 150 words, peer-to-peer tone, mentions referral partnerships), referral_intro_message (a short intro message to send to a referral partner, under 80 words, warm and specific). No markdown fences.',
    userPrompt: (b) => `${ctx(b)}\n\nWrite the Alignable profile and referral intro.`,
  },
  trust_kit: {
    model: HAIKU,
    maxTokens: 400,
    system: 'You write trust signal copy and testimonial requests for professional service providers. Return a JSON object with keys: credentials_callout (2–3 sentence block highlighting credentials and experience, suitable for a website About section), testimonial_request (email template to send to a happy client asking for a review, under 100 words, warm, ends with a direct link placeholder [REVIEW_LINK]). No markdown fences.',
    userPrompt: (b) => `${ctx(b)}\n\nWrite the trust signal kit.`,
  },
  seo_bio: {
    model: HAIKU,
    maxTokens: 300,
    system: 'You write SEO-optimised professional bios. Under 150 words. Include 3–5 natural keyword phrases relevant to the niche. First-person. End with location mention if available. Return plain text, no markdown.',
    userPrompt: (b) => `${ctx(b)}\n\nWrite the SEO bio.`,
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as { business_id?: string };
    if (!body.business_id) {
      return new Response(JSON.stringify({ error: 'business_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select('id, name, slug, bio, extracted_data')
      .eq('id', body.business_id)
      .single();

    if (bizErr || !business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ed = business.extracted_data as Record<string, unknown> ?? {};
    const identity = ed.identity as Record<string, string> ?? {};
    const services = (ed.services as Array<{ name: string }> ?? []).map(s => s.name).join(', ');
    const presenceTier = (ed.business_profile as Record<string, string> | null)?.presence_tier ?? 'b2b_professional';

    const portfolioUrl = business.slug
      ? `${Deno.env.get('PUBLIC_SITE_URL') ?? 'https://forgefly.app'}/p/${business.slug}`
      : null;

    const bizCtx: BusinessContext = {
      name: identity.businessName ?? business.name ?? 'this business',
      niche: identity.niche ?? '',
      tagline: identity.tagline ?? '',
      services,
      location: identity.location ?? 'Remote',
      portfolioUrl,
    };

    // Determine which channels to generate based on presence_tier
    const channelsByTier: Record<string, string[]> = {
      b2b_creative: ['behance_dribbble_bio', 'linkedin_kit', 'seo_bio'],
      b2c_local: ['instagram_kit', 'google_business', 'wedding_profile', 'nextdoor_intro'],
      b2b_professional: ['linkedin_authority', 'google_yelp_pro', 'alignable_referral', 'trust_kit'],
      hybrid_professional: ['linkedin_kit', 'google_business', 'trust_kit', 'seo_bio'],
    };

    const channelsToGenerate = channelsByTier[presenceTier] ?? channelsByTier.b2b_professional;

    // Generate all channels in parallel
    const results = await Promise.allSettled(
      channelsToGenerate.map(async (channelId) => {
        const gen = CHANNEL_GENERATORS[channelId];
        if (!gen) return { channelId, content: null };
        const raw = await callAnthropic(gen.model, gen.system, gen.userPrompt(bizCtx), gen.maxTokens);
        // Try JSON parse; if it fails, store as plain string
        let content: unknown;
        try {
          content = JSON.parse(raw.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim());
        } catch {
          content = raw.trim();
        }
        return { channelId, content };
      }),
    );

    const visibilityKit: Record<string, unknown> = {};
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.content !== null) {
        visibilityKit[result.value.channelId] = result.value.content;
      }
    }

    // Generate bio if not already set (pre-populate from business context)
    let bio = (business as { bio?: string | null }).bio ?? null;
    if (!bio) {
      try {
        const bioSystem = 'You write short professional bios for freelancers and solopreneurs. Write in first person, 2–4 sentences, under 80 words. Cover: what they do, who they help, and what makes them different. No buzzwords. No "passionate" or "driven". Plain text only.';
        const bioUser = `${ctx(bizCtx)}\n\nWrite a professional bio for this freelancer's public portfolio page.`;
        bio = await callAnthropic(HAIKU, bioSystem, bioUser, 200);
        bio = bio.trim();
      } catch {
        bio = null;
      }
    }

    // Patch extracted_data.visibility_kit in DB and bio column
    const updatedData = { ...ed, visibility_kit: visibilityKit };
    const updatePayload: Record<string, unknown> = { extracted_data: updatedData };
    if (bio) updatePayload.bio = bio;

    await supabase
      .from('businesses')
      .update(updatePayload)
      .eq('id', body.business_id);

    return new Response(JSON.stringify({ visibility_kit: visibilityKit, bio }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-visibility-kit error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
