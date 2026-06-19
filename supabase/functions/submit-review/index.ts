import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getReviewReceivedEmailTemplate } from '../_shared/email-templates.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REVIEW_JWT_SECRET = Deno.env.get('REVIEW_JWT_SECRET')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://www.forgefly.io';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── JWT verification ──────────────────────────────────────────────────────────

interface ReviewTokenPayload {
  review_request_id: string;
  business_id: string;
  client_id: string;
  client_name: string;
  exp: number;
}

async function verifyJwt(token: string): Promise<ReviewTokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(REVIEW_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const sigBytes = Uint8Array.from(
      atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );

    if (!valid) return null;

    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')),
    ) as ReviewTokenPayload;

    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

// ── Email helper ──────────────────────────────────────────────────────────────

async function notifyFreelancer(opts: {
  toEmail: string;
  freelancerName: string;
  clientName: string;
  rating: number;
  comment?: string | null;
}) {
  const { subject, html } = getReviewReceivedEmailTemplate({
    freelancerName: opts.freelancerName,
    clientName: opts.clientName,
    rating: opts.rating,
    comment: opts.comment,
    dashboardUrl: `${SITE_URL}/dashboard/reviews`,
  });

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Forgefly <hello@forgefly.io>',
      to: opts.toEmail,
      subject,
      html,
    }),
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, rating, comment, client_name } = await req.json();

    if (!token) return fail('Missing token');
    if (!rating || rating < 1 || rating > 5) return fail('Rating must be 1–5');

    // Verify JWT
    const payload = await verifyJwt(token);
    if (!payload) return fail('Invalid or expired review link', 401);

    const { review_request_id, business_id, client_id, client_name: tokenName } = payload;

    // Check review request is still open
    const { data: rr } = await supabase
      .from('review_requests')
      .select('id, status, review_id')
      .eq('id', review_request_id)
      .maybeSingle();

    if (!rr) return fail('Review request not found', 404);
    if (rr.review_id) return fail('Review already submitted', 409);

    const displayName: string = (client_name ?? tokenName ?? 'Client').trim();

    // Insert the review
    const { data: review, error: reviewErr } = await supabase
      .from('reviews')
      .insert({
        business_id,
        client_id,
        invoice_id: null,
        client_name: displayName,
        rating,
        comment: comment?.trim() || null,
        is_verified: true,
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (reviewErr || !review) {
      console.error('Failed to insert review:', reviewErr);
      return fail('Failed to save review', 500);
    }

    // Mark review request completed
    await supabase
      .from('review_requests')
      .update({
        review_id: review.id,
        status: 'completed',
      })
      .eq('id', review_request_id);

    // Fetch business info for notification
    const { data: biz } = await supabase
      .from('businesses')
      .select('name, contact_email, extracted_data')
      .eq('id', business_id)
      .maybeSingle();

    // Fire-and-forget: notify freelancer via email
    if (biz?.contact_email) {
      notifyFreelancer({
        toEmail: biz.contact_email,
        freelancerName: biz.name,
        clientName: displayName,
        rating,
        comment,
      }).catch((err) => console.error('Notify freelancer failed:', err));
    }

    // Fire-and-forget: select portal testimonials (#79 — EF to be deployed)
    supabase.functions.invoke('select-portal-testimonials', {
      body: { business_id },
    }).catch(() => {});

    return ok({ ok: true, review_id: review.id });
  } catch (err) {
    console.error('submit-review error:', err);
    return fail(String(err), 500);
  }
});
