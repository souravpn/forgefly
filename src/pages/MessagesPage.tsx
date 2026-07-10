import { ArrowLeft, Download, FileText, Folder, Loader2, MessageSquare, Paperclip, Send, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/CurrentBusinessContext';
// @ts-ignore
import { supabase } from '@/db/supabase';

const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'https://www.forgefly.io';
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  lifecycle_status: string
  portal_token: string | null
}

interface Message {
  id: string
  business_id: string
  client_id: string | null
  sender_id: string
  sender_role: 'freelancer' | 'client'
  channel: 'portal' | 'whatsapp' | 'email'
  wa_phone: string | null
  body: string
  read_at: string | null
  created_at: string
}

// A thread from an unrecognized WhatsApp number — no contact row yet.
interface UnknownThread {
  isUnknown: true
  id: string // `wa:${phone}`
  waPhone: string
  name: string // just the raw phone number, used as the display label
}

interface PortalFile {
  id: string
  file_name: string
  file_url: string
  storage_path: string
  file_size: number | null
  uploaded_by: 'freelancer' | 'client'
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Thread pane ──────────────────────────────────────────────────────────────

function ThreadPane({
  contact,
  messages,
  businessId,
  onSend,
  sending,
}: {
  contact: Contact
  messages: Message[]
  businessId: string
  onSend: (body: string) => Promise<void>
  sending: boolean
}) {
  const [tab, setTab] = useState<'messages' | 'files'>('messages');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load files whenever the selected contact changes
  useEffect(() => {
    supabase
      .from('portal_files')
      .select('*')
      .eq('business_id', businessId)
      .eq('client_id', contact.id)
      .order('created_at', { ascending: false })
      .then(({ data }: { data: PortalFile[] | null }) => setFiles(data || []));
  }, [businessId, contact.id]);

  useEffect(() => {
    if (tab === 'messages') endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, tab]);

  async function handleSend() {
    const body = text.trim();
    if (!body || sending) return;
    setText('');
    await onSend(body);
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File must be under 50 MB');
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${businessId}/${contact.id}/${Date.now()}_${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from('portal-files')
        .upload(storagePath, file);
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('portal-files')
        .getPublicUrl(storagePath);

      const { data: fileRow, error: dbErr } = await supabase
        .from('portal_files')
        .insert({
          business_id: businessId,
          client_id: contact.id,
          uploaded_by: 'freelancer',
          file_name: file.name,
          file_url: publicUrl,
          storage_path: storagePath,
          file_size: file.size,
        })
        .select()
        .single();
      if (dbErr) throw dbErr;

      setFiles(prev => [fileRow as PortalFile, ...prev]);
      toast.success(`${file.name} shared with ${contact.name}`);
      supabase.functions.invoke('notify-portal-file-shared', {
        body: { contact_id: contact.id, file_name: file.name },
      });
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteFile(file: PortalFile) {
    setDeletingId(file.id);
    try {
      await Promise.all([
        supabase.from('portal_files').delete().eq('id', file.id),
        supabase.storage.from('portal-files').remove([file.storage_path]),
      ]);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      toast.success('File removed');
    } catch {
      toast.error('Failed to remove file');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Thread header */}
      <div className="hidden md:flex px-4 py-3 border-b border-border items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
          {initials(contact.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{contact.name}</div>
          {contact.company && (
            <div className="text-xs text-muted-foreground truncate">{contact.company}</div>
          )}
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setTab('messages')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === 'messages' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setTab('files')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              tab === 'files' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Folder className="w-3 h-3" />
            Files
            {files.length > 0 && (
              <span className="min-w-[16px] h-4 rounded-full bg-primary/20 text-primary px-1 text-[10px] font-semibold flex items-center justify-center">
                {files.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Messages tab */}
      {tab === 'messages' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No messages yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Send a message to start the conversation.</p>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex flex-col ${m.sender_role === 'freelancer' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                      m.sender_role === 'freelancer'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`text-[10px] mt-1 ${
                      m.sender_role === 'freelancer' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                    }`}>
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                  {m.channel === 'whatsapp' && (
                    <span className="text-[10px] mt-0.5 px-1 text-muted-foreground/60">via WhatsApp</span>
                  )}
                  {m.sender_role === 'freelancer' && (
                    <span className={`text-[10px] mt-0.5 px-1 transition-colors ${m.read_at ? 'text-primary' : 'text-muted-foreground/40'}`}>
                      {m.read_at ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
          <div className="px-4 py-3 border-t border-border flex gap-2 items-end shrink-0">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`Message ${contact.name}…`}
              className="flex-1 resize-none min-h-[44px] max-h-32 text-sm rounded-xl"
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </>
      )}

      {/* Files tab */}
      {tab === 'files' && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Upload area */}
          <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUploadFile}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
            >
              {uploading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                : <><Paperclip className="w-4 h-4" /> Share a file with {contact.name}</>
              }
            </button>
            <p className="text-xs text-muted-foreground/60 text-center mt-1.5">Max 50 MB · Client sees this in their portal Files tab</p>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Folder className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No files shared yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Upload a file above to share it with {contact.name}.</p>
              </div>
            ) : (
              files.map(f => (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 bg-card hover:bg-muted/30 transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(f.file_size)}
                      {f.file_size ? ' · ' : ''}
                      {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <a
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDeleteFile(f)}
                      disabled={deletingId === f.id}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                      title="Remove"
                    >
                      {deletingId === f.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Shell chrome heights: ForgeflyBand h-10 (40px) + BusinessBand h-14 (56px) + TabNav h-10 (40px) = 136px
const SHELL_HEIGHT = 136;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useAuth();
  const { business, isLoading: bizLoading } = useBusiness();
  const isDesktop = useIsDesktop();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [saveAsClientPhone, setSaveAsClientPhone] = useState<string | null>(null);
  const [saveAsClientName, setSaveAsClientName] = useState('');
  const [saveAsClientEmail, setSaveAsClientEmail] = useState('');
  const [savingAsClient, setSavingAsClient] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);

  useEffect(() => {
    if (!business) return;

    async function load() {
      setLoading(true);
      const [{ data: contactData }, { data: msgData }, { data: waConnection }] = await Promise.all([
        supabase
          .from('contacts')
          .select('id, name, email, phone, company, lifecycle_status, portal_token')
          .eq('business_id', business!.id)
          .order('name'),
        supabase
          .from('messages')
          .select('*')
          .eq('business_id', business!.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('social_connections')
          .select('id')
          .eq('business_id', business!.id)
          .eq('platform', 'whatsapp')
          .eq('status', 'connected')
          .maybeSingle(),
      ]);
      setContacts(contactData || []);
      setMessages(msgData || []);
      setWhatsappConnected(!!waConnection);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`messages:business:${business.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `business_id=eq.${business.id}`,
      }, (payload: { new: Message }) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `business_id=eq.${business.id}`,
      }, (payload: { new: Message }) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, read_at: payload.new.read_at } : m));
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [business?.id]);

  // Mark client messages read when selecting a contact
  useEffect(() => {
    if (!selectedId || !business) return;
    const unread = messages.filter(
      m => m.client_id === selectedId && m.sender_role === 'client' && !m.read_at
    );
    if (unread.length === 0) return;

    supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('business_id', business.id)
      .eq('client_id', selectedId)
      .eq('sender_role', 'client')
      .is('read_at', null)
      .then(() => {
        setMessages(prev =>
          prev.map(m =>
            m.client_id === selectedId && m.sender_role === 'client' && !m.read_at
              ? { ...m, read_at: new Date().toISOString() }
              : m
          )
        );
      });
  }, [selectedId]);

  async function handleSend(body: string) {
    if (!business || !user || !selectedId) return;
    setSending(true);
    try {
      const contact = contacts.find(c => c.id === selectedId);

      // Once a contact's thread has any WhatsApp-channel message, keep replying on
      // WhatsApp rather than silently falling back to a portal-only message the
      // client would never see unless they happen to check their portal.
      const threadHasWhatsapp = messages.some(
        m => m.client_id === selectedId && m.channel === 'whatsapp',
      );

      if (threadHasWhatsapp && whatsappConnected && contact?.phone) {
        const { error } = await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            business_id: business.id,
            client_id: selectedId,
            to_phone: contact.phone,
            body_text: body,
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('messages').insert({
          business_id: business.id,
          client_id: selectedId,
          sender_id: user.id,
          sender_role: 'freelancer',
          body,
        });
        if (error) throw error;
      }

      if (contact?.email) {
        const portalUrl = contact.portal_token
          ? `${SITE_URL}/portal/${contact.portal_token}`
          : undefined;
        supabase.functions.invoke('send-email', {
          body: {
            type: 'client_message',
            to: contact.email,
            reply_to: business.contact_email ?? undefined,
            data: {
              clientName: contact.name,
              senderName: business.name,
              subject: `New message from ${business.name}`,
              message: body,
              portalUrl,
            },
          },
        });
      }
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }

  const contactsWithMeta = contacts.map(c => {
    const msgs = messages.filter(m => m.client_id === c.id);
    const last = msgs[msgs.length - 1] ?? null;
    const unread = msgs.filter(m => m.sender_role === 'client' && !m.read_at).length;
    return { ...c, lastMessage: last, unread, isUnknown: false as const };
  }).filter(c => c.lastMessage !== null);

  // Messages from a WhatsApp number with no matching contact yet
  const unknownPhones = Array.from(new Set(
    messages.filter(m => m.channel === 'whatsapp' && !m.client_id && m.wa_phone).map(m => m.wa_phone as string),
  ));
  const unknownThreadsWithMeta = unknownPhones.map(phone => {
    const msgs = messages.filter(m => m.wa_phone === phone && !m.client_id);
    const last = msgs[msgs.length - 1] ?? null;
    const unread = msgs.filter(m => m.sender_role === 'client' && !m.read_at).length;
    return { id: `wa:${phone}`, waPhone: phone, name: phone, lastMessage: last, unread, isUnknown: true as const };
  });

  const threadsWithMeta = [...contactsWithMeta, ...unknownThreadsWithMeta].sort((a, b) =>
    new Date(b.lastMessage!.created_at).getTime() - new Date(a.lastMessage!.created_at).getTime(),
  );

  const selectedContact = contacts.find(c => c.id === selectedId) ?? null;
  const selectedUnknown = unknownThreadsWithMeta.find(t => t.id === selectedId) ?? null;
  const threadMessages = selectedUnknown
    ? messages.filter(m => m.wa_phone === selectedUnknown.waPhone && !m.client_id)
    : messages.filter(m => m.client_id === selectedId);

  async function handleSaveAsClient() {
    if (!business || !saveAsClientPhone || !saveAsClientName.trim()) return;
    setSavingAsClient(true);
    try {
      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({
          business_id: business.id,
          name: saveAsClientName.trim(),
          email: saveAsClientEmail.trim() || null,
          phone: saveAsClientPhone,
          lifecycle_status: 'prospect',
        })
        .select('id, name, email, phone, company, lifecycle_status, portal_token')
        .single();
      if (error) throw error;

      await supabase
        .from('messages')
        .update({ client_id: newContact.id })
        .eq('business_id', business.id)
        .eq('wa_phone', saveAsClientPhone)
        .is('client_id', null);

      setContacts(prev => [...prev, newContact as Contact]);
      setMessages(prev => prev.map(m =>
        m.wa_phone === saveAsClientPhone && !m.client_id ? { ...m, client_id: newContact.id } : m,
      ));
      setSelectedId(newContact.id);
      setSaveAsClientPhone(null);
      toast.success(`Saved ${saveAsClientName.trim()} as a client`);
    } catch {
      toast.error('Failed to save as client');
    } finally {
      setSavingAsClient(false);
    }
  }

  if (bizLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const gridCols = isDesktop
    ? '260px 1fr'
    : mobileShowThread ? '0px 1fr' : '1fr 0px';

  return (
    <div
      className="-mx-4 md:-mx-6 -mt-4 md:-mt-6 flex flex-col"
      style={{ height: `calc(100vh - ${SHELL_HEIGHT}px)`, overflow: 'hidden' }}
    >
      <div className="px-4 md:px-6 py-3 border-b border-border shrink-0 flex items-center gap-3">
        {!isDesktop && mobileShowThread && (
          <button onClick={() => setMobileShowThread(false)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <h1 className="text-lg font-semibold">
          {!isDesktop && mobileShowThread && (selectedContact?.name ?? selectedUnknown?.name) ? (selectedContact?.name ?? selectedUnknown?.name) : 'Messages'}
        </h1>
      </div>

      <div className="flex-1 overflow-hidden" style={{ display: 'grid', gridTemplateColumns: gridCols }}>

        {/* Left: client list */}
        <div className="flex flex-col overflow-hidden border-r border-border">
          {threadsWithMeta.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">No contacts yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contacts appear here once you add clients to your pipeline.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {threadsWithMeta.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedId(c.id);
                    setMobileShowThread(true);
                  }}
                  className={`w-full text-left px-4 py-3.5 flex items-start gap-3 border-b border-border/50 transition-colors hover:bg-muted/40 ${
                    selectedId === c.id ? 'bg-muted/60' : ''
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                      {c.isUnknown ? <MessageSquare className="w-4 h-4" /> : initials(c.name)}
                    </div>
                    {c.unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground">
                        {c.unread > 9 ? '9+' : c.unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`text-sm truncate ${c.unread > 0 ? 'font-semibold' : 'font-medium'}`}>
                        {c.isUnknown ? `Unknown number · ${c.name}` : c.name}
                      </span>
                      {c.lastMessage && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {timeAgo(c.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    {c.lastMessage ? (
                      <p className={`text-xs truncate mt-0.5 ${c.unread > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {c.lastMessage.sender_role === 'freelancer' ? 'You: ' : ''}{c.lastMessage.body}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 mt-0.5 italic">No messages yet</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: thread */}
        <div className="flex flex-col overflow-hidden min-w-0">
          {selectedContact ? (
            <ThreadPane
              contact={selectedContact}
              messages={threadMessages}
              businessId={business!.id}
              onSend={handleSend}
              sending={sending}
            />
          ) : selectedUnknown ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="hidden md:flex px-4 py-3 border-b border-border items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">Unknown number</div>
                  <div className="text-xs text-muted-foreground truncate">{selectedUnknown.waPhone}</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setSaveAsClientPhone(selectedUnknown.waPhone);
                    setSaveAsClientName('');
                    setSaveAsClientEmail('');
                  }}
                >
                  <UserPlus className="w-4 h-4 mr-1.5" />
                  Save as client
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {threadMessages.map(m => (
                  <div key={m.id} className="flex flex-col items-start">
                    <div className="max-w-[78%] rounded-2xl px-4 py-2.5 bg-muted text-foreground">
                      <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                      <p className="text-[10px] mt-1 text-muted-foreground">{formatTime(m.created_at)}</p>
                    </div>
                    <span className="text-[10px] mt-0.5 px-1 text-muted-foreground/60">via WhatsApp</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground text-center shrink-0">
                Save this number as a client to reply.
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <MessageSquare className="w-10 h-10 text-muted-foreground/20 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">Select a conversation</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Choose a client from the list to view messages.
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={saveAsClientPhone !== null} onOpenChange={(open) => { if (!open) setSaveAsClientPhone(null); }}>
        <DialogContent>
          {saveAsClientPhone && (
            <>
              <DialogHeader>
                <DialogTitle>Save as client</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={saveAsClientPhone} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saveAsClientName">Name</Label>
                  <Input
                    id="saveAsClientName"
                    value={saveAsClientName}
                    onChange={e => setSaveAsClientName(e.target.value)}
                    placeholder="Client name"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saveAsClientEmail">Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="saveAsClientEmail"
                    type="email"
                    value={saveAsClientEmail}
                    onChange={e => setSaveAsClientEmail(e.target.value)}
                    placeholder="client@example.com"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSaveAsClient}
                  disabled={!saveAsClientName.trim() || savingAsClient}
                >
                  {savingAsClient ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save as client
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
