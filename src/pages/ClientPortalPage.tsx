import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Briefcase, FileText, Receipt, CheckCircle2, Clock, AlertCircle,
  Sparkles, Mail, Phone, ThumbsUp, MessageSquare, DollarSign, Calendar,
  ArrowRight, PartyPopper, XCircle, Send,
} from 'lucide-react';
// @ts-ignore
import { supabase } from '@/db/supabase';
import type { Project, Proposal, Invoice, Client } from '@/types/types';
import { toast } from 'sonner';

// ─── Engagement portal types ──────────────────────────────────────────────────

interface Contact {
  id: string
  name: string
  company: string | null
  email: string | null
}

interface EngagementMessage {
  id: string
  author: 'client' | 'freelancer'
  body: string
  created_at: string
}

interface EngagementScope {
  proposal?: {
    title?: string
    introduction?: string
    scope?: string[]
    deliverables?: string[]
    pricing?: string
    timeline?: string
    nextSteps?: string[]
  }
  messages?: EngagementMessage[]
  project_id?: string
  invoice_id?: string
}

interface Engagement {
  id: string
  business_id: string
  contact_id: string | null
  portal_token: string
  service_name: string | null
  status: 'proposal_sent' | 'active' | 'completed' | 'cancelled'
  scope: EngagementScope
  created_at: string
  contacts: Contact | null
}

