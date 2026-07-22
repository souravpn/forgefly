// Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 over the raw,
// unparsed request body, keyed by the app secret) per Meta's webhook
// security requirements: https://developers.facebook.com/docs/messenger-platform/webhook#security
//
// Must be called with the raw body text BEFORE JSON.parse — HMAC is
// computed over the exact bytes Meta signed, not a re-serialized object.
export async function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader || !appSecret) return false;
  const [scheme, hexDigest] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !hexDigest) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computedHex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-time comparison to avoid timing side-channels.
  if (computedHex.length !== hexDigest.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) diff |= computedHex.charCodeAt(i) ^ hexDigest.charCodeAt(i);
  return diff === 0;
}
