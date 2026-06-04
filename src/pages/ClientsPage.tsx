import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Mail, Phone, Building2, Edit, Trash2, User, Users, UserPlus, Crown, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { Client } from '@/types/types';
import { getClients, createClient, updateClient, deleteClient, uploadAvatar, subscribeToClients } from '@/services/clientService';
import { useAuth } from '@/contexts/AuthContext';
// @ts-ignore
import { supabase } from '@/db/supabase';
import { Badge } from '@/components/ui/badge';

export default function ClientsPage() {
  const { isAgency, profile, user } = useAuth();
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
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
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
                    <h3 className="font-semibold text-lg mb-1 truncate">{client.name}</h3>
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
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
    </div>
  );
}
