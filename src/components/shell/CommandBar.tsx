import { useState } from 'react'
import { Sparkles, X, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { supabase } from '@/db/supabase'
import type { Business } from '@/hooks/useCurrentBusiness'
import type { ExtractedData } from '@/pages/GeneratedPortalPage'

interface CommandBarProps {
  onClose: () => void
  business: Business | null
  extractedData: ExtractedData | null
  refetch: () => void
}

interface DiffLine {
  type: '+' | '~'
  label: string
  detail?: string
}

interface PendingDiff {
  mergedData: Record<string, unknown>
  sections: string[]
  lines: DiffLine[]
}

type RawData = Record<string, unknown>

function asArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function asObj<T>(v: unknown): Partial<T> {
  return (v && typeof v === 'object' && !Array.isArray(v)) ? (v as Partial<T>) : {}
}

function buildDiffLines(old: RawData, next: RawData, sections: string[]): DiffLine[] {
  const lines: DiffLine[] = []

  for (const section of sections) {
    const o = old[section]
    const n = next[section]

    if (section === 'services') {
      type Svc = { name?: string; price?: string }
      const oldSvcs = asArr<Svc>(o)
      const newSvcs = asArr<Svc>(n)
      const oldNames = new Set(oldSvcs.map(s => s.name))
      const newNames = new Set(newSvcs.map(s => s.name))
      for (const svc of newSvcs) {
        if (!oldNames.has(svc.name)) {
          lines.push({ type: '+', label: 'service', detail: `${svc.name}${svc.price ? ` · ${svc.price}` : ''}` })
        } else {
          const prev = oldSvcs.find(s => s.name === svc.name)
          if (prev?.price !== svc.price) {
            lines.push({ type: '~', label: svc.name ?? 'service', detail: `${prev?.price ?? '—'} → ${svc.price}` })
          }
        }
      }
      for (const svc of oldSvcs) {
        if (!newNames.has(svc.name)) {
          lines.push({ type: '~', label: 'service removed', detail: svc.name ?? '' })
        }
      }
    }

    if (section === 'metrics') {
      type M = { monthlyRevenue?: string; pipelineValue?: string; avgProjectValue?: string }
      const om = asObj<M>(o)
      const nm = asObj<M>(n)
      const pairs: Array<[string, keyof M]> = [
        ['monthly revenue', 'monthlyRevenue'],
        ['avg. project value', 'avgProjectValue'],
        ['pipeline value', 'pipelineValue'],
      ]
      for (const [label, key] of pairs) {
        if (nm[key] && om[key] !== nm[key]) {
          lines.push({ type: '~', label, detail: `${om[key] ?? '—'} → ${nm[key]}` })
        }
      }
    }

    if (section === 'identity') {
      type Id = { tagline?: string; niche?: string; businessName?: string }
      const oi = asObj<Id>(o)
      const ni = asObj<Id>(n)
      if (ni.businessName && oi.businessName !== ni.businessName) {
        lines.push({ type: '~', label: 'business name', detail: `${oi.businessName ?? '—'} → ${ni.businessName}` })
      }
      if (ni.tagline && oi.tagline !== ni.tagline) {
        lines.push({ type: '~', label: 'tagline', detail: `"${oi.tagline ?? ''}" → "${ni.tagline}"` })
      }
      if (ni.niche && oi.niche !== ni.niche) {
        lines.push({ type: '~', label: 'niche', detail: `${oi.niche ?? '—'} → ${ni.niche}` })
      }
    }

    if (section === 'brand') {
      type Br = { primaryColor?: string; secondaryColor?: string; keywords?: string[] }
      const ob = asObj<Br>(o)
      const nb = asObj<Br>(n)
      if (nb.primaryColor && ob.primaryColor !== nb.primaryColor) {
        lines.push({ type: '~', label: 'brand color', detail: `${ob.primaryColor ?? '—'} → ${nb.primaryColor}` })
      }
      const oldKw = new Set(ob.keywords ?? [])
      const added = (nb.keywords ?? []).filter(k => !oldKw.has(k))
      if (added.length > 0) {
        lines.push({ type: '+', label: 'keyword', detail: added.join(', ') })
      }
    }

    if (section === 'pipeline') {
      type Lead = { name?: string; value?: string; stage?: string }
      type Pipeline = { leads?: Lead[] }
      const oldLeads = asArr<Lead>(asObj<Pipeline>(o).leads)
      const newLeads = asArr<Lead>(asObj<Pipeline>(n).leads)
      const oldNames = new Set(oldLeads.map(l => l.name))
      for (const lead of newLeads) {
        if (!oldNames.has(lead.name)) {
          lines.push({
            type: '+',
            label: 'lead',
            detail: `${lead.name}${lead.value ? ` · ${lead.value}` : ''}${lead.stage ? ` (${lead.stage})` : ''}`,
          })
        }
      }
    }

    if (section === 'proposal') {
      type Pr = { intro?: string; approach?: string }
      const op = asObj<Pr>(o)
      const np = asObj<Pr>(n)
      if (np.intro && op.intro !== np.intro) lines.push({ type: '~', label: 'proposal intro', detail: 'updated' })
      if (np.approach && op.approach !== np.approach) lines.push({ type: '~', label: 'proposal approach', detail: 'updated' })
    }
  }

  // Fallback: if no specific diff lines generated, summarise by section name
  if (lines.length === 0) {
    for (const sec of sections) {
      lines.push({ type: '~', label: sec, detail: 'updated' })
    }
  }

  return lines
}

function DiffConfirmModal({
  pending,
  onConfirm,
  onCancel,
  applying,
}: {
  pending: PendingDiff | null
  onConfirm: () => void
  onCancel: () => void
  applying: boolean
}) {
  return (
    <Dialog open={!!pending} onOpenChange={open => { if (!open && !applying) onCancel() }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Changes</DialogTitle>
          <DialogDescription>
            These changes will be applied across all tabs of your business OS.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 max-h-60 overflow-y-auto space-y-0.5">
          {pending?.lines.map((line, i) => (
            <div key={i} className="flex items-start gap-3 text-sm py-1 px-1 rounded hover:bg-muted/40">
              <span className={cn(
                'font-mono font-bold text-base leading-none shrink-0 mt-0.5 w-3',
                line.type === '+' ? 'text-emerald-500' : 'text-amber-500',
              )}>
                {line.type}
              </span>
              <span className="text-muted-foreground shrink-0 w-32">{line.label}</span>
              {line.detail && <span className="text-foreground/90 text-xs">{line.detail}</span>}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={applying}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={applying} className="glow-accent">
            {applying ? 'Applying…' : 'Apply to all tabs'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CommandBar({ onClose, business, extractedData, refetch }: CommandBarProps) {
  const [value, setValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pending, setPending] = useState<PendingDiff | null>(null)
  const [applying, setApplying] = useState(false)

  async function handleSubmit() {
    if (!value.trim() || isLoading) return
    if (!business) {
      toast.error('No active business found — generate your Business OS first.')
      return
    }
    setIsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-gateway', {
        body: {
          mode: 'extract',
          prompt: value.trim(),
          current_data: extractedData,
          business_id: business.id,
        },
      })
      if (error) throw error

      const { extracted_data: mergedData, sections_updated } = data as {
        extracted_data: Record<string, unknown>
        sections_updated: string[]
      }

      const lines = buildDiffLines(
        (extractedData ?? {}) as RawData,
        mergedData,
        sections_updated ?? [],
      )
      setPending({ mergedData, sections: sections_updated ?? [], lines })
    } catch (err) {
      console.error('ai-gateway error:', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function applyDiff() {
    if (!pending || !business) return
    setApplying(true)
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ extracted_data: pending.mergedData })
        .eq('id', business.id)
      if (error) throw error
      await refetch()
      toast.success('Business OS updated')
      setPending(null)
      setValue('')
      onClose()
    } catch (err) {
      console.error('Apply diff error:', err)
      toast.error('Failed to apply changes. Please try again.')
    } finally {
      setApplying(false)
    }
  }

  function cancelDiff() {
    setPending(null)
  }

  return (
    <>
      <div className="border-t border-border/60 bg-background px-4 pt-3 pb-3">
        <div className="flex items-end gap-2">
          <Sparkles className={cn('h-4 w-4 shrink-0 mb-[11px] text-primary', isLoading && 'animate-pulse')} />
          <Textarea
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder='Describe a change to your OS… e.g. "I now offer brand photography from $800"'
            className="min-h-[44px] max-h-28 resize-none text-sm bg-muted/40 border-border/50 focus-visible:ring-primary/40"
            disabled={isLoading}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
              if (e.key === 'Escape') onClose()
            }}
          />
          <div className="flex flex-col gap-1 mb-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              onClick={onClose}
              aria-label="Close command bar"
              disabled={isLoading}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={handleSubmit}
              disabled={!value.trim() || isLoading}
              aria-label="Submit"
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {isLoading && (
          <p className="text-xs text-muted-foreground mt-1.5 ml-6 animate-pulse">
            Updating your business OS…
          </p>
        )}
      </div>

      <DiffConfirmModal
        pending={pending}
        onConfirm={applyDiff}
        onCancel={cancelDiff}
        applying={applying}
      />
    </>
  )
}
