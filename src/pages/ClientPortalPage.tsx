import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Briefcase, FileText, Receipt, Download, ExternalLink, CheckCircle2, Clock, AlertCircle, Sparkles, Mail, Phone, DollarSign, CalendarDays, List, BookOpen, ScrollText } from 'lucide-react';
import { supabase } from '@/db/supabase';
import type { Project, Proposal, Invoice, Client } from '@/types/types';
import { toast } from 'sonner';

export default function ClientPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingProposal, setViewingProposal] = useState<Proposal | null>(null);

  useEffect(() => {
    if (token) {
      validateTokenAndLoadData();
    }
  }, [token]);

  async function validateTokenAndLoadData() {
    try {
      setLoading(true);
      setError(null);

      // Validate token and get client ID
      const { data: tokenData, error: tokenError } = await supabase
        .from('client_portal_tokens')
        .select('client_id, expires_at')
        .eq('token', token)
        .single();

      if (tokenError || !tokenData) {
        setError('Invalid or expired portal link. Please contact your service provider for a new link.');
        return;
      }

      // Check if token is expired
      if (new Date(tokenData.expires_at) < new Date()) {
        setError('This portal link has expired. Please contact your service provider for a new link.');
        return;
      }

      // Update last accessed time
      await supabase
        .from('client_portal_tokens')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('token', token);

      // Load client data
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

      // Load projects, proposals, and invoices for this client
      const [projectsData, proposalsData, invoicesData] = await Promise.all([
        supabase
          .from('projects')
          .select('*')
          .eq('client_id', tokenData.client_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('proposals')
          .select('*')
          .eq('client_id', tokenData.client_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select('*')
          .eq('client_id', tokenData.client_id)
          .order('created_at', { ascending: false }),
      ]);

      if (projectsData.data) setProjects(projectsData.data);
      if (proposalsData.data) setProposals(proposalsData.data);
      if (invoicesData.data) setInvoices(invoicesData.data);
    } catch (error) {
      console.error('Error loading portal data:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'paid':
      case 'accepted':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'in_progress':
      case 'sent':
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'paid':
      case 'accepted':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'in_progress':
      case 'sent':
      case 'pending':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'overdue':
      case 'rejected':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
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
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
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

  const activeProjects = projects.filter(p => p.status === 'In Progress').length;
  const pendingProposals = proposals.filter(p => p.status === 'sent').length;
  const unpaidInvoices = invoices.filter(i => i.payment_status === 'unpaid').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-balance mb-2 flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-emerald-500" />
                Client Portal
              </h1>
              <p className="text-muted-foreground">Welcome, {client?.name || 'Valued Client'}</p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm text-muted-foreground">Powered by</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-amber-500 bg-clip-text text-transparent">
                Forgefly
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="card-hover border-emerald-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Projects</p>
                  <p className="text-3xl font-bold">{activeProjects}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover border-amber-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pending Proposals</p>
                  <p className="text-3xl font-bold">{pendingProposals}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Unpaid Invoices</p>
                  <p className="text-3xl font-bold">{unpaidInvoices}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects, Proposals, Invoices Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Projects */}
          <Card>
            <CardHeader>
              <CardTitle className="text-balance flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-500" />
                Projects
              </CardTitle>
              <CardDescription>Your ongoing work</CardDescription>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No projects yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <div key={project.id} className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-transparent hover:border-emerald-500/20">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-balance">{project.name}</h4>
                        <Badge variant="outline" className={getStatusColor(project.status)}>
                          {getStatusIcon(project.status)}
                          <span className="ml-1 capitalize">{project.status}</span>
                        </Badge>
                      </div>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mb-2 text-pretty line-clamp-2">{project.description}</p>
                      )}
                      <div className="flex items-center justify-between text-sm mt-3">
                        <span className="text-muted-foreground">
                          {project.deadline && `Due: ${new Date(project.deadline).toLocaleDateString()}`}
                        </span>
                        {project.value && (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            ${project.value.toLocaleString()}
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
              <CardTitle className="text-balance flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                Proposals
              </CardTitle>
              <CardDescription>Review and respond</CardDescription>
            </CardHeader>
            <CardContent>
              {proposals.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No proposals yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {proposals.map((proposal) => (
                    <div key={proposal.id} className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-transparent hover:border-amber-500/20">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-balance">{proposal.title}</h4>
                        <Badge variant="outline" className={getStatusColor(proposal.status)}>
                          {getStatusIcon(proposal.status)}
                          <span className="ml-1 capitalize">{proposal.status}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Sent: {new Date(proposal.created_at).toLocaleDateString()}
                      </p>
                      {(proposal.status === 'sent') && (
                        <Button size="sm" variant="outline" className="w-full" onClick={() => setViewingProposal(proposal)}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Proposal
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-balance flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-500" />
                Invoices
              </CardTitle>
              <CardDescription>Payment information</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No invoices yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-transparent hover:border-blue-500/20">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold">{invoice.invoice_number}</h4>
                            <Badge variant="outline" className={getStatusColor(invoice.payment_status)}>
                              {getStatusIcon(invoice.payment_status)}
                              <span className="ml-1 capitalize">{invoice.payment_status}</span>
                            </Badge>
                          </div>
                          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm text-muted-foreground">
                            <span>Due: {invoice.due_date && new Date(invoice.due_date).toLocaleDateString()}</span>
                            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                              ${typeof invoice.amount === 'string' ? parseFloat(invoice.amount).toLocaleString() : invoice.amount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        {invoice.payment_status === 'unpaid' && (
                          <Button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shrink-0" onClick={() => toast.info('Payment processing coming soon!')}>
                            <Receipt className="w-4 h-4 mr-2" />
                            Pay Now
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Contact Section */}
        {client && (client.email || client.phone) && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-balance">Need Help?</CardTitle>
              <CardDescription>Get in touch with us</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
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

        {/* Proposal View Modal */}
        <Dialog open={!!viewingProposal} onOpenChange={(open) => !open && setViewingProposal(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <FileText className="w-5 h-5 text-amber-500" />
                {viewingProposal?.title}
              </DialogTitle>
            </DialogHeader>

            {viewingProposal && (
              <div className="space-y-5 pt-2">
                {viewingProposal.introduction && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                      <BookOpen className="w-4 h-4" />
                      Introduction
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{viewingProposal.introduction}</p>
                  </div>
                )}

                {viewingProposal.services && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                        <Briefcase className="w-4 h-4" />
                        Services
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{viewingProposal.services}</p>
                    </div>
                  </>
                )}

                {viewingProposal.deliverables && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                        <List className="w-4 h-4" />
                        Deliverables
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{viewingProposal.deliverables}</p>
                    </div>
                  </>
                )}

                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  {viewingProposal.pricing != null && (
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-1">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                        Investment
                      </div>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        ${Number(viewingProposal.pricing).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {viewingProposal.timeline && (
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-1">
                        <CalendarDays className="w-4 h-4 text-amber-500" />
                        Timeline
                      </div>
                      <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                        {viewingProposal.timeline}
                      </p>
                    </div>
                  )}
                </div>

                {viewingProposal.terms && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                        <ScrollText className="w-4 h-4" />
                        Terms & Conditions
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{viewingProposal.terms}</p>
                    </div>
                  </>
                )}

                <Separator />
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Sent on {new Date(viewingProposal.created_at).toLocaleDateString()}</span>
                  <Badge variant="outline" className={getStatusColor(viewingProposal.status)}>
                    {getStatusIcon(viewingProposal.status)}
                    <span className="ml-1 capitalize">{viewingProposal.status}</span>
                  </Badge>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>This portal is secured and private. Only you can access this information.</p>
          <p className="mt-2">Powered by <span className="font-semibold text-emerald-600 dark:text-emerald-400">Forgefly</span> - AI Business OS for Solopreneurs</p>
        </div>
      </div>
    </div>
  );
}
