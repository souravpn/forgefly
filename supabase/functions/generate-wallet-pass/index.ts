import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import forge from 'npm:node-forge@1.3.1';
import JSZip from 'npm:jszip@3.10.1';
import { zlibSync } from 'npm:fflate@0.8.2';

// Request body: { slug: string } for public visitor, or { business_id: string } for owner
// Returns: application/vnd.apple.pkpass binary

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const c = hex.replace('#', '').padEnd(6, '0');
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

function getLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Pure-JS solid-color PNG generator (no native deps)
function solidColorPng(width: number, height: number, r: number, g: number, b: number): Uint8Array {
  // Build raw unfiltered scanlines: [filter=0, r, g, b, ...] per row
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3);
    raw[row] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const px = row + 1 + x * 3;
      raw[px] = r; raw[px + 1] = g; raw[px + 2] = b;
    }
  }
  const idat = zlibSync(raw); // zlib-wrapped deflate (required by PNG spec)

  function crc32(data: Uint8Array): number {
    let c = 0xFFFFFFFF;
    for (const byte of data) {
      c ^= byte;
      for (let i = 0; i < 8; i++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type: string, data: Uint8Array): Uint8Array {
    const t = new TextEncoder().encode(type);
    const lenBuf = new ArrayBuffer(4);
    new DataView(lenBuf).setUint32(0, data.length);
    const crcIn = new Uint8Array(t.length + data.length);
    crcIn.set(t); crcIn.set(data, t.length);
    const crcBuf = new ArrayBuffer(4);
    new DataView(crcBuf).setUint32(0, crc32(crcIn));
    return new Uint8Array([...new Uint8Array(lenBuf), ...t, ...data, ...new Uint8Array(crcBuf)]);
  }

  const ihdrBuf = new ArrayBuffer(13);
  const v = new DataView(ihdrBuf);
  v.setUint32(0, width); v.setUint32(4, height);
  v.setUint8(8, 8); v.setUint8(9, 2); // 8-bit RGB, no alpha

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', new Uint8Array(ihdrBuf));
  const idatChunk = chunk('IDAT', idat);
  const iend = chunk('IEND', new Uint8Array(0));

  const out = new Uint8Array(sig.length + ihdr.length + idatChunk.length + iend.length);
  let off = 0;
  [sig, ihdr, idatChunk, iend].forEach(part => { out.set(part, off); off += part.length; });
  return out;
}

async function sha1Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function signManifest(
  manifestJson: string,
  p12Base64: string,
  passphrase: string,
  wwdrBase64: string,
): Uint8Array {
  // Parse P12 bundle → extract signing cert + private key
  const p12Der = forge.util.decode64(p12Base64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Der), passphrase);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const signerCert = certBags[forge.pki.oids.certBag]![0].cert!;
  const signerKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]![0].key!;

  // Parse WWDR cert — stored as base64-encoded PEM
  const wwdrPem = atob(wwdrBase64);
  const wwdrCert = forge.pki.certificateFromPem(wwdrPem);

  // Build detached PKCS#7 signature over manifest.json content
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestJson);
  p7.addCertificate(signerCert);
  p7.addCertificate(wwdrCert);
  p7.addSigner({
    key: signerKey,
    certificate: signerCert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: true });

  const derStr = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return Uint8Array.from(derStr, (c: string) => c.charCodeAt(0));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { slug, business_id } = body as { slug?: string; business_id?: string };

    if (!slug && !business_id) {
      return new Response(JSON.stringify({ error: 'slug or business_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client — this endpoint is public (visitor can call it by slug)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Resolve business
    let business: Record<string, unknown> | null = null;

    if (business_id) {
      const { data } = await supabase
        .from('businesses')
        .select('id, name, bio, slug, contact_email, contact_phone, extracted_data')
        .eq('id', business_id)
        .eq('status', 'active')
        .maybeSingle();
      business = data;
    } else {
      // Try businesses.slug first, then fall back to profiles.username
      const { data: bySlug } = await supabase
        .from('businesses')
        .select('id, name, bio, slug, contact_email, contact_phone, extracted_data')
        .eq('slug', slug!)
        .eq('status', 'active')
        .maybeSingle();

      if (bySlug) {
        business = bySlug;
      } else {
        const { data: profile } = await supabase
          .from('profiles').select('id').eq('username', slug!).maybeSingle();
        if (profile) {
          const { data } = await supabase
            .from('businesses')
            .select('id, name, bio, slug, contact_email, contact_phone, extracted_data')
            .eq('user_id', (profile as Record<string, unknown>).id)
            .eq('status', 'active')
            .maybeSingle();
          business = data;
        }
      }
    }

    if (!business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Apple Developer credentials
    const passTypeId = Deno.env.get('APPLE_PASS_TYPE_ID') ?? '';
    const teamId = Deno.env.get('APPLE_TEAM_ID') ?? '';
    const p12Base64 = Deno.env.get('APPLE_CERT_P12_BASE64') ?? '';
    const p12Passphrase = Deno.env.get('APPLE_CERT_P12_PASSPHRASE') ?? '';
    const wwdrBase64 = Deno.env.get('APPLE_WWDR_CERT_BASE64') ?? '';

    if (!passTypeId || !teamId || !p12Base64 || !wwdrBase64) {
      return new Response(JSON.stringify({ error: 'Apple Developer certs not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Brand values
    const extracted = business.extracted_data as Record<string, unknown> | null ?? {};
    const identity = (extracted.identity ?? {}) as Record<string, string>;
    const brand = (extracted.brand ?? {}) as Record<string, string>;
    const primaryHex = brand.primaryColor ?? '#10B981';
    const { r, g, b } = hexToRgb(primaryHex);
    const fgColor = getLuminance(r, g, b) > 0.5 ? 'rgb(0,0,0)' : 'rgb(255,255,255)';

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://www.forgefly.io';
    const resolvedSlug = (business.slug as string | null) ?? slug ?? '';
    const portfolioUrl = `${siteUrl}/p/${resolvedSlug}`;
    const bizName = identity.businessName ?? (business.name as string) ?? '';
    const tagline = identity.tagline ?? (business.bio as string | null) ?? '';

    // pass.json
    const passObj: Record<string, unknown> = {
      formatVersion: 1,
      passTypeIdentifier: passTypeId,
      serialNumber: business.id as string,
      teamIdentifier: teamId,
      organizationName: bizName,
      description: `${bizName} — Portfolio`,
      backgroundColor: `rgb(${r},${g},${b})`,
      foregroundColor: fgColor,
      labelColor: fgColor,
      logoText: bizName,
      generic: {
        primaryFields: [{ key: 'name', label: 'PORTFOLIO', value: bizName }],
        secondaryFields: tagline ? [{ key: 'tagline', label: 'ABOUT', value: tagline }] : [],
        auxiliaryFields: business.contact_email
          ? [{ key: 'email', label: 'EMAIL', value: business.contact_email as string }]
          : [],
        backFields: [
          { key: 'portfolio', label: 'Portfolio URL', value: portfolioUrl },
          ...(business.contact_phone
            ? [{ key: 'phone', label: 'Phone', value: business.contact_phone as string }]
            : []),
        ],
      },
      // barcodes (iOS 9+) and legacy barcode field
      barcodes: [{ message: portfolioUrl, format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1' }],
      barcode: { message: portfolioUrl, format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1' },
    };

    const passJsonBytes = new TextEncoder().encode(JSON.stringify(passObj, null, 2));

    // Generate brand-colored PNG images (icon must be 29×29, logo 160×50 max)
    const icon1x = solidColorPng(29, 29, r, g, b);
    const icon2x = solidColorPng(58, 58, r, g, b);
    const logo1x = solidColorPng(160, 50, r, g, b);
    const logo2x = solidColorPng(320, 100, r, g, b);

    // Build manifest (SHA1 of each file — required by Apple Pass Kit spec)
    const fileMap: Record<string, Uint8Array> = {
      'pass.json': passJsonBytes,
      'icon.png': icon1x,
      'icon@2x.png': icon2x,
      'logo.png': logo1x,
      'logo@2x.png': logo2x,
    };

    const manifest: Record<string, string> = {};
    for (const [name, data] of Object.entries(fileMap)) {
      manifest[name] = await sha1Hex(data);
    }
    const manifestJson = JSON.stringify(manifest);
    const manifestBytes = new TextEncoder().encode(manifestJson);

    // Sign manifest → PKCS#7 DER signature
    const signatureBytes = signManifest(manifestJson, p12Base64, p12Passphrase, wwdrBase64);

    // Bundle as ZIP (.pkpass is a ZIP)
    const zip = new JSZip();
    for (const [name, data] of Object.entries(fileMap)) zip.file(name, data);
    zip.file('manifest.json', manifestBytes);
    zip.file('signature', signatureBytes);

    const pkpassBytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });

    return new Response(pkpassBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="${resolvedSlug}.pkpass"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('generate-wallet-pass error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
