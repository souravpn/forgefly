import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getReviewRequestEmailTemplate } from '../_shared/email-templates.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const REVIEW_JWT_SECRET = Deno.env.get('REVIEW_JWT_SECRET')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://www.forgefly.io';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── JWT helpers (Web Crypto — no external deps) ───────────────────────────────

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(REVIEW_JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = b64url(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`)),
  );
  return `${header}.${body}.${sig}`;
}

// ── Email sender ──────────────────────────────────────────────────────────────

async function sendEmail(opts: {
  to: string;
  replyTo: string;
  subject: string;
  html: string;
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Forgefly <hello@forgefly.io>',
      to: opts.to,
      reply_to: opts.replyTo || undefined,
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch all pending review requests that are due
    const { data: pending, error: fetchErr } = await supabase
      .from('review_requests')
      .select(`
        id,
        business_id,
        client_id,
        invoice_id,
        contacts:client_id ( name, email ),
        businesses:business_id ( name, contact_email, extracted_data )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .is('review_id', null);

    if (fetchErr) throw fetchErr;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    let skipped = 0;

    for (const rr of pending) {
      const contact = rr.contacts as { name: string; email: string } | null;
      const biz = rr.businesses as {
        name: string;
        contact_email: string | null;
        extracted_data: { brand?: { primaryColor?: string } };
      } | null;

      if (!contact?.email || !biz) {
        skipped++;
        continue;
      }

      try {
        // Sign a 30-day JWT for this review request
        const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
        const token = await signJwt({
          review_request_id: rr.id,
          business_id: rr.business_id,
          client_id: rr.client_id,
          client_name: contact.name,
          exp,
        });

        const reviewUrl = `${SITE_URL}/review/${token}`;
        const primaryColor = biz.extracted_data?.brand?.primaryColor ?? '#10B981';

        const { subject, html } = getReviewRequestEmailTemplate({
          clientName: contact.name,
          businessName: biz.name,
          primaryColor,
          reviewUrl,
          replyTo: biz.contact_email ?? '',
        });

        await sendEmail({
          to: contact.email,
          replyTo: biz.contact_email ?? '',
          subject,
          html,
        });

        // Mark as sent
        await supabase
          .from('review_requests')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', rr.id);

        sent++;
      } catch (err) {
        console.error(`Failed to send review request ${rr.id}:`, err);
        skipped++;
      }
    }

    console.log(`send-review-requests: sent=${sent} skipped=${skipped}`);

    return new Response(JSON.stringify({ ok: true, sent, skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-review-requests error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
