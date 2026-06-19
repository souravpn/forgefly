import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Only act on UPDATE events where payment_status flips to 'paid'
    if (payload.type !== 'UPDATE') return ok({ skipped: 'not an update' });

    const record = payload.record;
    const oldRecord = payload.old_record;

    if (record.payment_status !== 'paid') return ok({ skipped: 'not paid' });
    if (oldRecord?.payment_status === 'paid') return ok({ skipped: 'already was paid' });

    const invoiceId: string = record.id;
    const userId: string = record.user_id;
    const clientId: string | null = record.client_id;

    if (!clientId) return ok({ skipped: 'no client_id on invoice' });

    // Get the active business for this user
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (bizErr || !business) return ok({ skipped: 'no active business found' });

    // Get client name + email from the legacy clients table
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('name, email')
      .eq('id', clientId)
      .maybeSingle();

    if (clientErr || !client || !client.email) {
      return ok({ skipped: 'client not found or has no email' });
    }

    // Resolve or create a contacts row — review_requests.client_id references contacts
    let contactId: string;

    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('business_id', business.id)
      .eq('email', client.email)
      .maybeSingle();

    if (existing) {
      contactId = existing.id;
    } else {
      const { data: newContact, error: createErr } = await supabase
        .from('contacts')
        .insert({
          business_id: business.id,
          name: client.name,
          email: client.email,
          status: 'Active client',
        })
        .select('id')
        .single();

      if (createErr || !newContact) {
        console.error('Failed to create contact:', createErr);
        return ok({ skipped: 'failed to resolve contact' });
      }
      contactId = newContact.id;
    }

    // scheduled_for = 7 days from when the invoice was paid
    const baseTime = record.paid_at ? new Date(record.paid_at) : new Date();
    const scheduledFor = new Date(
      baseTime.getTime() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Upsert — UNIQUE on invoice_id prevents duplicate requests
    const { error: upsertErr } = await supabase
      .from('review_requests')
      .upsert(
        {
          business_id: business.id,
          client_id: contactId,
          invoice_id: invoiceId,
          scheduled_for: scheduledFor,
          status: 'pending',
        },
        { onConflict: 'invoice_id', ignoreDuplicates: true },
      );

    if (upsertErr) {
      console.error('Failed to upsert review_request:', upsertErr);
      return new Response(
        JSON.stringify({ error: 'DB upsert failed', details: upsertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Review request scheduled: invoice=${invoiceId} contact=${contactId} for=${scheduledFor}`);

    return ok({
      ok: true,
      invoiceId,
      businessId: business.id,
      contactId,
      scheduledFor,
    });
  } catch (err) {
    console.error('schedule-review-request error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
