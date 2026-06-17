import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getDailyDigestEmailTemplate } from '../_shared/email-templates.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const RESEND_API_URL = 'https://api.resend.com/emails'
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://www.forgefly.io'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Returns the current hour (0-23) in the given IANA timezone.
function localHour(date: Date, timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    })
    const h = parseInt(fmt.format(date), 10)
    // Intl uses 24 for midnight in some locales; normalise to 0
    return h === 24 ? 0 : h
  } catch {
    return date.getUTCHours()
  }
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

    const now = new Date()
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const cutoff4h  = new Date(now.getTime() -  4 * 60 * 60 * 1000)

    const sent: string[] = []
    const skipped: string[] = []

    // Load all active businesses
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, user_id, extracted_data')
      .eq('status', 'active')

    if (!businesses?.length) {
      return new Response(JSON.stringify({ sent: 0, skipped: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    for (const biz of businesses) {
      const userId  = biz.user_id as string
      const bizId   = biz.id as string
      const extData = (biz.extracted_data ?? {}) as Record<string, unknown>
      const timezone = (extData.timezone as string | undefined) ?? 'UTC'

      // Only fire for businesses where it is currently 8am local time
      if (localHour(now, timezone) !== 8) {
        skipped.push(bizId)
        continue
      }

      // Skip if the freelancer was active in the last 4 hours
      const { data: authData } = await supabase.auth.admin.getUserById(userId)
      const lastSignIn = authData?.user?.last_sign_in_at
      if (lastSignIn && new Date(lastSignIn) > cutoff4h) {
        skipped.push(bizId)
        continue
      }

      // Collect unread nudges from the last 24h
      const { data: nudges } = await supabase
        .from('nudges')
        .select('title, body, type, action_url')
        .eq('business_id', bizId)
        .eq('read', false)
        .gte('created_at', cutoff24h.toISOString())
        .order('created_at', { ascending: false })

      if (!nudges?.length) {
        skipped.push(bizId)
        continue
      }

      // Get freelancer profile (email + display name)
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, email')
        .eq('id', userId)
        .single()

      if (!profile?.email || !RESEND_API_KEY) {
        skipped.push(bizId)
        continue
      }

      // Guard: don't send a second digest today (e.g. if cron misfires)
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const { data: alreadySent } = await supabase
        .from('nudges')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', bizId)
        .eq('type', 'daily_digest_sent')
        .gte('created_at', todayStart.toISOString())

      if ((alreadySent as unknown as { count: number } | null)?.count ?? 0 > 0) {
        skipped.push(bizId)
        continue
      }

      // Build and send the digest email
      const template = getDailyDigestEmailTemplate({
        username: profile.username ?? 'there',
        nudges: nudges.map((n) => ({
          title:     n.title as string,
          body:      n.body as string,
          type:      n.type as string,
          actionUrl: n.action_url as string | null,
        })),
        dashboardUrl: `${SITE_URL}/dashboard`,
      })

      const emailRes = await fetch(RESEND_API_URL, {
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

      if (!emailRes.ok) {
        console.error(`send-daily-digest: Resend error for ${bizId}`, await emailRes.text())
        skipped.push(bizId)
        continue
      }

      // Record a sentinel nudge so the dedup guard above fires on re-runs today
      await supabase.from('nudges').insert({
        user_id:     userId,
        business_id: bizId,
        type:        'daily_digest_sent',
        title:       'Daily digest sent',
        body:        `Sent digest with ${nudges.length} item${nudges.length === 1 ? '' : 's'}.`,
        read:        true,
      })

      sent.push(bizId)
      console.log(`send-daily-digest: sent to ${profile.email} (${nudges.length} nudges)`)
    }

    return new Response(
      JSON.stringify({ sent: sent.length, skipped: skipped.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('send-daily-digest error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
