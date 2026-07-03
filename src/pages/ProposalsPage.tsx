import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
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
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
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

// engagements.contact_id is a FK into the business-scoped `contacts` table —
// never the user-scoped `clients` table. Resolve or create the matching
// contact so the portal (and its engagement_access grant) can actually link.
async function resolveContactId(businessId: string, name: string, email: string | null): Promise<string> {
  if (email) {
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('business_id', businessId)
      .ilike('email', email)
      .maybeSingle();

    if (existingContact?.id) return existingContact.id;
  }

  const { data: newContact, error: contactErr } = await supabase
    .from('contacts')
    .insert({ business_id: businessId, name, email })
    .select('id')
    .single();

  if (contactErr || !newContact) throw new Error('Failed to create contact');
  return newContact.id;
}

// Every proposal (freelancer- or client-initiated) should have a matching
// `clients` row so it shows up in the Clients list — not just a name/email
// stashed on the proposal row.
async function resolveClientId(userId: string, name: string, email: string | null): Promise<string> {
  if (email) {
    const { data: existingClient } = await supabase.from('clients').select('id').eq('email', email).maybeSingle();
    if (existingClient?.id) return existingClient.id;
  }

  const { data: newClient, error: clientErr } = await supabase
    .from('clients')
    .insert({
      user_id: userId,
      name,
      email,
      company: null,
      status: 'prospect',
      total_value: 0,
      last_interaction: new Date().toISOString(),
      notes: null,
      avatar_url: null,
      stripe_customer_id: null,
    })
    .select('id')
    .single();

  if (clientErr || !newClient) throw new Error('Failed to create client');
  return newClient.id;
}

const LEAD_STAGE_ORDER = ['Prospect', 'Qualified', 'Contacted', 'Proposal Sent', 'Negotiating', 'Closed Won', 'Lost'] as const;
type LeadStage = typeof LEAD_STAGE_ORDER[number];

function leadStageRank(stage: string): number {
  const i = LEAD_STAGE_ORDER.indexOf(stage as LeadStage);
  return i === -1 ? 0 : i;
}

