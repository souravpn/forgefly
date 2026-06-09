import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertCircle, Clock, FileText, Inbox, Bell,
  CheckCircle2, Sparkles, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/db/supabase'
import { useBusiness } from '@/contexts/CurrentBusinessContext'
import { useNudges } from '@/hooks/useNudges'
import { formatDistanceToNow } from 'date-fns'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface NudgeSettings {
  overdue_invoice: boolean
  stale_lead: boolean
  unsent_proposal: boolean
  new_request: boolean
}

const DEFAULT_SETTINGS: NudgeSettings = {
  overdue_invoice: true,
  stale_lead: true,
  unsent_proposal: true,
  new_request: true,
}

// ─── Nudge type config ────────────────────────────────────────────────────────

const NUDGE_TYPES: Array<{
  key: keyof NudgeSettings
  label: string
  description: string
  icon: typeof Bell
  color: string
}> = [
  {
    key: 'overdue_invoice',
    label: 'Overdue invoice reminder',
    description: 'Alert when an invoice is unpaid for 3+ days past due.',
    icon: AlertCircle,
    color: 'text-red-500',
  },
  {
    key: 'stale_lead',
    label: 'Stale pipeline alert',
    description: 'Flag leads with no activity in 14+ days.',
    icon: Clock,
    color: 'text-amber-500',
  },
  {
    key: 'unsent_proposal',
    label: 'Unsent proposal reminder',
    description: 'Nudge when a draft proposal sits for 7+ days.',
    icon: FileText,
    color: 'text-blue-500',
  },
  {
    key: 'new_request',
    label: 'New proposal request alert',
    description: 'Remind you about unactioned requests after 24 hours.',
    icon: Inbox,
    color: 'text-emerald-500',
  },
]

const NUDGE_TYPE_ICONS: Record<string, typeof Bell> = {
  overdue_invoice: AlertCircle,
  stale_lead: Clock,
  unsent_proposal: FileText,
  new_request: Inbox,
}

const NUDGE_TYPE_COLORS: Record<string, string> = {
  overdue_invoice: 'text-red-500 bg-red-500/10',
  stale_lead: 'text-amber-500 bg-amber-500/10',
  unsent_proposal: 'text-blue-500 bg-blue-500/10',
  new_request: 'text-emerald-500 bg-emerald-500/10',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const { business, extractedData, refetch: refetchBiz } = useBusiness()
  const { nudges, markRead, refetch: refetchNudges } = useNudges()
  const [settings, setSettings] = useState<NudgeSettings>(DEFAULT_SETTINGS)
  const [savingSettings, setSavingSettings] = useState(false)
  const [triggering, setTriggering] = useState(false)

  // Load settings from extracted_data.settings.nudges
  useEffect(() => {
    const saved = (extractedData as Record<string, unknown>)?.settings?.nudges as NudgeSettings | undefined
    if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved })
  }, [extractedData])

  const saveSettings = useCallback(async (updated: NudgeSettings) => {
    if (!business) return
    setSavingSettings(true)
    const currentSettings = (extractedData as Record<string, unknown>)?.settings ?? {}
    const { error } = await supabase
      .from('businesses')
      .update({
        extracted_data: {
          ...(extractedData as object),
          settings: { ...currentSettings, nudges: updated },
        },
      })
      .eq('id', business.id)
    if (error) {
      toast.error('Failed to save settings')
    } else {
      refetchBiz()
    }
    setSavingSettings(false)
  }, [business, extractedData, refetchBiz])

  function handleToggle(key: keyof NudgeSettings) {
    const updated = { ...settings, [key]: !settings[key] }
    setSettings(updated)
    saveSettings(updated)
  }

  async function handleTriggerNow() {
    setTriggering(true)
    try {
      const { error } = await supabase.functions.invoke('trigger-nudges', { body: {} })
      if (error) throw error
      toast.success('Nudge check complete — new alerts added if triggered')
      refetchNudges()
    } catch {
      toast.error('Failed to run nudge check')
    } finally {
      setTriggering(false)
    }
  }

  // Last 30 days of nudge history
  const recentNudges = nudges.slice(0, 30)

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nudges & Automations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Daily nudges keep you on top of overdue items — runs automatically at 9 AM UTC.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTriggerNow}
          disabled={triggering || !business}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${triggering ? 'animate-spin' : ''}`} />
          {triggering ? 'Checking…' : 'Run check now'}
        </Button>
      </div>

      {/* Toggle cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Nudge types
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {NUDGE_TYPES.map(({ key, label, description, icon: Icon, color }) => (
            <Card key={key} className={`transition-opacity ${!settings[key] ? 'opacity-60' : ''}`}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${NUDGE_TYPE_COLORS[key]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
                </div>
                <Switch
                  checked={settings[key]}
                  onCheckedChange={() => handleToggle(key)}
                  disabled={savingSettings || !business}
                  className="shrink-0 mt-0.5"
                />
              </CardContent>
            </Card>
          ))}
        </div>
        {!business && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Generate your Business OS to activate nudges.
          </p>
        )}
      </div>

      {/* Nudge history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent nudges
          </h2>
          {nudges.some(n => !n.read) && (
            <button
              onClick={() => nudges.filter(n => !n.read).forEach(n => markRead(n.id))}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>

        {recentNudges.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No nudges yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Nudges run daily at 9 AM UTC, or click "Run check now" to trigger manually.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentNudges.map(nudge => {
              const Icon = NUDGE_TYPE_ICONS[nudge.type] ?? Bell
              const colorClass = NUDGE_TYPE_COLORS[nudge.type] ?? 'text-muted-foreground bg-muted'
              return (
                <Card
                  key={nudge.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/40 ${!nudge.read ? 'border-primary/20 bg-primary/5' : ''}`}
                  onClick={() => !nudge.read && markRead(nudge.id)}
                >
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium leading-snug">{nudge.title}</p>
                        {!nudge.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{nudge.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(nudge.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {nudge.read ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
