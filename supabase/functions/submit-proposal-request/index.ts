import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getNewRequestEmailTemplate } from '../_shared/email-templates.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const RESEND_API_URL = 'https://api.resend.com/emails'
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://www.forgefly.io'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json()
    const { business_id, name, company, email, service_name, problem, timeline, budget_flexible, notes } = body

    if (!business_id || !name || !email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get freelancer info first — needed for user_id (RLS) and nudge/email
    const { data: business } = await supabase
      .from('businesses')
      .select('user_id, extracted_data')
      .eq('id', business_id)
      .single()

    if (!business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const proposalTitle = service_name ? `${service_name} request` : 'Proposal request'

    // ── Look up (or create) the client record for FK link ─────────────────────
    // Every proposal — client- or freelancer-initiated — should have a real
    // `clients` row, so a brand-new lead actually shows up in the Clients list.
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', business.user_id)
      .eq('email', email)
      .maybeSingle()

    let clientId: string | null = existingClient?.id ?? null
    if (!clientId) {
      const { data: newClient } = await supabase
        .from('clients')
        .insert({
          user_id: business.user_id,
          name,
          email,
          company: company || null,
          status: 'prospect',
          total_value: 0,
          last_interaction: new Date().toISOString(),
        })
        .select('id')
        .single()
      clientId = newClient?.id ?? null
    }

    // Insert directly into proposals with initiated_by='client'
    const { data: request, error: insertErr } = await supabase
      .from('proposals')
      .insert({
        business_id,
        user_id: business.user_id,
        client_id: clientId,
        client_name: name,
        client_email: email,
        title: proposalTitle,
        initiated_by: 'client',
        status: 'draft',
        request_context: {
          company: company || null,
          service_name: service_name || null,
          problem: problem || null,
          timeline: timeline || null,
          budget_flexible: budget_flexible ?? false,
          notes: notes || null,
        },
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    // ── Upsert contact + pipeline card ────────────────────────────────────────
    let contactId: string | null = null

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, lifecycle_status')
      .eq('business_id', business_id)
      .eq('email', email)
      .maybeSingle()

    if (existingContact) {
      contactId = existingContact.id
      // Returning client: reset archived or engaged → prospect (re-engaging)
      if (existingContact.lifecycle_status === 'archived' || existingContact.lifecycle_status === 'engaged') {
        await supabase
          .from('contacts')
          .update({ lifecycle_status: 'prospect' })
          .eq('id', existingContact.id)
      }
    } else {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          business_id,
          name,
          email,
          company: company || null,
          lifecycle_status: 'prospect',
        })
        .select('id')
        .single()
      contactId = newContact?.id ?? null
    }

    // Create pipeline lead at Prospect if no active lead already exists
    if (contactId) {
      const { data: existingLead } = await supabase
        .from('pipeline_leads')
        .select('id')
        .eq('business_id', business_id)
        .eq('contact_id', contactId)
        .not('stage', 'in', '("Closed Won","Lost")')
        .maybeSingle()

      if (!existingLead) {
        await supabase.from('pipeline_leads').insert({
          business_id,
          contact_id: contactId,
          stage: 'Prospect',
          service_name: service_name || null,
          source: 'portal_request',
        })
      }
    }

    if (business) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, email')
        .eq('id', business.user_id)
        .single()

      // Insert nudge
      await supabase.from('nudges').insert({
        user_id: business.user_id,
        business_id,
        type: 'new_request',
        title: 'New proposal request',
        body: `${name}${company ? ` from ${company}` : ''} wants to work with you${service_name ? ` on ${service_name}` : ''}.`,
        action_url: '/dashboard/proposals',
      })

      // Send email to freelancer
      if (profile?.email && RESEND_API_KEY) {
        const template = getNewRequestEmailTemplate({
          freelancerName: profile.username ?? 'there',
          clientName: name,
          clientCompany: company ?? '',
          serviceName: service_name ?? '',
          dashboardUrl: `${SITE_URL}/dashboard/proposals`,
        })

        await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Forgefly <hello@forgefly.io>',
            to: [profile.email],
            subject: template.subject,
            html: template.html,
          }),
        })
      }
    }

    return new Response(JSON.stringify({ success: true, id: request.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('submit-proposal-request error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
