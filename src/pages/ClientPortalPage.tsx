import {
  AlertCircle, ArrowRight, Bell, CheckCircle2, ChevronRight,
  Clock, FileText, Folder, Layers, Loader2, LogOut, Mail,
  MessageSquare, PartyPopper, Receipt, Send,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
// @ts-ignore
import { supabase } from '@/db/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalContact {
  id: string
  business_id: string
  name: string
  email: string
  company: string | null
  lifecycle_status: string
  portal_token: string
  unread_count: number
}

interface PortalBusiness {
  id: string
  name: string
  extracted_data: {
    brand?: { primaryColor?: string }
    identity?: { name?: string }
  }
}

interface PortalProposal {
  id: string
  title: string | null
  status: string
  initiated_by: string
  introduction: string | null
  services: string[] | null
  deliverables: string[] | null
  total_amount: number | null
  timeline: string | null
  terms: string | null
  created_at: string
  viewed_at: string | null
  responded_at: string | null
}

interface PortalInvoice {
  id: string
  invoice_number: string
  amount: number
  status: string
  payment_status: string
  due_date: string | null
  description: string | null
}

interface DBMessage {
  id: string
  engagement_id?: string
  client_id?: string
  sender_id: string
  sender_role: 'freelancer' | 'client'
  body: string
  created_at: string
}

type ContactTabId = 'overview' | 'proposals' | 'invoices' | 'projects' | 'messages' | 'files'

// Legacy types (for backward-compat engagement portal)
interface LegacyContact {
  id: string
  name: string
  company: string | null
  email: string | null
}

interface ProposalScope {
  title?: string
  introduction?: string
  scopeOfWork?: string[]
  deliverables?: string[]
  pricing?: string
  timeline?: string
  nextSteps?: string[]
}

interface EngagementScope {
  proposal?: ProposalScope
  project_id?: string
  invoice_id?: string
  kickoffDate?: string
}

interface LegacyEngagement {
  id: string
  business_id: string
  contact_id: string | null
  portal_token: string
  service_name: string | null
  status: 'proposal_sent' | 'active' | 'completed' | 'cancelled'
  scope: EngagementScope
  created_at: string
  contacts: LegacyContact | null
}

interface InvoiceRow {
  id: string
  invoice_number: string
  amount: number
  status: string
  payment_status: string
  due_date: string | null
  description: string | null
}

interface ProjectRow {
  id: string
  name: string
  description: string | null
  status: string
}

interface Task {
  id: string
  title: string
  description: string | null
  completed: boolean
}

type LegacyTabId = 'overview' | 'proposal' | 'invoice' | 'project' | 'messages'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function hexToRgb(hex: string): string {
  const c = parseInt(hex.replace('#', ''), 16);
  return `${(c >> 16) & 0xff}, ${(c >> 8) & 0xff}, ${c & 0xff}`;
}

function formatProposalStatus(status: string): string {
  const map: Record<string, string> = {
    sent: 'Awaiting review',
    viewed: 'Viewed',
    accepted: 'Accepted',
    declined: 'Declined',
    rejected: 'Declined',
    expired: 'Expired',
  };
  return map[status] || status;
}

function proposalStatusBg(status: string, accent: string): string {
  if (['sent', 'viewed'].includes(status)) return `rgba(${hexToRgb(accent)},0.12)`;
  if (status === 'accepted') return 'rgba(16,185,129,0.12)';
  if (['declined', 'rejected'].includes(status)) return 'rgba(239,68,68,0.12)';
  return '#2a2a2a';
}

function proposalStatusColor(status: string, accent: string): string {
  if (['sent', 'viewed'].includes(status)) return accent;
  if (status === 'accepted') return '#10b981';
  if (['declined', 'rejected'].includes(status)) return '#ef4444';
  return '#888';
}

// ─── AuthGate ─────────────────────────────────────────────────────────────────

function AuthGate({
  businessName,
  clientName,
  accent,
  token,
  onAuthed,
}: {
  businessName: string
  clientName: string
  accent: string
  token: string
  onAuthed: () => void
}) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/portal/${token}` },
    });
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
    setSending(false);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/portal/${token}` },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#111111' }}>
      <div className="w-full max-w-sm rounded-2xl p-8 border" style={{ background: '#1a1a1a', borderColor: `rgba(${hexToRgb(accent)}, 0.2)` }}>
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white mb-3" style={{ background: accent }}>
            {initials(businessName)}
          </div>
          <h1 className="text-white font-semibold text-lg">{businessName}</h1>
        </div>
        <p className="text-center text-white font-medium mb-1">You've been invited to a client portal</p>
        <p className="text-center text-sm mb-6" style={{ color: '#888' }}>Hi {clientName} — sign in to access your portal</p>
        {sent ? (
          <div className="rounded-xl p-4 text-center text-sm" style={{ background: `rgba(${hexToRgb(accent)}, 0.1)`, color: accent }}>
            <CheckCircle2 className="w-5 h-5 mx-auto mb-2" />
            Check your email for the magic link
          </div>
        ) : (
          <>
            <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 rounded-xl py-3 mb-4 font-medium text-sm transition-opacity hover:opacity-80" style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #333' }}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2a10.34 10.34 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z"/>
                <path fill="#FBBC05" d="M3.98 10.72A5.41 5.41 0 0 1 3.7 9c0-.6.1-1.18.28-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.06l3.02-2.34Z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.34L14.98 2.4A9 9 0 0 0 0 4.94l3.02 2.34C3.68 5.16 6.16 3.58 9 3.58Z"/>
              </svg>
              Sign in with Google
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: '#333' }} />
              <span className="text-xs" style={{ color: '#666' }}>or</span>
              <div className="flex-1 h-px" style={{ background: '#333' }} />
            </div>
            <form onSubmit={handleMagicLink} className="space-y-3">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: '#242424', border: '1px solid #333', color: '#fff' }}
              />
              <button type="submit" disabled={sending} className="w-full rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90" style={{ background: accent, color: '#fff' }}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {sending ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          </>
        )}
        <p className="text-center text-xs mt-6" style={{ color: '#555' }}>forgefly.io/portal/{token}</p>
      </div>
    </div>
  );
}

