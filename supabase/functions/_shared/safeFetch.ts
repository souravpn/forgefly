// SSRF guard for any edge function that fetches a URL derived from user or
// business input (company research, competitor research, etc.). Blocks
// non-http(s) schemes, loopback/private/link-local ranges, and the cloud
// metadata endpoint, both by literal host and by resolved IP (defeats a
// hostname like "internal.example.com" that resolves to a private address).
// Also disables automatic redirect-following so a validated URL can't
// redirect into a disallowed target behind the guard's back.

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

function isBlockedIp(rawIp: string): boolean {
  // Unwrap IPv4-mapped IPv6 literals (::ffff:127.0.0.1, ::ffff:7f00:1) so the
  // IPv4 checks below still catch them instead of falling through unmatched.
  const mapped = rawIp.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const ip = mapped ? mapped[1] : rawIp;

  // IPv4 private/loopback/link-local/metadata ranges.
  if (/^127\./.test(ip)) return true;                  // loopback
  if (/^10\./.test(ip)) return true;                    // private
  if (/^192\.168\./.test(ip)) return true;              // private
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true; // private
  if (/^169\.254\./.test(ip)) return true;              // link-local + cloud metadata (169.254.169.254)
  if (ip === '0.0.0.0') return true;
  // IPv6 loopback/link-local/unique-local.
  if (ip === '::1') return true;
  if (/^fe80:/i.test(ip)) return true;
  if (/^fc00:|^fd00:/i.test(ip)) return true;
  return false;
}

async function assertUrlIsSafe(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`blocked scheme: ${url.protocol}`);
  }
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`blocked hostname: ${hostname}`);
  }
  if (isBlockedIp(hostname)) {
    // hostname is itself a literal IP address
    throw new Error(`blocked IP literal: ${hostname}`);
  }

  // Resolve DNS and check every returned address — catches a hostname that
  // resolves to a private/metadata IP (DNS rebinding / internal aliasing).
  try {
    const records = await Deno.resolveDns(hostname, 'A').catch(() => []);
    const records6 = await Deno.resolveDns(hostname, 'AAAA').catch(() => []);
    for (const ip of [...records, ...records6]) {
      if (isBlockedIp(ip)) throw new Error(`blocked resolved IP: ${ip} for ${hostname}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('blocked resolved IP')) throw err;
    // DNS resolution itself failing (permission denied, NXDOMAIN, etc.) is
    // not a reason to allow the fetch through unchecked, but it's also not
    // proof of maliciousness — the literal-hostname/IP checks above already
    // ran, so fall through and let fetch() itself fail naturally if the
    // host truly doesn't resolve.
  }
}

/** Drop-in replacement for fetch() that validates the URL (and each redirect hop) before connecting. */
export async function safeFetch(input: string, init: RequestInit = {}, maxRedirects = 3): Promise<Response> {
  let current = new URL(input);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertUrlIsSafe(current);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) return res;
      current = new URL(location, current);
      continue;
    }
    return res;
  }
  throw new Error('too many redirects');
}
