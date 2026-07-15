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

async function exchangeInstagramToken(code: string, redirectUri: string) {
  // Instagram Login uses its own app ID/secret pair, distinct from the parent
  // Meta App ID used for Facebook Login (WhatsApp) — passing the Meta App ID
  // here fails with "Invalid platform app".
  const appId = Deno.env.get('INSTAGRAM_APP_ID') ?? '';
  const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET') ?? '';

  // Short-lived token — Instagram Login product uses api.instagram.com, not graph.facebook.com
  const shortLivedRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  });
  const shortLivedData = await shortLivedRes.json();
  if (!shortLivedRes.ok || !shortLivedData.access_token) {
    throw new Error(shortLivedData.error_message ?? 'Failed to exchange Instagram authorization code');
  }

  // Long-lived token exchange
  const longLivedRes = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortLivedData.access_token}`,
  );
  const longLivedData = await longLivedRes.json();
  if (!longLivedRes.ok || !longLivedData.access_token) {
    throw new Error(longLivedData.error?.message ?? 'Failed to obtain long-lived Instagram token');
  }

  // Fetch display info for the connected account
  const meRes = await fetch(
    `https://graph.instagram.com/${GRAPH_API_VERSION}/me?fields=user_id,username&access_token=${longLivedData.access_token}`,
  );
  const meData = await meRes.json();

  return {
    accessToken: longLivedData.access_token as string,
    externalId: (meData.user_id ?? shortLivedData.user_id ?? '').toString(),
    extra: { username: meData.username ?? null },
  };
}

