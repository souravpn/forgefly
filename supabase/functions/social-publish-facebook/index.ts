import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_VERSION = 'v21.0';

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { social_post_id, use_video } = await req.json() as { social_post_id?: string; use_video?: boolean };
    if (!social_post_id) {
      return new Response(JSON.stringify({ error: 'social_post_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the caller owns the business this post belongs to
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
      .select('id, business_id, caption, image_url, video_url, status')
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

    // Same reasoning as social-publish-instagram: a photo and a Reel from the same promotion
    // are published with two sequential calls to this function — the first flips status from
    // 'approved' to 'published', so the second leg must still be allowed through.
    if (post.status !== 'approved' && post.status !== 'published') {
      return new Response(JSON.stringify({ error: 'Post must be approved before publishing' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (use_video && !post.video_url) {
      return new Response(JSON.stringify({ error: 'Reel video is not ready yet — wait for rendering to finish or publish as a photo instead' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!use_video && !post.image_url) {
      return new Response(JSON.stringify({ error: 'Post has no image — Facebook requires media on every post' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: connection, error: connError } = await service
      .from('social_connections')
      .select('access_token, external_id, status')
      .eq('business_id', post.business_id)
      .eq('platform', 'facebook')
      .maybeSingle();

    if (connError || !connection || connection.status !== 'connected') {
      return new Response(JSON.stringify({ error: 'No connected Facebook Page for this business' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { access_token: pageAccessToken, external_id: pageId } = connection;

    let platformPostId: string;

    if (!use_video) {
      // Page photo posts publish in a single call — no container/polling step, unlike
      // Instagram or Facebook Reels.
      const photoRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/photos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: post.image_url,
            caption: post.caption,
            access_token: pageAccessToken,
          }),
        },
      );
      const photoData = await photoRes.json();
      console.log('social-publish-facebook photo response:', photoRes.status, JSON.stringify(photoData));

      if (!photoRes.ok || !photoData.post_id) {
        return new Response(
          JSON.stringify({ error: photoData.error?.message ?? 'Failed to publish photo to Facebook' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      platformPostId = photoData.post_id;
    } else {
      // Facebook Page Reels use the resumable-upload video API: start (get an upload session
      // + video_id) → transfer (hand Meta a hosted file_url to fetch server-side, rather than
      // streaming bytes through this function) → finish (publish). This is a genuinely
      // different shape from Instagram's create-container/media_publish flow.
      const startRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/video_reels?` +
          new URLSearchParams({ upload_phase: 'start', access_token: pageAccessToken }),
        { method: 'POST' },
      );
      const startData = await startRes.json();
      console.log('social-publish-facebook reel start response:', startRes.status, JSON.stringify(startData));

      if (!startRes.ok || !startData.video_id || !startData.upload_url) {
        return new Response(
          JSON.stringify({ error: startData.error?.message ?? 'Failed to start Facebook Reel upload' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const videoId = startData.video_id as string;

      const transferRes = await fetch(startData.upload_url, {
        method: 'POST',
        headers: {
          'Authorization': `OAuth ${pageAccessToken}`,
          'file_url': post.video_url!,
        },
      });
      const transferData = await transferRes.json().catch(() => ({}));
      console.log('social-publish-facebook reel transfer response:', transferRes.status, JSON.stringify(transferData));

      if (!transferRes.ok) {
        return new Response(
          JSON.stringify({ error: transferData.error?.message ?? 'Failed to upload Reel video to Facebook' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const finishRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/video_reels?` +
          new URLSearchParams({
            upload_phase: 'finish',
            video_id: videoId,
            video_state: 'PUBLISHED',
            description: post.caption,
            access_token: pageAccessToken,
          }),
        { method: 'POST' },
      );
      const finishData = await finishRes.json();
      console.log('social-publish-facebook reel finish response:', finishRes.status, JSON.stringify(finishData));

      if (!finishRes.ok || !finishData.success) {
        return new Response(
          JSON.stringify({ error: finishData.error?.message ?? 'Failed to publish Facebook Reel' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Reel processing continues asynchronously after 'finish' returns success — poll status
      // so we don't report a broken/unplayable Reel as published.
      const maxAttempts = 30;
      const pollIntervalMs = 3000;
      let reelReady = false;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const statusRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${videoId}?fields=status&access_token=${pageAccessToken}`,
        );
        const statusData = await statusRes.json();
        console.log('social-publish-facebook reel status poll:', attempt, JSON.stringify(statusData));

        const uploadingPhase = statusData.status?.video_status;
        if (uploadingPhase === 'ready') {
          reelReady = true;
          break;
        }
        if (uploadingPhase === 'error') {
          return new Response(
            JSON.stringify({ error: 'Facebook failed to process the Reel video' }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      if (!reelReady) {
        return new Response(
          JSON.stringify({ error: 'Facebook is still processing the Reel — try publishing again in a moment' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      platformPostId = videoId;
    }

    // Only the first leg (photo or Reel, whichever publishes first) sets these top-level
    // columns — mirrors social-publish-instagram so a second leg to the same post_id doesn't
    // clobber the first leg's platform_post_id/published_at.
    if (post.status !== 'published') {
      await service
        .from('social_posts')
        .update({
          status: 'published',
          platform_post_id: platformPostId,
          published_at: new Date().toISOString(),
        })
        .eq('id', post.id);
    }

    // A Reel and a photo from the same promotion are two independent Facebook posts —
    // tracked as separate social_post_targets rows ('facebook' vs 'facebook_reel').
    await service
      .from('social_post_targets')
      .upsert(
        {
          post_id: post.id,
          platform: use_video ? 'facebook_reel' : 'facebook',
          status: 'published',
          platform_post_id: platformPostId,
          published_at: new Date().toISOString(),
        },
        { onConflict: 'post_id,platform' },
      );

    return new Response(
      JSON.stringify({ published: true, platform_post_id: platformPostId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('social-publish-facebook error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
