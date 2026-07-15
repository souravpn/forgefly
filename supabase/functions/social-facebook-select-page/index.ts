import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StoredPage {
  id: string;
  name: string;
  access_token: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { business_id, page_id } = await req.json() as { business_id?: string; page_id?: string };
    if (!business_id || !page_id) {
      return new Response(JSON.stringify({ error: 'business_id and page_id are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const service = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: business } = await service
      .from('businesses')
      .select('id, user_id')
      .eq('id', business_id)
      .maybeSingle();

    if (!business || business.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: connection, error: connError } = await service
      .from('social_connections')
      .select('access_token, status')
      .eq('business_id', business_id)
      .eq('platform', 'facebook')
      .maybeSingle();

    if (connError || !connection || connection.status !== 'pending_page_selection') {
      return new Response(JSON.stringify({ error: 'No pending Facebook Page selection for this business' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The full list of Pages (each with its own access token) from the OAuth callback was
    // stashed in access_token as JSON rather than `extra` — see social-oauth-callback — so it
    // never round-trips through get-social-status, which only ever selects `extra`.
    let pages: StoredPage[];
    try {
      pages = JSON.parse(connection.access_token);
    } catch {
      return new Response(JSON.stringify({ error: 'Stored Page list was corrupted — reconnect Facebook' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const page = pages.find((p) => p.id === page_id);
    if (!page) {
      return new Response(JSON.stringify({ error: 'Selected Page was not found in this authorization' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: upsertError } = await service
      .from('social_connections')
      .update({
        access_token: page.access_token,
        external_id: page.id,
        extra: { page_name: page.name },
        status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('business_id', business_id)
      .eq('platform', 'facebook');

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ connected: true, extra: { page_name: page.name } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('social-facebook-select-page error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