async function exchangeWhatsappToken(code: string, redirectUri: string) {
  const appId = Deno.env.get('META_APP_ID') ?? '';
  const appSecret = Deno.env.get('META_APP_SECRET') ?? '';

  const shortLivedRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?` +
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }),
  );
  const shortLivedData = await shortLivedRes.json();
  if (!shortLivedRes.ok || !shortLivedData.access_token) {
    throw new Error(shortLivedData.error?.message ?? 'Failed to exchange WhatsApp authorization code');
  }

  const longLivedRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedData.access_token,
      }),
  );
  const longLivedData = await longLivedRes.json();
  if (!longLivedRes.ok || !longLivedData.access_token) {
    throw new Error(longLivedData.error?.message ?? 'Failed to obtain long-lived WhatsApp token');
  }
  const accessToken = longLivedData.access_token as string;

  // Avoid the `business_management` permission entirely (not granted on this app) —
  // the WABA ID granted during OAuth is readable directly off the token itself via
  // /debug_token's granular_scopes, which is Meta's documented approach for the
  // WhatsApp embedded-signup flow.
  const debugRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/debug_token?` +
      new URLSearchParams({
        input_token: accessToken,
        access_token: `${appId}|${appSecret}`,
      }),
  );
  const debugData = await debugRes.json();
  const granularScopes = debugData.data?.granular_scopes as
    { scope: string; target_ids?: string[] }[] | undefined;
  const wabaId = granularScopes
    ?.find(s => s.scope === 'whatsapp_business_management')
    ?.target_ids?.[0];
  if (!wabaId) {
    throw new Error('No WhatsApp Business Account was granted during authorization.');
  }

  const phoneRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/phone_numbers?access_token=${accessToken}`,
  );
  const phoneData = await phoneRes.json();
  const phoneNumber = phoneData.data?.[0];
  if (!phoneNumber?.id) {
    throw new Error('No phone number found on this WhatsApp Business Account.');
  }

  return {
    accessToken,
    externalId: phoneNumber.id as string,
    extra: { waba_id: wabaId, display_phone_number: phoneNumber.display_phone_number ?? null },
  };
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

/** Facebook Page publishing shares the WhatsApp/Facebook Login app (META_APP_ID/SECRET) —
 * just a different scope (pages_show_list etc.) on the same OAuth product, so the
 * short/long-lived token exchange is identical to exchangeWhatsappToken's first half. */
async function exchangeFacebookToken(
  code: string,
  redirectUri: string,
): Promise<
  | { needsSelection: true; pages: FacebookPage[] }
  | { needsSelection: false; accessToken: string; externalId: string; extra: { page_name: string } }
> {
  const appId = Deno.env.get('META_APP_ID') ?? '';
  const appSecret = Deno.env.get('META_APP_SECRET') ?? '';

  const shortLivedRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?` +
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }),
  );
  const shortLivedData = await shortLivedRes.json();
  if (!shortLivedRes.ok || !shortLivedData.access_token) {
    throw new Error(shortLivedData.error?.message ?? 'Failed to exchange Facebook authorization code');
  }

  const longLivedRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedData.access_token,
      }),
  );
  const longLivedData = await longLivedRes.json();
  if (!longLivedRes.ok || !longLivedData.access_token) {
    throw new Error(longLivedData.error?.message ?? 'Failed to obtain long-lived Facebook token');
  }
  const userAccessToken = longLivedData.access_token as string;

  // /me/accounts lists every Page this user administers (personal or Business-Manager-owned
  // alike — Page access is granted per person, not per account type) and conveniently already
  // includes each Page's own (effectively non-expiring) access token, so no further exchange
  // is needed once a Page is chosen.
  const accountsRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?access_token=${userAccessToken}`,
  );
  const accountsData = await accountsRes.json();
  if (!accountsRes.ok) {
    throw new Error(accountsData.error?.message ?? 'Failed to list Facebook Pages');
  }
  const pages = (accountsData.data ?? []) as FacebookPage[];
  if (pages.length === 0) {
    throw new Error('No Facebook Pages found for this account — you need to be an admin of a Page to connect it.');
  }

  if (pages.length === 1) {
    return {
      needsSelection: false,
      accessToken: pages[0].access_token,
      externalId: pages[0].id,
      extra: { page_name: pages[0].name },
    };
  }
  return { needsSelection: true, pages };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { platform, code, business_id, redirect_uri } = await req.json() as {
      platform?: 'instagram' | 'whatsapp' | 'facebook';
      code?: string;
      business_id?: string;
      redirect_uri?: string;
    };

    if (!platform || !code || !business_id || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: 'platform, code, business_id, and redirect_uri are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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

    const service = getServiceClient();

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

    if (platform === 'facebook') {
      const result = await exchangeFacebookToken(code, redirect_uri);

      if (result.needsSelection) {
        // Multiple Pages: don't finalize a connection yet. Page access tokens are stashed
        // in the access_token column (as JSON) rather than `extra` — get-social-status only
        // ever selects `extra`, so this keeps every Page's token out of client reach until
        // social-facebook-select-page (service-role only) resolves the chosen one.
        const { error: upsertError } = await service
          .from('social_connections')
          .upsert({
            business_id,
            platform,
            access_token: JSON.stringify(result.pages),
            external_id: '',
            extra: { pages: result.pages.map((p) => ({ id: p.id, name: p.name })) },
            status: 'pending_page_selection',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'business_id,platform' });
        if (upsertError) throw upsertError;

        return new Response(
          JSON.stringify({
            connected: false,
            needsSelection: true,
            pages: result.pages.map((p) => ({ id: p.id, name: p.name })),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { error: upsertError } = await service
        .from('social_connections')
        .upsert({
          business_id,
          platform,
          access_token: result.accessToken,
          external_id: result.externalId,
          extra: result.extra,
          status: 'connected',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'business_id,platform' });
      if (upsertError) throw upsertError;

      return new Response(JSON.stringify({ connected: true, extra: result.extra }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = platform === 'instagram'
      ? await exchangeInstagramToken(code, redirect_uri)
      : await exchangeWhatsappToken(code, redirect_uri);

    const { error: upsertError } = await service
      .from('social_connections')
      .upsert({
        business_id,
        platform,
        access_token: result.accessToken,
        external_id: result.externalId,
        extra: result.extra,
        status: 'connected',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'business_id,platform' });

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ connected: true, extra: result.extra }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('social-oauth-callback error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
