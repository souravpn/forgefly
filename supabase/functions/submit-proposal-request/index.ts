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

    // Insert proposal request
    const { data: request, error: insertErr } = await supabase
      .from('proposal_requests')
      .insert({
        business_id,
        name,
        company: company || null,
        email,
        service_name: service_name || null,
        problem: problem || null,
        timeline: timeline || null,
        budget_flexible: budget_flexible ?? false,
        notes: notes || null,
        status: 'new',
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    // Get freelancer info for the nudge + email
    const { data: business } = await supabase
      .from('businesses')
      .select('user_id, extracted_data')
      .eq('id', business_id)
      .single()

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
        action_url: '/dashboard/requests',
      })

      // Send email to freelancer
      if (profile?.email && RESEND_API_KEY) {
        const template = getNewRequestEmailTemplate({
          freelancerName: profile.username ?? 'there',
          clientName: name,
          clientCompany: company ?? '',
          serviceName: service_name ?? '',
          dashboardUrl: `${SITE_URL}/dashboard/requests`,
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
