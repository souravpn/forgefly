import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/db/supabase'
import { useBusiness } from '@/contexts/CurrentBusinessContext'
import type { OnboardingMilestones } from '@/hooks/useCurrentBusiness'

type MilestoneKey = keyof OnboardingMilestones

interface MilestoneConfig {
  label: string
  description: string
  action: string
  route: string
}

const MILESTONE_ORDER: MilestoneKey[] = [
  'business_created',
  'services_reviewed',
  'portfolio_shared',
  'prospect_added',
  'proposal_sent',
]

const MILESTONE_CONFIG: Record<Exclude<MilestoneKey, 'business_created'>, MilestoneConfig> = {
  services_reviewed: {
    label: 'Review your services',
    description: 'Check what Forgefly extracted and confirm your pricing looks right.',
    action: 'Go to Services',
    route: '/dashboard/services',
  },
  portfolio_shared: {
    label: 'Share your portfolio',
    description: 'Your public link is ready. Send it to someone — anyone.',
    action: 'Open Brand Kit',
    route: '/dashboard/brand',
  },
  prospect_added: {
    label: 'Add your first prospect',
    description: "Who would you love to work with? Add them as a lead — even a long shot counts.",
    action: 'Open Leads',
    route: '/dashboard/leads',
  },
  proposal_sent: {
    label: 'Send your first proposal',
    description: 'Turn a prospect into a real opportunity.',
    action: 'Open Proposals',
    route: '/dashboard/proposals',
  },
}

async function callMarkMilestone(milestone: MilestoneKey, skipped = false) {
  await supabase.functions.invoke('mark-milestone', {
    body: { milestone, skipped },
  })
}

export function MilestoneCard() {
  const navigate = useNavigate()
  const { business, refetch } = useBusiness()
  const autoCompleteFired = useRef(false)
  const [skippedInSession, setSkippedInSession] = useState<Set<MilestoneKey>>(new Set())

  const milestones: OnboardingMilestones = business?.onboarding_milestones ?? {
    business_created: false,
    services_reviewed: false,
    portfolio_shared: false,
    prospect_added: false,
    proposal_sent: false,
  }

  // Auto-complete business_created the first time we see the business
  useEffect(() => {
    if (!business || autoCompleteFired.current) return
    if (!milestones.business_created) {
      autoCompleteFired.current = true
      callMarkMilestone('business_created').then(() => refetch())
    }
  }, [business])

  if (!business) return null

  // All done — card disappears silently
  const allComplete = MILESTONE_ORDER.every(m => milestones[m])
  if (allComplete) return null

  // Find the first incomplete milestone not skipped this session
  const activeMilestone = MILESTONE_ORDER.filter(
    m => m !== 'business_created' && !milestones[m] && !skippedInSession.has(m)
  )[0] as Exclude<MilestoneKey, 'business_created'> | undefined

  // All non-auto milestones skipped this session — show nothing (they'll come back on reload)
  if (!activeMilestone) return null

  const config = MILESTONE_CONFIG[activeMilestone]

  function handleGo() {
    navigate(config.route)
  }

  async function handleSkip() {
    setSkippedInSession(prev => new Set(prev).add(activeMilestone!))
    // Fire-and-forget to record the skip event
    callMarkMilestone(activeMilestone!, true)
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold">{config.label}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{config.description}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button size="sm" className="text-xs" onClick={handleGo}>
            {config.action}
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            skip for now
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
