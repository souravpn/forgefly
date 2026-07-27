import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, type PanInfo } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ThumbsUp, ThumbsDown, Send, Sparkles, X, Phone, Link2, ExternalLink, Copy, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/db/supabase';
import { useBusiness } from '@/contexts/CurrentBusinessContext';
import {
  getMarketResearch,
  getMarketResearchItems,
  updateMarketResearchItem,
} from '@/services/marketResearchService';
import type { MarketResearch, MarketResearchItem } from '@/types/types';

const ITEM_TYPE_LABEL: Record<string, string> = {
  outreach_draft: 'Outreach draft',
  channel_signup_suggestion: 'Channel suggestion',
  pricing_note: 'Pricing note',
  positioning_insight: 'Positioning insight',
};

const ITEM_TYPE_BADGE_CLASS = 'bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10';

const STATUS_LABEL: Record<string, string> = {
  sent: 'Sent',
  approved: 'Approved',
  rejected: 'Skipped',
  dismissed: 'Dismissed',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  sent: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10',
  approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10',
  rejected: 'bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/10',
  dismissed: 'bg-muted text-muted-foreground border-transparent hover:bg-muted',
};

const POLL_INTERVAL_MS = 4000;
const EXIT_ANIMATION_MS = 250;
const SWIPE_THRESHOLD = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function MarketResearchPage() {
  const { business } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [research, setResearch] = useState<MarketResearch | null>(null);
  const [items, setItems] = useState<MarketResearchItem[]>([]);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [sending, setSending] = useState(false);
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getMarketResearch();
      setResearch(r);
      setItems(r ? await getMarketResearchItems(r.id) : []);
    } catch {
      toast.error('Failed to load market research');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const shouldPoll = !research || research.status === 'pending' || research.status === 'running';
    if (shouldPoll) {
      pollRef.current = setInterval(load, POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [research?.status, load]);

  const actionableQueue = items.filter((i) => i.kind === 'actionable' && i.status === 'new');
  const fyiItems = items.filter((i) => i.kind === 'fyi' && i.status !== 'dismissed');
  const historyItems = items
    .filter((i) => i.status !== 'new')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const current = actionableQueue[0] ?? null;
  const isOutreach = current?.item_type === 'outreach_draft';

  const businessName = (business?.extracted_data as { identity?: { businessName?: string } } | undefined)
    ?.identity?.businessName || business?.name || 'your business';

  // Reset the editable fields whenever the card in view changes.
  useEffect(() => {
    if (current && isOutreach) {
      setToEmail(current.lead_contact?.email ?? '');
      setSubject(current.title);
      setMessage(current.summary);
    }
  }, [current?.id, isOutreach]);

  function removeCurrent(item: MarketResearchItem, status: 'approved' | 'rejected' | 'sent', direction: 'left' | 'right', summary?: string) {
    setExitDirection(direction);
    setTimeout(() => {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status, ...(summary ? { summary } : {}) } : i)));
      setExitDirection(null);
    }, EXIT_ANIMATION_MS);
  }

  function handleSkip(item: MarketResearchItem) {
    updateMarketResearchItem(item.id, { status: 'rejected' }).catch(() => {
      toast.error('Failed to update item — it may reappear in the queue');
    });
    removeCurrent(item, 'rejected', 'left');
  }

  function handleApproveChannel(item: MarketResearchItem) {
    updateMarketResearchItem(item.id, { status: 'approved' }).catch(() => {
      toast.error('Failed to update item — it may reappear in the queue');
    });
    const url = item.lead_contact?.url;
    if (url) {
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      window.open(href, '_blank', 'noopener,noreferrer');
    }
    removeCurrent(item, 'approved', 'right');
    toast.success(url ? 'Marked done — opening the signup page…' : 'Marked to sign up');
  }

  // Adds (or reuses) a contact + pipeline lead for a sent outreach draft,
  // stage fixed to 'Proposal Sent' since an actual message just went out —
  // idempotent by email so re-approving (or a future re-run) can't duplicate it.
  async function addLeadToPipeline(businessId: string, name: string, email: string) {
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('business_id', businessId)
      .ilike('email', email)
      .maybeSingle();

    let contactId = existingContact?.id as string | undefined;
    if (!contactId) {
      const { data: newContact, error: contactErr } = await supabase
        .from('contacts')
        .insert({ business_id: businessId, name, email })
        .select('id')
        .single();
      if (contactErr || !newContact) throw contactErr ?? new Error('Failed to create contact');
      contactId = newContact.id;
    }

    const { data: existingLead } = await supabase
      .from('pipeline_leads')
      .select('id')
      .eq('business_id', businessId)
      .eq('contact_id', contactId)
      .maybeSingle();
    if (existingLead) return;

    await supabase.from('pipeline_leads').insert({
      business_id: businessId,
      contact_id: contactId,
      stage: 'Proposal Sent',
    });
  }

  async function handleApproveAndSend(item: MarketResearchItem) {
    if (!EMAIL_RE.test(toEmail.trim())) {
      toast.error('Enter a valid email address to send to.');
      return;
    }
    if (!message.trim()) {
      toast.error('Message can\'t be empty.');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'client_message',
          to: toEmail.trim(),
          reply_to: business?.contact_email ?? undefined,
          data: {
            clientName: item.lead_name || 'there',
            senderName: businessName,
            subject: subject.trim() || item.title,
            message: message.trim(),
          },
        },
      });
      if (error) throw error;
      await updateMarketResearchItem(item.id, { status: 'sent', summary: message.trim() });
      removeCurrent(item, 'sent', 'right', message.trim());
      toast.success('Sent!');

      if (business) {
        try {
          await addLeadToPipeline(business.id, item.lead_name || toEmail.trim(), toEmail.trim());
        } catch (err) {
          console.warn('Failed to add lead to pipeline (non-fatal):', err);
        }
      }
    } catch {
      toast.error('Failed to send email — item stays in the queue');
    } finally {
      setSending(false);
    }
  }

  // Drag-to-decide only applies to the channel-suggestion path (a plain status
  // flip, no side effect). Outreach drafts now trigger a real email send, so
  // that action is button-only — a stray drag must never fire it.
  function handleDragEnd(item: MarketResearchItem, _e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) handleApproveChannel(item);
    else if (info.offset.x < -SWIPE_THRESHOLD) handleSkip(item);
  }

  async function handleDismissFyi(item: MarketResearchItem) {
    try {
      await updateMarketResearchItem(item.id, { status: 'dismissed' });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'dismissed' } : i)));
    } catch {
      toast.error('Failed to dismiss');
    }
  }

  function handleCopySummary(item: MarketResearchItem) {
    navigator.clipboard.writeText(item.summary);
    toast.success('Copied');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">Market Research</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          AI-researched competitors, leads, and channels for your business.
        </p>
        {research?.completed_at && (
          <p className="text-xs text-muted-foreground mt-1">
            Researched {formatDistanceToNow(new Date(research.completed_at), { addSuffix: true })}
          </p>
        )}
      </div>

      {!research && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Sparkles className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground max-w-sm">
              Market research hasn't run for this business yet — it kicks off automatically when a new business is set up.
            </p>
          </CardContent>
        </Card>
      )}

      {research && (research.status === 'pending' || research.status === 'running') && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Researching your local market — this usually takes under a minute…</p>
          </CardContent>
        </Card>
      )}

      {research && research.status === 'failed' && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <AlertCircle className="w-8 h-8 text-destructive/70" />
            <p className="text-sm text-muted-foreground max-w-sm">
              Market research failed to generate{research.error ? `: ${research.error}` : '.'}
            </p>
          </CardContent>
        </Card>
      )}

      {research && research.status === 'ready' && (
        <>
          {research.market_summary && (
            <Card>
              <CardContent className="p-4 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Market summary</p>
                <p className="text-sm leading-relaxed">{research.market_summary}</p>
              </CardContent>
            </Card>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Review queue{actionableQueue.length > 0 && ` (${actionableQueue.length})`}
            </p>

            {!current ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-14 text-center gap-2">
                  <ThumbsUp className="w-7 h-7 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">All caught up — nothing left to review.</p>
                </CardContent>
              </Card>
            ) : isOutreach ? (
              <motion.div
                key={current.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={
                  exitDirection === 'right'
                    ? { x: 400, opacity: 0, rotate: 12 }
                    : exitDirection === 'left'
                      ? { x: -400, opacity: 0, rotate: -12 }
                      : { x: 0, opacity: 1, scale: 1, rotate: 0 }
                }
                transition={{ duration: EXIT_ANIMATION_MS / 1000 }}
              >
                <Card className="shadow-lg">
                  <CardContent className="p-5 flex flex-col gap-3">
                    <Badge variant="outline" className={`text-xs w-fit ${ITEM_TYPE_BADGE_CLASS}`}>{ITEM_TYPE_LABEL[current.item_type]}</Badge>
                    {current.lead_name && (
                      <p className="text-sm font-medium text-muted-foreground">{current.lead_name}</p>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs">To</Label>
                      <Input
                        value={toEmail}
                        onChange={(e) => setToEmail(e.target.value)}
                        placeholder="lead@example.com"
                        disabled={sending}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Subject</Label>
                      <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sending} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Message</Label>
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={8}
                        disabled={sending}
                      />
                    </div>

                    {current.lead_contact && (current.lead_contact.phone || current.lead_contact.url) && (
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
                        {current.lead_contact.phone && (
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{current.lead_contact.phone}</span>
                        )}
                        {current.lead_contact.url && (
                          <span className="flex items-center gap-1"><Link2 className="w-3 h-3" />{current.lead_contact.url}</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="relative h-[340px]">
                <motion.div
                  key={current.id}
                  className="absolute inset-0"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.6}
                  onDragEnd={(e, info) => handleDragEnd(current, e, info)}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={
                    exitDirection === 'right'
                      ? { x: 400, opacity: 0, rotate: 12 }
                      : exitDirection === 'left'
                        ? { x: -400, opacity: 0, rotate: -12 }
                        : { x: 0, opacity: 1, scale: 1, rotate: 0 }
                  }
                  transition={{ duration: EXIT_ANIMATION_MS / 1000 }}
                >
                  <Card className="h-full shadow-lg cursor-grab active:cursor-grabbing">
                    <CardContent className="p-5 h-full flex flex-col gap-3">
                      <Badge variant="outline" className={`text-xs w-fit ${ITEM_TYPE_BADGE_CLASS}`}>{ITEM_TYPE_LABEL[current.item_type]}</Badge>
                      <h3 className="text-lg font-semibold text-balance">{current.title}</h3>
                      {current.lead_name && (
                        <p className="text-sm font-medium text-muted-foreground">{current.lead_name}</p>
                      )}
                      <p className="text-sm leading-relaxed flex-1 overflow-y-auto">{current.summary}</p>
                      {current.lead_contact && (current.lead_contact.url) && (
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
                          <span className="flex items-center gap-1"><Link2 className="w-3 h-3" />{current.lead_contact.url}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            )}

            {current && (
              <div className="flex gap-3 justify-center mt-4">
                <Button size="lg" variant="outline" className="gap-2" onClick={() => handleSkip(current)} disabled={sending}>
                  <ThumbsDown className="w-4 h-4" /> Skip
                </Button>
                {isOutreach ? (
                  <Button size="lg" className="gap-2 glow-accent" onClick={() => handleApproveAndSend(current)} disabled={sending}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending ? 'Sending…' : 'Approve & Send'}
                  </Button>
                ) : current.lead_contact?.url ? (
                  <Button size="lg" className="gap-2 glow-accent" onClick={() => handleApproveChannel(current)}>
                    <ExternalLink className="w-4 h-4" /> Approve & Open
                  </Button>
                ) : (
                  <Button size="lg" className="gap-2 glow-accent" onClick={() => handleApproveChannel(current)}>
                    <ThumbsUp className="w-4 h-4" /> Approve
                  </Button>
                )}
              </div>
            )}
          </div>

          {fyiItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Insights & notes</p>
              <div className="space-y-2">
                {fyiItems.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <Badge variant="outline" className={`text-xs w-fit ${ITEM_TYPE_BADGE_CLASS}`}>{ITEM_TYPE_LABEL[item.item_type]}</Badge>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.summary}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => handleDismissFyi(item)}
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {historyItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">History</p>
              <div className="space-y-2">
                {historyItems.map((item) => (
                  <Card key={item.id} className="opacity-80">
                    <CardContent className="p-4 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs w-fit ${ITEM_TYPE_BADGE_CLASS}`}>{ITEM_TYPE_LABEL[item.item_type]}</Badge>
                        <Badge variant="outline" className={`text-xs w-fit ${STATUS_BADGE_CLASS[item.status]}`}>{STATUS_LABEL[item.status]}</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.lead_name && <p className="text-xs text-muted-foreground">{item.lead_name}</p>}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{item.summary}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => handleCopySummary(item)}
                          title="Copy"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
