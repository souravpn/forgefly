import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles, Search, Clock, Building2, Package, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/db/supabase'
import { useBusiness } from '@/contexts/CurrentBusinessContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'

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

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  drafted: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  sent: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  declined: 'bg-muted text-muted-foreground border-border',
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '')
}

export default function RequestsPage() {
  const { business } = useBusiness()
  const { profile } = useAuth()
  const [requests, setRequests] = useState<ProposalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [draftingId, setDraftingId] = useState<string | null>(null)

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

  async function handleDecline(id: string) {
    const { error } = await supabase
      .from('proposal_requests')
      .update({ status: 'declined' })
      .eq('id', id)
    if (error) { toast.error('Failed to update'); return }
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'declined' } : r))
    toast.success('Request declined')
  }

  async function handleDraftWithAI(request: ProposalRequest) {
    if (!business) return
    setDraftingId(request.id)
    try {
      const { data, error } = await supabase.functions.invoke('ai-gateway', {
        body: {
          mode: 'chat',
          message: `Draft a professional proposal for this potential client:
- Name: ${request.name}${request.company ? `, ${request.company}` : ''}
- Service requested: ${request.service_name ?? 'general services'}
- Their problem: ${request.problem ?? 'not specified'}
- Timeline: ${request.timeline ?? 'flexible'}
- Budget flexible: ${request.budget_flexible ? 'yes' : 'no'}

Use my proposal template and services from my business OS. Return a complete proposal with: title, introduction paragraph, scope of work (3-5 bullet points), deliverables, pricing estimate, timeline, and next steps. Format as JSON with keys: title, introduction, scope, deliverables, pricing, timeline, nextSteps.`,
          current_page: 'requests',
        },
      })
      if (error) throw error

      // Mark as drafted
      await supabase.from('proposal_requests').update({ status: 'drafted' }).eq('id', request.id)
      setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: 'drafted' } : r))

      toast.success('Draft ready — head to Proposals to send it', {
        action: { label: 'Go', onClick: () => window.location.href = '/dashboard/proposals' },
      })

      // Log the draft for reference
      console.log('AI proposal draft:', data?.message)
    } catch {
      toast.error('Failed to draft proposal. Try again.')
    } finally {
      setDraftingId(null)
    }
  }

  const filtered = requests.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.name.toLowerCase().includes(q) ||
      r.company?.toLowerCase().includes(q) ||
      r.service_name?.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Proposal Requests</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Prospects from your public portfolio who want to work with you.
        </p>
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
            <Card key={r.id}>
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
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => handleDraftWithAI(r)}
                        disabled={draftingId === r.id}
                      >
                        <Sparkles className="h-3 w-3" />
                        {draftingId === r.id ? 'Drafting…' : 'Draft with AI'}
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
