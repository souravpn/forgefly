import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const HAIKU = 'claude-haiku-4-5-20251001'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Nudge copy generator ────────────────────────────────────────────────────

async function generateNudgeCopy(
  type: string,
  context: Record<string, string>,
): Promise<{ title: string; body: string }> {
  if (!ANTHROPIC_API_KEY) {
    // Fallback copy without AI
    return FALLBACK_COPY[type]?.(context) ?? { title: 'Action needed', body: 'Review required.' }
  }

  const prompt = NUDGE_PROMPTS[type]?.(context) ?? `Generate a short nudge notification. Context: ${JSON.stringify(context)}`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: HAIKU,
        max_tokens: 120,
        temperature: 0.4,
        system: 'Generate a short in-app notification for a freelancer. Return ONLY a JSON object with "title" (max 8 words) and "body" (max 20 words). No markdown.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!resp.ok) throw new Error(`Anthropic ${resp.status}`)
    const data = await resp.json()
    const text = data.content[0].text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(text)
    return { title: parsed.title ?? 'Action needed', body: parsed.body ?? '' }
  } catch {
    return FALLBACK_COPY[type]?.(context) ?? { title: 'Action needed', body: '' }
  }
}

// ─── Prompt templates ────────────────────────────────────────────────────────

const NUDGE_PROMPTS: Record<string, (ctx: Record<string, string>) => string> = {
  overdue_invoice: (c) =>
    `Invoice for ${c.clientName} is overdue by ${c.daysOverdue} days ($${c.amount}). Write a gentle nudge to follow up.`,
  stale_lead: (c) =>
    `Pipeline lead "${c.leadName}" hasn't been updated in ${c.daysStale} days (stage: ${c.stage}). Write a nudge to re-engage.`,
  unsent_proposal: (c) =>
    `Proposal "${c.title}" has been sitting as a draft for ${c.daysSitting} days. Write a nudge to send it.`,
  new_request: (c) =>
    `${c.clientName} from ${c.company || 'unknown'} submitted a proposal request ${c.hoursAgo} hours ago. Write an urgent nudge.`,
  project_complete_insight: (c) =>
    `Freelancer just completed project "${c.name}" which took ${c.hours} hours at an effective rate of $${c.rate}/hr. ` +
    `Their last 3 completed projects averaged ${c.avgHours} hours and $${c.avgRate}/hr. ` +
    `Write a 2-sentence max insight comparing this project to their baseline. Be specific about the numbers. No fluff.`,
}

const FALLBACK_COPY: Record<string, (ctx: Record<string, string>) => { title: string; body: string }> = {
  overdue_invoice: (c) => ({
    title: `Invoice overdue: ${c.clientName}`,
    body: `$${c.amount} has been unpaid for ${c.daysOverdue} days. Send a reminder.`,
  }),
  stale_lead: (c) => ({
    title: `Stale lead: ${c.leadName}`,
    body: `No update in ${c.daysStale} days. Move it forward or close it.`,
  }),
  unsent_proposal: (c) => ({
    title: `Draft proposal waiting`,
    body: `"${c.title}" has been a draft for ${c.daysSitting} days. Ready to send?`,
  }),
  new_request: (c) => ({
    title: `New proposal request`,
    body: `${c.clientName} wants to work with you. Review now.`,
  }),
  project_complete_insight: (c) => ({
    title: `Project insight: ${c.name}`,
    body: `${c.hours} hrs · $${c.rate}/hr effective rate. Compare to your ${c.avgHours} hr avg.`,
  }),
}

// ─── Quarterly tax due dates ─────────────────────────────────────────────────

interface QuarterlyDate {
  label: string   // "Q1 2026"
  quarter: string // "Jan–Mar income"
  date: Date
}

function quarterlyDueDates(year: number): QuarterlyDate[] {
  return [
    { label: `Q1 ${year}`, quarter: 'Jan–Mar income', date: new Date(year, 3, 15) },   // Apr 15
    { label: `Q2 ${year}`, quarter: 'Apr–May income', date: new Date(year, 5, 15) },   // Jun 15
    { label: `Q3 ${year}`, quarter: 'Jun–Aug income', date: new Date(year, 8, 15) },   // Sep 15
    { label: `Q4 ${year}`, quarter: 'Sep–Dec income', date: new Date(year + 1, 0, 15) }, // Jan 15 next year
  ]
}

