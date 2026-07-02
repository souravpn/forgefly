import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Edit, Trash2, DollarSign, Briefcase, Sparkles, Link2, ExternalLink, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBusiness } from '@/contexts/CurrentBusinessContext';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

const STAGES = [
  'Prospect',
  'Qualified',
  'Contacted',
  'Proposal Sent',
  'Negotiating',
  'Closed Won',
  'Lost',
] as const;

type Stage = typeof STAGES[number];

interface Lead {
  _id: string;        // pipeline_leads.id (uuid)
  contactId: string | null;
  name: string;       // from contacts.name
  stage: Stage;
  value: string;
  service: string;
  lifecycleStatus: string;
  portalToken: string | null;
}

type LeadFormData = {
  name: string;
  stage: Stage;
  value: string;
  service: string;
};

const EMPTY_FORM: LeadFormData = {
  name: '', stage: 'Prospect', value: '', service: '',
};

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<Stage, { label: string; color: string; dot: string }> = {
  'Prospect':      { label: 'Prospect',      color: 'bg-gray-500/10 text-gray-600 border-gray-500/20',   dot: 'bg-gray-400' },
  'Qualified':     { label: 'Qualified',      color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',   dot: 'bg-blue-500' },
  'Contacted':     { label: 'Contacted',      color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',   dot: 'bg-cyan-500' },
  'Proposal Sent': { label: 'Proposal Sent',  color: 'bg-violet-500/10 text-violet-600 border-violet-500/20', dot: 'bg-violet-500' },
  'Negotiating':   { label: 'Negotiating',    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', dot: 'bg-amber-500' },
  'Closed Won':    { label: 'Closed Won',     color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', dot: 'bg-emerald-500' },
  'Lost':          { label: 'Lost',           color: 'bg-rose-500/10 text-rose-600 border-rose-500/20',     dot: 'bg-rose-500' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toStage(s: string): Stage {
  return (STAGES.includes(s as Stage) ? s : 'Prospect') as Stage;
}

function generatePortalToken(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Lead card (sortable) ─────────────────────────────────────────────────────

function LeadCard({
  lead,
  onEdit,
  onDelete,
  overlay = false,
}: {
  lead: Lead;
  onEdit: () => void;
  onDelete: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const isEngaged = lead.lifecycleStatus === 'engaged';
  const portalUrl = lead.portalToken
    ? `${window.location.origin}/portal/${lead.portalToken}`
    : null;

  function handleCopyPortalLink(e: React.MouseEvent) {
    e.stopPropagation();
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    toast.success('Portal link copied');
  }

  function handleOpenPortal(e: React.MouseEvent) {
    e.stopPropagation();
    if (!portalUrl) return;
    window.open(portalUrl, '_blank', 'noopener noreferrer');
  }

  return (
    <div ref={setNodeRef} style={overlay ? undefined : style} {...attributes} {...listeners}>
      <Card className={`cursor-grab active:cursor-grabbing ${overlay ? 'shadow-xl rotate-1' : 'card-hover'}`}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-1">
            <p className="font-medium text-sm leading-tight">{lead.name}</p>
            {isEngaged && (
              <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Client
              </span>
            )}
          </div>
          {lead.service && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Briefcase className="w-3 h-3 shrink-0" />
              <span className="truncate">{lead.service}</span>
            </div>
          )}
          {lead.value && (
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <DollarSign className="w-3 h-3" />
              {lead.value.replace(/^\$/, '')}
            </div>
          )}
          {!overlay && (
            <div className="flex gap-1.5 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs flex-1"
                onClick={e => { e.stopPropagation(); onEdit(); }}
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
              {portalUrl && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title="Copy portal link"
                    onClick={handleCopyPortalLink}
                  >
                    <Link2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title="Open portal"
                    onClick={handleOpenPortal}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                onClick={e => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Droppable column ─────────────────────────────────────────────────────────

function StageColumn({
  stage,
  leads,
  onAddLead,
  onEdit,
  onDelete,
}: {
  stage: Stage;
  leads: Lead[];
  onAddLead: (stage: Stage) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const cfg = STAGE_CONFIG[stage];

  return (
    <div className="flex flex-col w-[270px] shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
          <span className="text-xs font-semibold truncate">{stage}</span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
            {leads.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 shrink-0"
          onClick={() => onAddLead(stage)}
          title={`Add lead to ${stage}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Cards drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 min-h-[160px] p-2 rounded-lg border border-dashed transition-colors ${
          isOver
            ? 'border-primary/60 bg-primary/5'
            : 'border-transparent bg-muted/30'
        }`}
      >
        <SortableContext items={leads.map(l => l._id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <LeadCard
              key={lead._id}
              lead={lead}
              onEdit={() => onEdit(lead)}
              onDelete={() => onDelete(lead)}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <button
            type="button"
            onClick={() => onAddLead(stage)}
            className="w-full h-16 flex items-center justify-center text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            + add lead
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Lead form modal ──────────────────────────────────────────────────────────

function LeadModal({
  open,
  onClose,
  onSave,
  initial,
  saving,
  services,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: LeadFormData) => void;
  initial: LeadFormData;
  saving: boolean;
  services: string[];
}) {
  const [form, setForm] = useState<LeadFormData>(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  const isEdit = !!initial.name;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Lead' : 'Add Lead'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this pipeline lead.' : 'Add a new prospect to your pipeline.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!form.name.trim()) return;
            onSave(form);
          }}
        >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name / Company *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Acme Corp"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v as Stage }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Deal Value</Label>
                <Input
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  placeholder="e.g., $5,000"
                />
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                {services.length > 0 ? (
                  <Select value={form.service} onValueChange={v => setForm(f => ({ ...f, service: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick one" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.service}
                    onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                    placeholder="e.g., Brand Identity"
                  />
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()} className="glow-accent">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { business, extractedData, isLoading: bizLoading } = useBusiness();
  const { user } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [leadModal, setLeadModal] = useState<{
    open: boolean;
    initial: LeadFormData;
    editId: string | null;
  }>({ open: false, initial: EMPTY_FORM, editId: null });

  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  // Auto-open "new lead" modal when navigated with ?action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setLeadModal({ open: true, initial: EMPTY_FORM, editId: null });
      setSearchParams({}, { replace: true });
    }
  }, []);

  // ── Load from pipeline_leads table, seed from extracted_data if empty ────

  const loadLeads = useCallback(async () => {
    if (!business) return;

    const { data } = await supabase
      .from('pipeline_leads')
      .select('id, contact_id, stage, value, service_name, contacts(name, lifecycle_status, portal_token)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: true });

    if (data && data.length > 0) {
      setLeads(data.map(l => {
        const c = l.contacts as { name: string; lifecycle_status: string; portal_token: string | null } | null;
        return {
          _id: l.id,
          contactId: l.contact_id ?? null,
          name: c?.name ?? 'Unknown',
          stage: toStage(l.stage),
          value: l.value ?? '',
          service: l.service_name ?? '',
          lifecycleStatus: c?.lifecycle_status ?? 'prospect',
          portalToken: c?.portal_token ?? null,
        };
      }));
      setLoaded(true);
      return;
    }

    // Seed from extracted_data if table is empty
    const raw = (extractedData?.pipeline?.leads ?? []) as Array<{
      name: string; stage: string; value: string; service: string;
    }>;

    if (raw.length === 0) { setLoaded(true); return; }

    const seeded: Lead[] = [];
    for (const item of raw) {
      const { data: contact } = await supabase
        .from('contacts')
        .insert({ business_id: business.id, name: item.name })
        .select('id')
        .single();
      if (!contact) continue;

      const { data: pl } = await supabase
        .from('pipeline_leads')
        .insert({
          business_id: business.id,
          contact_id: contact.id,
          stage: toStage(item.stage),
          value: item.value || null,
          service_name: item.service || null,
        })
        .select('id')
        .single();
      if (!pl) continue;

      seeded.push({
        _id: pl.id,
        contactId: contact.id,
        name: item.name,
        stage: toStage(item.stage),
        value: item.value ?? '',
        service: item.service ?? '',
        lifecycleStatus: 'prospect',
        portalToken: null,
      });
    }
    setLeads(seeded);
    setLoaded(true);
  }, [business, extractedData]);

  useEffect(() => {
    if (business && !loaded) loadLeads();
  }, [business, loaded, loadLeads]);

  // ── DnD ──────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const draggedId = active.id as string;
    const overId = over.id as string;

    const targetStage: Stage = STAGES.includes(overId as Stage)
      ? (overId as Stage)
      : (leads.find(l => l._id === overId)?.stage ?? 'Prospect');

    const dragged = leads.find(l => l._id === draggedId);
    if (!dragged || dragged.stage === targetStage) return;

    const previous = leads;
    setLeads(prev => prev.map(l => l._id === draggedId ? { ...l, stage: targetStage } : l));

    supabase
      .from('pipeline_leads')
      .update({ stage: targetStage })
      .eq('id', draggedId)
      .then(({ error }) => {
        if (error) { toast.error('Failed to save'); setLeads(previous); }
      });
  }

  // ── Lead CRUD ─────────────────────────────────────────────────────────────

  function openAdd(stage: Stage = 'Prospect') {
    setLeadModal({ open: true, initial: { ...EMPTY_FORM, stage }, editId: null });
  }

  function openEdit(lead: Lead) {
    setLeadModal({
      open: true,
      editId: lead._id,
      initial: { name: lead.name, stage: lead.stage, value: lead.value, service: lead.service },
    });
  }

  async function handleSaveLead(data: LeadFormData) {
    if (!business) return;
    setSaving(true);
    try {
      if (leadModal.editId) {
        const lead = leads.find(l => l._id === leadModal.editId)!;
        if (lead.contactId && lead.name !== data.name) {
          await supabase.from('contacts').update({ name: data.name }).eq('id', lead.contactId);
        }
        await supabase
          .from('pipeline_leads')
          .update({ stage: data.stage, value: data.value || null, service_name: data.service || null })
          .eq('id', leadModal.editId);
        setLeads(prev => prev.map(l => l._id === leadModal.editId
          ? { ...l, name: data.name, stage: data.stage, value: data.value, service: data.service }
          : l));
        toast.success('Lead updated');
      } else {
        const portalToken = generatePortalToken();
        const { data: contact } = await supabase
          .from('contacts')
          .insert({ business_id: business.id, name: data.name, portal_token: portalToken })
          .select('id')
          .single();
        if (!contact) throw new Error('Failed to create contact');

        const { data: pl } = await supabase
          .from('pipeline_leads')
          .insert({
            business_id: business.id,
            contact_id: contact.id,
            stage: data.stage,
            value: data.value || null,
            service_name: data.service || null,
          })
          .select('id')
          .single();
        if (!pl) throw new Error('Failed to create lead');

        // Also create a client record with Lead status so it appears in Clients
        if (user) {
          await supabase.from('clients').insert({
            user_id: user.id,
            name: data.name,
            status: 'lead',
            total_value: 0,
            email: null,
            company: null,
            phone: null,
            notes: data.service ? `Pipeline lead – service: ${data.service}` : null,
            last_interaction: new Date().toISOString(),
          });
        }

        setLeads(prev => [...prev, {
          _id: pl.id, contactId: contact.id, name: data.name,
          stage: data.stage, value: data.value, service: data.service,
          lifecycleStatus: 'prospect', portalToken,
        }]);
        toast.success('Lead added');
        // Milestone beacon: fire-and-forget
        if (!business.onboarding_milestones?.prospect_added) {
          supabase.functions.invoke('mark-milestone', { body: { milestone: 'prospect_added' } });
        }
      }
      setLeadModal({ open: false, initial: EMPTY_FORM, editId: null });
    } catch {
      toast.error('Failed to save lead. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(lead: Lead) {
    const { error } = await supabase.from('pipeline_leads').delete().eq('id', lead._id);
    if (error) { toast.error('Failed to remove lead'); return; }
    setLeads(prev => prev.filter(l => l._id !== lead._id));
    setDeleteTarget(null);
    toast.success('Lead removed');
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const hasBusiness = !bizLoading && !!business;
  const activeDragLead = activeId ? leads.find(l => l._id === activeId) : null;
  const serviceNames = (extractedData?.services ?? []).map((s: { name: string }) => s.name);

  const totalValue = leads.reduce((sum, l) => {
    const v = parseFloat(l.value.replace(/[^0-9.]/g, ''))
    return sum + (isNaN(v) ? 0 : v)
  }, 0);
  const totalValueStr = totalValue > 0 ? `$${totalValue.toLocaleString()}` : null;

  const stageLeads = (stage: Stage) => leads.filter(l => l.stage === stage);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">Pipeline</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {hasBusiness
              ? `${leads.length} lead${leads.length !== 1 ? 's' : ''}${totalValueStr ? ` · ${totalValueStr} total value` : ''}`
              : 'Pre-sales CRM — track prospects through your pipeline'}
          </p>
        </div>
        {hasBusiness && (
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="flex-1 md:flex-none"
              onClick={() => navigate('/dashboard/outreach')}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Research a company
            </Button>
            <Button size="lg" className="glow-accent flex-1 md:flex-none" onClick={() => openAdd()}>
              <Plus className="w-5 h-5 mr-2" />
              Add Lead
            </Button>
          </div>
        )}
      </div>

      {/* No business CTA */}
      {!bizLoading && !business && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Generate your Business OS first</h3>
            <p className="text-muted-foreground max-w-sm text-pretty">
              Your pipeline is pre-populated from your business description. Generate your OS to get started.
            </p>
          </div>
          <Button onClick={() => navigate('/')}>
            Generate now
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Stage summary strip */}
      {hasBusiness && leads.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          {STAGES.map((stage, i) => {
            const count = stageLeads(stage).length;
            if (count === 0) return null;
            const cfg = STAGE_CONFIG[stage];
            return (
              <span key={stage} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${cfg.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {stage} · {count}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Kanban board */}
      {hasBusiness && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto pb-4 -mx-4 px-4">
            <div className="flex gap-4 min-w-max">
              {STAGES.map(stage => (
                <StageColumn
                  key={stage}
                  stage={stage}
                  leads={stageLeads(stage)}
                  onAddLead={openAdd}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeDragLead && (
              <LeadCard
                lead={activeDragLead}
                onEdit={() => {}}
                onDelete={() => {}}
                overlay
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Empty state (has business, no leads) */}
      {hasBusiness && !bizLoading && leads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
            <Briefcase className="w-7 h-7 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">No leads yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs text-pretty">
              Add your first prospect or update your Business OS prompt to seed the pipeline.
            </p>
          </div>
          <Button onClick={() => openAdd()} className="glow-accent">
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>
      )}

      {/* Lead modal */}
      <LeadModal
        open={leadModal.open}
        onClose={() => setLeadModal({ open: false, initial: EMPTY_FORM, editId: null })}
        onSave={handleSaveLead}
        initial={leadModal.initial}
        saving={saving}
        services={serviceNames}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteTarget?.name}" from your pipeline? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
