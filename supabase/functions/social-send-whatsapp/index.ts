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

// Utility-template-only, per the locked WhatsApp scope — no freeform marketing content.
// "hello_world" is Meta's default pre-approved sample template, used here purely to prove
// the outbound send pipeline; swap for a real approved utility template before wider use.
const TEMPLATE_NAME = 'hello_world';
const TEMPLATE_LANGUAGE = 'en_US';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { business_id, to_number } = await req.json() as {
      business_id?: string;
      to_number?: string;
    };

    if (!business_id || !to_number) {
      return new Response(JSON.stringify({ error: 'business_id and to_number required' }), {
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

    const { data: connection, error: connError } = await service
      .from('social_connections')
      .select('access_token, external_id, status')
      .eq('business_id', business_id)
      .eq('platform', 'whatsapp')
      .maybeSingle();

    if (connError || !connection || connection.status !== 'connected') {
      return new Response(JSON.stringify({ error: 'No connected WhatsApp account for this business' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { access_token: accessToken, external_id: phoneNumberId } = connection;

    const sendRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to_number,
          type: 'template',
          template: { name: TEMPLATE_NAME, language: { code: TEMPLATE_LANGUAGE } },
        }),
      },
    );
    const sendData = await sendRes.json();

    if (!sendRes.ok) {
      return new Response(
        JSON.stringify({ error: sendData.error?.message ?? 'Failed to send WhatsApp message' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ sent: true, message_id: sendData.messages?.[0]?.id ?? null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('social-send-whatsapp error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