// ─── Nudge settings helpers ──────────────────────────────────────────────────

function isEnabled(settings: Record<string, boolean> | null, key: string): boolean {
  if (!settings) return true // default all on
  return settings[key] !== false
}

// ─── Main handler ────────────────────────────────────────────────────────────

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
    const nudgesCreated: string[] = []

    // Load all active businesses with their nudge settings
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, user_id, extracted_data')
      .eq('status', 'active')

    if (!businesses || businesses.length === 0) {
      return new Response(JSON.stringify({ nudges_created: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    for (const biz of businesses) {
      const settings: Record<string, boolean> | null =
        (biz.extracted_data as Record<string, unknown>)?.settings?.nudges as Record<string, boolean> | null ?? null
      const userId = biz.user_id as string
      const bizId = biz.id as string

      // ── 1. Overdue invoices ────────────────────────────────────────────────
      if (isEnabled(settings, 'overdue_invoice')) {
        const cutoff = new Date(now)
        cutoff.setDate(cutoff.getDate() - 3) // only trigger after 3 days overdue

        const { data: overdueInvoices } = await supabase
          .from('invoices')
          .select('id, invoice_number, amount, due_date, clients(name)')
          .eq('user_id', userId)
          .in('payment_status', ['unpaid', 'overdue'])
          .lt('due_date', cutoff.toISOString())

        for (const inv of overdueInvoices ?? []) {
          // Avoid duplicate nudges for the same invoice today
          const { count } = await supabase
            .from('nudges')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('type', 'overdue_invoice')
            .eq('action_url', `/dashboard/invoices`)
            .gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())

          if ((count ?? 0) > 0) continue

          const dueDate = new Date(inv.due_date as string)
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000)
          const clientName = (inv.clients as { name: string } | null)?.name ?? 'Client'
          const amount = String(inv.amount)

          const copy = await generateNudgeCopy('overdue_invoice', { clientName, daysOverdue: String(daysOverdue), amount })

          await supabase.from('nudges').insert({
            user_id: userId, business_id: bizId,
            type: 'overdue_invoice', title: copy.title, body: copy.body,
            action_url: '/dashboard/invoices',
          })
          nudgesCreated.push(`overdue_invoice:${inv.id}`)
        }
      }

      // ── 2. Stale pipeline leads ────────────────────────────────────────────
      if (isEnabled(settings, 'stale_lead')) {
        const staleCutoff = new Date(now)
        staleCutoff.setDate(staleCutoff.getDate() - 14)

        const { data: staleLeads } = await supabase
          .from('pipeline_leads')
          .select('id, stage, updated_at, contacts(name)')
          .eq('business_id', bizId)
          .neq('stage', 'Closed Won')
          .lt('updated_at', staleCutoff.toISOString())

        for (const lead of staleLeads ?? []) {
          // One stale-lead nudge per lead per week
          const { count } = await supabase
            .from('nudges')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('type', 'stale_lead')
            .like('body', `%${(lead.contacts as { name: string } | null)?.name ?? ''}%`)
            .gte('created_at', new Date(now.getTime() - 7 * 86400000).toISOString())

          if ((count ?? 0) > 0) continue

          const leadName = (lead.contacts as { name: string } | null)?.name ?? 'Lead'
          const updatedAt = new Date(lead.updated_at as string)
          const daysStale = Math.floor((now.getTime() - updatedAt.getTime()) / 86400000)

          const copy = await generateNudgeCopy('stale_lead', {
            leadName, daysStale: String(daysStale), stage: lead.stage as string,
          })

          await supabase.from('nudges').insert({
            user_id: userId, business_id: bizId,
            type: 'stale_lead', title: copy.title, body: copy.body,
            action_url: '/dashboard/pipeline',
          })
          nudgesCreated.push(`stale_lead:${lead.id}`)
        }
      }

      // ── 3. Unsent proposals (draft > 7 days) ──────────────────────────────
      if (isEnabled(settings, 'unsent_proposal')) {
        const proposalCutoff = new Date(now)
        proposalCutoff.setDate(proposalCutoff.getDate() - 7)

        const { data: draftProposals } = await supabase
          .from('proposals')
          .select('id, title, created_at')
          .eq('user_id', userId)
          .eq('status', 'draft')
          .lt('created_at', proposalCutoff.toISOString())

        for (const proposal of draftProposals ?? []) {
          const { count } = await supabase
            .from('nudges')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('type', 'unsent_proposal')
            .gte('created_at', new Date(now.getTime() - 7 * 86400000).toISOString())

          if ((count ?? 0) > 0) continue

          const createdAt = new Date(proposal.created_at as string)
          const daysSitting = Math.floor((now.getTime() - createdAt.getTime()) / 86400000)

          const copy = await generateNudgeCopy('unsent_proposal', {
            title: proposal.title as string,
            daysSitting: String(daysSitting),
          })

          await supabase.from('nudges').insert({
            user_id: userId, business_id: bizId,
            type: 'unsent_proposal', title: copy.title, body: copy.body,
            action_url: '/dashboard/proposals',
          })
          nudgesCreated.push(`unsent_proposal:${proposal.id}`)
        }
      }

      // ── 4. New proposal requests (not actioned in 24h) ────────────────────
      if (isEnabled(settings, 'new_request')) {

        const requestCutoff = new Date(now)
        requestCutoff.setHours(requestCutoff.getHours() - 24)

        const { data: newRequests } = await supabase
          .from('proposal_requests')
          .select('id, name, company, created_at')
          .eq('business_id', bizId)
          .eq('status', 'new')
          .lt('created_at', requestCutoff.toISOString())

        for (const req of newRequests ?? []) {
          const { count } = await supabase
            .from('nudges')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('type', 'new_request')
            .like('body', `%${req.name}%`)
            .gte('created_at', new Date(now.getTime() - 3 * 86400000).toISOString())

          if ((count ?? 0) > 0) continue

          const createdAt = new Date(req.created_at as string)
          const hoursAgo = Math.floor((now.getTime() - createdAt.getTime()) / 3600000)

          const copy = await generateNudgeCopy('new_request', {
            clientName: req.name as string,
            company: (req.company as string) ?? '',
            hoursAgo: String(hoursAgo),
          })

          await supabase.from('nudges').insert({
            user_id: userId, business_id: bizId,
            type: 'new_request', title: copy.title, body: copy.body,
            action_url: '/dashboard/requests',
          })
          nudgesCreated.push(`new_request:${req.id}`)
        }
      }

      // ── 5. Quarterly tax payment reminders ────────────────────────────────
      if (isEnabled(settings, 'quarterly_tax_reminder')) {
        const year = now.getFullYear()
        // Check current year's 4 quarters + Q4 of prior year (due Jan 15 this year)
        const allDates = [
          ...quarterlyDueDates(year - 1).filter(q => q.label === `Q4 ${year - 1}`),
          ...quarterlyDueDates(year),
        ]

        for (const q of allDates) {
          const daysUntil = Math.ceil((q.date.getTime() - now.getTime()) / 86400000)

          // Only fire at the three trigger windows
          const window =
            daysUntil >= 28 && daysUntil <= 30 ? '30d' :
            daysUntil >= 6  && daysUntil <= 8  ? '7d'  :
            daysUntil >= -1 && daysUntil <= 1  ? 'due' :
            null

          if (!window) continue

          // Dedup: one nudge per quarter per window within the last 5 days
          const dedupSince = new Date(now.getTime() - 5 * 86400000).toISOString()
          const { count: existingCount } = await supabase
            .from('nudges')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', bizId)
            .eq('type', 'quarterly_tax_reminder')
            .ilike('title', `%${q.label}%`)
            .gte('created_at', dedupSince)

          if ((existingCount ?? 0) > 0) continue

          const dueStr = q.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          let title: string
          let body: string

          if (window === '30d') {
            title = `${q.label} estimated tax due in 30 days`
            body = `${q.quarter} — payment due ${dueStr}. Review your estimate in Finances.`
          } else if (window === '7d') {
            title = `${q.label} estimated tax due in 7 days`
            body = `${q.quarter} — payment due ${dueStr}. Pay via IRS Direct Pay or EFTPS.`
          } else {
            title = `${q.label} estimated tax due today`
            body = `${q.quarter} — payment due ${dueStr}. Avoid underpayment penalties.`
          }

          await supabase.from('nudges').insert({
            user_id: userId, business_id: bizId,
            type: 'quarterly_tax_reminder',
            title,
            body,
            action_url: '/dashboard/finances?tab=tax',
          })
          nudgesCreated.push(`quarterly_tax_reminder:${q.label}:${window}`)
        }
      }

      // ── 6. Post-project AI insight (fires when project completed in last 24h, ≥3 baseline) ──
      if (isEnabled(settings, 'project_complete_insight')) {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

        const { data: recentlyCompleted } = await supabase
          .from('projects')
          .select('id, name, value')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .gte('updated_at', yesterday)

        for (const proj of recentlyCompleted ?? []) {
          // Dedup: one insight per project (ever)
          const { count: alreadyFired } = await supabase
            .from('nudges')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', bizId)
            .eq('type', 'project_complete_insight')
            .ilike('title', `%${proj.name}%`)

          if ((alreadyFired ?? 0) > 0) continue

          // Fetch time entries for this project
          const { data: projEntries } = await supabase
            .from('time_entries')
            .select('hours')
            .eq('project_id', proj.id)
            .eq('business_id', bizId)

          const thisHours = (projEntries ?? []).reduce((s: number, e: { hours: number }) => s + e.hours, 0)
          if (thisHours === 0) continue // no time logged — skip

          const thisRate = proj.value && thisHours > 0 ? Math.round(proj.value / thisHours) : null

          // Fetch last 3 completed projects (not this one) with time data
          const { data: pastProjects } = await supabase
            .from('projects')
            .select('id, value')
            .eq('user_id', userId)
            .eq('status', 'completed')
            .neq('id', proj.id)
            .order('updated_at', { ascending: false })
            .limit(3)

          if (!pastProjects || pastProjects.length < 3) continue // need ≥3 for baseline

          // Sum hours for each past project
          const pastData = await Promise.all(
            pastProjects.map(async (p: { id: string; value: number | null }) => {
              const { data: ents } = await supabase
                .from('time_entries')
                .select('hours')
                .eq('project_id', p.id)
                .eq('business_id', bizId)
              const h = (ents ?? []).reduce((s: number, e: { hours: number }) => s + e.hours, 0)
              const r = p.value && h > 0 ? p.value / h : null
              return { hours: h, rate: r }
            })
          )
          const withHours = pastData.filter(p => p.hours > 0)
          if (withHours.length === 0) continue

          const avgHours = Math.round(withHours.reduce((s, p) => s + p.hours, 0) / withHours.length)
          const ratesWithData = withHours.filter(p => p.rate != null)
          const avgRate = ratesWithData.length > 0
            ? Math.round(ratesWithData.reduce((s, p) => s + (p.rate ?? 0), 0) / ratesWithData.length)
            : null

          const copy = await generateNudgeCopy('project_complete_insight', {
            name: proj.name as string,
            hours: thisHours.toFixed(1),
            rate: String(thisRate ?? '?'),
            avgHours: String(avgHours),
            avgRate: String(avgRate ?? '?'),
          })

          await supabase.from('nudges').insert({
            user_id: userId, business_id: bizId,
            type: 'project_complete_insight',
            title: copy.title,
            body: copy.body,
            action_url: '/dashboard/projects',
          })
          nudgesCreated.push(`project_complete_insight:${proj.id}`)
        }
      }
    }

    console.log(`trigger-nudges: created ${nudgesCreated.length} nudges`, nudgesCreated)

    return new Response(
      JSON.stringify({ nudges_created: nudgesCreated.length, nudges: nudgesCreated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('trigger-nudges error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
