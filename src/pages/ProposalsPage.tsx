import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit2,
  Eye,
  FileCheck,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/CurrentBusinessContext';
import { supabase } from '@/db/supabase';
import { cn } from '@/lib/utils';
import type { Client, Proposal, ProposalOrigin, ProposalStatus } from '@/types/types';
import { formatDistanceToNow, format } from 'date-fns';

// ─── Local types ─────────────────────────────────────────────────────────────

type OriginFilter = 'all' | 'mine' | 'theirs';

interface DraftFields {
  title: string;
  introduction: string;
  services: string;
  deliverables: string;
  pricing: string;
  timeline: string;
  whyUs: string;
}

interface DraftModalState {
  proposal: Proposal;
  fields: DraftFields;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePricing(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? null : n;
  }
  return null;
}

function fmtPrice(v: string | number | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!n) return '';
  return `$${n.toLocaleString()}`;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Display name: client relation first, then client_name, then title
function getClientDisplay(p: Proposal): string {
  return p.client?.name ?? p.client_name ?? '—';
}

function getClientEmail(p: Proposal): string | null {
  return p.client?.email ?? p.client_email ?? null;
}

// Reconstruct context for AI drafting from a client-initiated proposal
function buildRequestContext(p: Proposal) {
  const rc = p.request_context ?? {};
  return {
    name: getClientDisplay(p),
    email: getClientEmail(p) ?? '',
    company: (rc.company as string | null) ?? null,
    service_name: (rc.service_name as string | null) ?? p.title ?? null,
    problem: (rc.problem as string | null) ?? p.description ?? null,
    timeline: (rc.timeline as string | null) ?? p.timeline ?? null,
    budget_flexible: (rc.budget_flexible as boolean | undefined) ?? false,
  };
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusLabel(s: ProposalStatus): string {
  const map: Record<ProposalStatus, string> = {
    draft: 'Draft',
    sent: 'Sent',
    viewed: 'Viewed',
    accepted: 'Accepted',
    declined: 'Declined',
    rejected: 'Declined',
    expired: 'Expired',
    withdrawn: 'Withdrawn',
  };
  return map[s] ?? s;
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  const cfg: Record<ProposalStatus, { icon: React.ElementType; cls: string }> = {
    draft: { icon: Clock, cls: 'bg-muted text-muted-foreground' },
    sent: { icon: Send, cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    viewed: { icon: Eye, cls: 'bg-violet-500/10 text-violet-500 border-violet-500/20' },
    accepted: { icon: CheckCircle2, cls: 'bg-success/10 text-success border-success/20' },
    declined: { icon: XCircle, cls: 'bg-destructive/10 text-destructive border-destructive/20' },
    rejected: { icon: XCircle, cls: 'bg-destructive/10 text-destructive border-destructive/20' },
    expired: { icon: AlertCircle, cls: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    withdrawn: { icon: FileText, cls: 'bg-muted text-muted-foreground' },
  };
  const { icon: Icon, cls } = cfg[status] ?? cfg.draft;
  return (
    <Badge variant="outline" className={cls}>
      <Icon className="w-3 h-3 mr-1" />
      {statusLabel(status)}
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const { business } = useBusiness();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');

  // AI draft modal (for client-initiated proposals)
  const [draftModal, setDraftModal] = useState<DraftModalState | null>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<DraftFields | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sendingPortal, setSendingPortal] = useState(false);

  // Manual create/edit modal (for freelancer-initiated)
  const [createModal, setCreateModal] = useState(false);
  const [editProposal, setEditProposal] = useState<Proposal | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    introduction: '',
    services: '',
    deliverables: '',
    pricing: '',
    timeline: '',
    terms: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Send dialog (for freelancer-initiated)
  const [sendDialog, setSendDialog] = useState<Proposal | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<Proposal | null>(null);

  // Follow-up compose
  const [followUpProposal, setFollowUpProposal] = useState<Proposal | null>(null);
  const [followUpText, setFollowUpText] = useState('');
  const [sendingFollowUp, setSendingFollowUp] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!business) return;
    loadAll();

    const channel = supabase
      .channel('proposals_merged')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, loadProposals)
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [business]);

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadProposals(), loadClients()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadProposals() {
    if (!business) return;
    const { data, error } = await supabase
      .from('proposals')
      .select('*, client:clients(id, name, email, company)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });
    if (error) {
      // Fallback: use user_id scope (before migration runs)
      const { data: fallback } = await supabase
        .from('proposals')
        .select('*, client:clients(id, name, email, company)')
        .order('created_at', { ascending: false });
      setProposals(fallback ?? []);
    } else {
      setProposals(data ?? []);
    }
  }

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    setClients(data ?? []);
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filteredProposals = proposals.filter((p) => {
    if (originFilter === 'mine' && p.initiated_by !== 'freelancer' && p.initiated_by !== 'pipeline') return false;
    if (originFilter === 'theirs' && p.initiated_by !== 'client') return false;
    if (statusFilter !== 'all' && p.status !== statusFilter && !(statusFilter === 'declined' && p.status === 'rejected')) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const clientName = getClientDisplay(p).toLowerCase();
      if (!p.title.toLowerCase().includes(q) && !clientName.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: proposals.length,
    mine: proposals.filter((p) => p.initiated_by === 'freelancer' || p.initiated_by === 'pipeline').length,
    theirs: proposals.filter((p) => p.initiated_by === 'client').length,
  };

  const inboundNew = proposals.filter((p) => p.initiated_by === 'client' && p.status === 'draft').length;

  // ── AI Draft modal (client-initiated) ─────────────────────────────────────

  async function runAIDraft(proposal: Proposal): Promise<DraftFields | null> {
    const ctx = buildRequestContext(proposal);
    const { data, error } = await supabase.functions.invoke('ai-gateway', {
      body: {
        mode: 'chat',
        message: `Draft a professional proposal for this potential client:
- Name: ${ctx.name}${ctx.company ? `, ${ctx.company}` : ''}
- Service requested: ${ctx.service_name ?? 'general services'}
- Their problem: ${ctx.problem ?? 'not specified'}
- Timeline: ${ctx.timeline ?? 'flexible'}
- Budget flexible: ${ctx.budget_flexible ? 'yes' : 'no'}

Use my proposal template and services from my business OS. Return a complete proposal as JSON with these exact keys:
- title: short proposal title
- introduction: 2-3 sentence paragraph about their specific challenge (THE CHALLENGE section)
- scope: array of 3-5 bullet point strings describing scope of work
- deliverables: short string summarizing deliverables
- pricing: number (estimate in USD, no symbols)
- timeline: string (e.g. "4 weeks")
- whyUs: 2-3 sentences explaining why you are the right fit for this specific client`,
        current_page: 'proposals',
      },
    });
    if (error) throw error;

    let parsed: Record<string, unknown> = {};
    try {
      const raw = typeof data?.message === 'string' ? data.message : JSON.stringify(data?.message ?? {});
      const m = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
      parsed = JSON.parse(m ? m[1] : raw);
    } catch {
      parsed = {};
    }

    return {
      title: (parsed.title as string) || proposal.title || `Proposal for ${ctx.name}`,
      introduction: (parsed.introduction as string) || proposal.introduction || '',
      services: Array.isArray(parsed.scope)
        ? (parsed.scope as string[]).join('\n')
        : (parsed.services as string) || proposal.services || '',
      deliverables: (parsed.deliverables as string) || proposal.deliverables || '',
      pricing: parsePricing(parsed.pricing)?.toString() ?? proposal.pricing?.toString() ?? '',
      timeline: (parsed.timeline as string) || ctx.timeline || proposal.timeline || '',
      whyUs: (parsed.whyUs as string) || proposal.terms || '',
    };
  }

  async function handleDraftWithAI(proposal: Proposal) {
    setDraftingId(proposal.id);
    try {
      const fields = await runAIDraft(proposal);
      if (!fields) throw new Error('No draft returned');

      // Save draft fields back to the proposal record
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
          ai_generated: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', proposal.id);

      // Upsert client in clients table if not linked
      let clientId = proposal.client_id;
      const email = getClientEmail(proposal);
      if (!clientId && email) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (existing?.id) {
          clientId = existing.id;
        } else {
          const ctx = buildRequestContext(proposal);
          const { data: newClient } = await supabase
            .from('clients')
            .insert({
              name: getClientDisplay(proposal),
              email,
              company: ctx.company ?? undefined,
              status: 'prospect',
            })
            .select('id')
            .single();
          clientId = newClient?.id ?? null;
        }
        if (clientId) {
          await supabase.from('proposals').update({ client_id: clientId }).eq('id', proposal.id);
        }
      }

      const updated: Proposal = {
        ...proposal,
        ...{
          title: fields.title,
          introduction: fields.introduction || null,
          services: fields.services || null,
          deliverables: fields.deliverables || null,
          pricing: parsePricing(fields.pricing),
          timeline: fields.timeline || null,
          terms: fields.whyUs || null,
          ai_generated: true,
          client_id: clientId,
        },
      };

      setDraftModal({ proposal: updated, fields });
      setEditMode(false);
      setEditFields(null);
      await loadProposals();
    } catch {
      toast.error('Failed to draft proposal. Try again.');
    } finally {
      setDraftingId(null);
    }
  }

  async function handleOpenExistingDraft(proposal: Proposal) {
    const fields: DraftFields = {
      title: proposal.title ?? '',
      introduction: proposal.introduction ?? '',
      services: proposal.services ?? '',
      deliverables: proposal.deliverables ?? '',
      pricing: proposal.pricing?.toString() ?? '',
      timeline: proposal.timeline ?? '',
      whyUs: proposal.terms ?? '',
    };
    setDraftModal({ proposal, fields });
    setEditMode(false);
    setEditFields(null);
  }

  async function handleSaveDraftEdit() {
    if (!draftModal || !editFields) return;
    setSavingDraft(true);
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftModal.proposal.id);
      setDraftModal((prev) => prev ? { ...prev, fields: editFields } : prev);
      setEditMode(false);
      setEditFields(null);
      toast.success('Draft saved');
    } catch {
      toast.error('Failed to save.');
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleRegenerate() {
    if (!draftModal) return;
    setRegenerating(true);
    try {
      const fields = await runAIDraft(draftModal.proposal);
      if (!fields) throw new Error();
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftModal.proposal.id);
      setDraftModal((prev) => prev ? { ...prev, fields } : prev);
      setEditMode(false);
      setEditFields(null);
      toast.success('Proposal regenerated');
    } catch {
      toast.error('Regeneration failed.');
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSendClientDraft() {
    if (!draftModal || !business) return;
    const { proposal, fields } = draftModal;
    const clientEmail = getClientEmail(proposal);
    const clientName = getClientDisplay(proposal);

    if (!clientEmail) {
      toast.error('Client email is missing');
      return;
    }

    setSendingPortal(true);
    try {
      const proposalScope = {
        title: fields.title,
        introduction: fields.introduction ?? undefined,
        scopeOfWork: fields.services ? fields.services.split('\n').map((s) => s.trim()).filter(Boolean) : [],
        deliverables: fields.deliverables ?? undefined,
        pricing: fields.pricing ? fmtPrice(fields.pricing) : undefined,
        timeline: fields.timeline ?? undefined,
        whyUs: fields.whyUs ?? undefined,
      };

      let clientId = proposal.client_id;
      if (!clientId) {
        const { data: existing } = await supabase.from('clients').select('id').eq('email', clientEmail).maybeSingle();
        if (existing?.id) {
          clientId = existing.id;
        } else {
          const ctx = buildRequestContext(proposal);
          const { data: c } = await supabase
            .from('clients')
            .insert({ name: clientName, email: clientEmail, company: ctx.company ?? undefined, status: 'prospect' })
            .select('id')
            .single();
          clientId = c?.id ?? null;
        }
      }

      // Upsert engagement
      const { data: existing } = await supabase
        .from('engagements')
        .select('id')
        .eq('business_id', business.id)
        .eq('contact_id', clientId)
        .eq('service_name', fields.title)
        .maybeSingle();

      let engagementId: string;
      if (existing?.id) {
        engagementId = existing.id;
        await supabase
          .from('engagements')
          .update({ status: 'proposal_sent', scope: { proposal: proposalScope } })
          .eq('id', engagementId);
      } else {
        const { data: eng, error: engErr } = await supabase
          .from('engagements')
          .insert({
            business_id: business.id,
            contact_id: clientId,
            service_name: fields.title,
            status: 'proposal_sent',
            scope: { proposal: proposalScope },
          })
          .select('id')
          .single();
        if (engErr || !eng) throw new Error('Failed to create engagement');
        engagementId = eng.id;
      }

      const { data: portalData, error: portalErr } = await supabase.functions.invoke('generate-portal-link', {
        body: { engagementId, clientEmail },
      });
      if (portalErr || !portalData?.portalUrl) throw new Error('Failed to generate portal link');

      const { portalUrl, token: portalToken } = portalData;

      const { error: emailErr } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'portal_invite',
          to: clientEmail,
          cc: profile?.email ?? undefined,
          data: {
            clientName,
            clientFirstName: clientName.split(' ')[0],
            businessName: business.name,
            freelancerName: profile?.username ?? business.name,
            serviceName: fields.title,
            portalUrl,
            token: portalToken,
            problemSnippet: proposal.request_context?.problem ?? proposal.description ?? null,
          },
        },
      });
      if (emailErr) throw new Error('Failed to send email');

      await supabase
        .from('proposals')
        .update({
          status: 'sent',
          client_id: clientId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', proposal.id);

      toast.success(`Proposal sent to ${clientName}!`);
      setDraftModal(null);
      await loadProposals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send. Try again.');
    } finally {
      setSendingPortal(false);
    }
  }

  // ── Freelancer-initiated send (existing flow) ──────────────────────────────

  async function handleSendEmail() {
    if (!sendDialog || !business) return;
    const proposal = sendDialog;
    const clientEmail = getClientEmail(proposal);
    const clientName = getClientDisplay(proposal);

    if (!clientEmail) { toast.error('Client email is missing'); return; }

    setSendingEmail(true);
    try {
      const proposalScope = {
        title: proposal.title,
        introduction: proposal.introduction ?? undefined,
        scopeOfWork: proposal.services ? proposal.services.split('\n').map((s) => s.trim()).filter(Boolean) : [],
        deliverables: proposal.deliverables ?? undefined,
        pricing: proposal.pricing ? String(proposal.pricing) : undefined,
        timeline: proposal.timeline ?? undefined,
        nextSteps: [],
      };

      const { data: existingEng } = await supabase
        .from('engagements')
        .select('id')
        .eq('business_id', business.id)
        .eq('contact_id', proposal.client_id)
        .eq('service_name', proposal.title)
        .maybeSingle();

      let engagementId: string;
      if (existingEng?.id) {
        engagementId = existingEng.id;
        await supabase
          .from('engagements')
          .update({ status: 'proposal_sent', scope: { proposal: proposalScope } })
          .eq('id', engagementId);
      } else {
        const { data: eng, error: engErr } = await supabase
          .from('engagements')
          .insert({
            business_id: business.id,
            contact_id: proposal.client_id,
            service_name: proposal.title,
            status: 'proposal_sent',
            scope: { proposal: proposalScope },
          })
          .select('id')
          .single();
        if (engErr || !eng) throw new Error('Failed to create engagement');
        engagementId = eng.id;
      }

      const { data: portalData, error: portalErr } = await supabase.functions.invoke('generate-portal-link', {
        body: { engagementId, clientEmail },
      });
      if (portalErr || !portalData?.portalUrl) throw new Error('Failed to generate portal link');

      const { portalUrl, token: portalToken } = portalData;

      const { error: emailErr } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'portal_invite',
          to: clientEmail,
          data: {
            clientName,
            businessName: business.name,
            serviceName: proposal.title,
            portalUrl,
            token: portalToken,
          },
        },
      });
      if (emailErr) throw new Error('Failed to send email');

      await supabase
        .from('proposals')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', proposal.id);

      const isResend = proposal.status !== 'draft';
      toast.success(isResend ? 'Proposal resent!' : 'Proposal sent!');
      setSendDialog(null);
      await loadProposals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSendingEmail(false);
    }
  }

  // ── Manual create/edit ─────────────────────────────────────────────────────

  function openCreate() {
    setEditProposal(null);
    setFormData({ title: '', client_id: '', introduction: '', services: '', deliverables: '', pricing: '', timeline: '', terms: '' });
    setCreateModal(true);
  }

  function openEdit(p: Proposal) {
    setEditProposal(p);
    setFormData({
      title: p.title,
      client_id: p.client_id ?? '',
      introduction: p.introduction ?? '',
      services: p.services ?? '',
      deliverables: p.deliverables ?? '',
      pricing: p.pricing?.toString() ?? '',
      timeline: p.timeline ?? '',
      terms: p.terms ?? '',
    });
    setCreateModal(true);
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const client = clients.find((c) => c.id === formData.client_id);
      const payload = {
        title: formData.title,
        client_id: formData.client_id || null,
        client_name: client?.name ?? null,
        client_email: client?.email ?? null,
        introduction: formData.introduction || null,
        services: formData.services || null,
        deliverables: formData.deliverables || null,
        pricing: formData.pricing ? parseFloat(formData.pricing) : null,
        total_amount: formData.pricing ? parseFloat(formData.pricing) : null,
        timeline: formData.timeline || null,
        terms: formData.terms || null,
        initiated_by: 'freelancer' as ProposalOrigin,
        business_id: business?.id ?? null,
        updated_at: new Date().toISOString(),
      };

      if (editProposal) {
        await supabase.from('proposals').update(payload).eq('id', editProposal.id);
        toast.success('Proposal updated');
      } else {
        await supabase.from('proposals').insert({ ...payload, status: 'draft' });
        toast.success('Proposal created');
      }

      setCreateModal(false);
      await loadProposals();
    } catch {
      toast.error('Failed to save proposal');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Follow-up ──────────────────────────────────────────────────────────────

  function openFollowUp(p: Proposal) {
    const clientName = getClientDisplay(p).split(' ')[0];
    setFollowUpProposal(p);
    setFollowUpText(`Hi ${clientName},\n\nJust following up on the proposal I sent over for ${p.title}. Happy to answer any questions or jump on a quick call.\n\nLooking forward to hearing from you,\n${profile?.username ?? business?.name ?? ''}`);
  }

  async function handleSendFollowUp() {
    if (!followUpProposal || !business) return;
    const clientEmail = getClientEmail(followUpProposal);
    if (!clientEmail) { toast.error('Client email missing'); return; }
    setSendingFollowUp(true);
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'client_message',
          to: clientEmail,
          data: {
            clientName: getClientDisplay(followUpProposal),
            senderName: business.name,
            subject: `Following up — ${followUpProposal.title}`,
            message: followUpText,
          },
        },
      });
      toast.success('Follow-up sent');
      setFollowUpProposal(null);
    } catch {
      toast.error('Failed to send follow-up');
    } finally {
      setSendingFollowUp(false);
    }
  }

  // ── Status change ──────────────────────────────────────────────────────────

  async function handleStatusChange(p: Proposal, status: ProposalStatus) {
    try {
      await supabase.from('proposals').update({ status, updated_at: new Date().toISOString() }).eq('id', p.id);
      await loadProposals();
    } catch {
      toast.error('Failed to update status');
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteDialog) return;
    try {
      await supabase.from('proposals').delete().eq('id', deleteDialog.id);
      toast.success('Proposal deleted');
      setDeleteDialog(null);
      await loadProposals();
    } catch {
      toast.error('Failed to delete');
    }
  }

  // ── Create invoice shortcut ────────────────────────────────────────────────

  function handleCreateInvoice(p: Proposal) {
    const params = new URLSearchParams();
    if (p.client_id) params.set('client_id', p.client_id);
    if (p.total_amount ?? p.pricing) params.set('amount', String(p.total_amount ?? p.pricing));
    params.set('description', p.title);
    navigate(`/dashboard/invoices?${params.toString()}`);
  }

  // ── Row action buttons ─────────────────────────────────────────────────────

  function ActionButtons({ p }: { p: Proposal }) {
    const origin = p.initiated_by ?? 'freelancer';
    const status = p.status;

    // Client-initiated
    if (origin === 'client') {
      if (status === 'draft') {
        const hasDraftContent = !!(p.introduction || p.services);
        return (
          <div className="flex gap-1.5 shrink-0">
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={draftingId === p.id}
              onClick={() => hasDraftContent ? handleOpenExistingDraft(p) : handleDraftWithAI(p)}
            >
              {draftingId === p.id
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Sparkles className="h-3 w-3" />}
              {draftingId === p.id ? 'Drafting…' : hasDraftContent ? 'View draft' : 'Draft with AI'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
              onClick={() => handleStatusChange(p, 'declined')}>
              Decline
            </Button>
          </div>
        );
      }
      if (status === 'sent' || status === 'viewed') {
        return (
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openFollowUp(p)}>
              <MessageSquare className="h-3 w-3 mr-1" />
              Follow up
            </Button>
          </div>
        );
      }
      if (status === 'accepted') {
        return (
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" className="h-7 gap-1.5 text-xs glow-accent" onClick={() => handleCreateInvoice(p)}>
              <FileCheck className="h-3 w-3" />
              Create invoice
            </Button>
          </div>
        );
      }
    }

    // Freelancer or pipeline initiated
    if (status === 'draft') {
      return (
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" className="h-7 gap-1.5 text-xs glow-accent"
            onClick={() => getClientEmail(p) ? setSendDialog(p) : toast.error('Add a client with an email first')}>
            <Send className="h-3 w-3" />
            Send
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(p)}>
            <Edit2 className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive/70"
            onClick={() => setDeleteDialog(p)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    if (status === 'sent') {
      return (
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openFollowUp(p)}>
            <MessageSquare className="h-3 w-3 mr-1" />
            Follow up
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSendDialog(p)}>
            <Mail className="h-3 w-3 mr-1" />
            Resend
          </Button>
        </div>
      );
    }
    if (status === 'viewed') {
      return (
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => openFollowUp(p)}>
            <MessageSquare className="h-3 w-3" />
            Follow up
          </Button>
        </div>
      );
    }
    if (status === 'accepted') {
      return (
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" className="h-7 gap-1.5 text-xs glow-accent" onClick={() => handleCreateInvoice(p)}>
            <FileCheck className="h-3 w-3" />
            Create invoice
          </Button>
        </div>
      );
    }
    if (status === 'declined' || status === 'rejected') {
      return (
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
            onClick={() => setDeleteDialog(p)}>
            <Trash2 className="h-3 w-3 mr-1" />
            Archive
          </Button>
        </div>
      );
    }
    if (status === 'expired') {
      return (
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => handleStatusChange(p, 'draft')}>
            Reopen
          </Button>
        </div>
      );
    }
    return null;
  }

  // ── Draft modal active fields ──────────────────────────────────────────────

  const activeFields = editMode ? editFields : draftModal?.fields;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 md:space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-2">Proposals</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            All proposals — yours and requests from clients
            {inboundNew > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full px-2 py-0.5">
                {inboundNew} new {inboundNew === 1 ? 'request' : 'requests'}
              </span>
            )}
          </p>
        </div>
        <Button size="lg" className="glow-accent w-full md:w-auto" onClick={openCreate}>
          <Plus className="w-5 h-5 mr-2" />
          New Proposal
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Origin tabs */}
        <div className="flex items-center gap-1.5">
          {([['all', 'All'], ['mine', 'Created by me'], ['theirs', 'Requested']] as [OriginFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setOriginFilter(key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium transition-colors border',
                originFilter === key
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground',
              )}
            >
              {label}
              {counts[key] > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold',
                  originFilter === key ? 'bg-accent-foreground/20 text-accent-foreground' : 'bg-muted-foreground/20 text-muted-foreground',
                )}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProposalStatus | 'all')}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs w-44"
            />
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-16" />
            </Card>
          ))}
        </div>
      ) : filteredProposals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            {originFilter === 'theirs' ? (
              <>
                <h3 className="text-xl font-semibold mb-2">No requests yet</h3>
                <p className="text-muted-foreground mb-2 max-w-sm text-pretty text-sm">
                  Share your portfolio link to start receiving proposal requests.
                </p>
                {business && (
                  <p className="text-xs font-mono text-foreground/60">
                    forgefly.io/p/{profile?.username ?? business.name.toLowerCase().replace(/\s+/g, '')}
                  </p>
                )}
              </>
            ) : originFilter === 'mine' ? (
              <>
                <h3 className="text-xl font-semibold mb-2">No proposals yet</h3>
                <p className="text-muted-foreground mb-6 max-w-sm text-pretty">
                  Start winning clients with professional proposals.
                </p>
                <Button onClick={openCreate} className="glow-accent">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Proposal
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold mb-2">No proposals found</h3>
                <p className="text-muted-foreground max-w-sm text-pretty">
                  {search ? 'Try a different search.' : 'Create a proposal or share your portfolio to receive requests.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredProposals.map((p) => {
            const clientDisplay = getClientDisplay(p);
            const initials = getInitials(clientDisplay);
            const isClientInitiated = p.initiated_by === 'client';
            const amount = p.total_amount ?? p.pricing;

            return (
              <Card key={p.id} className="transition-colors hover:border-border/80">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0 text-xs font-semibold text-accent mt-0.5">
                      {initials}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">{clientDisplay}</span>
                            <span className="text-muted-foreground text-sm">·</span>
                            <span className="text-sm text-foreground/80 truncate">{p.title}</span>
                            {amount ? (
                              <span className="text-sm font-semibold text-accent">{fmtPrice(amount)}</span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              {isClientInitiated ? (
                                <span className="flex items-center gap-1">
                                  <UserCheck className="h-3 w-3" />
                                  Requested by them
                                </span>
                              ) : (
                                'You created'
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                            </span>
                            <StatusBadge status={p.status} />
                            {p.ai_generated && (
                              <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">
                                <Sparkles className="h-2.5 w-2.5 mr-1" />
                                AI
                              </Badge>
                            )}
                          </div>

                          {/* Problem snippet for client-initiated */}
                          {isClientInitiated && (p.request_context?.problem ?? p.description) && p.status === 'draft' && (
                            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                              {p.request_context?.problem ?? p.description}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <ActionButtons p={p} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── AI Draft Modal (client-initiated) ─────────────────────────────── */}
      <Dialog open={!!draftModal} onOpenChange={(open) => { if (!open) { setDraftModal(null); setEditMode(false); setEditFields(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          {draftModal && (
            <>
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{business?.name ?? 'Forgefly'}</span>
                  {editMode && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">Editing</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {!editMode ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                      onClick={() => { setEditFields({ ...draftModal.fields }); setEditMode(true); }}>
                      <Edit2 className="h-3 w-3" /> Edit
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => { setEditMode(false); setEditFields(null); }}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5 glow-accent"
                    disabled={sendingPortal || savingDraft}
                    onClick={editMode ? handleSaveDraftEdit : handleSendClientDraft}
                  >
                    {(sendingPortal || savingDraft) && <Loader2 className="h-3 w-3 animate-spin" />}
                    {editMode
                      ? (savingDraft ? 'Saving…' : 'Save draft')
                      : (sendingPortal ? 'Sending…' : `Send to ${getClientDisplay(draftModal.proposal).split(' ')[0]} →`)}
                  </Button>
                </div>
              </div>

              {/* AI badge */}
              <div className="px-5 py-2 bg-accent/5 border-b flex items-center gap-2 shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="text-xs text-muted-foreground">
                  AI-drafted from {getClientDisplay(draftModal.proposal).split(' ')[0]}'s request + your business profile
                  {!editMode && ' · Review before sending'}
                </span>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6">
                {/* Title */}
                {editMode ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Proposal Title</Label>
                    <Input
                      value={editFields?.title ?? ''}
                      onChange={(e) => setEditFields((prev) => prev ? { ...prev, title: e.target.value } : prev)}
                      className="text-lg font-semibold"
                    />
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">{activeFields?.title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      For {getClientDisplay(draftModal.proposal)}
                      {draftModal.proposal.request_context?.company ? ` · ${draftModal.proposal.request_context.company}` : ''}
                      {' · '}Prepared {format(new Date(), 'MMMM d, yyyy')}
                    </p>
                  </div>
                )}

                {/* The Challenge */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-accent uppercase">The Challenge</p>
                  {editMode ? (
                    <Textarea
                      value={editFields?.introduction ?? ''}
                      onChange={(e) => setEditFields((prev) => prev ? { ...prev, introduction: e.target.value } : prev)}
                      rows={4}
                      placeholder="Describe the client's challenge…"
                    />
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground/90">{activeFields?.introduction}</p>
                  )}
                </div>

                {/* Scope of Work */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-accent uppercase">Scope of Work</p>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b">
                          <td className="px-4 py-2.5 text-muted-foreground w-36">Service</td>
                          <td className="px-4 py-2.5 font-medium text-right">
                            {draftModal.proposal.request_context?.service_name ?? activeFields?.title}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-2.5 text-muted-foreground">Timeline</td>
                          <td className="px-4 py-2.5 text-right">
                            {editMode ? (
                              <Input
                                value={editFields?.timeline ?? ''}
                                onChange={(e) => setEditFields((prev) => prev ? { ...prev, timeline: e.target.value } : prev)}
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
                                onChange={(e) => setEditFields((prev) => prev ? { ...prev, deliverables: e.target.value } : prev)}
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
                                onChange={(e) => setEditFields((prev) => prev ? { ...prev, pricing: e.target.value } : prev)}
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
                        onChange={(e) => setEditFields((prev) => prev ? { ...prev, services: e.target.value } : prev)}
                        rows={4}
                        placeholder="One bullet per line…"
                      />
                    </div>
                  )}
                </div>

                {/* Why This Works */}
                {(activeFields?.whyUs || editMode) && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-accent uppercase">
                      Why This Works for {draftModal.proposal.request_context?.company ?? getClientDisplay(draftModal.proposal).split(' ')[0]}
                    </p>
                    {editMode ? (
                      <Textarea
                        value={editFields?.whyUs ?? ''}
                        onChange={(e) => setEditFields((prev) => prev ? { ...prev, whyUs: e.target.value } : prev)}
                        rows={3}
                        placeholder="Why are you the right fit?…"
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
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-r"
                  onClick={() => {
                    if (editMode) { setEditMode(false); setEditFields(null); }
                    else { setEditFields({ ...draftModal.fields }); setEditMode(true); }
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                  {editMode ? 'Cancel edit' : 'Edit draft'}
                </button>
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-r disabled:opacity-50"
                  onClick={handleRegenerate}
                  disabled={regenerating || sendingPortal}
                >
                  {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {regenerating ? 'Regenerating…' : 'Regenerate'}
                </button>
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                  onClick={editMode ? handleSaveDraftEdit : handleSendClientDraft}
                  disabled={sendingPortal || savingDraft}
                >
                  {(sendingPortal || savingDraft) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {editMode ? (savingDraft ? 'Saving…' : 'Save draft') : (sendingPortal ? 'Sending…' : `Send to ${getClientDisplay(draftModal.proposal).split(' ')[0]}`)}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Manual create/edit modal ───────────────────────────────────────── */}
      <Dialog open={createModal} onOpenChange={(open) => { if (!open) setCreateModal(false); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <div className="py-2">
            <h2 className="text-lg font-semibold mb-1">{editProposal ? 'Edit Proposal' : 'New Proposal'}</h2>
            <p className="text-sm text-muted-foreground mb-5">
              {editProposal ? 'Update proposal details.' : 'Create a proposal to send to a client.'}
            </p>
            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-title">Proposal Title *</Label>
                <Input
                  id="p-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Brand Identity Design Package"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-client">Client</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                  <SelectTrigger id="p-client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-intro">Introduction</Label>
                <Textarea
                  id="p-intro"
                  value={formData.introduction}
                  onChange={(e) => setFormData({ ...formData, introduction: e.target.value })}
                  placeholder="Brief intro paragraph…"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-services">Scope of Work</Label>
                <Textarea
                  id="p-services"
                  value={formData.services}
                  onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                  placeholder="One bullet point per line…"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-deliverables">Deliverables</Label>
                <Textarea
                  id="p-deliverables"
                  value={formData.deliverables}
                  onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
                  placeholder="What the client will receive…"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-pricing">Investment ($)</Label>
                  <Input
                    id="p-pricing"
                    type="number"
                    step="0.01"
                    value={formData.pricing}
                    onChange={(e) => setFormData({ ...formData, pricing: e.target.value })}
                    placeholder="4500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-timeline">Timeline</Label>
                  <Input
                    id="p-timeline"
                    value={formData.timeline}
                    onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                    placeholder="e.g. 4 weeks"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-terms">Why Us / Terms</Label>
                <Textarea
                  id="p-terms"
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                  placeholder="Why you're the right fit, payment terms…"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setCreateModal(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="glow-accent">
                  {submitting ? 'Saving…' : editProposal ? 'Update Proposal' : 'Create Proposal'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Send / Resend dialog (freelancer-initiated) ───────────────────── */}
      <AlertDialog open={!!sendDialog} onOpenChange={(open) => { if (!open) setSendDialog(null); }}>
        {sendDialog && (
          <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {sendDialog.status !== 'draft' ? 'Resend Proposal' : 'Send Proposal via Email'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {sendDialog.status !== 'draft'
                  ? `A new portal link will be sent to ${getClientDisplay(sendDialog)}.`
                  : `This will send the proposal to ${getClientDisplay(sendDialog)} at `}
                {sendDialog.status === 'draft' && (
                  <strong className="text-accent">{getClientEmail(sendDialog)}</strong>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-3">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proposal</span>
                  <span className="font-medium truncate ml-2">{sendDialog.title}</span>
                </div>
                {(sendDialog.total_amount ?? sendDialog.pricing) ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Value</span>
                    <span className="font-bold text-accent">{fmtPrice(sendDialog.total_amount ?? sendDialog.pricing)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To</span>
                  <span className="text-muted-foreground">{getClientEmail(sendDialog)}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Client receives a branded email with a secure portal link — no account needed.
                </p>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={sendingEmail}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSendEmail} disabled={sendingEmail} className="glow-accent">
                {sendingEmail ? 'Sending…' : sendDialog.status !== 'draft' ? 'Resend' : 'Send Email'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {/* ── Follow-up dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!followUpProposal} onOpenChange={(open) => { if (!open) setFollowUpProposal(null); }}>
        {followUpProposal && (
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <div className="py-2">
              <h2 className="text-lg font-semibold mb-1">Send Follow-up</h2>
              <p className="text-sm text-muted-foreground mb-4">
                To: <strong>{getClientEmail(followUpProposal) ?? getClientDisplay(followUpProposal)}</strong>
              </p>
              <Textarea
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                rows={8}
                className="text-sm font-mono"
              />
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setFollowUpProposal(null)} disabled={sendingFollowUp}>
                  Cancel
                </Button>
                <Button onClick={handleSendFollowUp} disabled={!followUpText.trim() || sendingFollowUp} className="glow-accent">
                  {sendingFollowUp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {sendingFollowUp ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* ── Delete dialog ─────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteDialog?.title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
