import { ArrowRight, Check, ListChecks, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBusiness } from '@/contexts/CurrentBusinessContext'
import { supabase } from '@/db/supabase'
import type { OnboardingMilestones } from '@/hooks/useCurrentBusiness'

type ChecklistKey = Exclude<keyof OnboardingMilestones, 'business_created'>

interface ChecklistItem {
  key: ChecklistKey
  label: string
  description: string
  route: string
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    key: 'services_reviewed',
    label: 'Review your services',
    description: 'Confirm the pricing Forgefly pulled from your description looks right.',
    route: '/dashboard/services',
  },
  {
    key: 'prospect_added',
    label: 'Add your first prospect',
    description: "Who would you love to work with? Add them — even a long shot counts.",
    route: '/dashboard/leads',
  },
  {
    key: 'proposal_sent',
    label: 'Send your first proposal',
    description: 'Turn a prospect into a real opportunity.',
    route: '/dashboard/proposals',
  },
  {
    key: 'portfolio_shared',
    label: 'Share your portfolio',
    description: 'Your public link is ready. Send it to someone.',
    route: '/dashboard/brand',
  },
  {
    key: 'social_connected',
    label: 'Connect a social account',
    description: 'Publish AI-drafted promotions straight to Instagram or Facebook.',
    route: '/dashboard/social',
  },
]

export function GettingStartedChecklist() {
  const navigate = useNavigate()
  const { business, refetch } = useBusiness()
  const [dismissing, setDismissing] = useState(false)

  if (!business) return null

  const milestones: OnboardingMilestones = business.onboarding_milestones ?? {
    business_created: false,
    services_reviewed: false,
    portfolio_shared: false,
    prospect_added: false,
    proposal_sent: false,
    social_connected: false,
  }

  const doneCount = CHECKLIST_ITEMS.filter(item => milestones[item.key]).length
  const allDone = doneCount === CHECKLIST_ITEMS.length
  const pct = Math.round((doneCount / CHECKLIST_ITEMS.length) * 100)

  if (allDone) return null

  async function setDismissed(value: boolean) {
    setDismissing(true)
    await supabase.from('businesses').update({ getting_started_dismissed: value }).eq('id', business!.id)
    await refetch()
    setDismissing(false)
  }

  if (business.getting_started_dismissed) {
    return (
      <button
        type="button"
        disabled={dismissing}
        onClick={() => setDismissed(false)}
        className="inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-3 py-1.5 hover:bg-muted/50 transition-colors"
      >
        <span
          className="w-[22px] h-[22px] rounded-full shrink-0 grid place-items-center"
          style={{ background: `conic-gradient(hsl(var(--primary)) ${pct}%, hsl(var(--muted)) 0)` }}
        >
          <span className="w-[15px] h-[15px] rounded-full bg-card" />
        </span>
        <span className="text-xs font-semibold">Getting Started</span>
        <span className="text-xs text-muted-foreground">{doneCount} of {CHECKLIST_ITEMS.length} · Resume</span>
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.055] p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <ListChecks className="w-3 h-3 text-primary" />
          Getting Started
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
            {doneCount} / {CHECKLIST_ITEMS.length}
          </span>
          <button
            type="button"
            disabled={dismissing}
            onClick={() => setDismissed(true)}
            className="w-[18px] h-[18px] rounded grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="h-[5px] rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div>
        {CHECKLIST_ITEMS.map((item, i) => {
          const done = !!milestones[item.key]
          return (
            <div
              key={item.key}
              className={`flex items-start gap-2.5 py-2 ${i > 0 ? 'border-t border-border/60' : ''}`}
            >
              <span
                className={`w-[18px] h-[18px] rounded-full shrink-0 mt-0.5 grid place-items-center ${
                  done ? 'bg-primary' : 'border-[1.5px] border-muted-foreground/40'
                }`}
              >
                {done && <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-tight ${done ? 'text-muted-foreground font-medium line-through decoration-muted-foreground/45' : ''}`}>
                  {item.label}
                </p>
                {!done && (
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.description}</p>
                )}
              </div>
              {done ? (
                <span className="shrink-0 text-[10.5px] font-semibold text-muted-foreground mt-1">Done</span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(item.route)}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1 mt-0.5 hover:bg-primary/15 transition-colors"
                >
                  Go
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
