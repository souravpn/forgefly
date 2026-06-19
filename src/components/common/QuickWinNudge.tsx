import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/db/supabase'

interface Nudge {
  title: string
  description: string
  action: string | null
  route: string | null
}

interface NudgeContext {
  business_name: string
  account_age_days: number
  received_this_month_usd: number
  outstanding_usd: number
  overdue_usd: number
  pipeline_lead_count: number
  proposals_sent_this_month: number
  days_since_last_proposal: number | null
  portfolio_shared: boolean
}

const CACHE_PREFIX = 'qw_nudge_'

function todayKey() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function cacheKey(businessId: string) {
  return `${CACHE_PREFIX}${businessId}_${todayKey()}`
}

function readCache(businessId: string): Nudge | null {
  try {
    const raw = localStorage.getItem(cacheKey(businessId))
    return raw ? (JSON.parse(raw) as Nudge) : null
  } catch {
    return null
  }
}

function writeCache(businessId: string, nudge: Nudge) {
  try {
    localStorage.setItem(cacheKey(businessId), JSON.stringify(nudge))
  } catch {}
}

interface Props {
  businessId: string
  context: NudgeContext
}

export function QuickWinNudge({ businessId, context }: Props) {
  const navigate = useNavigate()
  const [nudge, setNudge] = useState<Nudge | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const cached = readCache(businessId)
    if (cached) {
      setNudge(cached)
      setLoading(false)
      return
    }

    // Build context payload
    const ctx: Record<string, string | number | boolean> = {
      business_name: context.business_name,
      account_age_days: context.account_age_days,
      received_this_month: `$${Math.round(context.received_this_month_usd)}`,
      outstanding_invoices: `$${Math.round(context.outstanding_usd)}`,
      overdue_invoices: `$${Math.round(context.overdue_usd)}`,
      pipeline_leads: context.pipeline_lead_count,
      proposals_sent_this_month: context.proposals_sent_this_month,
      portfolio_shared: context.portfolio_shared,
    }
    if (context.days_since_last_proposal !== null) {
      ctx.days_since_last_proposal = context.days_since_last_proposal
    }

    supabase.functions
      .invoke('ai-gateway', { body: { mode: 'nudge', context: ctx } })
      .then(({ data }) => {
        const n = data?.nudge as Nudge | undefined
        if (n?.title) {
          writeCache(businessId, n)
          setNudge(n)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [businessId])

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    )
  }

  if (!nudge) return null

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold leading-snug">{nudge.title}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{nudge.description}</p>
        </div>
      </div>
      {nudge.action && nudge.route && (
        <Button size="sm" className="text-xs w-full" onClick={() => navigate(nudge.route!)}>
          {nudge.action}
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      )}
    </div>
  )
}
