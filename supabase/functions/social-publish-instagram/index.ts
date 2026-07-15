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

    // A photo and a Reel from the same promotion are published with two sequential calls
    // to this function — the first flips status from 'approved' to 'published', so the
    // second (the Reel leg) must still be allowed through rather than rejected as unapproved.
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
      return new Response(JSON.stringify({ error: 'Post has no image — Instagram requires media on every post' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: connection, error: connError } = await service
      .from('social_connections')
      .select('access_token, external_id, status')
      .eq('business_id', post.business_id)
      .eq('platform', 'instagram')
      .maybeSingle();

    if (connError || !connection || connection.status !== 'connected') {
      return new Response(JSON.stringify({ error: 'No connected Instagram account for this business' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { access_token: accessToken } = connection;

    // "me" resolves the account from the bearer token itself — the numeric Instagram User ID
    // shown in the Meta dashboard is not a directly-addressable graph node for the
    // Instagram-Login product (as opposed to the older Facebook-Page-linked flow).
    const igUserId = 'me';

    console.log('social-publish-instagram debug:', {
      igUserId,
      tokenLength: accessToken?.length,
      useVideo: !!use_video,
      mediaUrl: use_video ? post.video_url : post.image_url,
      graphVersion: GRAPH_API_VERSION,
    });

    // Step 1: create media container
    const containerRes = await fetch(
      `https://graph.instagram.com/${GRAPH_API_VERSION}/${igUserId}/media`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          use_video
            ? { media_type: 'REELS', video_url: post.video_url, caption: post.caption }
            : { image_url: post.image_url, caption: post.caption },
        ),
      },
    );
    const containerData = await containerRes.json();
    console.log('social-publish-instagram container response:', containerRes.status, JSON.stringify(containerData));

    if (!containerRes.ok || !containerData.id) {
      return new Response(
        JSON.stringify({ error: containerData.error?.message ?? 'Failed to create media container' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Instagram processes the uploaded media asynchronously — publishing immediately after
    // container creation races a "media not ready" error, so poll status_code until FINISHED.
    // Video (Reels) containers take meaningfully longer to process than images, hence the
    // longer poll budget on that path.
    const maxAttempts = use_video ? 30 : 15;
    const pollIntervalMs = use_video ? 3000 : 2000;
    let containerReady = false;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusRes = await fetch(
        `https://graph.instagram.com/${GRAPH_API_VERSION}/${containerData.id}?fields=status_code`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } },
      );
      const statusData = await statusRes.json();
      console.log('social-publish-instagram container status poll:', attempt, JSON.stringify(statusData));

      if (statusData.status_code === 'FINISHED') {
        containerReady = true;
        break;
      }
      if (statusData.status_code === 'ERROR' || statusData.status_code === 'EXPIRED') {
        return new Response(
          JSON.stringify({ error: `Instagram failed to process the media (${statusData.status_code})` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    if (!containerReady) {
      return new Response(
        JSON.stringify({ error: 'Instagram is still processing the media — try publishing again in a moment' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 2: publish the container
    const publishRes = await fetch(
      `https://graph.instagram.com/${GRAPH_API_VERSION}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creation_id: containerData.id,
        }),
      },
    );
    const publishData = await publishRes.json();
    console.log('social-publish-instagram publish response:', publishRes.status, JSON.stringify(publishData));

    if (!publishRes.ok || !publishData.id) {
      return new Response(
        JSON.stringify({ error: publishData.error?.message ?? 'Failed to publish media' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Only the first leg (photo or Reel, whichever publishes first) sets these top-level
    // columns — a second leg to the same post_id shouldn't clobber the first leg's
    // platform_post_id/published_at with its own. Per-artifact detail always lives in
    // social_post_targets below regardless of publish order.
    if (post.status !== 'published') {
      await service
        .from('social_posts')
        .update({
          status: 'published',
          platform_post_id: publishData.id,
          published_at: new Date().toISOString(),
        })
        .eq('id', post.id);
    }

    // A Reel and a photo from the same promotion are two independent Instagram posts —
    // tracked as separate social_post_targets rows ('instagram' vs 'instagram_reel') so
    // publishing both doesn't overwrite either one's platform_post_id. The 'instagram_reel'
    // row doesn't necessarily exist yet (it isn't part of the fixed platform checklist),
    // hence upsert rather than update.
    await service
      .from('social_post_targets')
      .upsert(
        {
          post_id: post.id,
          platform: use_video ? 'instagram_reel' : 'instagram',
          status: 'published',
          platform_post_id: publishData.id,
          published_at: new Date().toISOString(),
        },
        { onConflict: 'post_id,platform' },
      );

    return new Response(
      JSON.stringify({ published: true, platform_post_id: publishData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('social-publish-instagram error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
