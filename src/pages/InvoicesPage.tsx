import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Send, Edit, Trash2, DollarSign, Calendar, CheckCircle2, Clock, AlertCircle, CreditCard, Mail, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import type { Invoice, InvoiceStatus, PaymentStatus, Client, Project } from '@/types/types';
import { getInvoices, createInvoice, updateInvoice, sendInvoice, markInvoiceAsPaid, deleteInvoice, subscribeToInvoices } from '@/services/invoiceService';
import { getClients } from '@/services/clientService';
import { getProjects } from '@/services/projectService';

export default function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    project_id: '',
    amount: '',
    description: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-open create modal when navigated with ?action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsCreateModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    loadData();

    const channel = subscribeToInvoices(() => {
      loadInvoices();
    });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  async function loadData() {
    try {
      const [invoicesData, clientsData, projectsData] = await Promise.all([
        getInvoices(),
        getClients(),
        getProjects(),
      ]);
      setInvoices(invoicesData);
      setClients(clientsData);
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function loadInvoices() {
    try {
      const data = await getInvoices();
      setInvoices(data);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  }

  function openCreateModal() {
    setFormData({
      client_id: '',
      project_id: '',
      amount: '',
      description: '',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: '',
      notes: '',
    });
    setIsCreateModalOpen(true);
  }

  function openEditModal(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setFormData({
      client_id: invoice.client_id || '',
      project_id: invoice.project_id || '',
      amount: invoice.amount.toString(),
      description: invoice.description || '',
      issue_date: invoice.issue_date || new Date().toISOString().split('T')[0],
      due_date: invoice.due_date || '',
      notes: invoice.notes || '',
    });
    setIsEditModalOpen(true);
  }

  function openDeleteDialog(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setIsDeleteDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const invoiceData = {
        client_id: formData.client_id || null,
        project_id: formData.project_id || null,
        amount: parseFloat(formData.amount),
        description: formData.description || null,
        issue_date: formData.issue_date || null,
        due_date: formData.due_date || null,
        notes: formData.notes || null,
        status: 'draft' as InvoiceStatus,
        payment_status: 'unpaid' as PaymentStatus,
        sent_at: null,
        paid_at: null,
        stripe_payment_intent_id: null,
        stripe_checkout_session_id: null,
      };

      if (isEditModalOpen && selectedInvoice) {
        await updateInvoice(selectedInvoice.id, invoiceData);
        toast.success('Invoice updated successfully!');
        setIsEditModalOpen(false);
      } else {
        await createInvoice(invoiceData);
        toast.success('Invoice created successfully!');
        setIsCreateModalOpen(false);
      }

      loadInvoices();
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Failed to save invoice');
    } finally {
      setSubmitting(false);
    }
  }

  function openSendDialog(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setIsSendDialogOpen(true);
  }

  async function handleSendEmail() {
    if (!selectedInvoice || !selectedInvoice.client) {
      toast.error('Client information missing');
      return;
    }

    if (!selectedInvoice.client.email) {
      toast.error('Client email address is required');
      return;
    }

    const isResend = selectedInvoice.status !== 'draft';
    setSendingEmail(true);
    try {
      // Generate a fresh portal link (30-day, no-login URL for the client)
      const { data: portalData } = await supabase.functions.invoke('generate-portal-link', {
        body: { clientId: selectedInvoice.client_id, expiresInDays: 30 },
      });

      const paymentLink = portalData?.portalUrl ?? `${window.location.origin}/portal`;

      const dueDate = selectedInvoice.due_date
        ? new Date(selectedInvoice.due_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'Upon receipt';

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'invoice',
          to: selectedInvoice.client.email,
          data: {
            clientName: selectedInvoice.client.name,
            invoiceNumber: selectedInvoice.invoice_number,
            amount: typeof selectedInvoice.amount === 'string' ? parseFloat(selectedInvoice.amount) : selectedInvoice.amount,
            dueDate,
            paymentLink,
          },
        },
      });

      if (error) {
        const errorMsg = await error?.context?.text();
        console.error('Email sending error:', errorMsg || error?.message);
        toast.error('Failed to send email. Please try again.');
        return;
      }

      await sendInvoice(selectedInvoice.id);
      toast.success(isResend ? 'Invoice resent successfully!' : 'Invoice sent successfully!');
      setIsSendDialogOpen(false);
      loadInvoices();
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast.error('Failed to send invoice');
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleMarkAsPaid(invoice: Invoice) {
    try {
      await markInvoiceAsPaid(invoice.id);
      toast.success('Invoice marked as paid!');
      loadInvoices();
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      toast.error('Failed to mark invoice as paid');
    }
  }

  async function handlePayWithStripe(invoice: Invoice) {
    try {
      const loadingToast = toast.loading('Creating payment session...');
      
      const { data, error } = await supabase.functions.invoke('create-invoice-checkout', {
        body: { invoiceId: invoice.id },
      });

      toast.dismiss(loadingToast);

      if (error) {
        const errorMsg = await error?.context?.text();
        console.error('Stripe checkout error:', errorMsg || error?.message);
        toast.error(errorMsg || 'Failed to create payment session. Please ensure STRIPE_SECRET_KEY is configured.');
        return;
      }

      if (data?.data?.url) {
        // Open Stripe checkout in new tab to avoid CORS issues
        window.open(data.data.url, '_blank');
        toast.success('Payment page opened in new tab');
      } else {
        toast.error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to initiate payment');
    }
  }

  async function handleDelete() {
    if (!selectedInvoice) return;

    try {
      await deleteInvoice(selectedInvoice.id);
      toast.success('Invoice deleted successfully!');
      setIsDeleteDialogOpen(false);
      loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Failed to delete invoice');
    }
  }

  function getStatusBadge(status: InvoiceStatus) {
    const config = {
      draft: { icon: Clock, label: 'Draft', className: 'bg-muted text-muted-foreground' },
      sent: { icon: Send, label: 'Sent', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      paid: { icon: CheckCircle2, label: 'Paid', className: 'bg-success/10 text-success border-success/20' },
      overdue: { icon: AlertCircle, label: 'Overdue', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    };

    const { icon: Icon, label, className} = config[status];
    return (
      <Badge variant="outline" className={className}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  }

  function getPaymentStatusBadge(status: PaymentStatus) {
    const config = {
      unpaid: { label: 'Unpaid', className: 'bg-muted text-muted-foreground' },
      processing: { label: 'Processing', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      paid: { label: 'Paid', className: 'bg-success/10 text-success border-success/20' },
      failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    };

    const { label, className } = config[status];
    return (
      <Badge variant="outline" className={className}>
        {label}
      </Badge>
    );
  }

  const filteredProjects = projects.filter(p => p.client_id === formData.client_id);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-2">Invoices</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your invoices and payments</p>
        </div>
        <Button size="lg" className="glow-accent w-full md:w-auto" onClick={openCreateModal}>
          <Plus className="w-5 h-5 mr-2" />
          Create Invoice
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search invoices..."
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
      ) : invoices.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No invoices yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-pretty">
              Start tracking your payments by creating your first invoice.
            </p>
            <Button onClick={openCreateModal} className="glow-accent">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Invoice
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {invoices.filter(i => {
            const q = searchQuery.toLowerCase();
            return !q || i.invoice_number.toLowerCase().includes(q) || (i as any).client?.name?.toLowerCase().includes(q) || (i as any).project?.name?.toLowerCase().includes(q);
          }).map((invoice) => (
            <Card key={invoice.id} className="card-hover h-full flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1 truncate">{invoice.invoice_number}</h3>
                    {invoice.client && (
                      <p className="text-sm text-muted-foreground truncate">{invoice.client.name}</p>
                    )}
                    {invoice.project && (
                      <p className="text-xs text-muted-foreground truncate">{invoice.project.name}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {getStatusBadge(invoice.status)}
                    {getPaymentStatusBadge(invoice.payment_status)}
                  </div>
                </div>

                <div className="space-y-2 flex-1 mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-accent" />
                    <span className="text-xl font-bold text-accent">${invoice.amount.toLocaleString()}</span>
                  </div>
                  {invoice.due_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Due {new Date(invoice.due_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {invoice.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 text-pretty">{invoice.description}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-4 border-t border-border">
                  {invoice.status === 'draft' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full glow-accent"
                        onClick={() => openSendDialog(invoice)}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Send to Client
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openEditModal(invoice)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(invoice)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}
                  {(invoice.status === 'sent' || invoice.status === 'overdue') && invoice.payment_status !== 'paid' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full glow-accent"
                        onClick={() => openSendDialog(invoice)}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Resend Invoice
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openEditModal(invoice)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Revise
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => openDeleteDialog(invoice)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                  {invoice.status === 'paid' && (
                    <div className="text-center py-2 text-sm text-success">
                      <CheckCircle2 className="w-4 h-4 inline mr-1" />
                      Paid on {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : 'N/A'}
                    </div>
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
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditModalOpen ? 'Edit Invoice' : 'Create New Invoice'}</DialogTitle>
            <DialogDescription>
              {isEditModalOpen ? 'Update invoice information' : 'Create a new invoice for your client'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value, project_id: '' })} required>
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
                  <Label htmlFor="project">Project *</Label>
                  <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })} disabled={!formData.client_id} required>
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
                <Label htmlFor="amount">Amount ($) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of services..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issue_date">Issue Date *</Label>
                  <Input
                    id="issue_date"
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={2}
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
                {submitting ? 'Saving...' : isEditModalOpen ? 'Update Invoice' : 'Create Invoice'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedInvoice?.invoice_number}? This action cannot be undone.
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
              {selectedInvoice?.status !== 'draft' ? 'Resend Invoice' : 'Send Invoice via Email'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedInvoice?.status !== 'draft'
                ? `A new email with a fresh payment link will be sent to ${selectedInvoice?.client?.name}.`
                : `This will send the invoice to ${selectedInvoice?.client?.name} at`}{' '}
              {selectedInvoice?.status === 'draft' && (
                <strong className="text-accent">{selectedInvoice?.client?.email}</strong>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Invoice:</span>
                <span className="text-sm text-accent">{selectedInvoice?.invoice_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Amount:</span>
                <span className="text-sm font-bold text-accent">${selectedInvoice?.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">To:</span>
                <span className="text-sm text-muted-foreground">{selectedInvoice?.client?.email}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                {selectedInvoice?.status !== 'draft'
                  ? 'Client will receive a new email with a 30-day secure portal link to view and pay this invoice — no account needed.'
                  : 'Client will receive a branded email with a secure portal link to view and pay — no account needed.'}
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingEmail}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendEmail} disabled={sendingEmail} className="glow-accent">
              {sendingEmail ? 'Sending...' : selectedInvoice?.status !== 'draft' ? 'Resend' : 'Send Email'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