// Ensures a pipeline lead card exists for this contact and reflects at least
// `minStage` — creates one if missing, advances it if it's behind, and never
// regresses a lead that's already further along (or closed).
async function ensureLeadStage(businessId: string, contactId: string, serviceName: string | null, minStage: LeadStage): Promise<void> {
  const { data: existingLead } = await supabase
    .from('pipeline_leads')
    .select('id, stage')
    .eq('business_id', businessId)
    .eq('contact_id', contactId)
    .not('stage', 'in', '("Closed Won","Lost")')
    .maybeSingle();

  if (!existingLead) {
    await supabase.from('pipeline_leads').insert({
      business_id: businessId,
      contact_id: contactId,
      stage: minStage,
      service_name: serviceName,
    });
  } else if (leadStageRank(minStage) > leadStageRank(existingLead.stage)) {
    await supabase.from('pipeline_leads').update({ stage: minStage }).eq('id', existingLead.id);
  }
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
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Detail slide-over
  const [detailProposal, setDetailProposal] = useState<Proposal | null>(null);

  // New proposal wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardClientMode, setWizardClientMode] = useState<'existing' | 'new'>('existing');
  const [wizardClientId, setWizardClientId] = useState('');
  const [wizardNewName, setWizardNewName] = useState('');
  const [wizardNewEmail, setWizardNewEmail] = useState('');
  const [wizardStartMode, setWizardStartMode] = useState<'ai' | 'blank' | 'duplicate'>('ai');
  const [wizardDupId, setWizardDupId] = useState('');
  const [wizardContext, setWizardContext] = useState('');
  const [wizardGenerating, setWizardGenerating] = useState(false);

  // Follow-up compose
  const [followUpProposal, setFollowUpProposal] = useState<Proposal | null>(null);
  const [followUpText, setFollowUpText] = useState('');
  const [sendingFollowUp, setSendingFollowUp] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────

  // Auto-open new proposal wizard when navigated with ?action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setWizardOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, []);

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
    const { data, error } = await supabase.functions.invoke('ai-gateway', {
      body: {
        mode: 'generate_proposal',
        proposal_id: proposal.id,
        initiated_by: proposal.initiated_by ?? 'client',
        business_id: business?.id,
      },
    });
    if (error) throw error;

    // generate_proposal returns a structured ProposalDraft directly
    const d = data as {
      title?: string;
      introduction?: string;
      services?: string | string[];
      deliverables?: string;
      timeline?: string;
      terms?: string;
    };

    return {
      title: d.title || proposal.title || 'Untitled Proposal',
      introduction: d.introduction || proposal.introduction || '',
      services: Array.isArray(d.services)
        ? d.services.join('\n')
        : d.services || proposal.services || '',
      deliverables: d.deliverables || proposal.deliverables || '',
      pricing: proposal.pricing?.toString() ?? '',   // never overwrite with AI price
      timeline: d.timeline || proposal.timeline || '',
      whyUs: d.terms || proposal.terms || '',
    };
  }

  async function handleDraftWithAI(proposal: Proposal) {
    setDraftingId(proposal.id);
    try {
      // Call generate_proposal and capture tone/model metadata
      const { data: rawData, error: invokeErr } = await supabase.functions.invoke('ai-gateway', {
        body: {
          mode: 'generate_proposal',
          proposal_id: proposal.id,
          initiated_by: proposal.initiated_by ?? 'client',
          business_id: business?.id,
        },
      });
      if (invokeErr) throw invokeErr;

      const d = rawData as {
        title?: string; introduction?: string; services?: string | string[];
        deliverables?: string; timeline?: string; terms?: string;
        ai_generation_tone?: string; ai_model_used?: string;
      };

      const fields: DraftFields = {
        title: d.title || proposal.title || 'Untitled Proposal',
        introduction: d.introduction || proposal.introduction || '',
        services: Array.isArray(d.services) ? d.services.join('\n') : d.services || proposal.services || '',
        deliverables: d.deliverables || proposal.deliverables || '',
        pricing: proposal.pricing?.toString() ?? '',
        timeline: d.timeline || proposal.timeline || '',
        whyUs: d.terms || proposal.terms || '',
      };

      if (!fields.title) throw new Error('No draft returned');

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
          ai_generation_tone: d.ai_generation_tone ?? null,
          ai_model_used: d.ai_model_used ?? null,
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
    if (!draftModal || !business || !profile) return;
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
        const { data: existingClient } = await supabase.from('clients').select('id').eq('email', clientEmail).maybeSingle();
        if (existingClient?.id) {
          clientId = existingClient.id;
        } else {
          const ctx = buildRequestContext(proposal);
          const { data: c, error: clientErr } = await supabase
            .from('clients')
            .insert({
              user_id: profile.id,
              name: clientName,
              email: clientEmail,
              company: ctx.company ?? null,
              status: 'prospect',
              total_value: 0,
              last_interaction: null,
              notes: null,
              avatar_url: null,
              stripe_customer_id: null,
            })
            .select('id')
            .single();
          if (clientErr || !c) throw new Error('Failed to create client');
          clientId = c.id;
        }
      }

      // engagements.contact_id references the business-scoped `contacts` table,
      // not `clients` — resolve/create that contact so the portal actually links.
      const contactId = await resolveContactId(business.id, clientName, clientEmail);

      // Track this send in the Leads pipeline — create the card if missing,
      // advance it to "Proposal Sent" if it hasn't gotten there yet.
      await ensureLeadStage(business.id, contactId, fields.title, 'Proposal Sent');

      // Upsert engagement
      const { data: existingEngagement } = await supabase
        .from('engagements')
        .select('id')
        .eq('business_id', business.id)
        .eq('contact_id', contactId)
        .eq('service_name', fields.title)
        .maybeSingle();

      let engagementId: string;
      if (existingEngagement?.id) {
        engagementId = existingEngagement.id;
        await supabase
          .from('engagements')
          .update({ status: 'proposal_sent', scope: { proposal: proposalScope } })
          .eq('id', engagementId);
      } else {
        const { data: eng, error: engErr } = await supabase
          .from('engagements')
          .insert({
            business_id: business.id,
            contact_id: contactId,
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

      // engagements.contact_id references the business-scoped `contacts` table,
      // not `clients` — resolve/create that contact so the portal actually links.
      const contactId = await resolveContactId(business.id, clientName, clientEmail);

      // Backfill a `clients` row if this proposal was created without one
      // (e.g. a "new client" wizard proposal never sent through the draft flow).
      if (!proposal.client_id && profile) {
        const newClientId = await resolveClientId(profile.id, clientName, clientEmail);
        await supabase.from('proposals').update({ client_id: newClientId }).eq('id', proposal.id);
      }

      // Track this send in the Leads pipeline — create the card if missing,
      // advance it to "Proposal Sent" if it hasn't gotten there yet.
      await ensureLeadStage(business.id, contactId, proposal.title, 'Proposal Sent');

      const { data: existingEng } = await supabase
        .from('engagements')
        .select('id')
        .eq('business_id', business.id)
        .eq('contact_id', contactId)
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
            contact_id: contactId,
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

      // Advance the specific originating lead card too, if this proposal came from one
      if (proposal.pipeline_lead_id) {
        supabase.from('pipeline_leads').update({ stage: 'Proposal Sent' }).eq('id', proposal.pipeline_lead_id);
      }

      const isResend = proposal.status !== 'draft';
      toast.success(isResend ? 'Proposal resent!' : 'Proposal sent!');
      // Milestone beacon: fire-and-forget
      if (!isResend && business && !business.onboarding_milestones?.proposal_sent) {
        supabase.functions.invoke('mark-milestone', { body: { milestone: 'proposal_sent' } });
      }
      setSendDialog(null);
      await loadProposals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSendingEmail(false);
    }
  }

  // ── New proposal wizard ────────────────────────────────────────────────────

  function openWizard() {
    setWizardStep(1);
    setWizardClientMode(clients.length > 0 ? 'existing' : 'new');
    setWizardClientId('');
    setWizardNewName('');
    setWizardNewEmail('');
    setWizardStartMode('ai');
    setWizardDupId('');
    setWizardContext('');
    setWizardOpen(true);
  }

  function wizardResolvedClient() {
    if (wizardClientMode === 'existing') {
      const c = clients.find((cl) => cl.id === wizardClientId);
      return { id: c?.id ?? null, name: c?.name ?? '', email: c?.email ?? '' };
    }
    return { id: null, name: wizardNewName.trim(), email: wizardNewEmail.trim() };
  }

  function handleWizardStep1Next() {
    if (wizardClientMode === 'existing' && !wizardClientId) {
      toast.error('Select a client to continue');
      return;
    }
    if (wizardClientMode === 'new' && !wizardNewName.trim()) {
      toast.error('Enter a name to continue');
      return;
    }
    setWizardStep(2);
  }

  function handleWizardStep2Next() {
    const client = wizardResolvedClient();
    if (wizardStartMode === 'ai') {
      setWizardStep(3);
      return;
    }
    if (wizardStartMode === 'blank') {
      setWizardOpen(false);
      setEditProposal(null);
      setFormData({
        title: '',
        client_id: client.id ?? '',
        introduction: '',
        services: '',
        deliverables: '',
        pricing: '',
        timeline: '',
        terms: '',
      });
      setCreateModal(true);
      return;
    }
    if (wizardStartMode === 'duplicate') {
      if (!wizardDupId) {
        toast.error('Select a proposal to duplicate');
        return;
      }
      const src = proposals.find((p) => p.id === wizardDupId);
      if (!src) return;
      setWizardOpen(false);
      setEditProposal(null);
      setFormData({
        title: `${src.title} (copy)`,
        client_id: client.id ?? '',
        introduction: src.introduction ?? '',
        services: src.services ?? '',
        deliverables: src.deliverables ?? '',
        pricing: src.pricing?.toString() ?? '',
        timeline: src.timeline ?? '',
        terms: src.terms ?? '',
      });
      setCreateModal(true);
    }
  }

  async function handleWizardGenerate() {
    if (!business || !profile) return;
    setWizardGenerating(true);
    try {
      const client = wizardResolvedClient();

      const { data: newProposal, error: insertErr } = await supabase
        .from('proposals')
        .insert({
          business_id: business.id,
          user_id: profile.id,
          client_id: client.id,
          client_name: client.name || null,
          client_email: client.email || null,
          title: client.name ? `Proposal for ${client.name}` : 'New Proposal',
          initiated_by: 'freelancer' as ProposalOrigin,
          status: 'draft',
        })
        .select()
        .single();

      if (insertErr || !newProposal) throw insertErr ?? new Error('Failed to create proposal');

      // Track this proposal in the Leads pipeline, and add a `clients` row
      // if this is a brand-new client (existing clients are left as-is).
      if (client.name) {
        const clientId = client.id ?? await resolveClientId(profile.id, client.name, client.email || null);
        if (!client.id) {
          await supabase.from('proposals').update({ client_id: clientId }).eq('id', newProposal.id);
        }
        const contactId = await resolveContactId(business.id, client.name, client.email || null);
        await ensureLeadStage(business.id, contactId, newProposal.title, 'Prospect');
      }

      const { data: rawData, error: genErr } = await supabase.functions.invoke('ai-gateway', {
        body: {
          mode: 'generate_proposal',
          proposal_id: newProposal.id,
          initiated_by: 'freelancer',
          business_id: business.id,
          extra_context: wizardContext.trim() || undefined,
        },
      });

      if (genErr) throw genErr;

      const d = rawData as {
        title?: string; introduction?: string; services?: string | string[];
        deliverables?: string; timeline?: string; terms?: string;
        ai_generation_tone?: string; ai_model_used?: string;
      };

      const fields: DraftFields = {
        title: d.title || newProposal.title || 'Untitled Proposal',
        introduction: d.introduction || '',
        services: Array.isArray(d.services) ? d.services.join('\n') : d.services || '',
        deliverables: d.deliverables || '',
        pricing: '',
        timeline: d.timeline || '',
        whyUs: d.terms || '',
      };

      await supabase
        .from('proposals')
        .update({
          title: fields.title,
          introduction: fields.introduction || null,
          services: fields.services || null,
          deliverables: fields.deliverables || null,
          timeline: fields.timeline || null,
          terms: fields.whyUs || null,
          ai_generated: true,
          ai_generation_tone: d.ai_generation_tone ?? null,
          ai_model_used: d.ai_model_used ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', newProposal.id);

      setWizardOpen(false);
      await loadProposals();
      setDraftModal({ proposal: { ...newProposal, title: fields.title }, fields });
      setEditMode(false);
      setEditFields(null);
      toast.success('Draft ready — review and send when you\'re happy!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setWizardGenerating(false);
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

      // Make sure this client has a lead card tracking the proposal.
      if (business && client?.email) {
        const contactId = await resolveContactId(business.id, client.name, client.email);
        await ensureLeadStage(business.id, contactId, payload.title, 'Prospect');
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

      if (status === 'declined' && business) {
        if (p.pipeline_lead_id) {
          supabase.from('pipeline_leads').update({ stage: 'Lost' }).eq('id', p.pipeline_lead_id);
        } else if (p.client_id) {
          supabase.from('pipeline_leads').update({ stage: 'Lost' })
            .eq('business_id', business.id)
            .eq('contact_id', p.client_id);
        }
      }

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
    params.set('tab', 'invoices');
    navigate(`/dashboard/finances?${params.toString()}`);
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
        <Button size="lg" className="glow-accent w-full md:w-auto" onClick={openWizard}>
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
                <Button onClick={openWizard} className="glow-accent">
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
              <Card key={p.id} className="transition-colors hover:border-border/80 cursor-pointer" onClick={() => setDetailProposal(p)}>
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
                        <div onClick={(e) => e.stopPropagation()}>
                          <ActionButtons p={p} />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Detail slide-over ────────────────────────────────────────────── */}
      <Sheet open={!!detailProposal} onOpenChange={(open) => { if (!open) setDetailProposal(null); }}>
        {detailProposal && (() => {
          const p = detailProposal;
          const clientDisplay = getClientDisplay(p);
          const amount = p.total_amount ?? p.pricing;
          const rc = p.request_context ?? {};
          const scopeLines = p.services ? p.services.split('\n').filter(Boolean) : [];
          const lineItems: { label: string; qty?: number; unit_price?: number }[] =
            Array.isArray(p.line_items) ? p.line_items : [];

          const timelineEvents: { label: string; ts: string | null | undefined; done: boolean }[] = [
            { label: 'Created', ts: p.created_at, done: true },
            { label: 'Sent', ts: p.sent_at, done: !!p.sent_at || ['sent','viewed','accepted','declined','rejected','expired'].includes(p.status) },
            { label: 'Viewed', ts: p.viewed_at, done: !!p.viewed_at },
            { label: 'Responded', ts: p.responded_at, done: !!p.responded_at || ['accepted','declined','rejected'].includes(p.status) },
          ];

          return (
            <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0 gap-0 overflow-hidden">
              <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
                {/* Client + title */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0 text-sm font-semibold text-accent">
                    {getInitials(clientDisplay)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base leading-tight">{clientDisplay}</div>
                    <div className="text-sm text-muted-foreground truncate mt-0.5">{p.title}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {amount ? (
                      <span className="text-base font-bold text-accent">{fmtPrice(amount)}</span>
                    ) : null}
                    <StatusBadge status={p.status} />
                  </div>
                </div>

                {/* Origin note */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                  {p.initiated_by === 'client' ? (
                    <><UserCheck className="h-3 w-3 text-blue-500" /><span>Requested by {clientDisplay.split(' ')[0]}</span></>
                  ) : p.initiated_by === 'pipeline' ? (
                    <><ChevronRight className="h-3 w-3" /><span>From pipeline: {(rc.company as string) ?? clientDisplay}</span></>
                  ) : (
                    <><FileText className="h-3 w-3" /><span>You created this</span></>
                  )}
                  <span className="mx-1">·</span>
                  <CalendarClock className="h-3 w-3" />
                  <span>{format(new Date(p.created_at), 'MMM d, yyyy')}</span>
                  {p.ai_generated && (
                    <><span className="mx-1">·</span><Sparkles className="h-3 w-3 text-accent" /><span className="text-accent">AI-drafted</span></>
                  )}
                </div>
              </SheetHeader>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

                {/* Activity timeline */}
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase mb-3">Timeline</p>
                  <div className="flex items-center gap-0">
                    {timelineEvents.map((ev, i) => (
                      <div key={ev.label} className="flex items-center flex-1">
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <div className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center',
                            ev.done ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground/30',
                          )}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <span className={cn('text-[10px] font-medium text-center', ev.done ? 'text-foreground' : 'text-muted-foreground/40')}>
                            {ev.label}
                          </span>
                          {ev.ts && (
                            <span className="text-[9px] text-muted-foreground text-center leading-tight">
                              {format(new Date(ev.ts), 'MMM d')}
                            </span>
                          )}
                        </div>
                        {i < timelineEvents.length - 1 && (
                          <div className={cn('h-px flex-1 mx-1 mb-6', ev.done && timelineEvents[i+1].done ? 'bg-accent/30' : 'bg-border')} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Client request context (client-initiated only) */}
                {p.initiated_by === 'client' && (rc.problem || rc.service_name || p.description) && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase mb-2">Their Request</p>
                    <div className="rounded-lg bg-muted/40 p-3.5 space-y-2 text-sm">
                      {rc.service_name && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-20 shrink-0">Service</span>
                          <span className="font-medium">{rc.service_name as string}</span>
                        </div>
                      )}
                      {(rc.problem ?? p.description) && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-20 shrink-0">Problem</span>
                          <span className="leading-relaxed">{(rc.problem ?? p.description) as string}</span>
                        </div>
                      )}
                      {rc.timeline && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-20 shrink-0">Timeline</span>
                          <span>{rc.timeline as string}</span>
                        </div>
                      )}
                      {rc.company && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-20 shrink-0">Company</span>
                          <span>{rc.company as string}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Introduction */}
                {p.introduction && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase mb-2">Introduction</p>
                    <p className="text-sm leading-relaxed text-foreground/90">{p.introduction}</p>
                  </div>
                )}

                {/* Line items (structured) */}
                {lineItems.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase mb-2">Line Items</p>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">Item</th>
                            <th className="px-3 py-2 text-right text-xs text-muted-foreground font-medium">Qty</th>
                            <th className="px-3 py-2 text-right text-xs text-muted-foreground font-medium">Price</th>
                            <th className="px-3 py-2 text-right text-xs text-muted-foreground font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((li, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="px-3 py-2">{li.label}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">{li.qty ?? 1}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">{li.unit_price ? fmtPrice(li.unit_price) : '—'}</td>
                              <td className="px-3 py-2 text-right font-medium">{li.unit_price ? fmtPrice((li.qty ?? 1) * li.unit_price) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                        {amount && (
                          <tfoot>
                            <tr className="border-t bg-muted/20">
                              <td colSpan={3} className="px-3 py-2 text-right text-xs text-muted-foreground font-semibold">Total</td>
                              <td className="px-3 py-2 text-right font-bold text-accent">{fmtPrice(amount)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                )}

                {/* Scope of work (text-based) */}
                {scopeLines.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase mb-2">Scope of Work</p>
                    <ul className="space-y-1.5">
                      {scopeLines.map((line, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground/80">
                          <span className="text-accent shrink-0 mt-0.5">·</span>
                          <span>{line.replace(/^[-•·]\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Deliverables + Investment + Timeline */}
                {(p.deliverables || p.timeline || amount) && (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        {p.deliverables && (
                          <tr className="border-b">
                            <td className="px-4 py-2.5 text-muted-foreground w-32">Deliverables</td>
                            <td className="px-4 py-2.5 text-right font-medium">{p.deliverables}</td>
                          </tr>
                        )}
                        {p.timeline && (
                          <tr className="border-b">
                            <td className="px-4 py-2.5 text-muted-foreground">Timeline</td>
                            <td className="px-4 py-2.5 text-right font-medium">{p.timeline}</td>
                          </tr>
                        )}
                        {amount && lineItems.length === 0 && (
                          <tr>
                            <td className="px-4 py-2.5 text-muted-foreground">Investment</td>
                            <td className="px-4 py-2.5 text-right font-bold text-accent">{fmtPrice(amount)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Why us / Terms */}
                {p.terms && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase mb-2">Why Us</p>
                    <p className="text-sm leading-relaxed text-foreground/90">{p.terms}</p>
                  </div>
                )}
              </div>

              {/* Sticky action bar */}
              <div className="border-t px-5 py-4 shrink-0 bg-background">
                <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  <ActionButtons p={p} />
                </div>
              </div>
            </SheetContent>
          );
        })()}
      </Sheet>

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

      {/* ── New Proposal Wizard ─────────────────────────────────────────── */}
      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) setWizardOpen(false); }}>
        {wizardOpen && (
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {wizardStep === 1 ? 'Who is this for?' : wizardStep === 2 ? 'How do you want to start?' : 'Add context (optional)'}
              </DialogTitle>
              <DialogDescription className="sr-only">New proposal wizard</DialogDescription>
            </DialogHeader>

            {/* Step progress */}
            <div className="flex gap-1.5 -mt-1 mb-1">
              {([1, 2, 3] as const).map((s) => (
                <div
                  key={s}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    s < wizardStep ? 'bg-accent' : s === wizardStep ? 'bg-accent/70' : 'bg-muted',
                    s === 3 && wizardStartMode !== 'ai' && wizardStep < 3 ? 'opacity-30' : '',
                  )}
                />
              ))}
            </div>

            {/* ── Step 1: Client ── */}
            {wizardStep === 1 && (
              <div className="space-y-4 pt-1">
                {clients.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWizardClientMode('existing')}
                      className={cn(
                        'flex-1 py-1.5 px-3 rounded-md border text-sm font-medium transition-colors',
                        wizardClientMode === 'existing'
                          ? 'bg-accent text-accent-foreground border-accent'
                          : 'border-border text-muted-foreground hover:border-accent/50',
                      )}
                    >
                      Existing client
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardClientMode('new')}
                      className={cn(
                        'flex-1 py-1.5 px-3 rounded-md border text-sm font-medium transition-colors',
                        wizardClientMode === 'new'
                          ? 'bg-accent text-accent-foreground border-accent'
                          : 'border-border text-muted-foreground hover:border-accent/50',
                      )}
                    >
                      New contact
                    </button>
                  </div>
                )}

                {wizardClientMode === 'existing' ? (
                  <Select value={wizardClientId} onValueChange={setWizardClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client…" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.email ? ` — ${c.email}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Name</Label>
                      <Input
                        placeholder="Jane Smith"
                        value={wizardNewName}
                        onChange={(e) => setWizardNewName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">
                        Email <span className="text-muted-foreground/60">(optional — needed to send)</span>
                      </Label>
                      <Input
                        type="email"
                        placeholder="jane@company.com"
                        value={wizardNewEmail}
                        onChange={(e) => setWizardNewEmail(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setWizardOpen(false)}>Cancel</Button>
                  <Button onClick={handleWizardStep1Next}>Next →</Button>
                </div>
              </div>
            )}

            {/* ── Step 2: Start mode ── */}
            {wizardStep === 2 && (
              <div className="space-y-4 pt-1">
                <div className="space-y-2">
                  {(
                    [
                      {
                        id: 'ai' as const,
                        Icon: Sparkles,
                        label: 'Generate with AI',
                        desc: 'Get a polished first draft in seconds — recommended',
                      },
                      {
                        id: 'blank' as const,
                        Icon: FileText,
                        label: 'Start from blank',
                        desc: 'Open the form and write from scratch',
                      },
                      {
                        id: 'duplicate' as const,
                        Icon: Copy,
                        label: 'Duplicate an existing proposal',
                        desc: 'Copy a previous proposal as your starting point',
                      },
                    ]
                  ).map(({ id, Icon, label, desc }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setWizardStartMode(id)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                        wizardStartMode === id
                          ? 'border-accent bg-accent/5'
                          : 'border-border hover:border-accent/40 hover:bg-muted/40',
                      )}
                    >
                      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', wizardStartMode === id ? 'text-accent' : 'text-muted-foreground')} />
                      <div>
                        <div className="text-sm font-medium leading-snug">{label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {wizardStartMode === 'duplicate' && (
                  <Select value={wizardDupId} onValueChange={setWizardDupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a proposal to copy…" />
                    </SelectTrigger>
                    <SelectContent>
                      {proposals
                        .filter((p) => p.initiated_by !== 'client')
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setWizardStep(1)}>← Back</Button>
                  <Button onClick={handleWizardStep2Next}>
                    {wizardStartMode === 'ai' ? 'Next →' : wizardStartMode === 'blank' ? 'Open form →' : 'Use as template →'}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 3: AI context ── */}
            {wizardStep === 3 && (
              <div className="space-y-4 pt-1">
                <Textarea
                  placeholder="e.g. they mentioned a tight timeline, or they have a fixed budget of $2k"
                  rows={5}
                  value={wizardContext}
                  onChange={(e) => setWizardContext(e.target.value)}
                  className="resize-none text-sm"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Optional — leave blank for a general draft. This context helps tailor tone and scope.
                </p>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setWizardStep(2)} disabled={wizardGenerating}>
                    ← Back
                  </Button>
                  <Button onClick={handleWizardGenerate} disabled={wizardGenerating} className="glow-accent">
                    {wizardGenerating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" />Generate proposal</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
