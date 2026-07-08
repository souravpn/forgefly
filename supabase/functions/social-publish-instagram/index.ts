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
    const { social_post_id } = await req.json() as { social_post_id?: string };
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
      .select('id, business_id, caption, image_url, status')
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

    if (post.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Post must be approved before publishing' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!post.image_url) {
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
      imageUrl: post.image_url,
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
        body: JSON.stringify({
          image_url: post.image_url,
          caption: post.caption,
        }),
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

    // Instagram processes the uploaded image asynchronously — publishing immediately after
    // container creation races a "media not ready" error, so poll status_code until FINISHED.
    let containerReady = false;
    for (let attempt = 0; attempt < 15; attempt++) {
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
          JSON.stringify({ error: `Instagram failed to process the image (${statusData.status_code})` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (!containerReady) {
      return new Response(
        JSON.stringify({ error: 'Instagram is still processing the image — try publishing again in a moment' }),
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

    await service
      .from('social_posts')
      .update({
        status: 'published',
        platform_post_id: publishData.id,
        published_at: new Date().toISOString(),
      })
      .eq('id', post.id);

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
