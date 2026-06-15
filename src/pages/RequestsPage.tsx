import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Sparkles, Search, Clock, Building2, Package, CalendarClock, Edit2, RefreshCw, Send, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/db/supabase'
import { useBusiness } from '@/contexts/CurrentBusinessContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'

interface ProposalRequest {
  id: string
  business_id: string
  name: string
  company: string | null
  email: string
  service_name: string | null
  problem: string | null
  timeline: string | null
  budget_flexible: boolean
  notes: string | null
  status: 'new' | 'drafted' | 'sent' | 'declined'
  engagement_id: string | null
  created_at: string
}

interface DraftFields {
  title: string
  introduction: string
  services: string
  deliverables: string
  pricing: string
  timeline: string
  whyUs: string
}

interface DraftModalState {
  request: ProposalRequest
  proposalId: string
  fields: DraftFields
}

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  drafted: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  sent: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  declined: 'bg-muted text-muted-foreground border-border',
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '')
}

function parsePricing(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.]/g, ''))
    return isNaN(n) ? null : n
  }
  return null
}

function fmtPrice(v: string | number | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (!n) return ''
  return `$${n.toLocaleString()}`
}

export default function RequestsPage() {
  const { business } = useBusiness()
  const { profile } = useAuth()
  const [requests, setRequests] = useState<ProposalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [draftingId, setDraftingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'new' | 'drafted' | 'sent' | 'declined' | 'all'>('all')

  // Ask a question inline
  const [questionCardId, setQuestionCardId] = useState<string | null>(null)
  const [questionText, setQuestionText] = useState('')
  const [sendingQuestion, setSendingQuestion] = useState(false)

  // Draft modal
  const [modal, setModal] = useState<DraftModalState | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editFields, setEditFields] = useState<DraftFields | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (!business) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('proposal_requests')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
      setRequests(data ?? [])
      setLoading(false)
    })()
  }, [business])

  function openModal(state: DraftModalState) {
    setModal(state)
    setEditMode(false)
    setEditFields(null)
  }

  function startEdit() {
    if (!modal) return
    setEditFields({ ...modal.fields })
    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
    setEditFields(null)
  }

  async function handleDecline(id: string) {
    const { error } = await supabase
      .from('proposal_requests')
      .update({ status: 'declined' })
      .eq('id', id)
    if (error) { toast.error('Failed to update'); return }
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'declined' } : r))
    toast.success('Request declined')
  }

  async function handleSendQuestion(request: ProposalRequest) {
    if (!questionText.trim() || !business) return
    setSendingQuestion(true)
    try {
      const subject = `Re: Your ${request.service_name ?? 'proposal'} request`
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'client_message',
          to: request.email,
          data: {
            clientName: request.name,
            senderName: business.name,
            subject,
            message: questionText.trim(),
          },
        },
      })
      if (error) throw error
      toast.success(`Message sent to ${request.name}`)
      setQuestionCardId(null)
      setQuestionText('')
    } catch {
      toast.error('Failed to send. Try again.')
    } finally {
      setSendingQuestion(false)
    }
  }

  async function runAIDraft(request: ProposalRequest): Promise<DraftFields | null> {
    const { data, error } = await supabase.functions.invoke('ai-gateway', {
      body: {
        mode: 'chat',
        message: `Draft a professional proposal for this potential client:
- Name: ${request.name}${request.company ? `, ${request.company}` : ''}
- Service requested: ${request.service_name ?? 'general services'}
- Their problem: ${request.problem ?? 'not specified'}
- Timeline: ${request.timeline ?? 'flexible'}
- Budget flexible: ${request.budget_flexible ? 'yes' : 'no'}

Use my proposal template and services from my business OS. Return a complete proposal as JSON with these exact keys:
- title: short proposal title
- introduction: 2-3 sentence paragraph about their specific challenge (THE CHALLENGE section)
- scope: array of 3-5 bullet point strings describing scope of work
- deliverables: short string summarizing deliverables
- pricing: number (estimate in USD, no symbols)
- timeline: string (e.g. "4 weeks")
- whyUs: 2-3 sentences explaining why you are the right fit for this specific client/company`,
        current_page: 'requests',
      },
    })
    if (error) throw error

    let parsed: Record<string, unknown> = {}
    try {
      const raw = typeof data?.message === 'string' ? data.message : JSON.stringify(data?.message ?? {})
      const m = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
      parsed = JSON.parse(m ? m[1] : raw)
    } catch {
      parsed = {}
    }

    return {
      title: (parsed.title as string) || `Proposal for ${request.name}`,
      introduction: (parsed.introduction as string) || '',
      services: Array.isArray(parsed.scope)
        ? (parsed.scope as string[]).join('\n')
        : (parsed.services as string) || '',
      deliverables: (parsed.deliverables as string) || '',
      pricing: parsePricing(parsed.pricing)?.toString() ?? '',
      timeline: (parsed.timeline as string) || request.timeline || '',
      whyUs: (parsed.whyUs as string) || '',
    }
  }

  async function handleDraftWithAI(request: ProposalRequest) {
    if (!business) return
    setDraftingId(request.id)
    try {
      const fields = await runAIDraft(request)
      if (!fields) throw new Error('No draft returned')

      // Upsert prospect as client
      let clientId: string | null = null
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('email', request.email)
        .maybeSingle()
      if (existing?.id) {
        clientId = existing.id
      } else {
        const { data: newClient } = await supabase
          .from('clients')
          .insert({
            name: request.name,
            email: request.email,
            company: request.company ?? undefined,
            status: 'prospect',
          })
          .select('id')
          .single()
        clientId = newClient?.id ?? null
      }

      // Save draft to proposals table
      const { data: savedProposal } = await supabase
        .from('proposals')
        .insert({
          title: fields.title,
          client_id: clientId,
          introduction: fields.introduction || null,
          services: fields.services || null,
          deliverables: fields.deliverables || null,
          pricing: parsePricing(fields.pricing),
          timeline: fields.timeline || null,
          terms: fields.whyUs || null,
          status: 'draft',
        })
        .select('id')
        .single()

      const proposalId = savedProposal?.id ?? ''

      // Link request → proposal
      await supabase
        .from('proposal_requests')
        .update({ status: 'drafted', engagement_id: proposalId })
        .eq('id', request.id)
      setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: 'drafted', engagement_id: proposalId } : r))

      openModal({ request, proposalId, fields })
    } catch {
      toast.error('Failed to draft proposal. Try again.')
    } finally {
      setDraftingId(null)
    }
  }

  async function handleOpenDraftedCard(r: ProposalRequest) {
    if (!r.engagement_id) {
      // Old draft pre-dates proposal saving — offer to re-draft
      toast('This draft was created before proposal saving was available.', {
        description: 'Click "Draft with AI" to generate and save a new draft.',
        action: {
          label: 'Re-draft',
          onClick: () => {
            setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'new' } : x))
            supabase.from('proposal_requests').update({ status: 'new' }).eq('id', r.id)
          },
        },
        duration: 6000,
      })
      return
    }
    const { data: p } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', r.engagement_id)
      .maybeSingle()
    if (!p) {
      toast('Proposal record not found. Please re-draft.', {
        action: {
          label: 'Re-draft',
          onClick: () => {
            setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'new' } : x))
            supabase.from('proposal_requests').update({ status: 'new' }).eq('id', r.id)
          },
        },
        duration: 6000,
      })
      return
    }
    openModal({
      request: r,
      proposalId: p.id,
      fields: {
        title: p.title ?? '',
        introduction: p.introduction ?? '',
        services: p.services ?? '',
        deliverables: p.deliverables ?? '',
        pricing: p.pricing?.toString() ?? '',
        timeline: p.timeline ?? '',
        whyUs: p.terms ?? '',
      },
    })
  }

  async function handleSaveEdit() {
    if (!modal || !editFields) return
    setSaving(true)
    try {
      await supabase
        .from('proposals')
        .update({
          title: editFields.title,
          introduction: editFields.introduction || null,
          services: editFields.services || null,
          deliverables: editFields.deliverables || null,
          pricing: parsePricing(editFields.pricing),
          timeline: editFields.timeline || null,
          terms: editFields.whyUs || null,
        })
        .eq('id', modal.proposalId)
      setModal(prev => prev ? { ...prev, fields: editFields } : prev)
      setEditMode(false)
      setEditFields(null)
      toast.success('Draft saved')
    } catch {
      toast.error('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRegenerate() {
    if (!modal) return
    setRegenerating(true)
    try {
      const fields = await runAIDraft(modal.request)
      if (!fields) throw new Error()
      await supabase
        .from('proposals')
        .update({
          title: fields.title,
          introduction: fields.introduction || null,
          services: fields.services || null,
          deliverables: fields.deliverables || null,
          pricing: parsePricing(fields.pricing),
          timeline: fields.timeline || null,
          terms: fields.whyUs || null,
        })
        .eq('id', modal.proposalId)
      setModal(prev => prev ? { ...prev, fields } : prev)
      setEditMode(false)
      setEditFields(null)
      toast.success('Proposal regenerated')
    } catch {
      toast.error('Regeneration failed. Try again.')
    } finally {
      setRegenerating(false)
    }
  }

  async function handleSendToClient() {
    if (!modal || !business) return
    const { request, proposalId, fields } = modal
    setSending(true)
    try {
      const proposalScope = {
        title: fields.title,
        introduction: fields.introduction ?? undefined,
        scopeOfWork: fields.services
          ? fields.services.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
        deliverables: fields.deliverables ?? undefined,
        pricing: fields.pricing ? fmtPrice(fields.pricing) : undefined,
        timeline: fields.timeline ?? undefined,
        whyUs: fields.whyUs ?? undefined,
      }

      // Get or create client
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('email', request.email)
        .maybeSingle()

      let clientId = client?.id ?? null
      if (!clientId) {
        const { data: c } = await supabase
          .from('clients')
          .insert({ name: request.name, email: request.email, company: request.company ?? undefined, status: 'prospect' })
          .select('id').single()
        clientId = c?.id ?? null
      }

      // Upsert engagement
      const { data: existing } = await supabase
        .from('engagements')
        .select('id')
        .eq('business_id', business.id)
        .eq('contact_id', clientId)
        .eq('service_name', fields.title)
        .maybeSingle()

      let engagementId: string
      if (existing?.id) {
        engagementId = existing.id
        await supabase.from('engagements').update({ status: 'proposal_sent', scope: { proposal: proposalScope } }).eq('id', engagementId)
      } else {
        const { data: eng, error: engErr } = await supabase
          .from('engagements')
          .insert({ business_id: business.id, contact_id: clientId, service_name: fields.title, status: 'proposal_sent', scope: { proposal: proposalScope } })
          .select('id').single()
        if (engErr || !eng) throw new Error('Failed to create engagement')
        engagementId = eng.id
      }

      // Generate portal link
      const { data: portalData, error: portalErr } = await supabase.functions.invoke('generate-portal-link', {
        body: { engagementId },
      })
      if (portalErr || !portalData?.portalUrl) throw new Error('Failed to generate portal link')

      const { portalUrl, token: portalToken } = portalData
      const freelancerEmail = profile?.email ?? undefined

      // Send portal invite email (with CC to freelancer)
      const { error: emailErr } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'portal_invite',
          to: request.email,
          cc: freelancerEmail,
          data: {
            clientName: request.name,
            clientFirstName: request.name.split(' ')[0],
            businessName: business.name,
            freelancerName: profile?.username ?? business.name,
            serviceName: fields.title,
            portalUrl,
            token: portalToken,
            problemSnippet: request.problem ?? null,
          },
        },
      })
      if (emailErr) throw new Error('Failed to send email')

      // Mark proposal as sent
      await supabase.from('proposals').update({ status: 'sent' }).eq('id', proposalId)
      // Mark request as sent
      await supabase.from('proposal_requests').update({ status: 'sent' }).eq('id', request.id)
      setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: 'sent' } : r))

      toast.success(`Proposal sent to ${request.name}!`)
      setModal(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send. Try again.')
    } finally {
      setSending(false)
    }
  }

  const TABS: { key: typeof activeTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'Requests' },
    { key: 'drafted', label: 'Drafted' },
    { key: 'sent', label: 'Accepted' },
    { key: 'declined', label: 'Declined' },
  ]

  const counts = {
    all: requests.length,
    new: requests.filter(r => r.status === 'new').length,
    drafted: requests.filter(r => r.status === 'drafted').length,
    sent: requests.filter(r => r.status === 'sent').length,
    declined: requests.filter(r => r.status === 'declined').length,
  }

  const filtered = requests.filter(r => {
    if (activeTab !== 'all' && r.status !== activeTab) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.name.toLowerCase().includes(q) ||
      r.company?.toLowerCase().includes(q) ||
      r.service_name?.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q)
    )
  })

  const activeFields = editMode ? editFields : modal?.fields

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Proposal Requests</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Prospects from your public portfolio who want to work with you.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium transition-colors border',
              activeTab === tab.key
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground',
            )}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold',
                activeTab === tab.key ? 'bg-accent-foreground/20 text-accent-foreground' : 'bg-muted-foreground/20 text-muted-foreground',
              )}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search requests…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Loading requests…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? 'No matching requests.' : 'No requests yet. Share your portfolio link to start receiving them.'}</p>
          {!search && business && (
            <p className="text-xs mt-2">
              Your portfolio:{' '}
              <span className="font-mono text-foreground">
                forgefly.io/p/{profile?.username ?? toSlug(business.name)}
              </span>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card
              key={r.id}
              className={cn(r.status === 'drafted' && 'cursor-pointer hover:border-accent/40 transition-colors')}
              onClick={r.status === 'drafted' ? () => handleOpenDraftedCard(r) : undefined}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{r.name}</span>
                      {r.company && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" /> {r.company}
                        </span>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </Badge>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {r.service_name && (
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" /> {r.service_name}
                        </span>
                      )}
                      {r.timeline && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" /> {r.timeline}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {r.problem && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {r.problem}
                      </p>
                    )}
                  </div>

                  {r.status === 'new' && (
                    <div className="flex flex-col gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <Button
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => handleDraftWithAI(r)}
                        disabled={draftingId === r.id}
                      >
                        {draftingId === r.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Sparkles className="h-3 w-3" />}
                        {draftingId === r.id ? 'Drafting…' : 'Draft with AI'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => {
                          setQuestionCardId(id => id === r.id ? null : r.id)
                          setQuestionText('')
                        }}
                      >
                        Ask a Question
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => handleDecline(r.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  )}

                  {r.status === 'drafted' && (
                    <span className="text-xs text-accent shrink-0">View draft →</span>
                  )}
                </div>

                {/* Inline question composer */}
                {questionCardId === r.id && (
                  <div className="mt-3 pt-3 border-t space-y-2" onClick={e => e.stopPropagation()}>
                    <p className="text-xs text-muted-foreground">
                      Sending to <span className="text-foreground font-medium">{r.email}</span>
                    </p>
                    <Textarea
                      autoFocus
                      rows={3}
                      placeholder={`Hi ${r.name.split(' ')[0]}, thanks for reaching out…`}
                      value={questionText}
                      onChange={e => setQuestionText(e.target.value)}
                      className="text-sm resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => { setQuestionCardId(null); setQuestionText('') }}
                        disabled={sendingQuestion}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleSendQuestion(r)}
                        disabled={!questionText.trim() || sendingQuestion}
                      >
                        {sendingQuestion
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Send className="h-3 w-3" />}
                        Send to {r.name.split(' ')[0]}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Draft Modal */}
      <Dialog open={!!modal} onOpenChange={open => { if (!open) { setModal(null); setEditMode(false); setEditFields(null) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          {modal && (
            <>
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{business?.name ?? 'Forgefly'}</span>
                  {editMode && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">Editing</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {!editMode ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={startEdit}>
                      <Edit2 className="h-3 w-3" /> Edit
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5 glow-accent"
                    onClick={editMode ? handleSaveEdit : handleSendToClient}
                    disabled={sending || saving}
                  >
                    {(sending || saving) && <Loader2 className="h-3 w-3 animate-spin" />}
                    {editMode
                      ? (saving ? 'Saving…' : 'Save draft')
                      : (sending ? 'Sending…' : `Send to ${modal.request.name.split(' ')[0]} →`)}
                  </Button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => { setModal(null); setEditMode(false); setEditFields(null) }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* AI badge */}
              <div className="px-5 py-2.5 bg-accent/5 border-b flex items-center gap-2 shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="text-xs text-muted-foreground">
                  AI-drafted from {modal.request.name.split(' ')[0]}'s request + your business profile
                  {!editMode && ' · Review before sending'}
                </span>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6">

                {/* Title + meta */}
                {editMode ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Proposal Title</Label>
                    <Input
                      value={editFields?.title ?? ''}
                      onChange={e => setEditFields(prev => prev ? { ...prev, title: e.target.value } : prev)}
                      className="text-lg font-semibold"
                    />
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">{activeFields?.title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      For {modal.request.name}
                      {modal.request.company ? ` · ${modal.request.company}` : ''}
                      {' · '}Prepared {format(new Date(), 'MMMM d, yyyy')}
                    </p>
                  </div>
                )}

                {/* THE CHALLENGE */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-accent uppercase">The Challenge</p>
                  {editMode ? (
                    <Textarea
                      value={editFields?.introduction ?? ''}
                      onChange={e => setEditFields(prev => prev ? { ...prev, introduction: e.target.value } : prev)}
                      rows={4}
                      placeholder="Describe the client's challenge…"
                    />
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground/90">{activeFields?.introduction}</p>
                  )}
                </div>

                {/* SCOPE OF WORK */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-accent uppercase">Scope of Work</p>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b">
                          <td className="px-4 py-2.5 text-muted-foreground w-36">Service</td>
                          <td className="px-4 py-2.5 font-medium text-right">
                            {modal.request.service_name ?? activeFields?.title}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-2.5 text-muted-foreground">Timeline</td>
                          <td className="px-4 py-2.5 text-right">
                            {editMode ? (
                              <Input
                                value={editFields?.timeline ?? ''}
                                onChange={e => setEditFields(prev => prev ? { ...prev, timeline: e.target.value } : prev)}
                                className="h-7 text-xs text-right ml-auto max-w-[180px]"
                              />
                            ) : (
                              <span className="font-medium">{activeFields?.timeline || '—'}</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-2.5 text-muted-foreground">Deliverables</td>
                          <td className="px-4 py-2.5 text-right">
                            {editMode ? (
                              <Input
                                value={editFields?.deliverables ?? ''}
                                onChange={e => setEditFields(prev => prev ? { ...prev, deliverables: e.target.value } : prev)}
                                className="h-7 text-xs text-right ml-auto max-w-[240px]"
                              />
                            ) : (
                              <span className="font-medium">{activeFields?.deliverables || '—'}</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 text-muted-foreground">Investment</td>
                          <td className="px-4 py-2.5 text-right">
                            {editMode ? (
                              <Input
                                value={editFields?.pricing ?? ''}
                                onChange={e => setEditFields(prev => prev ? { ...prev, pricing: e.target.value } : prev)}
                                placeholder="e.g. 4500"
                                className="h-7 text-xs text-right ml-auto max-w-[140px]"
                              />
                            ) : (
                              <span className="font-semibold text-accent">
                                {activeFields?.pricing ? fmtPrice(activeFields.pricing) : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Scope bullets */}
                  {!editMode && activeFields?.services && (
                    <ul className="space-y-1 mt-2">
                      {activeFields.services.split('\n').filter(Boolean).map((line, i) => (
                        <li key={i} className="text-sm text-foreground/80 flex gap-2">
                          <span className="text-accent shrink-0 mt-0.5">·</span>
                          <span>{line.replace(/^[-•·]\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {editMode && (
                    <div className="space-y-1.5 mt-1">
                      <Label className="text-xs text-muted-foreground">Scope bullets (one per line)</Label>
                      <Textarea
                        value={editFields?.services ?? ''}
                        onChange={e => setEditFields(prev => prev ? { ...prev, services: e.target.value } : prev)}
                        rows={4}
                        placeholder="One bullet per line…"
                      />
                    </div>
                  )}
                </div>

                {/* WHY THIS WORKS */}
                {(activeFields?.whyUs || editMode) && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-accent uppercase">
                      Why This Works for {modal.request.company ?? modal.request.name.split(' ')[0]}
                    </p>
                    {editMode ? (
                      <Textarea
                        value={editFields?.whyUs ?? ''}
                        onChange={e => setEditFields(prev => prev ? { ...prev, whyUs: e.target.value } : prev)}
                        rows={3}
                        placeholder="Why are you the right fit for this client?…"
                      />
                    ) : (
                      <p className="text-sm leading-relaxed text-foreground/90">{activeFields?.whyUs}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex border-t shrink-0">
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-r"
                  onClick={editMode ? cancelEdit : startEdit}
                >
                  <Edit2 className="h-4 w-4" />
                  {editMode ? 'Cancel edit' : 'Edit draft'}
                </button>
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-r disabled:opacity-50"
                  onClick={handleRegenerate}
                  disabled={regenerating || sending}
                >
                  {regenerating
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <RefreshCw className="h-4 w-4" />}
                  {regenerating ? 'Regenerating…' : 'Regenerate'}
                </button>
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                  onClick={editMode ? handleSaveEdit : handleSendToClient}
                  disabled={sending || saving}
                >
                  {(sending || saving)
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                  {editMode
                    ? (saving ? 'Saving…' : 'Save draft')
                    : (sending ? 'Sending…' : `Send to ${modal.request.name.split(' ')[0]}`)}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
