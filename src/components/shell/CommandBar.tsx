import { useState } from 'react'
import { Sparkles, Send, ArrowLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
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

    if (section === 'contacts') {
      type Contact = { name?: string; email?: string; company?: string }
      const oldContacts = asArr<Contact>(o)
      const newContacts = asArr<Contact>(n)
      const oldNames = new Set(oldContacts.map(c => c.name?.toLowerCase()))
      for (const c of newContacts) {
        if (c.name && !oldNames.has(c.name.toLowerCase())) {
          const detail = [c.name, c.email, c.company].filter(Boolean).join(' · ')
          lines.push({ type: '+', label: 'client', detail })
        }
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

      // Sync new services → services table
      if (pending.sections.includes('services')) {
        type Svc = { name?: string; price?: string; type?: string; description?: string; deliverables?: string[] }
        const oldSvcs = asArr<Svc>((extractedData as RawData)?.services)
        const newSvcs = asArr<Svc>((pending.mergedData as RawData)?.services)
        const oldNames = new Set(oldSvcs.map(s => s.name?.toLowerCase()).filter(Boolean))
        const toInsert = newSvcs.filter(s => s.name && !oldNames.has(s.name.toLowerCase()))
        if (toInsert.length > 0) {
          // Get current max sort_order
          const { data: existing } = await supabase
            .from('services')
            .select('sort_order')
            .eq('business_id', business.id)
            .order('sort_order', { ascending: false })
            .limit(1)
          const maxOrder = (existing?.[0]?.sort_order ?? -1) as number
          const rows = toInsert.map((s, i) => ({
            business_id: business.id,
            name: s.name!,
            price: s.price ?? null,
            type: s.type ?? 'project',
            description: s.description ?? null,
            deliverables: s.deliverables ?? [],
            sort_order: maxOrder + 1 + i,
          }))
          const { error: svcErr } = await supabase.from('services').insert(rows)
          if (svcErr) console.warn('Service sync warning (non-fatal):', svcErr)
        }
      }

      // Sync new contacts → clients table
      if (pending.sections.includes('contacts')) {
        type Contact = { name?: string; email?: string; company?: string; status?: string }
        const oldContacts = asArr<Contact>((extractedData as RawData)?.contacts)
        const newContacts = asArr<Contact>((pending.mergedData as RawData)?.contacts)
        const oldNames = new Set(oldContacts.map(c => c.name?.toLowerCase()).filter(Boolean))
        const toInsert = newContacts.filter(c => c.name && !oldNames.has(c.name.toLowerCase()))
        if (toInsert.length > 0) {
          const rows = toInsert.map(c => ({
            user_id: business.user_id,
            name: c.name!,
            email: c.email ?? null,
            company: c.company ?? null,
            status: 'active',
            total_value: 0,
          }))
          const { error: clientErr } = await supabase.from('clients').insert(rows)
          if (clientErr) console.warn('Client sync warning (non-fatal):', clientErr)
        }
      }

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

  // Review view — shown after AI extraction
  if (pending) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 pt-4 pb-2 shrink-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Review changes</p>
          <p className="text-xs text-muted-foreground">These will be applied across all tabs of your OS.</p>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-0.5 py-2">
            {pending.lines.map((line, i) => (
              <div key={i} className="flex items-start gap-3 text-sm py-1.5 px-2 rounded-lg hover:bg-muted/40">
                <span className={cn(
                  'font-mono font-bold text-sm leading-none shrink-0 mt-0.5 w-3',
                  line.type === '+' ? 'text-emerald-500' : 'text-amber-500',
                )}>
                  {line.type}
                </span>
                <span className="text-muted-foreground shrink-0 w-28 text-xs leading-relaxed">{line.label}</span>
                {line.detail && <span className="text-foreground/90 text-xs leading-relaxed">{line.detail}</span>}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="px-4 pb-4 pt-3 border-t flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={cancelDiff} disabled={applying} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <Button onClick={applyDiff} disabled={applying} className="flex-1 gap-2">
            <Check className="h-3.5 w-3.5" />
            {applying ? 'Applying…' : 'Apply to all tabs'}
          </Button>
        </div>
      </div>
    )
  }

  // Input view
  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-4 gap-3">
      <Textarea
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder='Describe a change… e.g. "I now offer brand photography from $800, updated my niche to luxury brands"'
        className="flex-1 resize-none text-sm bg-muted/40 border-border/50 focus-visible:ring-primary/40 min-h-[120px]"
        disabled={isLoading}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
          if (e.key === 'Escape') onClose()
        }}
      />
      {isLoading && (
        <p className="text-xs text-muted-foreground animate-pulse flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Analysing changes…
        </p>
      )}
      <Button
        onClick={handleSubmit}
        disabled={!value.trim() || isLoading}
        className="w-full gap-2"
      >
        <Send className="h-3.5 w-3.5" />
        {isLoading ? 'Thinking…' : 'Update OS'}
      </Button>
    </div>
  )
}