// ─── AccessDenied ─────────────────────────────────────────────────────────────

function AccessDenied({ accent }: { accent: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#111' }}>
      <div className="max-w-sm w-full text-center p-8 rounded-2xl" style={{ background: '#1a1a1a' }}>
        <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#ef4444' }} />
        <h2 className="text-white text-lg font-semibold mb-2">Portal not linked to your account</h2>
        <p className="text-sm mb-6" style={{ color: '#888' }}>This portal is linked to a different email address. Please sign in with the email your invitation was sent to.</p>
        <button onClick={() => supabase.auth.signOut()} className="text-sm px-4 py-2 rounded-lg transition-opacity hover:opacity-80" style={{ background: accent, color: '#fff' }}>
          Sign out and try again
        </button>
      </div>
    </div>
  );
}

// ─── ContactHub ───────────────────────────────────────────────────────────────

function ContactHub({
  contact,
  business,
  token,
}: {
  contact: PortalContact
  business: PortalBusiness
  token: string
}) {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<ContactTabId>('overview');
  const [proposals, setProposals] = useState<PortalProposal[]>([]);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<PortalProposal | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(contact.unread_count);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const accent = business.extracted_data?.brand?.primaryColor || '#10b981';
  const businessName = business.extracted_data?.identity?.name || business.name;

  // Get current auth user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string; email?: string } | null } }) => {
      if (data.user) setCurrentUser({ id: data.user.id, email: data.user.email });
    });
  }, []);

  // Handle payment return
  useEffect(() => {
    const payment = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    if (payment === 'success') {
      toast.success('Payment successful! Thank you.');
      if (sessionId) supabase.functions.invoke('verify-stripe-payment', { body: { sessionId } });
    }
    if (payment === 'cancelled') toast.info('Payment cancelled.');
  }, [searchParams]);

  // Load proposals + invoices
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: props }, { data: invs }] = await Promise.all([
        supabase
          .from('proposals')
          .select('id, title, status, initiated_by, introduction, services, deliverables, total_amount, timeline, terms, created_at, viewed_at, responded_at')
          .eq('business_id', contact.business_id)
          .eq('client_email', contact.email)
          .in('status', ['sent', 'viewed', 'accepted', 'declined', 'rejected', 'expired'])
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select('id, invoice_number, amount, status, payment_status, due_date, description')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false }),
      ]);
      setProposals(props || []);
      setInvoices(invs || []);
      setLoading(false);
    }
    load();
  }, [contact.business_id, contact.email, contact.id]);

  // Load messages (by client_id — populated after migration #32)
  useEffect(() => {
    supabase
      .from('messages')
      .select('*')
      .eq('client_id', contact.id)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: DBMessage[] | null }) => setMessages(data || []));

    const channel = supabase
      .channel(`hub-messages:${contact.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `client_id=eq.${contact.id}`,
      }, (payload: { new: DBMessage }) => {
        setMessages(prev => [...prev, payload.new]);
        if (payload.new.sender_role === 'freelancer') {
          setUnreadCount(n => n + 1);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [contact.id]);

  // Clear unread badge when messages tab is opened
  useEffect(() => {
    if (tab === 'messages' && unreadCount > 0) {
      setUnreadCount(0);
      supabase.from('contacts').update({ unread_count: 0 }).eq('id', contact.id);
    }
  }, [tab, contact.id]); // intentionally excludes unreadCount to avoid loop

  // Scroll messages to bottom
  useEffect(() => {
    if (tab === 'messages') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tab]);

  async function handleViewProposal(proposal: PortalProposal) {
    setSelectedProposal(proposal);
    if (proposal.status === 'sent') {
      supabase.functions.invoke('portal-approve-proposal', {
        body: { proposalId: proposal.id, action: 'track_viewed' },
      });
      setProposals(prev => prev.map(p =>
        p.id === proposal.id ? { ...p, status: 'viewed', viewed_at: new Date().toISOString() } : p
      ));
    }
  }

  async function handleApproveProposal(proposal: PortalProposal) {
    setActionLoading('approve-' + proposal.id);
    try {
      const { error } = await supabase.functions.invoke('portal-approve-proposal', {
        body: { proposalId: proposal.id, action: 'approve' },
      });
      if (error) throw error;
      setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: 'accepted' } : p));
      setApproved(prev => new Set(prev).add(proposal.id));
      setSelectedProposal(prev => prev?.id === proposal.id ? { ...prev, status: 'accepted' } : prev);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSendMessage() {
    if (!msgText.trim() || !currentUser?.id) return;
    setSendingMsg(true);
    const body = msgText.trim();
    setMsgText('');
    try {
      const { error } = await supabase.from('messages').insert({
        business_id: contact.business_id,
        client_id: contact.id,
        sender_id: currentUser.id,
        sender_role: 'client',
        body,
      });
      if (error) throw error;
    } catch {
      toast.error('Failed to send message');
      setMsgText(body);
    } finally {
      setSendingMsg(false);
    }
  }

  async function handlePayInvoice(invoice: PortalInvoice) {
    setActionLoading('pay-' + invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-invoice-checkout', {
        body: { invoiceId: invoice.id, portalToken: token },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error('No checkout URL returned');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Payment failed');
      setActionLoading(null);
    }
  }

  const tabs: { id: ContactTabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'proposals', label: 'Proposals' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'projects', label: 'Projects' },
    { id: 'messages', label: 'Messages' },
    { id: 'files', label: 'Files' },
  ];

  const activeProposals = proposals.filter(p => ['sent', 'viewed'].includes(p.status));
  const openInvoices = invoices.filter(i => i.payment_status !== 'paid');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#111111', color: '#e5e5e5' }}>

      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: accent }}>
            {initials(businessName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white leading-tight truncate">{businessName}</div>
            {contact.company && (
              <div className="text-xs truncate" style={{ color: '#888' }}>{contact.company}</div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Notification bell */}
            <button
              onClick={() => setTab('messages')}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ background: '#2a2a2a' }}
              title="Messages"
            >
              <Bell className="w-4 h-4" style={{ color: '#888' }} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold px-1" style={{ background: '#ef4444', color: '#fff' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Client avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-opacity hover:opacity-80 focus:outline-none"
                  style={{ background: `rgba(${hexToRgb(accent)}, 0.15)`, color: accent }}
                  title={contact.name}
                >
                  {initials(contact.name)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52" style={{ background: '#1e1e1e', border: '1px solid #2a2a2a' }}>
                <DropdownMenuLabel style={{ color: '#888' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `rgba(${hexToRgb(accent)}, 0.15)`, color: accent }}>
                      {initials(contact.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: '#e5e5e5' }}>{contact.name}</div>
                      <div className="text-[10px] truncate" style={{ color: '#666' }}>{contact.email}</div>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator style={{ background: '#2a2a2a' }} />
                <DropdownMenuItem
                  onClick={() => supabase.auth.signOut()}
                  className="cursor-pointer gap-2 focus:bg-white/5"
                  style={{ color: '#ef4444' }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-px">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: tab === t.id ? accent : '#888',
                  borderBottom: tab === t.id ? `2px solid ${accent}` : '2px solid transparent',
                  background: 'transparent',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">

        {/* Overview */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="rounded-2xl p-5" style={{ background: '#1a1a1a' }}>
              <div className="text-lg font-semibold text-white mb-1">
                Welcome back, {contact.name.split(' ')[0]}
              </div>
              <div className="text-sm" style={{ color: '#888' }}>
                Your portal with {businessName}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setTab('proposals')} className="rounded-2xl p-4 text-left transition-opacity hover:opacity-80" style={{ background: '#1a1a1a' }}>
                <div className="text-2xl font-bold mb-1" style={{ color: accent }}>{activeProposals.length}</div>
                <div className="text-xs" style={{ color: '#888' }}>Proposals awaiting review</div>
              </button>
              <button onClick={() => setTab('invoices')} className="rounded-2xl p-4 text-left transition-opacity hover:opacity-80" style={{ background: '#1a1a1a' }}>
                <div className="text-2xl font-bold mb-1" style={{ color: accent }}>{openInvoices.length}</div>
                <div className="text-xs" style={{ color: '#888' }}>Open invoices</div>
              </button>
            </div>

            {proposals.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#1a1a1a' }}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#666' }}>
                  Proposals
                </div>
                <div className="space-y-1">
                  {proposals.slice(0, 3).map(p => (
                    <button key={p.id} onClick={() => { setTab('proposals'); handleViewProposal(p); }}
                      className="w-full flex items-center justify-between py-2 text-left transition-opacity hover:opacity-80"
                    >
                      <span className="text-sm text-white truncate">{p.title || 'Proposal'}</span>
                      <span className="text-xs ml-3 shrink-0 px-2 py-0.5 rounded-full"
                        style={{ background: proposalStatusBg(p.status, accent), color: proposalStatusColor(p.status, accent) }}>
                        {formatProposalStatus(p.status)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Proposals */}
        {tab === 'proposals' && (
          <div className="space-y-3">
            {loading ? (
              [1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" style={{ background: '#1a1a1a' }} />)
            ) : proposals.length === 0 ? (
              <div className="text-center py-16" style={{ color: '#555' }}>
                <FileText className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No proposals yet.</p>
              </div>
            ) : (
              proposals.map(p => (
                <button key={p.id} onClick={() => handleViewProposal(p)}
                  className="w-full rounded-2xl p-4 text-left transition-opacity hover:opacity-90"
                  style={{ background: '#1a1a1a' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{p.title || 'Proposal'}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#666' }}>
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {p.total_amount ? ` · $${Number(p.total_amount).toLocaleString()}` : ''}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: proposalStatusBg(p.status, accent), color: proposalStatusColor(p.status, accent) }}>
                      {formatProposalStatus(p.status)}
                    </span>
                  </div>
                  {['sent', 'viewed'].includes(p.status) && (
                    <div className="mt-2 text-xs font-medium" style={{ color: accent }}>Tap to review →</div>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* Invoices */}
        {tab === 'invoices' && (
          <div className="space-y-3">
            {loading ? (
              <Skeleton className="h-32 w-full rounded-2xl" style={{ background: '#1a1a1a' }} />
            ) : invoices.length === 0 ? (
              <div className="text-center py-16" style={{ color: '#555' }}>
                <Receipt className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No invoices yet.</p>
              </div>
            ) : (
              invoices.map(inv => (
                <div key={inv.id} className="rounded-2xl p-5" style={{ background: '#1a1a1a' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold text-white">#{inv.invoice_number}</div>
                      {inv.description && <div className="text-xs mt-0.5" style={{ color: '#888' }}>{inv.description}</div>}
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{
                        background: inv.payment_status === 'paid' ? `rgba(${hexToRgb(accent)},0.12)` : '#2a2a2a',
                        color: inv.payment_status === 'paid' ? accent : '#888',
                      }}>
                      {inv.payment_status === 'paid' ? 'Paid' : inv.payment_status === 'overdue' ? 'Overdue' : 'Outstanding'}
                    </span>
                  </div>
                  <div className="text-2xl font-bold mb-1" style={{ color: accent }}>
                    ${Number(inv.amount).toLocaleString()}
                  </div>
                  {inv.due_date && (
                    <div className="text-xs mb-3" style={{ color: '#666' }}>
                      Due {new Date(inv.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  {inv.payment_status !== 'paid' && (
                    <button disabled={actionLoading === 'pay-' + inv.id} onClick={() => handlePayInvoice(inv)}
                      className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                      style={{ background: accent, color: '#fff' }}
                    >
                      {actionLoading === 'pay-' + inv.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Receipt className="w-4 h-4" />}
                      {actionLoading === 'pay-' + inv.id ? 'Redirecting…' : 'Pay with Stripe →'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Projects */}
        {tab === 'projects' && (
          <div className="text-center py-16" style={{ color: '#555' }}>
            <Layers className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No active projects yet.</p>
          </div>
        )}

        {/* Messages */}
        {tab === 'messages' && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
            <div className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1">
              {messages.length === 0 ? (
                <div className="text-center py-16" style={{ color: '#555' }}>
                  <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No messages yet. Start the conversation.</p>
                </div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender_role === 'client' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[78%] rounded-2xl px-4 py-2.5"
                      style={m.sender_role === 'client'
                        ? { background: accent, color: '#fff' }
                        : { background: '#1e1e1e', color: '#e5e5e5', border: '1px solid #2a2a2a' }}
                    >
                      <p className="text-sm">{m.body}</p>
                      <p className="text-[10px] mt-1" style={{ color: m.sender_role === 'client' ? 'rgba(255,255,255,0.55)' : '#555' }}>
                        {new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2 items-end pt-3 border-t" style={{ borderColor: '#2a2a2a' }}>
              <Textarea value={msgText} onChange={e => setMsgText(e.target.value)}
                placeholder={`Message ${businessName}…`}
                className="flex-1 resize-none min-h-[44px] max-h-32 text-sm rounded-xl border-0 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ background: '#1e1e1e', color: '#e5e5e5' }}
                rows={1}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              />
              <button onClick={handleSendMessage} disabled={sendingMsg || !msgText.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: accent, color: '#fff' }}
              >
                {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Files */}
        {tab === 'files' && (
          <div className="text-center py-16" style={{ color: '#555' }}>
            <Folder className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No files shared yet.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t py-5 text-center" style={{ borderColor: '#2a2a2a' }}>
        <a href="https://forgefly.io" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-opacity hover:opacity-70"
          style={{ background: '#1e1e1e', color: '#555', border: '1px solid #2a2a2a' }}>
          <span style={{ color: accent, fontWeight: 600 }}>⚡</span>
          Powered by Forgefly
          <ChevronRight className="w-3 h-3" />
        </a>
      </footer>

      {/* Proposal detail dialog */}
      {selectedProposal && (
        <Dialog open={!!selectedProposal} onOpenChange={open => { if (!open) setSelectedProposal(null); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}>
            <DialogHeader>
              <DialogTitle className="text-white pr-6">{selectedProposal.title || 'Proposal'}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: proposalStatusBg(selectedProposal.status, accent), color: proposalStatusColor(selectedProposal.status, accent) }}>
                  {formatProposalStatus(selectedProposal.status)}
                </span>
                {selectedProposal.total_amount && (
                  <span className="text-sm font-semibold" style={{ color: accent }}>
                    ${Number(selectedProposal.total_amount).toLocaleString()}
                  </span>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {selectedProposal.introduction && (
                <p className="text-sm leading-relaxed" style={{ color: '#ccc' }}>{selectedProposal.introduction}</p>
              )}

              {Array.isArray(selectedProposal.services) && selectedProposal.services.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#666' }}>Scope of Work</div>
                  <ul className="space-y-1.5">
                    {selectedProposal.services.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#ccc' }}>
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accent }} />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(selectedProposal.deliverables) && selectedProposal.deliverables.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#666' }}>Deliverables</div>
                  <ul className="space-y-1">
                    {selectedProposal.deliverables.map((d, i) => (
                      <li key={i} className="text-sm" style={{ color: '#ccc' }}>· {d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(selectedProposal.total_amount || selectedProposal.timeline) && (
                <div className="grid grid-cols-2 gap-4 rounded-xl p-4" style={{ background: '#242424' }}>
                  {selectedProposal.total_amount && (
                    <div>
                      <div className="text-xs" style={{ color: '#666' }}>Investment</div>
                      <div className="text-lg font-bold mt-0.5" style={{ color: accent }}>
                        ${Number(selectedProposal.total_amount).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {selectedProposal.timeline && (
                    <div>
                      <div className="text-xs" style={{ color: '#666' }}>Timeline</div>
                      <div className="text-sm font-semibold mt-0.5 text-white">{selectedProposal.timeline}</div>
                    </div>
                  )}
                </div>
              )}

              {selectedProposal.terms && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#666' }}>Terms</div>
                  <p className="text-xs leading-relaxed" style={{ color: '#777' }}>{selectedProposal.terms}</p>
                </div>
              )}

              {['sent', 'viewed'].includes(selectedProposal.status) && !approved.has(selectedProposal.id) && (
                <div className="pt-2 space-y-2 border-t" style={{ borderColor: '#2a2a2a' }}>
                  <button disabled={!!actionLoading} onClick={() => handleApproveProposal(selectedProposal)}
                    className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                    style={{ background: accent, color: '#fff' }}
                  >
                    {actionLoading === 'approve-' + selectedProposal.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <CheckCircle2 className="w-4 h-4" />}
                    {actionLoading === 'approve-' + selectedProposal.id ? 'Approving…' : 'Approve Proposal'}
                  </button>
                  <button onClick={() => { setSelectedProposal(null); setTab('messages'); }}
                    className="w-full py-2 rounded-xl text-sm transition-opacity hover:opacity-80"
                    style={{ background: '#2a2a2a', color: '#888' }}
                  >
                    Request changes via messages
                  </button>
                </div>
              )}

              {(selectedProposal.status === 'accepted' || approved.has(selectedProposal.id)) && (
                <div className="rounded-xl p-3 flex items-center gap-2 text-sm" style={{ background: `rgba(${hexToRgb(accent)},0.1)`, color: accent }}>
                  <PartyPopper className="w-4 h-4 shrink-0" />
                  Proposal approved — thank you!
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── ContactPortalWithAuth ────────────────────────────────────────────────────

function ContactPortalWithAuth({
  contact,
  business,
  token,
}: {
  contact: PortalContact
  business: PortalBusiness
  token: string
}) {
  const [authState, setAuthState] = useState<'loading' | 'gate' | 'denied' | 'authed'>('loading');
  const accent = business.extracted_data?.brand?.primaryColor || '#10b981';
  const businessName = business.extracted_data?.identity?.name || business.name;

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) setAuthState('gate');
        return;
      }
      if (user.email === contact.email) {
        if (mounted) setAuthState('authed');
      } else {
        if (mounted) setAuthState('denied');
      }
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: unknown) => {
      if (session) checkAuth();
      else if (mounted) setAuthState('gate');
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [contact.email]);

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: accent }} />
      </div>
    );
  }

  if (authState === 'gate') {
    return (
      <AuthGate
        businessName={businessName}
        clientName={contact.name}
        accent={accent}
        token={token}
        onAuthed={() => setAuthState('authed')}
      />
    );
  }

  if (authState === 'denied') return <AccessDenied accent={accent} />;

  return <ContactHub contact={contact} business={business} token={token} />;
}

// ─── Legacy EngagementPortal (unchanged — serves old portal_token links) ──────

function EngagementPortal({
  engagement,
  business,
  token,
}: {
  engagement: LegacyEngagement
  business: PortalBusiness
  token: string
}) {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<LegacyTabId>('overview');
  const [proposalDecision, setProposalDecision] = useState<'approve' | 'request_changes' | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [changesText, setChangesText] = useState('');
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const viewedTrackedRef = useRef(false);

  const accent = business.extracted_data?.brand?.primaryColor || '#10b981';
  const businessName = business.extracted_data?.identity?.name || business.name;
  const contact = engagement.contacts;
  const proposal = engagement.scope?.proposal;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string; email?: string } | null } }) => {
      if (data.user) setCurrentUser({ id: data.user.id, email: data.user.email });
    });
  }, []);

  useEffect(() => {
    if (tab !== 'proposal' || viewedTrackedRef.current) return;
    viewedTrackedRef.current = true;
    supabase.functions.invoke('portal-approve-proposal', {
      body: { engagementId: engagement.id, action: 'track_viewed' },
    });
  }, [tab, engagement.id]);

  useEffect(() => {
    const payment = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    if (payment === 'success') {
      toast.success('Payment successful! Thank you.');
      if (sessionId) supabase.functions.invoke('verify-stripe-payment', { body: { sessionId } });
    }
    if (payment === 'cancelled') toast.info('Payment cancelled.');
  }, [searchParams]);

  useEffect(() => {
    const invoiceId = engagement.scope?.invoice_id;
    if (!invoiceId) return;
    setInvoiceLoading(true);
    supabase.from('invoices').select('id, invoice_number, amount, status, payment_status, due_date, description')
      .eq('id', invoiceId).maybeSingle()
      .then(({ data }: { data: InvoiceRow | null }) => { setInvoice(data); setInvoiceLoading(false); });
  }, [engagement.scope?.invoice_id]);

  useEffect(() => {
    const projectId = engagement.scope?.project_id;
    if (!projectId) return;
    setProjectLoading(true);
    Promise.all([
      supabase.from('projects').select('id, name, description, status').eq('id', projectId).maybeSingle(),
      supabase.from('tasks').select('id, title, description, completed').eq('project_id', projectId).order('created_at'),
    ]).then(([{ data: proj }, { data: taskData }]: [{ data: ProjectRow | null }, { data: Task[] | null }]) => {
      setProject(proj); setTasks(taskData || []); setProjectLoading(false);
    });
  }, [engagement.scope?.project_id]);

  useEffect(() => {
    setMsgLoading(true);
    supabase.from('messages').select('*').eq('engagement_id', engagement.id)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: DBMessage[] | null }) => { setMessages(data || []); setMsgLoading(false); });

    const channel = supabase.channel(`messages:${engagement.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `engagement_id=eq.${engagement.id}` },
        (payload: { new: DBMessage }) => setMessages(prev => [...prev, payload.new]))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [engagement.id]);

  useEffect(() => {
    if (tab === 'messages') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tab]);

  async function handleApproveProposal() {
    setActionLoading('approve');
    try {
      const { error } = await supabase.functions.invoke('portal-approve-proposal', {
        body: { engagementId: engagement.id, action: 'approve' },
      });
      if (error) throw error;
      setProposalDecision('approve');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to approve proposal');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRequestChanges() {
    if (!changesText.trim()) return;
    setActionLoading('request_changes');
    try {
      if (currentUser?.id) {
        await supabase.from('messages').insert({
          engagement_id: engagement.id,
          sender_id: currentUser.id,
          sender_role: 'client',
          body: `[Proposal feedback] ${changesText.trim()}`,
        });
      }
      setProposalDecision('request_changes');
      setChangesText('');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to send feedback');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSendMessage() {
    if (!msgText.trim() || !currentUser?.id) return;
    setSendingMsg(true);
    const body = msgText.trim();
    setMsgText('');
    try {
      const { error } = await supabase.from('messages').insert({
        engagement_id: engagement.id,
        sender_id: currentUser.id,
        sender_role: 'client',
        body,
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error('Failed to send message');
      setMsgText(body);
    } finally {
      setSendingMsg(false);
    }
  }

  async function handlePayInvoice() {
    if (!invoice) return;
    setActionLoading('pay');
    try {
      const { data, error } = await supabase.functions.invoke('create-invoice-checkout', {
        body: { invoiceId: invoice.id, portalToken: token },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error('No checkout URL returned');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to initiate payment');
      setActionLoading(null);
    }
  }

  const tabs: { id: LegacyTabId; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'proposal', label: 'Proposal' },
    { id: 'invoice', label: 'Invoice' },
    { id: 'project', label: 'Project' },
    { id: 'messages', label: 'Messages', badge: messages.filter(m => m.sender_role === 'freelancer').length || undefined },
  ];

  const statusMap: Record<string, string> = {
    proposal_sent: 'Proposal Sent', active: 'Active', completed: 'Completed', cancelled: 'Cancelled',
  };

  const timelineItems = [
    { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Request submitted', detail: new Date(engagement.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), done: true },
    { icon: <ArrowRight className="w-4 h-4" />, label: 'Proposal sent', detail: engagement.status !== 'proposal_sent' && engagement.status !== 'active' && engagement.status !== 'completed' ? 'Pending' : 'Sent', done: engagement.status !== 'proposal_sent' || !!proposal },
    { icon: <Receipt className="w-4 h-4" />, label: 'Payment', detail: invoice?.payment_status === 'paid' ? 'Paid' : 'Pending', done: invoice?.payment_status === 'paid' },
    { icon: <Layers className="w-4 h-4" />, label: 'Kick-off', detail: engagement.scope?.kickoffDate ? new Date(engagement.scope.kickoffDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : proposal?.timeline ? `Est. ${proposal.timeline}` : 'TBD', done: engagement.status === 'active' || engagement.status === 'completed' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#111111', color: '#e5e5e5' }}>
      <header className="sticky top-0 z-30 border-b" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: accent }}>
            {initials(businessName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white leading-tight truncate">{businessName}</div>
            <div className="text-xs truncate" style={{ color: '#888' }}>
              {engagement.service_name}{contact?.company ? ` · ${contact.company}` : ''}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs hidden sm:block" style={{ color: '#555' }}>Powered by Forgefly</span>
            {contact && (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: '#2a2a2a', color: '#aaa' }} title={contact.name}>
                {initials(contact.name)}
              </div>
            )}
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-px">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className="relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors"
                style={{ color: tab === t.id ? accent : '#888', borderBottom: tab === t.id ? `2px solid ${accent}` : '2px solid transparent', background: 'transparent' }}>
                {t.label}
                {t.badge ? <span className="ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 font-semibold" style={{ background: accent, color: '#fff' }}>{t.badge}</span> : null}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {tab === 'overview' && (
          <div className="space-y-4">
            {engagement.status === 'proposal_sent' && (
              <button onClick={() => setTab('proposal')} className="w-full flex items-center justify-between p-4 rounded-xl text-left transition-opacity hover:opacity-90"
                style={{ background: `rgba(${hexToRgb(accent)}, 0.12)`, border: `1px solid rgba(${hexToRgb(accent)}, 0.3)` }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: accent }}>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: accent }}>Proposal ready for review</div>
                    <div className="text-xs" style={{ color: '#888' }}>Click to view and approve</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: accent }} />
              </button>
            )}
            <div className="rounded-2xl p-5" style={{ background: '#1a1a1a' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-white">{engagement.service_name || 'Engagement'}</div>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `rgba(${hexToRgb(accent)}, 0.12)`, color: accent }}>
                  {statusMap[engagement.status] || engagement.status}
                </span>
              </div>
              {proposal?.pricing && (
                <div className="text-3xl font-bold mb-1" style={{ color: accent }}>
                  {proposal.pricing.startsWith('$') ? proposal.pricing : `$${proposal.pricing}`}
                </div>
              )}
              {proposal?.timeline && <div className="text-xs" style={{ color: '#888' }}>Timeline: {proposal.timeline}</div>}
            </div>
            <div className="rounded-2xl p-5 space-y-4" style={{ background: '#1a1a1a' }}>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#666' }}>Timeline</div>
              {timelineItems.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: item.done ? `rgba(${hexToRgb(accent)}, 0.15)` : '#242424', color: item.done ? accent : '#555' }}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: item.done ? '#e5e5e5' : '#666' }}>{item.label}</div>
                    <div className="text-xs" style={{ color: '#555' }}>{item.detail}</div>
                  </div>
                  {item.done && <CheckCircle2 className="w-4 h-4 shrink-0 mt-1" style={{ color: accent }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'proposal' && (
          <div className="space-y-4">
            {!proposal ? (
              <div className="text-center py-16" style={{ color: '#555' }}>
                <ArrowRight className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No proposal attached yet.</p>
              </div>
            ) : (
              <>
                {proposal.title && <h2 className="text-xl font-bold text-white">{proposal.title}</h2>}
                {proposal.introduction && (
                  <div className="rounded-2xl p-5" style={{ background: '#1a1a1a' }}>
                    <p className="text-sm leading-relaxed" style={{ color: '#ccc' }}>{proposal.introduction}</p>
                  </div>
                )}
                {proposal.scopeOfWork && proposal.scopeOfWork.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: '#1a1a1a' }}>
                    <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#666' }}>Scope of Work</div>
                    <ul className="space-y-2.5">
                      {proposal.scopeOfWork.map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: '#ccc' }}>
                          <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `rgba(${hexToRgb(accent)}, 0.15)`, color: accent }}>
                            <CheckCircle2 className="w-3 h-3" />
                          </div>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(proposal.pricing || proposal.timeline) && (
                  <div className="rounded-2xl p-5 grid grid-cols-2 gap-4" style={{ background: '#1a1a1a' }}>
                    {proposal.pricing && (
                      <div>
                        <div className="text-xs" style={{ color: '#666' }}>Investment</div>
                        <div className="text-xl font-bold mt-1" style={{ color: accent }}>
                          {proposal.pricing.startsWith('$') ? proposal.pricing : `$${proposal.pricing}`}
                        </div>
                      </div>
                    )}
                    {proposal.timeline && (
                      <div>
                        <div className="text-xs" style={{ color: '#666' }}>Timeline</div>
                        <div className="text-sm font-semibold mt-1 text-white">{proposal.timeline}</div>
                      </div>
                    )}
                  </div>
                )}
                {engagement.status === 'proposal_sent' && !proposalDecision && (
                  <div className="space-y-3 pt-2">
                    <button disabled={!!actionLoading} onClick={handleApproveProposal}
                      className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                      style={{ background: accent, color: '#fff' }}>
                      {actionLoading === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {actionLoading === 'approve' ? 'Approving…' : 'Approve Proposal'}
                    </button>
                    <div className="rounded-xl p-4" style={{ background: '#1a1a1a' }}>
                      <div className="text-sm font-medium mb-2 text-white">Request changes</div>
                      <Textarea value={changesText} onChange={e => setChangesText(e.target.value)} placeholder="Describe what you'd like changed…"
                        className="resize-none text-sm border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-[#ccc] placeholder:text-[#555]" rows={3} />
                      <button disabled={!!actionLoading || !changesText.trim()} onClick={handleRequestChanges}
                        className="mt-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-opacity hover:opacity-80 disabled:opacity-40"
                        style={{ background: '#2a2a2a', color: '#ccc', border: '1px solid #333' }}>
                        {actionLoading === 'request_changes' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                        Send Feedback
                      </button>
                    </div>
                  </div>
                )}
                {proposalDecision === 'approve' && (
                  <div className="rounded-xl p-4 flex items-center gap-3 text-sm" style={{ background: `rgba(${hexToRgb(accent)}, 0.1)`, color: accent }}>
                    <PartyPopper className="w-5 h-5 shrink-0" />
                    Proposal approved — thank you! The team has been notified.
                  </div>
                )}
                {proposalDecision === 'request_changes' && (
                  <div className="rounded-xl p-4 flex items-center gap-3 text-sm" style={{ background: '#1a1a1a', color: '#888' }}>
                    <MessageSquare className="w-5 h-5 shrink-0" />
                    Feedback sent — the team will review and follow up.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'invoice' && (
          <div className="space-y-4">
            {invoiceLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-2xl" style={{ background: '#1a1a1a' }} />
                <Skeleton className="h-12 w-full rounded-2xl" style={{ background: '#1a1a1a' }} />
              </div>
            ) : !invoice ? (
              <div className="text-center py-16" style={{ color: '#555' }}>
                <Receipt className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No invoice attached yet.</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl p-5" style={{ background: '#1a1a1a' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#666' }}>Invoice</div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: invoice.payment_status === 'paid' ? `rgba(${hexToRgb(accent)}, 0.12)` : '#2a2a2a', color: invoice.payment_status === 'paid' ? accent : '#888' }}>
                      {invoice.payment_status === 'paid' ? 'Paid' : invoice.payment_status === 'overdue' ? 'Overdue' : 'Outstanding'}
                    </span>
                  </div>
                  <div className="text-white font-semibold text-lg mb-1">#{invoice.invoice_number}</div>
                  {invoice.description && <div className="text-sm mb-3" style={{ color: '#888' }}>{invoice.description}</div>}
                  <div className="text-3xl font-bold" style={{ color: accent }}>${Number(invoice.amount).toLocaleString()}</div>
                  {invoice.due_date && <div className="text-xs mt-1" style={{ color: '#666' }}>Due {new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>}
                </div>
                {invoice.payment_status !== 'paid' ? (
                  <button disabled={actionLoading === 'pay'} onClick={handlePayInvoice}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                    style={{ background: accent, color: '#fff' }}>
                    {actionLoading === 'pay' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                    {actionLoading === 'pay' ? 'Redirecting…' : 'Pay with Stripe →'}
                  </button>
                ) : (
                  <div className="rounded-xl p-4 flex items-center justify-center gap-3 text-sm font-semibold" style={{ background: `rgba(${hexToRgb(accent)}, 0.1)`, color: accent }}>
                    <CheckCircle2 className="w-5 h-5" />
                    Payment received — thank you!
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'project' && (
          <div className="space-y-4">
            {projectLoading ? (
              <Skeleton className="h-48 w-full rounded-2xl" style={{ background: '#1a1a1a' }} />
            ) : !project ? (
              <div className="text-center py-16" style={{ color: '#555' }}>
                <Layers className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Project hasn't been set up yet.</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl p-5" style={{ background: '#1a1a1a' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{project.name}</div>
                      {project.description && <div className="text-sm mt-1" style={{ color: '#888' }}>{project.description}</div>}
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0" style={{ background: '#2a2a2a', color: '#888' }}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                {tasks.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: '#1a1a1a' }}>
                    <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#666' }}>Tasks</div>
                    <div className="space-y-2">
                      {tasks.map(task => (
                        <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#242424' }}>
                          <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: task.completed ? `rgba(${hexToRgb(accent)}, 0.15)` : '#333', color: task.completed ? accent : '#555' }}>
                            {task.completed ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          </div>
                          <div>
                            <div className="text-sm" style={{ color: task.completed ? '#777' : '#ccc', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</div>
                            {task.description && <div className="text-xs mt-0.5" style={{ color: '#555' }}>{task.description}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs" style={{ color: '#555' }}>{tasks.filter(t => t.completed).length} / {tasks.length} complete</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'messages' && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
            <div className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1">
              {msgLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#555' }} />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16" style={{ color: '#555' }}>
                  <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No messages yet. Start the conversation.</p>
                </div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender_role === 'client' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[78%] rounded-2xl px-4 py-2.5"
                      style={m.sender_role === 'client' ? { background: accent, color: '#fff' } : { background: '#1e1e1e', color: '#e5e5e5', border: '1px solid #2a2a2a' }}>
                      <p className="text-sm">{m.body}</p>
                      <p className="text-[10px] mt-1" style={{ color: m.sender_role === 'client' ? 'rgba(255,255,255,0.55)' : '#555' }}>
                        {new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2 items-end pt-3 border-t" style={{ borderColor: '#2a2a2a' }}>
              <Textarea value={msgText} onChange={e => setMsgText(e.target.value)} placeholder={`Message ${businessName}…`}
                className="flex-1 resize-none min-h-[44px] max-h-32 text-sm rounded-xl border-0 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ background: '#1e1e1e', color: '#e5e5e5' }} rows={1}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              />
              <button onClick={handleSendMessage} disabled={sendingMsg || !msgText.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: accent, color: '#fff' }}>
                {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EngagementPortalWithAuth (legacy) ────────────────────────────────────────

function EngagementPortalWithAuth({
  engagement,
  business,
  token,
}: {
  engagement: LegacyEngagement
  business: PortalBusiness
  token: string
}) {
  const [authState, setAuthState] = useState<'loading' | 'gate' | 'denied' | 'authed'>('loading');
  const accent = business.extracted_data?.brand?.primaryColor || '#10b981';
  const businessName = business.extracted_data?.identity?.name || business.name;

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (mounted) setAuthState('gate'); return; }

      const { data: accessRow } = await supabase
        .from('engagement_access')
        .select('id, client_user_id, client_email')
        .eq('engagement_id', engagement.id)
        .maybeSingle();

      if (!accessRow) { if (mounted) setAuthState('denied'); return; }

      if (!accessRow.client_user_id && accessRow.client_email === user.email) {
        await supabase.from('engagement_access').update({ client_user_id: user.id }).eq('id', accessRow.id);
      }

      if (accessRow.client_user_id === user.id || accessRow.client_email === user.email) {
        if (mounted) setAuthState('authed');
      } else {
        if (mounted) setAuthState('denied');
      }
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: unknown) => {
      if (session) checkAuth();
      else if (mounted) setAuthState('gate');
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [engagement.id]);

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: accent }} />
      </div>
    );
  }

  if (authState === 'gate') {
    return (
      <AuthGate
        businessName={businessName}
        clientName={engagement.contacts?.name || 'Client'}
        accent={accent}
        token={token}
        onAuthed={() => setAuthState('authed')}
      />
    );
  }

  if (authState === 'denied') return <AccessDenied accent={accent} />;

  return <EngagementPortal engagement={engagement} business={business} token={token} />;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export default function ClientPortalPage() {
  const { token } = useParams<{ token: string }>();

  // New contact-based path
  const [contact, setContact] = useState<PortalContact | null>(null);
  // Legacy engagement path
  const [engagement, setEngagement] = useState<LegacyEngagement | null>(null);

  const [business, setBusiness] = useState<PortalBusiness | null>(null);
  const [checked, setChecked] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setChecked(true); return; }

    async function load() {
      // 1. Try contacts.portal_token first (new hub)
      const { data: contactRow } = await supabase
        .from('contacts')
        .select('id, business_id, name, email, company, lifecycle_status, portal_token, unread_count')
        .eq('portal_token', token)
        .maybeSingle();

      if (contactRow) {
        setContact(contactRow as PortalContact);
        const { data: biz } = await supabase
          .from('businesses')
          .select('id, name, extracted_data')
          .eq('id', contactRow.business_id)
          .maybeSingle();
        setBusiness(biz as PortalBusiness);
        setChecked(true);
        return;
      }

      // 2. Fall back to engagements.portal_token (legacy links)
      const { data: eng } = await supabase
        .from('engagements')
        .select('*, contacts(*)')
        .eq('portal_token', token)
        .maybeSingle();

      if (!eng) { setNotFound(true); setChecked(true); return; }

      setEngagement(eng as LegacyEngagement);
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, name, extracted_data')
        .eq('id', eng.business_id)
        .maybeSingle();
      setBusiness(biz as PortalBusiness);
      setChecked(true);
    }

    load();
  }, [token]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111' }}>
        <div className="space-y-3 w-full max-w-3xl px-4">
          <Skeleton className="h-16 w-full rounded-2xl" style={{ background: '#1a1a1a' }} />
          <Skeleton className="h-48 w-full rounded-2xl" style={{ background: '#1a1a1a' }} />
          <Skeleton className="h-32 w-full rounded-2xl" style={{ background: '#1a1a1a' }} />
        </div>
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#111' }}>
        <div className="max-w-sm w-full text-center p-8 rounded-2xl" style={{ background: '#1a1a1a' }}>
          <AlertCircle className="w-10 h-10 mx-auto mb-4" style={{ color: '#ef4444' }} />
          <h2 className="text-white text-lg font-semibold mb-2">Portal not found</h2>
          <p className="text-sm mb-6" style={{ color: '#888' }}>
            This portal link is invalid or has been removed. Contact your service provider for a new link.
          </p>
          <a href="/" className="text-sm px-4 py-2 rounded-lg" style={{ background: '#2a2a2a', color: '#ccc' }}>Go home</a>
        </div>
      </div>
    );
  }

  if (contact) {
    return <ContactPortalWithAuth contact={contact} business={business} token={token!} />;
  }

  if (engagement) {
    return <EngagementPortalWithAuth engagement={engagement} business={business} token={token!} />;
  }

  return null;
}
