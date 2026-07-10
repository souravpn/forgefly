import { createClient } from 'jsr:@supabase/supabase-js@2';

// No JWT verification — Meta calls this directly with no user auth context.
// Deploy with: supabase functions deploy whatsapp-webhook --no-verify-jwt

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

// Normalize to digits-only so "+1 (555) 123-4567" and "15551234567" compare equal.
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && token && expected && token === expected) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    const service = getServiceClient();

    const entries = payload.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const { data: connection } = await service
          .from('social_connections')
          .select('business_id')
          .eq('platform', 'whatsapp')
          .eq('external_id', phoneNumberId)
          .maybeSingle();

        if (!connection) {
          console.error('whatsapp-webhook: no business connected for phone_number_id', phoneNumberId);
          continue;
        }
        const businessId = connection.business_id;

        for (const message of value.messages ?? []) {
          const from = message.from as string | undefined;
          const body = message.text?.body ?? `[${message.type} message]`;
          if (!from) continue;

          const normalizedFrom = normalizePhone(from);

          // Business phone numbers are stored inconsistently (with/without formatting),
          // so match by comparing normalized digits rather than an exact string.
          const { data: contacts } = await service
            .from('contacts')
            .select('id, phone')
            .eq('business_id', businessId)
            .not('phone', 'is', null);

          const matchedContact = (contacts ?? []).find(
            (c: { id: string; phone: string | null }) => c.phone && normalizePhone(c.phone) === normalizedFrom,
          );

          await service.from('messages').insert({
            business_id: businessId,
            client_id: matchedContact?.id ?? null,
            sender_role: 'client',
            channel: 'whatsapp',
            wa_phone: from,
            body,
          });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('whatsapp-webhook error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
