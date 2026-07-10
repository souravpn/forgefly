import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendWhatsapp } from '../_shared/whatsappSend.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { contact_id, file_name } = await req.json() as {
      contact_id?: string;
      file_name?: string;
    };
    if (!contact_id || !file_name) {
      return new Response(JSON.stringify({ error: 'contact_id and file_name are required' }), {
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

    const { data: contact } = await service
      .from('contacts')
      .select('id, name, phone, business_id')
      .eq('id', contact_id)
      .maybeSingle();
    if (!contact) {
      return new Response(JSON.stringify({ error: 'Contact not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: business } = await service
      .from('businesses')
      .select('id, name, user_id, contact_phone')
      .eq('id', contact.business_id)
      .maybeSingle();

    if (!business || business.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (business.contact_phone) {
      await sendWhatsapp(service, {
        businessId: business.id,
        toPhone: business.contact_phone,
        bodyText: `You shared "${file_name}" with ${contact.name}.`,
      });
    }
    if (contact.phone) {
      await sendWhatsapp(service, {
        businessId: business.id,
        toPhone: contact.phone,
        bodyText: `${business.name} shared a new file with you: "${file_name}". Check your portal to view it.`,
      });
    }

    return new Response(JSON.stringify({ notified: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-portal-file-shared error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
