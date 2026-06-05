import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Briefcase, FileText, Receipt, CheckCircle2, Clock, AlertCircle,
  Sparkles, Mail, Phone, ThumbsUp, MessageSquare, DollarSign, Calendar,
  ArrowRight, PartyPopper,
} from 'lucide-react';
// @ts-ignore
import { supabase } from '@/db/supabase';
import type { Project, Proposal, Invoice, Client } from '@/types/types';
import { toast } from 'sonner';

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

export default function ClientPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (token) validateTokenAndLoadData();
  }, [token]);

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') toast.success('Payment successful! Thank you.');
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

      setProposals(prev => prev.map(p =>
        p.id === proposalId ? { ...p, status: action === 'approve' ? 'approved' : 'rejected' } : p
      ));
      if (action === 'approve') {
        toast.success('Proposal approved! The team has been notified.');
      } else {
        toast.info('Changes requested. The team will follow up with you.');
      }
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
      case 'completed': case 'paid': case 'approved': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'in_progress': case 'sent': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'overdue': case 'rejected': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': case 'paid': case 'approved': return <CheckCircle2 className="w-3 h-3" />;
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

                    {proposal.status === 'approved' && (
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
    </div>
  );
}
