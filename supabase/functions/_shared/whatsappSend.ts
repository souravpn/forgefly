// Shared WhatsApp outbound-send helper used by every lifecycle notification
// (proposal approved, invoice paid, file shared) plus manual sends. Centralized
// here so the 24h session-vs-template branching and the "log every send into
// messages" behavior only need to be correct in one place.

// deno-lint-ignore no-explicit-any
type ServiceClient = any;

const GRAPH_API_VERSION = 'v21.0';
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

// Meta's default pre-approved sample template — swap for a real approved
// utility template before sending WhatsApp-initiated business messages widely.
const TEMPLATE_NAME = 'hello_world';
const TEMPLATE_LANGUAGE = 'en_US';

// Digits-only comparison so "+1 (555) 123-4567", "15551234567", and "5551234567"
// (missing country code) can still be matched against each other where possible.
export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

// Resolves the `contacts` row (messages.client_id's FK target) for a raw phone
// number, so outbound sends can attach to the same thread the inbound webhook
// uses — without this, client-facing notifications land as orphaned
// "Unknown number" threads even when the contact is known by other means
// (e.g. clients.id from an invoice, which is a different ID space entirely).
export async function resolveContactIdByPhone(
  service: ServiceClient,
  businessId: string,
  rawPhone: string | null | undefined,
): Promise<string | null> {
  if (!rawPhone) return null;
  const normalized = normalizePhone(rawPhone);
  if (!normalized) return null;

  const { data: contacts } = await service
    .from('contacts')
    .select('id, phone')
    .eq('business_id', businessId)
    .not('phone', 'is', null);

  const match = (contacts ?? []).find(
    (c: { id: string; phone: string | null }) => c.phone && normalizePhone(c.phone) === normalized,
  );
  return match?.id ?? null;
}

export async function sendWhatsapp(
  service: ServiceClient,
  params: { businessId: string; toPhone: string; bodyText: string; clientId?: string | null },
): Promise<{ sent: boolean; reason?: string }> {
  const { businessId, toPhone, bodyText, clientId } = params;
  if (!toPhone) return { sent: false, reason: 'No phone number' };

  const { data: connection } = await service
    .from('social_connections')
    .select('access_token, external_id, status')
    .eq('business_id', businessId)
    .eq('platform', 'whatsapp')
    .maybeSingle();

  if (!connection || connection.status !== 'connected') {
    return { sent: false, reason: 'WhatsApp not connected for this business' };
  }

  const { access_token: accessToken, external_id: phoneNumberId } = connection;

  // Session window: has this phone sent us an inbound message in the last 24h?
  const { data: lastInbound } = await service
    .from('messages')
    .select('created_at')
    .eq('business_id', businessId)
    .eq('wa_phone', toPhone)
    .eq('sender_role', 'client')
    .eq('channel', 'whatsapp')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const withinSession = lastInbound
    ? Date.now() - new Date(lastInbound.created_at).getTime() < SESSION_WINDOW_MS
    : false;

  const payload = withinSession
    ? { messaging_product: 'whatsapp', to: toPhone, type: 'text', text: { body: bodyText } }
    : {
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'template',
      template: { name: TEMPLATE_NAME, language: { code: TEMPLATE_LANGUAGE } },
    };

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  const data = await res.json();

  if (!res.ok) {
    console.error('sendWhatsapp failed:', JSON.stringify(data));
    return { sent: false, reason: data.error?.message ?? 'WhatsApp send failed' };
  }

  const { error: insertError } = await service.from('messages').insert({
    business_id: businessId,
    client_id: clientId ?? null,
    sender_role: 'freelancer',
    channel: 'whatsapp',
    wa_phone: toPhone,
    body: withinSession ? bodyText : `[Template sent] ${bodyText}`,
  });
  if (insertError) console.error('sendWhatsapp: failed to log message', insertError);

  return { sent: true };
}