const ENGAGEMENT_STATUS_LABELS: Record<string, string> = {
  proposal_sent: 'Proposal Sent',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

// ─── Engagement Portal View ────────────────────────────────────────────────────

function EngagementPortal({
  engagement,
  token,
  onReload,
}: {
  engagement: Engagement
  token: string
  onReload: () => void
}) {
  const [tab, setTab] = useState<'overview' | 'proposal' | 'messages'>('overview')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [proposalDecision, setProposalDecision] = useState<'approve' | 'request_changes' | null>(null)
  const [messageText, setMessageText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [messages, setMessages] = useState<EngagementMessage[]>(engagement.scope.messages ?? [])

  const contact = engagement.contacts
  const proposal = engagement.scope.proposal

  async function handleProposalAction(action: 'approve' | 'request_changes') {
    setActionLoading(action)
    try {
      // Reuse the existing edge function that takes token + action
      const { data, error } = await supabase.functions.invoke('portal-approve-proposal', {
        body: { token, action, engagementId: engagement.id },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setProposalDecision(action)
    } catch (err: any) {
      toast.error(err.message || 'Failed to update proposal')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSendMessage() {
    if (!messageText.trim()) return
    setSendingMsg(true)
    const newMsg: EngagementMessage = {
      id: crypto.randomUUID(),
      author: 'client',
      body: messageText.trim(),
      created_at: new Date().toISOString(),
    }
    const updated = [...messages, newMsg]
    try {
      const { error } = await supabase
        .from('engagements')
        .update({ scope: { ...engagement.scope, messages: updated } })
        .eq('portal_token', token)
      if (error) throw error
      setMessages(updated)
      setMessageText('')
    } catch {
      toast.error('Failed to send message. Try again.')
    } finally {
      setSendingMsg(false)
    }
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'proposal' as const, label: 'Proposal' },
    { id: 'messages' as const, label: 'Messages', badge: messages.filter(m => m.author === 'freelancer').length || undefined },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-emerald-500" />
                Client Portal
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Welcome{contact ? `, ${contact.name}` : ''} — {engagement.service_name ?? 'Your Engagement'}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">
              {ENGAGEMENT_STATUS_LABELS[engagement.status] ?? engagement.status}
            </Badge>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors relative ${
                  tab === t.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {t.label}
                {t.badge ? (
                  <span className="ml-1.5 bg-emerald-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-8 space-y-4">

        {/* ── Overview tab ── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Engagement Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {engagement.service_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">{engagement.service_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">{ENGAGEMENT_STATUS_LABELS[engagement.status]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started</span>
                  <span className="font-medium">{new Date(engagement.created_at).toLocaleDateString()}</span>
                </div>
                {proposal?.pricing && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Investment</span>
                    <span className="font-semibold text-emerald-600">{proposal.pricing}</span>
                  </div>
                )}
                {proposal?.timeline && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Timeline</span>
                    <span className="font-medium">{proposal.timeline}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {proposal?.scope && proposal.scope.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Scope of Work</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {proposal.scope.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Proposal tab ── */}
        {tab === 'proposal' && (
          <div className="space-y-4">
            {!proposal ? (
              <p className="text-sm text-muted-foreground text-center py-8">No proposal attached yet.</p>
            ) : (
              <>
                {proposal.title && <h2 className="text-xl font-bold">{proposal.title}</h2>}
                {proposal.introduction && (
                  <Card>
                    <CardContent className="pt-5 text-sm leading-relaxed">{proposal.introduction}</CardContent>
                  </Card>
                )}
                {proposal.deliverables && proposal.deliverables.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Deliverables</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5">
                        {proposal.deliverables.map((d, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" /> {d}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                {proposal.nextSteps && proposal.nextSteps.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Next Steps</CardTitle></CardHeader>
                    <CardContent>
                      <ol className="space-y-1.5 list-decimal list-inside">
                        {proposal.nextSteps.map((s, i) => (
                          <li key={i} className="text-sm">{s}</li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                )}

                {engagement.status === 'proposal_sent' && !proposalDecision && (
                  <div className="flex gap-3 pt-2">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={!!actionLoading}
                      onClick={() => handleProposalAction('approve')}
                    >
                      <ThumbsUp className="w-4 h-4 mr-2" />
                      {actionLoading === 'approve' ? 'Approving…' : 'Approve Proposal'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={!!actionLoading}
                      onClick={() => handleProposalAction('request_changes')}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      {actionLoading === 'request_changes' ? 'Sending…' : 'Request Changes'}
                    </Button>
                  </div>
                )}

                {proposalDecision === 'approve' && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <PartyPopper className="w-4 h-4" /> Proposal approved — thank you!
                  </div>
                )}
                {proposalDecision === 'request_changes' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageSquare className="w-4 h-4" /> Changes requested — the team will follow up.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Messages tab ── */}
        {tab === 'messages' && (
          <div className="space-y-3">
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Start the conversation below.</p>
              ) : (
                messages.map(m => (
                  <div
                    key={m.id}
                    className={`flex ${m.author === 'client' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.author === 'client'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
                      <p>{m.body}</p>
                      <p className={`text-[10px] mt-1 ${m.author === 'client' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="Type a message…"
                className="resize-none min-h-[60px]"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() }
                }}
              />
              <Button
                size="icon"
                className="shrink-0 h-auto"
                onClick={handleSendMessage}
                disabled={sendingMsg || !messageText.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground pt-4">
          Powered by <span className="font-semibold text-emerald-600">Forgefly</span>
        </div>
      </div>
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  lead: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  completed: 'Completed',
  archived: 'Archived',
  draft: 'Draft',
  sent: 'Awaiting Response',
  approved: 'Approved',
  rejected: 'Rejected',
  unpaid: 'Unpaid',
  paid: 'Paid',
  overdue: 'Overdue',
};

// ─── Legacy portal (old client_portal_tokens architecture) ────────────────────

function LegacyClientPortal({ token }: { token: string }) {
  const [searchParams] = useSearchParams();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [proposalDecision, setProposalDecision] = useState<{
    title: string;
    action: 'approve' | 'request_changes';
  } | null>(null);

  useEffect(() => {
    validateTokenAndLoadData();
  }, [token]);

  useEffect(() => {
    const payment = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    if (payment === 'success') {
      toast.success('Payment successful! Thank you.');
      if (sessionId) {
        supabase.functions.invoke('verify-stripe-payment', {
          body: { sessionId },
        }).then(() => {
          // Reload invoices to reflect paid status
          if (token) validateTokenAndLoadData();
        });
      }
    }
    if (payment === 'cancelled') toast.info('Payment cancelled.');
  }, [searchParams]);

  async function validateTokenAndLoadData() {
    try {
      setLoading(true);
      setError(null);

      const { data: tokenData, error: tokenError } = await supabase
        .from('client_portal_tokens')
        .select('client_id, expires_at')
        .eq('token', token)
        .single();

      if (tokenError || !tokenData) {
        setError('Invalid or expired portal link. Please contact your service provider for a new link.');
        return;
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        setError('This portal link has expired. Please contact your service provider for a new link.');
        return;
      }

      await supabase
        .from('client_portal_tokens')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('token', token);

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', tokenData.client_id)
        .single();

      if (clientError || !clientData) {
        setError('Unable to load client data. Please try again later.');
        return;
      }

      setClient(clientData);

      const [projectsData, proposalsData, invoicesData] = await Promise.all([
        supabase.from('projects').select('*').eq('client_id', tokenData.client_id).order('created_at', { ascending: false }),
        supabase.from('proposals').select('*').eq('client_id', tokenData.client_id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('client_id', tokenData.client_id).order('created_at', { ascending: false }),
      ]);

      if (projectsData.data) setProjects(projectsData.data);
      if (proposalsData.data) setProposals(proposalsData.data);
      if (invoicesData.data) setInvoices(invoicesData.data);
    } catch {
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  async function handleProposalAction(proposalId: string, action: 'approve' | 'request_changes') {
    setActionLoading(proposalId + action);
    try {
      const { data, error } = await supabase.functions.invoke('portal-approve-proposal', {
        body: { token, proposalId, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const proposal = proposals.find(p => p.id === proposalId);
      setProposals(prev => prev.map(p =>
        p.id === proposalId ? { ...p, status: action === 'approve' ? 'accepted' : 'rejected' } : p
      ));
      setProposalDecision({ title: proposal?.title ?? 'Proposal', action });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update proposal');
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePayInvoice(invoiceId: string) {
    setActionLoading(invoiceId);
    try {
      const { data, error } = await supabase.functions.invoke('portal-create-checkout', {
        body: { token, invoiceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate payment');
      setActionLoading(null);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': case 'paid': case 'accepted': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'in_progress': case 'sent': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'overdue': case 'rejected': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': case 'paid': case 'accepted': return <CheckCircle2 className="w-3 h-3" />;
      case 'in_progress': case 'sent': return <Clock className="w-3 h-3" />;
      default: return <AlertCircle className="w-3 h-3" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="border-b bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-6">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Access Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={() => window.location.href = '/'} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeProjects = projects.filter(p => p.status === 'in_progress').length;
  const pendingProposals = proposals.filter(p => p.status === 'sent').length;
  const unpaidInvoices = invoices.filter(i => i.payment_status === 'unpaid' || i.payment_status === 'overdue');
  const totalOwed = unpaidInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const nextSteps: { label: string; cta: string }[] = [];
  if (pendingProposals > 0) nextSteps.push({ label: `${pendingProposals} proposal${pendingProposals > 1 ? 's' : ''} awaiting your response`, cta: 'Review below' });
  if (unpaidInvoices.length > 0) nextSteps.push({ label: `$${totalOwed.toLocaleString()} outstanding across ${unpaidInvoices.length} invoice${unpaidInvoices.length > 1 ? 's' : ''}`, cta: 'Pay below' });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-emerald-500" />
                Client Portal
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Welcome back, {client?.name || 'Valued Client'}</p>
            </div>
            <p className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-amber-500 bg-clip-text text-transparent">
              Forgefly
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">

        {/* Next Steps — only shown when action needed */}
        {nextSteps.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <ArrowRight className="w-4 h-4" />
                Action Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {nextSteps.map((step, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{step.label}</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{step.cta} ↓</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-emerald-500/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Projects</p>
                  <p className="text-3xl font-bold">{activeProjects}</p>
                </div>
                <div className="w-11 h-11 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pending Proposals</p>
                  <p className="text-3xl font-bold">{pendingProposals}</p>
                </div>
                <div className="w-11 h-11 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Amount Outstanding</p>
                  <p className="text-3xl font-bold">${totalOwed.toLocaleString()}</p>
                </div>
                <div className="w-11 h-11 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="w-4 h-4 text-emerald-500" />
              Projects
            </CardTitle>
            <CardDescription>Your ongoing work</CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No projects yet</p>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <div key={project.id} className="p-4 rounded-lg bg-muted/50 border border-transparent hover:border-emerald-500/20 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="font-semibold">{project.name}</h4>
                      <Badge variant="outline" className={`shrink-0 flex items-center gap-1 ${getStatusColor(project.status)}`}>
                        {getStatusIcon(project.status)}
                        {STATUS_LABELS[project.status] || project.status}
                      </Badge>
                    </div>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{project.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {project.deadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Due {new Date(project.deadline).toLocaleDateString()}
                        </span>
                      )}
                      {project.value && (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          ${Number(project.value).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Proposals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-amber-500" />
              Proposals
            </CardTitle>
            <CardDescription>Review and respond to proposals</CardDescription>
          </CardHeader>
          <CardContent>
            {proposals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No proposals yet</p>
            ) : (
              <div className="space-y-4">
                {proposals.map((proposal) => (
                  <div key={proposal.id} className="p-4 rounded-lg bg-muted/50 border border-transparent hover:border-amber-500/20 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h4 className="font-semibold">{proposal.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Sent {new Date(proposal.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className={`shrink-0 flex items-center gap-1 ${getStatusColor(proposal.status)}`}>
                        {getStatusIcon(proposal.status)}
                        {STATUS_LABELS[proposal.status] || proposal.status}
                      </Badge>
                    </div>

                    {proposal.introduction && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{proposal.introduction}</p>
                    )}

                    <div className="flex flex-wrap gap-3 text-sm mb-4">
                      {proposal.pricing && (
                        <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <DollarSign className="w-3.5 h-3.5" />
                          ${Number(proposal.pricing).toLocaleString()}
                        </span>
                      )}
                      {proposal.timeline && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {proposal.timeline}
                        </span>
                      )}
                    </div>

                    {proposal.status === 'sent' && (
                      <div className="flex gap-2 pt-3 border-t border-border">
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={actionLoading === proposal.id + 'approve'}
                          onClick={() => handleProposalAction(proposal.id, 'approve')}
                        >
                          <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                          {actionLoading === proposal.id + 'approve' ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={actionLoading === proposal.id + 'request_changes'}
                          onClick={() => handleProposalAction(proposal.id, 'request_changes')}
                        >
                          <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                          {actionLoading === proposal.id + 'request_changes' ? 'Sending...' : 'Request Changes'}
                        </Button>
                      </div>
                    )}

                    {proposal.status === 'accepted' && (
                      <div className="flex items-center gap-2 pt-3 border-t border-border text-sm text-emerald-600 dark:text-emerald-400">
                        <PartyPopper className="w-4 h-4" />
                        You approved this proposal
                      </div>
                    )}

                    {proposal.status === 'rejected' && (
                      <div className="flex items-center gap-2 pt-3 border-t border-border text-sm text-muted-foreground">
                        <MessageSquare className="w-4 h-4" />
                        Changes requested — the team will follow up
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="w-4 h-4 text-blue-500" />
              Invoices
            </CardTitle>
            <CardDescription>Payment information</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No invoices yet</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="p-4 rounded-lg bg-muted/50 border border-transparent hover:border-blue-500/20 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-semibold">{invoice.invoice_number}</h4>
                          <Badge variant="outline" className={`flex items-center gap-1 ${getStatusColor(invoice.payment_status)}`}>
                            {getStatusIcon(invoice.payment_status)}
                            {STATUS_LABELS[invoice.payment_status] || invoice.payment_status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {invoice.due_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Due {new Date(invoice.due_date).toLocaleDateString()}
                            </span>
                          )}
                          <span className="text-lg font-bold text-foreground">
                            ${typeof invoice.amount === 'string' ? parseFloat(invoice.amount).toLocaleString() : invoice.amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {(invoice.payment_status === 'unpaid' || invoice.payment_status === 'overdue') && (
                        <Button
                          className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shrink-0"
                          disabled={actionLoading === invoice.id}
                          onClick={() => handlePayInvoice(invoice.id)}
                        >
                          <Receipt className="w-4 h-4 mr-2" />
                          {actionLoading === invoice.id ? 'Loading...' : 'Pay Now'}
                        </Button>
                      )}
                      {invoice.payment_status === 'paid' && (
                        <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Paid
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        {client && (client.email || client.phone) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Need Help?</CardTitle>
              <CardDescription>Get in touch</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-3">
                {client.email && (
                  <Button variant="outline" className="flex-1" onClick={() => window.location.href = `mailto:${client.email}`}>
                    <Mail className="w-4 h-4 mr-2" />
                    {client.email}
                  </Button>
                )}
                {client.phone && (
                  <Button variant="outline" className="flex-1" onClick={() => window.location.href = `tel:${client.phone}`}>
                    <Phone className="w-4 h-4 mr-2" />
                    {client.phone}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-muted-foreground py-4">
          <p>This portal is private and secured. Only you can access this link.</p>
          <p className="mt-1">Powered by <span className="font-semibold text-emerald-600 dark:text-emerald-400">Forgefly</span></p>
        </div>
      </div>

      {/* ── Thank You Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!proposalDecision} onOpenChange={() => setProposalDecision(null)}>
        <DialogContent className="max-w-sm text-center px-8 py-10">
          {proposalDecision?.action === 'approve' ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <PartyPopper className="w-10 h-10 text-emerald-500" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Thank you!</h2>
              <p className="text-muted-foreground mb-1 font-medium">{proposalDecision.title}</p>
              <p className="text-sm text-muted-foreground mb-6">
                Your approval has been received. We're excited to get started — the team has been notified and will be in touch soon.
              </p>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setProposalDecision(null)}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Back to Portal
              </Button>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <MessageSquare className="w-10 h-10 text-muted-foreground" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Feedback received</h2>
              <p className="text-muted-foreground mb-1 font-medium">{proposalDecision?.title}</p>
              <p className="text-sm text-muted-foreground mb-6">
                We've noted your request for changes. The team will review your feedback and follow up with a revised proposal shortly.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setProposalDecision(null)}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Back to Portal
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main entry: detects engagement token, routes to correct portal ────────────

export default function ClientPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!token) { setChecked(true); return; }
    supabase
      .from('engagements')
      .select('*, contacts(*)')
      .eq('portal_token', token)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setEngagement(data as unknown as Engagement);
        setChecked(true);
      });
  }, [token]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (engagement) {
    return <EngagementPortal engagement={engagement} token={token!} onReload={() => {}} />;
  }

  return <LegacyClientPortal token={token!} />;
}
