import { Building2, Crown, Download, Edit, FileText, Link, Loader2, Mail, Paperclip, Phone, Plus, Search, Send, Trash2, Upload, User, UserPlus, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PhoneInputField } from '@/components/common/PhoneInputField';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
// @ts-ignore
import { supabase } from '@/db/supabase';
import { createClient, deleteClient, getClients, subscribeToClients, updateClient, uploadAvatar } from '@/services/clientService';
import {
  deletePortalFile,
  formatFileSize,
  getContactIdByEmail,
  getPortalFiles,
  type PortalFileItem,
  uploadPortalFile,
} from '@/services/portalFileService';
import type { Client } from '@/types/types';

// ─── Client badge helpers ─────────────────────────────────────────────────────

type ClientBadge = { label: string; className: string }

function getClientBadge(client: Client): ClientBadge {
  const s = client.status ?? 'active';

  // Cold: engaged/active but no interaction in 30+ days
  if ((s === 'engaged' || s === 'active') && client.last_interaction) {
    const daysSince = (Date.now() - new Date(client.last_interaction).getTime()) / 86_400_000;
    if (daysSince > 30) {
      return { label: 'Cold', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' };
    }
  }

  switch (s) {
    case 'lead':
      return { label: 'Lead', className: 'bg-gray-500/10 text-gray-600 border-gray-500/20 dark:text-gray-400' };
    case 'engaged':
    case 'active':
      return { label: 'Engaged', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' };
    case 'cold':
      return { label: 'Cold', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' };
    case 'won':
      return { label: 'Won', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' };
    case 'repeat':
      return { label: 'Repeat', className: 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400' };
    default:
      return { label: 'Engaged', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' };
  }
}

export default function ClientsPage() {
  const { isAgency, profile, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTeamMemberModalOpen, setIsTeamMemberModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailData, setEmailData] = useState({ subject: '', message: '' });
  const [emailSending, setEmailSending] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    notes: '',
    avatar_url: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // email → portal_token map from contacts table
  const [portalTokenMap, setPortalTokenMap] = useState<Record<string, string>>({});

  // ── Files Sheet ──
  const [filesClient, setFilesClient] = useState<Client | null>(null);
  const [filesContactId, setFilesContactId] = useState<string | null>(null);
  const [clientFiles, setClientFiles] = useState<PortalFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const filesInputRef = useRef<HTMLInputElement>(null);

  // Auto-open create modal when navigated with ?action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsCreateModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    loadClients();

    const channel = subscribeToClients(() => {
      loadClients();
    });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  async function loadClients() {
    try {
      const data = await getClients();
      setClients(data);
      // Load portal tokens for clients that have emails
      const emails = data.map(c => c.email).filter(Boolean) as string[];
      if (emails.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('email, portal_token')
          .in('email', emails)
          .not('portal_token', 'is', null);
        if (contacts) {
          setPortalTokenMap(Object.fromEntries(contacts.map(c => [c.email, c.portal_token])));
        }
      }
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  function copyPortalLink(token: string) {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Portal link copied to clipboard');
  }

  function openCreateModal() {
    setFormData({
      name: '',
      email: '',
      company: '',
      phone: '',
      notes: '',
      avatar_url: '',
    });
    setAvatarFile(null);
    setIsCreateModalOpen(true);
  }

  function openEditModal(client: Client) {
    setSelectedClient(client);
    setFormData({
      name: client.name,
      email: client.email || '',
      company: client.company || '',
      phone: client.phone || '',
      notes: client.notes || '',
      avatar_url: client.avatar_url || '',
    });
    setAvatarFile(null);
    setIsEditModalOpen(true);
  }

  function openDeleteDialog(client: Client) {
    setSelectedClient(client);
    setIsDeleteDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      let avatarUrl = formData.avatar_url;

      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile);
      }

      const clientData = {
        name: formData.name,
        email: formData.email || null,
        company: formData.company || null,
        phone: formData.phone || null,
        notes: formData.notes || null,
        avatar_url: avatarUrl || null,
        status: 'active',
        total_value: 0,
        last_interaction: null,
        stripe_customer_id: null,
      };

      if (isEditModalOpen && selectedClient) {
        await updateClient(selectedClient.id, clientData);
        toast.success('Client updated successfully!');
        setIsEditModalOpen(false);
      } else {
        await createClient(clientData);
        toast.success('Client created successfully!');
        setIsCreateModalOpen(false);
      }

      loadClients();
    } catch (error) {
      console.error('Error saving client:', error);
      toast.error('Failed to save client');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedClient) return;

    try {
      await deleteClient(selectedClient.id);
      toast.success('Client deleted successfully!');
      setIsDeleteDialogOpen(false);
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('Failed to delete client');
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setAvatarFile(file);
    }
  }

  function openEmailModal(client: Client) {
    setSelectedClient(client);
    setEmailData({ subject: '', message: '' });
    setIsEmailModalOpen(true);
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient?.email) return;
    setEmailSending(true);
    try {
      const senderName = profile?.username ||
        user?.user_metadata?.full_name ||
        user?.email?.split('@')[0] ||
        'Your Freelancer';

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'client_message',
          to: selectedClient.email,
          data: {
            clientName: selectedClient.name,
            senderName,
            subject: emailData.subject,
            message: emailData.message,
          },
        },
      });
      if (error) throw error;
      toast.success(`Email sent to ${selectedClient.name}`);
      setIsEmailModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to send email');
    } finally {
      setEmailSending(false);
    }
  }

  // ── Files Sheet handlers ──
  async function openFilesSheet(client: Client) {
    setFilesClient(client);
    setClientFiles([]);
    setFilesContactId(null);
    setLoadingFiles(true);
    try {
      if (!client.email) {
        toast.error('This client has no email — add an email to enable file sharing');
        setLoadingFiles(false);
        return;
      }
      const contactId = await getContactIdByEmail(client.email);
      if (!contactId) {
        // No matching contact in the business-scoped table yet — sheet opens empty
        setFilesContactId(null);
        setClientFiles([]);
        return;
      }
      setFilesContactId(contactId);
      const files = await getPortalFiles(contactId);
      setClientFiles(files);
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoadingFiles(false);
    }
  }

  async function handleFileUpload(file: File) {
    if (!filesContactId) {
      toast.error('No portal contact found for this client');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File must be under 20 MB');
      return;
    }
    setUploadingFile(true);
    try {
      const newFile = await uploadPortalFile(filesContactId, file);
      setClientFiles(prev => [newFile, ...prev]);
      toast.success('File uploaded');
      supabase.functions.invoke('notify-portal-file-shared', {
        body: { contact_id: filesContactId, file_name: file.name },
      });
    } catch {
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
      if (filesInputRef.current) filesInputRef.current.value = '';
    }
  }

  async function handleDeleteFile(id: string, storagePath: string) {
    try {
      await deletePortalFile(id, storagePath);
      setClientFiles(prev => prev.filter(f => f.id !== id));
      toast.success('File deleted');
    } catch {
      toast.error('Failed to delete file');
    }
  }

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-2">Clients</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your client relationships</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {isAgency && (
            <Button
              size="lg"
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 w-full sm:w-auto"
              onClick={() => setIsTeamMemberModalOpen(true)}
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Add Team Member
              <Badge className="ml-2 bg-gradient-to-r from-emerald-500 to-amber-500 text-white text-xs px-1.5 py-0 h-5">
                <Crown className="w-3 h-3" />
              </Badge>
            </Button>
          )}
          <Button size="lg" className="glow-accent w-full sm:w-auto" onClick={openCreateModal}>
            <Plus className="w-5 h-5 mr-2" />
            Add Client
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
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
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No clients yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-pretty">
              {searchQuery ? 'No clients match your search.' : 'Start building your client base by adding your first client.'}
            </p>
            {!searchQuery && (
              <Button onClick={openCreateModal} className="glow-accent">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Card key={client.id} className="card-hover h-full flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {client.avatar_url ? (
                      <img src={client.avatar_url} alt={client.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{client.name}</h3>
                      {(() => {
                        const badge = getClientBadge(client);
                        return (
                          <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${badge.className}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                    </div>
                    {client.company && (
                      <p className="text-sm text-muted-foreground truncate">{client.company}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 flex-1">
                  {client.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{client.phone}</span>
                    </div>
                  )}
                  {client.company && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{client.company}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  {client.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEmailModal(client)}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Email
                    </Button>
                  )}
                  {client.email && portalTokenMap[client.email] && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      title="Copy client portal link"
                      onClick={() => copyPortalLink(portalTokenMap[client.email!])}
                    >
                      <Link className="w-4 h-4 mr-2" />
                      Portal link
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    title="Files"
                    onClick={() => openFilesSheet(client)}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={client.email ? '' : 'flex-1'}
                    onClick={() => openEditModal(client)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog(client)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
            <DialogTitle>{isEditModalOpen ? 'Edit Client' : 'Add New Client'}</DialogTitle>
            <DialogDescription>
              {isEditModalOpen ? 'Update client information' : 'Add a new client to your portfolio'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <PhoneInputField
                  id="phone"
                  value={formData.phone}
                  onChange={(value) => setFormData({ ...formData, phone: value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar">Avatar</Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
                <p className="text-xs text-muted-foreground">Max file size: 5MB</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                {submitting ? 'Saving...' : isEditModalOpen ? 'Update Client' : 'Create Client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedClient?.name}? This action cannot be undone and will also delete all associated projects, proposals, and invoices.
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

      {/* Email Compose Modal */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-400" />
              Email {selectedClient?.name}
            </DialogTitle>
            <DialogDescription>
              Sent from <span className="text-emerald-400 font-medium">hello@forgefly.io</span> to {selectedClient?.email}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendEmail}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email-subject">Subject *</Label>
                <Input
                  id="email-subject"
                  placeholder="e.g. Project update, Quick question..."
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-message">Message *</Label>
                <Textarea
                  id="email-message"
                  placeholder="Write your message here..."
                  value={emailData.message}
                  onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                  rows={6}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEmailModalOpen(false)} disabled={emailSending}>
                Cancel
              </Button>
              <Button type="submit" disabled={emailSending} className="glow-accent">
                <Send className="w-4 h-4 mr-2" />
                {emailSending ? 'Sending...' : 'Send Email'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Team Member Modal (Agency Only) */}
      <Dialog open={isTeamMemberModalOpen} onOpenChange={setIsTeamMemberModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              Add Team Member
              <Badge className="bg-gradient-to-r from-emerald-500 to-amber-500 text-white text-xs px-2 py-0.5">
                <Crown className="w-3 h-3 mr-1" />
                Agency
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Invite team members to collaborate on client projects
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member-email">Email Address</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="team@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Role</Label>
              <select
                id="member-role"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="member">Team Member</option>
                <option value="manager">Project Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
              <p className="text-sm text-emerald-400">
                <Crown className="w-4 h-4 inline mr-1" />
                Team members can view and manage assigned clients and projects
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTeamMemberModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-600 hover:to-amber-600"
              onClick={() => {
                toast.success('Team member invited successfully!');
                setIsTeamMemberModalOpen(false);
              }}
            >
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Files Sheet ───────────────────────────────────────────────────── */}
      <Sheet open={!!filesClient} onOpenChange={open => { if (!open) setFilesClient(null); }}>
        {filesClient && (
          <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
            <SheetHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center justify-between">
                <SheetTitle className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />
                  Files — {filesClient.name}
                </SheetTitle>
                <Button
                  size="sm"
                  disabled={uploadingFile || !filesContactId}
                  onClick={() => filesInputRef.current?.click()}
                  className="gap-1.5"
                >
                  {uploadingFile
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading…</>
                    : <><Upload className="w-3.5 h-3.5" />Upload file</>
                  }
                </Button>
              </div>
              {!filesContactId && !loadingFiles && (
                <p className="text-xs text-muted-foreground mt-1">
                  {filesClient.email
                    ? 'No portal contact found. Generate a portal link first to enable file sharing.'
                    : 'Add an email to this client to enable file sharing.'}
                </p>
              )}
            </SheetHeader>

            <input
              ref={filesInputRef}
              type="file"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {loadingFiles ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : clientFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <Paperclip className="w-8 h-8 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No files yet</p>
                  <p className="text-xs mt-1">Upload files to share with this client.</p>
                </div>
              ) : (
                clientFiles.map(f => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 rounded-lg border p-3 bg-card hover:bg-muted/40 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.file_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(f.file_size)}
                          {f.file_size ? ' · ' : ''}
                          {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <Badge variant={f.uploaded_by === 'client' ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0 h-4">
                          {f.uploaded_by === 'client' ? 'From client' : 'Uploaded by you'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0">
                        <a href={f.file_url} target="_blank" rel="noopener noreferrer" download={f.file_name}>
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                      {f.uploaded_by === 'freelancer' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteFile(f.id, f.storage_path)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
