import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SHOTSTACK_API_KEY = Deno.env.get('SHOTSTACK_API_KEY');
// Must match the endpoint generate-promotion submits to (sandbox for now) — status
// lookups against the wrong environment 404.
const SHOTSTACK_RENDER_URL = 'https://api.shotstack.io/edit/stage/render';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { social_post_id } = await req.json() as { social_post_id?: string };
    if (!social_post_id) {
      return new Response(JSON.stringify({ error: 'social_post_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the caller owns the business this post belongs to — same pattern as
    // social-publish-instagram.
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

    const { data: post, error: postError } = await service
      .from('social_posts')
      .select('id, business_id, video_status, video_url, shotstack_render_id')
      .eq('id', social_post_id)
      .maybeSingle();

    if (postError || !post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: business } = await service
      .from('businesses')
      .select('id, user_id')
      .eq('id', post.business_id)
      .maybeSingle();

    if (!business || business.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!post.shotstack_render_id || post.video_status !== 'rendering') {
      return new Response(
        JSON.stringify({ video_status: post.video_status, video_url: post.video_url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const statusRes = await fetch(`${SHOTSTACK_RENDER_URL}/${post.shotstack_render_id}`, {
      headers: { 'x-api-key': SHOTSTACK_API_KEY ?? '' },
    });
    const statusData = await statusRes.json();
    const shotstackStatus = statusData?.response?.status;

    let videoStatus: 'rendering' | 'ready' | 'failed' = 'rendering';
    let videoUrl: string | null = null;

    if (shotstackStatus === 'done') {
      videoStatus = 'ready';
      videoUrl = statusData.response.url;
    } else if (shotstackStatus === 'failed') {
      videoStatus = 'failed';
    }

    if (videoStatus !== 'rendering') {
      await service
        .from('social_posts')
        .update({ video_status: videoStatus, video_url: videoUrl })
        .eq('id', post.id);
    }

    return new Response(
      JSON.stringify({ video_status: videoStatus, video_url: videoUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('check-video-render error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
