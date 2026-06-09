import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Send, Edit, Trash2, Eye, CheckCircle2, Clock, XCircle, FileCheck, Mail, Search, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import type { Proposal, ProposalStatus, Client, Project } from '@/types/types';
import { getProposals, createProposal, updateProposal, sendProposal, updateProposalStatus, deleteProposal, subscribeToProposals } from '@/services/proposalService';
import { getClients } from '@/services/clientService';
import { getProjects } from '@/services/projectService';
import { useBusiness } from '@/contexts/CurrentBusinessContext';

interface ProposalTemplate {
  intro?: string;
  approach?: string;
  whyUs?: string;
  nextSteps?: string[];
}

export default function ProposalsPage() {
  const { business, extractedData, refetch: refetchBusiness } = useBusiness();
  const template = (extractedData?.proposal as ProposalTemplate | null | undefined) ?? null;

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    project_id: '',
    introduction: '',
    services: '',
    deliverables: '',
    pricing: '',
    timeline: '',
    terms: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [templateEditing, setTemplateEditing] = useState(false);
  const [templateDraft, setTemplateDraft] = useState({ intro: '', approach: '', whyUs: '', nextSteps: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    loadData();

    const channel = subscribeToProposals(() => {
      loadProposals();
    });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  async function loadData() {
    try {
      const [proposalsData, clientsData, projectsData] = await Promise.all([
        getProposals(),
        getClients(),
        getProjects(),
      ]);
      setProposals(proposalsData);
      setClients(clientsData);
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function loadProposals() {
    try {
      const data = await getProposals();
      setProposals(data);
    } catch (error) {
      console.error('Error loading proposals:', error);
    }
  }

  function openCreateModal() {
    setFormData({
      title: '',
      client_id: '',
      project_id: '',
      introduction: template?.intro ?? '',
      services: template?.approach ?? '',
      deliverables: '',
      pricing: '',
      timeline: '',
      terms: '',
    });
    setIsCreateModalOpen(true);
  }

  function openTemplateEdit() {
    setTemplateDraft({
      intro: template?.intro ?? '',
      approach: template?.approach ?? '',
      whyUs: template?.whyUs ?? '',
      nextSteps: (template?.nextSteps ?? []).join('\n'),
    });
    setTemplateEditing(true);
  }

  function cancelTemplateEdit() {
    setTemplateEditing(false);
  }

  async function saveTemplate() {
    if (!business) return;
    setSavingTemplate(true);
    const updated: ProposalTemplate = {
      intro: templateDraft.intro,
      approach: templateDraft.approach,
      whyUs: templateDraft.whyUs,
      nextSteps: templateDraft.nextSteps.split('\n').map(s => s.trim()).filter(Boolean),
    };
    await supabase.from('businesses').update({
      extracted_data: { ...extractedData, proposal: updated },
    }).eq('id', business.id);
    await refetchBusiness();
    setSavingTemplate(false);
    setTemplateEditing(false);
    toast.success('Template saved');
  }

  function openEditModal(proposal: Proposal) {
    setSelectedProposal(proposal);
    setFormData({
      title: proposal.title,
      client_id: proposal.client_id || '',
      project_id: proposal.project_id || '',
      introduction: proposal.introduction || '',
      services: proposal.services || '',
      deliverables: proposal.deliverables || '',
      pricing: proposal.pricing?.toString() || '',
      timeline: proposal.timeline || '',
      terms: proposal.terms || '',
    });
    setIsEditModalOpen(true);
  }

  function openDeleteDialog(proposal: Proposal) {
    setSelectedProposal(proposal);
    setIsDeleteDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const proposalData = {
        title: formData.title,
        client_id: formData.client_id || null,
        project_id: formData.project_id || null,
        introduction: formData.introduction || null,
        services: formData.services || null,
        deliverables: formData.deliverables || null,
        pricing: formData.pricing ? parseFloat(formData.pricing) : null,
        timeline: formData.timeline || null,
        terms: formData.terms || null,
        status: 'draft' as ProposalStatus,
        sent_at: null,
      };

      if (isEditModalOpen && selectedProposal) {
        await updateProposal(selectedProposal.id, proposalData);
        toast.success('Proposal updated successfully!');
        setIsEditModalOpen(false);
      } else {
        await createProposal(proposalData);
        toast.success('Proposal created successfully!');
        setIsCreateModalOpen(false);
      }

      loadProposals();
    } catch (error) {
      console.error('Error saving proposal:', error);
      toast.error('Failed to save proposal');
    } finally {
      setSubmitting(false);
    }
  }

  function openSendDialog(proposal: Proposal) {
    setSelectedProposal(proposal);
    setIsSendDialogOpen(true);
  }

  async function handleSendEmail() {
    if (!selectedProposal || !selectedProposal.client) {
      toast.error('Client information missing');
      return;
    }

    if (!selectedProposal.client.email) {
      toast.error('Client email address is required');
      return;
    }

    const isResend = selectedProposal.status !== 'draft';
    setSendingEmail(true);
    try {
      // Generate a fresh portal link (30-day, no-login URL for the client)
      const { data: portalData } = await supabase.functions.invoke('generate-portal-link', {
        body: { clientId: selectedProposal.client_id, expiresInDays: 30 },
      });

      const proposalLink = portalData?.portalUrl ?? `${window.location.origin}/portal`;

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'proposal',
          to: selectedProposal.client.email,
          data: {
            clientName: selectedProposal.client.name,
            proposalTitle: selectedProposal.title,
            amount: typeof selectedProposal.pricing === 'string' ? parseFloat(selectedProposal.pricing || '0') : (selectedProposal.pricing || 0),
            proposalLink,
          },
        },
      });

      if (error) {
        const errorMsg = await error?.context?.text();
        console.error('Email sending error:', errorMsg || error?.message);
        toast.error('Failed to send email. Please try again.');
        return;
      }

      await sendProposal(selectedProposal.id);
      toast.success(isResend ? 'Proposal resent successfully!' : 'Proposal sent successfully!');
      setIsSendDialogOpen(false);
      loadProposals();
    } catch (error) {
      console.error('Error sending proposal:', error);
      toast.error('Failed to send proposal');
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleStatusChange(proposal: Proposal, status: ProposalStatus) {
    try {
      await updateProposalStatus(proposal.id, status);
      toast.success('Proposal status updated!');
      loadProposals();
    } catch (error) {
      console.error('Error updating proposal status:', error);
      toast.error('Failed to update proposal status');
    }
  }

  async function handleDelete() {
    if (!selectedProposal) return;

    try {
      await deleteProposal(selectedProposal.id);
      toast.success('Proposal deleted successfully!');
      setIsDeleteDialogOpen(false);
      loadProposals();
    } catch (error) {
      console.error('Error deleting proposal:', error);
      toast.error('Failed to delete proposal');
    }
  }

  function getStatusBadge(status: ProposalStatus) {
    const config = {
      draft: { icon: Clock, label: 'Draft', className: 'bg-muted text-muted-foreground' },
      sent: { icon: Send, label: 'Sent', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      accepted: { icon: CheckCircle2, label: 'Approved', className: 'bg-success/10 text-success border-success/20' },
      rejected: { icon: XCircle, label: 'Rejected', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    };

    const statusConfig = config[status] || config.draft;
    const { icon: Icon, label, className } = statusConfig;
    return (
      <Badge variant="outline" className={className}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  }

  const filteredProjects = projects.filter(p => p.client_id === formData.client_id);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-2">Proposals</h1>
          <p className="text-sm md:text-base text-muted-foreground">Create and manage client proposals</p>
        </div>
        <Button size="lg" className="glow-accent w-full md:w-auto" onClick={openCreateModal}>
          <Plus className="w-5 h-5 mr-2" />
          Create Proposal
        </Button>
      </div>

      {template && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="font-semibold text-sm">Proposal Template</span>
                <Badge variant="outline" className="text-xs border-accent/30 text-accent">AI-generated</Badge>
              </div>
              {!templateEditing ? (
                <Button variant="ghost" size="sm" onClick={openTemplateEdit}>
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelTemplateEdit} disabled={savingTemplate}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveTemplate} disabled={savingTemplate} className="glow-accent">
                    {savingTemplate ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              )}
            </div>

            {!templateEditing ? (
              <div className="space-y-3 text-sm">
                {template.intro && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Introduction</p>
                    <p className="text-foreground/80 leading-relaxed">{template.intro}</p>
                  </div>
                )}
                {template.approach && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Our Approach</p>
                    <p className="text-foreground/80 leading-relaxed">{template.approach}</p>
                  </div>
                )}
                {template.whyUs && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Why Us</p>
                    <p className="text-foreground/80 leading-relaxed">{template.whyUs}</p>
                  </div>
                )}
                {template.nextSteps && template.nextSteps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Next Steps</p>
                    <ol className="list-decimal list-inside space-y-1">
                      {template.nextSteps.map((step) => (
                        <li key={step} className="text-foreground/80">{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                  Introduction and Services fields are pre-filled from this template when you create a new proposal.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Introduction</Label>
                  <Textarea
                    value={templateDraft.intro}
                    onChange={(e) => setTemplateDraft({ ...templateDraft, intro: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Our Approach</Label>
                  <Textarea
                    value={templateDraft.approach}
                    onChange={(e) => setTemplateDraft({ ...templateDraft, approach: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why Us</Label>
                  <Textarea
                    value={templateDraft.whyUs}
                    onChange={(e) => setTemplateDraft({ ...templateDraft, whyUs: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next Steps (one per line)</Label>
                  <Textarea
                    value={templateDraft.nextSteps}
                    onChange={(e) => setTemplateDraft({ ...templateDraft, nextSteps: e.target.value })}
                    rows={3}
                    placeholder="Schedule onboarding call&#10;Share project brief&#10;Send contract for signature"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search proposals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No proposals yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-pretty">
              Start winning more clients by creating professional proposals.
            </p>
            <Button onClick={openCreateModal} className="glow-accent">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Proposal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {proposals.filter(p => {
            const q = searchQuery.toLowerCase();
            return !q || p.title.toLowerCase().includes(q) || (p as any).client?.name?.toLowerCase().includes(q);
          }).map((proposal) => (
            <Card key={proposal.id} className="card-hover h-full flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1 truncate">{proposal.title}</h3>
                    {proposal.client && (
                      <p className="text-sm text-muted-foreground truncate">{proposal.client.name}</p>
                    )}
                  </div>
                  {getStatusBadge(proposal.status)}
                </div>

                <div className="space-y-2 flex-1 mb-4">
                  {proposal.pricing && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-accent font-semibold">${proposal.pricing.toLocaleString()}</span>
                    </div>
                  )}
                  {proposal.timeline && (
                    <div className="text-sm text-muted-foreground">
                      Timeline: {proposal.timeline}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Created {new Date(proposal.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-4 border-t border-border">
                  {proposal.status === 'draft' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full glow-accent"
                        onClick={() => openSendDialog(proposal)}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Send to Client
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openEditModal(proposal)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(proposal)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}
                  {proposal.status === 'sent' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full glow-accent"
                        onClick={() => openSendDialog(proposal)}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Resend Proposal
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleStatusChange(proposal, 'accepted')}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleStatusChange(proposal, 'rejected')}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Decline
                        </Button>
                      </div>
                    </>
                  )}
                  {(proposal.status === 'accepted' || proposal.status === 'rejected') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {}}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isCreateModalOpen || isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
        }
      }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditModalOpen ? 'Edit Proposal' : 'Create New Proposal'}</DialogTitle>
            <DialogDescription>
              {isEditModalOpen
                ? 'Update proposal information'
                : template
                  ? 'Fields pre-filled from your Proposal Template — edit freely before saving.'
                  : 'Create a professional proposal for your client'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Proposal Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Brand Identity Design Package"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value, project_id: '' })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project">Project (Optional)</Label>
                  <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })} disabled={!formData.client_id}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="introduction">Introduction</Label>
                <Textarea
                  id="introduction"
                  value={formData.introduction}
                  onChange={(e) => setFormData({ ...formData, introduction: e.target.value })}
                  placeholder="Thank you for considering our services..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="services">Services Description</Label>
                <Textarea
                  id="services"
                  value={formData.services}
                  onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                  placeholder="Describe the services you'll provide..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliverables">Deliverables</Label>
                <Textarea
                  id="deliverables"
                  value={formData.deliverables}
                  onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
                  placeholder="List deliverables (one per line)..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pricing">Pricing ($)</Label>
                  <Input
                    id="pricing"
                    type="number"
                    step="0.01"
                    value={formData.pricing}
                    onChange={(e) => setFormData({ ...formData, pricing: e.target.value })}
                    placeholder="3200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeline">Timeline</Label>
                  <Input
                    id="timeline"
                    value={formData.timeline}
                    onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                    placeholder="e.g., 4 weeks"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea
                  id="terms"
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                  placeholder="Payment terms, revision policy, etc..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="glow-accent">
                {submitting ? 'Saving...' : isEditModalOpen ? 'Update Proposal' : 'Create Proposal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedProposal?.title}? This action cannot be undone.
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

      {/* Send / Resend Email Confirmation Dialog */}
      <AlertDialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedProposal?.status !== 'draft' ? 'Resend Proposal' : 'Send Proposal via Email'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedProposal?.status !== 'draft'
                ? `A new email with a fresh portal link will be sent to ${selectedProposal?.client?.name}.`
                : `This will send the proposal to ${selectedProposal?.client?.name} at `}
              {selectedProposal?.status === 'draft' && (
                <strong className="text-accent">{selectedProposal?.client?.email}</strong>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Proposal:</span>
                <span className="text-sm text-accent truncate ml-2">{selectedProposal?.title}</span>
              </div>
              {selectedProposal?.pricing && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Value:</span>
                  <span className="text-sm font-bold text-accent">${Number(selectedProposal.pricing).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">To:</span>
                <span className="text-sm text-muted-foreground">{selectedProposal?.client?.email}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                {selectedProposal?.status !== 'draft'
                  ? 'Client will receive a new email with a fresh 30-day portal link to review and respond — no account needed.'
                  : 'Client will receive a branded email with a secure portal link to review and approve — no account needed.'}
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingEmail}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendEmail} disabled={sendingEmail} className="glow-accent">
              {sendingEmail ? 'Sending...' : selectedProposal?.status !== 'draft' ? 'Resend' : 'Send Email'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
