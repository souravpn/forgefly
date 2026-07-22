import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifyMetaSignature } from '../_shared/verifyMetaSignature.ts';

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
    // Verify this really came from Meta before trusting any of it — HMAC
    // must run over the raw body, so read text first and parse JSON after.
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    const appSecret = Deno.env.get('META_APP_SECRET') ?? '';
    if (!(await verifyMetaSignature(rawBody, signature, appSecret))) {
      console.error('whatsapp-webhook: invalid or missing X-Hub-Signature-256');
      return new Response('Forbidden', { status: 403 });
    }

    const payload = JSON.parse(rawBody);
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

          let matchedContact = (contacts ?? []).find(
            (c: { id: string; phone: string | null }) => c.phone && normalizePhone(c.phone) === normalizedFrom,
          );

          // First message ever from this number — auto-create a Prospect lead
          // instead of leaving it as an orphaned "Unknown number" thread.
          if (!matchedContact) {
            const { data: newContact, error: contactError } = await service
              .from('contacts')
              .insert({
                business_id: businessId,
                name: from,
                phone: from,
                lifecycle_status: 'prospect',
              })
              .select('id, phone')
              .single();

            if (contactError) {
              console.error('whatsapp-webhook: failed to auto-create contact', contactError);
            } else {
              matchedContact = newContact;
              const { error: leadError } = await service.from('pipeline_leads').insert({
                business_id: businessId,
                contact_id: newContact.id,
                stage: 'Prospect',
                service_name: 'via WhatsApp',
              });
              if (leadError) console.error('whatsapp-webhook: failed to auto-create lead', leadError);
            }
          }

          const { error: insertError } = await service.from('messages').insert({
            business_id: businessId,
            client_id: matchedContact?.id ?? null,
            sender_role: 'client',
            channel: 'whatsapp',
            wa_phone: from,
            body,
          });
          if (insertError) console.error('whatsapp-webhook: failed to insert message', insertError);
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
