import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.2';
import { TEMPLATES } from './templates.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const HAIKU = 'claude-haiku-4-5-20251001';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';

const PLATFORMS = ['instagram', 'facebook', 'nextdoor', 'x', 'linkedin'] as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cost per 1M tokens (USD) — matches ai-gateway's TOKEN_COST table for ai_usage_log.
const HAIKU_COST = { input: 1.00, output: 5.00 };
// gpt-image-1, 1024x1024, quality "medium" — flat per-image cost (not token-metered
// the way OpenAI bills it, but ai_usage_log's cost_usd column takes a flat figure fine).
const OPENAI_IMAGE_COST_USD = 0.042;

// deno-lint-ignore no-explicit-any
async function logUsage(
  service: any,
  userId: string | null,
  businessId: string | null,
  model: string,
  promptType: string,
  costUsd: number,
  inputTokens = 0,
  outputTokens = 0,
): Promise<void> {
  try {
    await service.from('ai_usage_log').insert({
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

async function renderOpenAiImage(input: {
  businessName: string;
  niche: string;
  headline: string;
  stat: string | null;
}): Promise<Uint8Array> {
  const prompt = `A professional, minimal square Instagram promotional graphic for "${input.businessName}", a ${input.niche} business. Dark modern background, clean bold sans-serif typography, high contrast. Large headline text reading exactly: "${input.headline}".${input.stat ? ` Prominent large stat callout reading exactly: "${input.stat}".` : ''} Include a small "Link in bio" footer. Graphic-design poster style, no photorealistic people, no stock-photo look.`;

  const response = await fetch(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      quality: 'medium',
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Images API error ${response.status}: ${error}`);
  }
  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI Images API returned no image data');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = fetch('https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm')
      .then((res) => res.arrayBuffer())
      .then((buf) => initWasm(buf));
  }
  return wasmReady;
}

let fontBufferCache: Uint8Array | null = null;
async function loadFont(): Promise<Uint8Array> {
  if (fontBufferCache) return fontBufferCache;
  const res = await fetch('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf');
  if (!res.ok) throw new Error('Failed to load font');
  fontBufferCache = new Uint8Array(await res.arrayBuffer());
  return fontBufferCache;
}

async function renderPng(svg: string): Promise<Uint8Array> {
  await ensureWasm();
  const fontBuffer = await loadFont();
  const resvg = new Resvg(svg, {
    font: { fontBuffers: [fontBuffer], loadSystemFonts: false, defaultFontFamily: 'Inter' },
    fitTo: { mode: 'width', value: 1080 },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

async function callAnthropic(system: string, userContent: string): Promise<AnthropicResponse> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: HAIKU,
      max_tokens: 500,
      temperature: 0.7,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${error}`);
  }
  return response.json();
}

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { mode } = await req.json() as { mode?: string };
    if (mode !== 'featured' && mode !== 'featured_openai') {
      return new Response(JSON.stringify({ error: 'Unsupported mode' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const useOpenAiImage = mode === 'featured_openai';

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const service = getServiceClient();

    const { data: business } = await service
      .from('businesses')
      .select('id, name, extracted_data')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!business) {
      return new Response(JSON.stringify({ error: 'No active business found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Manual generation has no daily limit — only block if there's already an
    // unresolved Featured draft waiting on the user (publish/draft/delete it first).
    // Once a promo has moved past draft (published or drafted-away), a new one can
    // always be generated, any number of times per day.
    const { data: existing } = await service
      .from('social_posts')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_featured', true)
      .eq('status', 'draft')
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ post: existing }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const extracted = business.extracted_data as Record<string, unknown> | null;
    const identity = extracted?.identity as Record<string, string> | null;
    const brand = extracted?.brand as Record<string, unknown> | null;
    const tone = (brand?.tone as string) || 'warm and professional';
    const businessName = identity?.businessName || business.name || 'this business';
    const niche = identity?.niche || 'freelance services';

    const { data: recentProject } = await service
      .from('projects')
      .select('name, client:clients(name)')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const winLine = recentProject
      ? `Recent completed work: "${recentProject.name}"`
      : 'No recent completed project on file — write a general availability/booking promo instead.';

    const system = `You are a social media copywriter drafting a single promotional graphic's text for a freelancer/small agency.
Tone: ${tone}
Return ONLY valid JSON, no markdown fences:
{
  "caption": "2-4 short sentences for the social caption, natural link-in-bio CTA at the end, max 2 emoji, max 3 hashtags",
  "headline": "a punchy 4-8 word headline for the graphic itself",
  "stat": "a VERY short standalone stat, 8 characters max, like '40%' or '5-star' — a bare number/percentage/rating only, never a phrase — or null if nothing concrete applies"
}`;
    const userContent = `Business: ${businessName}\nNiche: ${niche}\n${winLine}\n\nWrite one promotion.`;

    const aiResponse = await callAnthropic(system, userContent);
    const textCost = (aiResponse.usage.input_tokens * HAIKU_COST.input + aiResponse.usage.output_tokens * HAIKU_COST.output) / 1_000_000;
    await logUsage(service, user.id, business.id, HAIKU, 'generate_promotion_text', textCost, aiResponse.usage.input_tokens, aiResponse.usage.output_tokens);

    const raw = aiResponse.content[0]?.text ?? '{}';
    let parsed: { caption?: string; headline?: string; stat?: string | null };
    try {
      parsed = JSON.parse(raw.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const caption = parsed.caption?.trim();
    const headline = parsed.headline?.trim();
    if (!caption || !headline) {
      return new Response(JSON.stringify({ error: 'AI response missing caption or headline' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const stat = parsed.stat?.trim().slice(0, 12) || null;
    const templateId = useOpenAiImage ? 'openai_gpt_image_1' : stat ? 'stat_card' : 'announcement';

    const png = useOpenAiImage
      ? await renderOpenAiImage({ businessName, niche, headline, stat })
      : await renderPng(TEMPLATES[templateId]({ businessName, headline, stat, footerText: 'Link in bio' }));

    if (useOpenAiImage) {
      await logUsage(service, user.id, business.id, 'gpt-image-1', 'generate_promotion_image', OPENAI_IMAGE_COST_USD);
    }

    const { data: post, error: insertError } = await service
      .from('social_posts')
      .insert({
        business_id: business.id,
        platform: 'instagram',
        caption,
        headline,
        template_id: templateId,
        status: 'draft',
        source: 'ai_generated',
        is_featured: true,
        featured_date: today,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const filename = `promotions/${business.id}/${post.id}.png`;
    const { error: uploadError } = await service.storage
      .from('work-samples')
      .upload(filename, png, { contentType: 'image/png', upsert: true });
    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: publicUrlData } = service.storage.from('work-samples').getPublicUrl(filename);

    const { data: updatedPost, error: updateError } = await service
      .from('social_posts')
      .update({ image_url: publicUrlData.publicUrl })
      .eq('id', post.id)
      .select()
      .single();
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await service.from('social_post_targets').insert(
      PLATFORMS.map((platform) => ({ post_id: post.id, platform, status: 'pending' })),
    );

    await service.from('notifications').insert({
      business_id: business.id,
      client_id: null,
      recipient_role: 'freelancer',
      type: 'promotion_featured',
      title: "Today's Featured promotion is ready",
      body: headline,
      entity_type: 'social_post',
      entity_id: post.id,
    });

    return new Response(JSON.stringify({ post: updatedPost }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-promotion error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
