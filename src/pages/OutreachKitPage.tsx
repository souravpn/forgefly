import {
  AlertTriangle, ArrowLeft,
  ArrowRight, Ban, Briefcase, Building2,
  Check, ChevronRight, Clock, Copy, ExternalLink, Lightbulb, Loader2, MapPin, MessageSquare, Plus, Send, Sparkles, Target, Users, X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter,DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/CurrentBusinessContext';
import { supabase } from '@/db/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyIntel {
  company_name: string;
  company_url: string;
  description: string;
  industry: string;
  size_estimate: string;
  location: string;
  brand_approach: string;
  best_contact_point: string;
  best_channel: 'linkedin_dm' | 'email' | 'linkedin_then_email';
  open_roles: string[];
  recent_signals: string[];
  service_overlap_score: number;
  matched_services: string[];
  unmatched_services: string[];
  match_label: 'Strong match' | 'Partial match' | 'Weak match';
  researched_at: string;
}

interface CopyKit {
  cold_email: { subject: string; body: string };
  linkedin_dm: string;
  connection_note: string;
  follow_up: { subject: string; body: string };
}

interface ReplyResult {
  intent: string;
  timing_signal: string | null;
  tone: string;
  confidence: string;
  recommended_pipeline_action: string;
  reminder_weeks: number | null;
  classification_reasoning: string;
  draft_response: string;
  draft_subject: string | null;
  user_facing_label: string;
}

interface Persona {
  persona_label: string;
  company_profile: string;
  buyer_role: string;
  trigger: string;
  where_to_find: string;
}

type QueueStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
type DetailStep = 3 | 4 | 5;

interface QueueItem {
  id: string;
  input: string;
  status: QueueStatus;
  intel: CompanyIntel | null;
  copyKit: CopyKit | null;
  detailStep: DetailStep;
  leadId: string | null;
  sequenceStep: number;
}

type Phase = 'persona' | 'batch' | 'queue';

const CONCURRENCY = 3;
const MAX_BATCH_INPUT = 20;
const MAX_QUEUE_SIZE = 30;

const SEQUENCE_STEPS = [
  { id: 0, label: 'Connect', copy_key: 'connection_note' as const },
  { id: 1, label: 'LinkedIn DM', copy_key: 'linkedin_dm' as const },
  { id: 2, label: 'Cold email', copy_key: 'cold_email' as const },
  { id: 3, label: 'Follow-up', copy_key: 'follow_up' as const },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={copy}>
      {copied ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function MatchBadge({ label }: { label: string }) {
  const cfg = {
    'Strong match': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    'Partial match': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    'Weak match': 'bg-red-500/10 text-red-600 border-red-500/20',
  }[label] ?? '';
  return <Badge variant="outline" className={`text-xs ${cfg}`}>{label}</Badge>;
}

// ─── Persona brainstorm ────────────────────────────────────────────────────────

function PersonaBrainstorm({
  personas,
  loading,
  onGenerate,
  onContinue,
}: {
  personas: Persona[] | null;
  loading: boolean;
  onGenerate: () => void;
  onContinue: () => void;
}) {
  useEffect(() => {
    if (personas === null && !loading) onGenerate();
  }, [personas, loading, onGenerate]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <Target className="w-5 h-5 text-accent" />
          Who should you reach out to first?
        </h2>
        <p className="text-sm text-muted-foreground">
          A directional brainstorm based on your niche — not a verified list of real companies. Use it to figure out where to look, then paste real companies on the next step.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Thinking through who's likely to hire you right now…
        </div>
      )}

      {!loading && personas && personas.length > 0 && (
        <div className="space-y-3">
          {personas.map(p => (
            <Card key={p.persona_label}>
              <CardContent className="p-4 space-y-3">
                <p className="font-semibold text-sm">{p.persona_label}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">Company profile</p>
                    <p className="leading-relaxed">{p.company_profile}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Who signs off</p>
                    <p className="leading-relaxed">{p.buyer_role}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">What triggers them</p>
                    <p className="leading-relaxed">{p.trigger}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" />Where to find them
                    </p>
                    <p className="leading-relaxed">{p.where_to_find}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && personas && personas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Couldn't generate personas right now — you can still continue and research companies directly.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onContinue}>
          Skip
        </Button>
        <Button className="glow-accent flex-1" onClick={onContinue} disabled={loading}>
          Continue to outreach
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ─── Batch target input ────────────────────────────────────────────────────────

function BatchInput({ onSubmit }: { onSubmit: (inputs: string[]) => void }) {
  const [text, setText] = useState('');
  const lines = Array.from(new Set(text.split('\n').map(l => l.trim()).filter(Boolean)));

  function handleSubmit() {
    const capped = lines.slice(0, MAX_BATCH_INPUT);
    if (capped.length > 0) onSubmit(capped);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Who do you want to reach?</h2>
        <p className="text-sm text-muted-foreground">
          Paste company website URLs, LinkedIn pages, or names — one per line. Forgefly researches up to {CONCURRENCY} at a time.
        </p>
      </div>

      <div className="space-y-3">
        <Textarea
          placeholder={'https://acme.com\nAcme Corp\nhttps://widgetco.io'}
          value={text}
          onChange={e => setText(e.target.value)}
          rows={8}
          className="text-base resize-none"
          autoFocus
        />
        <p className="text-xs text-muted-foreground min-h-[1rem]">
          {lines.length > 0
            ? `${lines.length} compan${lines.length === 1 ? 'y' : 'ies'}${lines.length > MAX_BATCH_INPUT ? ` (first ${MAX_BATCH_INPUT} will be used)` : ''}`
            : ''}
        </p>
        <Button
          className="w-full glow-accent"
          size="lg"
          disabled={lines.length === 0}
          onClick={handleSubmit}
        >
          Research + draft
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-4">
          <p className="text-xs font-medium mb-2 text-muted-foreground">What Forgefly looks for</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500 shrink-0" />What the company does and who they serve</li>
            <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500 shrink-0" />Team signals and hiring activity</li>
            <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500 shrink-0" />Best point of contact and channel</li>
            <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500 shrink-0" />Overlap with your services</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Queue list (left panel) ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<QueueStatus, { icon: typeof Clock; className: string }> = {
  queued: { icon: Clock, className: 'text-muted-foreground' },
  running: { icon: Loader2, className: 'text-accent animate-spin' },
  completed: { icon: Check, className: 'text-emerald-500' },
  failed: { icon: X, className: 'text-red-500' },
  cancelled: { icon: Ban, className: 'text-muted-foreground' },
};

function QueueList({
  queue,
  selectedId,
  onSelect,
  onCancel,
  onAdd,
}: {
  queue: QueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCancel: (id: string) => void;
  onAdd: (inputs: string[]) => void;
}) {
  const [addText, setAddText] = useState('');
  const runningCount = queue.filter(i => i.status === 'running').length;
  const queuedCount = queue.filter(i => i.status === 'queued').length;
  const doneCount = queue.filter(i => i.status === 'completed').length;

  function handleAdd() {
    const inputs = Array.from(new Set(addText.split('\n').map(l => l.trim()).filter(Boolean)));
    if (inputs.length === 0) return;
    onAdd(inputs);
    setAddText('');
  }

  return (
    <div className="w-full md:w-72 shrink-0 space-y-3">
      <p className="text-xs text-muted-foreground">
        {runningCount} researching · {queuedCount} queued · {doneCount} ready
      </p>

      <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
        {queue.map(item => {
          const cfg = STATUS_CONFIG[item.status];
          const Icon = cfg.icon;
          const selectable = item.status === 'completed';
          const dismissable = item.status === 'queued' || item.status === 'running' || item.status === 'failed';
          return (
            <div
              key={item.id}
              role={selectable ? 'button' : undefined}
              tabIndex={selectable ? 0 : undefined}
              onClick={() => selectable && onSelect(item.id)}
              onKeyDown={e => { if (selectable && (e.key === 'Enter' || e.key === ' ')) onSelect(item.id); }}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors ${
                selectedId === item.id ? 'border-foreground bg-muted/60' : 'border-border'
              } ${selectable ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default'}`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.className}`} />
              <span className="truncate flex-1">{item.intel?.company_name || item.input}</span>
              {item.status === 'failed' && <span className="text-[10px] text-red-500 shrink-0">Failed</span>}
              {dismissable && (
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={e => { e.stopPropagation(); onCancel(item.id); }}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <Textarea
          placeholder="Add more companies, one per line…"
          value={addText}
          onChange={e => setAddText(e.target.value)}
          rows={2}
          className="text-xs resize-none"
        />
        <Button variant="outline" size="sm" className="w-full" onClick={handleAdd} disabled={!addText.trim()}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />Add to list
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Intel brief ──────────────────────────────────────────────────────

function Step3({
  intel,
  onContinue,
  onBack,
}: {
  intel: CompanyIntel;
  onContinue: () => void;
  onBack: () => void;
}) {
  const isWeak = intel.service_overlap_score < 0.3;
  const [showWeakModal, setShowWeakModal] = useState(false);

  function handleContinue() {
    if (isWeak) setShowWeakModal(true);
    else onContinue();
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Company header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0 text-lg font-bold">
          {intel.company_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-xl font-semibold">{intel.company_name}</h2>
            <MatchBadge label={intel.match_label} />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {intel.industry && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{intel.industry}</span>}
            {intel.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{intel.location}</span>}
            {intel.size_estimate && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{intel.size_estimate}</span>}
            {intel.company_url && (
              <a href={intel.company_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                <ExternalLink className="w-3 h-3" />Website
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Intel grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'What they do', value: intel.description },
          { label: 'Brand approach', value: intel.brand_approach },
          { label: 'Best contact', value: intel.best_contact_point },
          { label: 'Best channel', value: intel.best_channel.replace(/_/g, ' ') },
        ].map(cell => (
          <Card key={cell.label}>
            <CardContent className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{cell.label}</p>
              <p className="text-sm leading-relaxed">{cell.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Service match pills */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Service match</p>
        <div className="flex flex-wrap gap-2">
          {intel.matched_services.map(s => (
            <Badge key={s} variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <Check className="w-3 h-3 mr-1" />{s}
            </Badge>
          ))}
          {intel.unmatched_services.map(s => (
            <Badge key={s} variant="outline" className="text-xs text-muted-foreground">
              <X className="w-3 h-3 mr-1" />{s}
            </Badge>
          ))}
        </div>
      </div>

      {/* Live signals — coming soon */}
      {intel.open_roles.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Hiring signals</p>
          <div className="flex flex-wrap gap-2">
            {intel.open_roles.map(role => (
              <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <Button className="glow-accent flex-1" onClick={handleContinue}>
          View outreach kit
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Weak match gate */}
      <Dialog open={showWeakModal} onOpenChange={setShowWeakModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Weak service match
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Only {intel.matched_services.length > 0 ? intel.matched_services.length : 'none'} of your services seem relevant to {intel.company_name}.
            Outreach will be harder to personalise. Still want to generate copy?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWeakModal(false)}>Go back</Button>
            <Button onClick={() => { setShowWeakModal(false); onContinue(); }}>
              Generate anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Step 4: Copy kit ─────────────────────────────────────────────────────────

type CopyTab = 'email' | 'dm' | 'connect' | 'followup';

function Step4({
  intel,
  copyKit,
  onCopyKitChange,
  onContinue,
  onBack,
}: {
  intel: CompanyIntel;
  copyKit: CopyKit;
  onCopyKitChange: (next: CopyKit) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<CopyTab>('email');
  const [showPrewarm, setShowPrewarm] = useState(false);
  const [prewarmPost, setPrewarmPost] = useState('');
  const [prewarmComment, setPrewarmComment] = useState('');
  const [prewarmLoading, setPrewarmLoading] = useState(false);
  const [prewarmGated, setPrewarmGated] = useState(false);
  const { extractedData } = useBusiness();

  const tabs: { id: CopyTab; label: string }[] = [
    { id: 'email', label: 'Cold email' },
    { id: 'dm', label: 'LinkedIn DM' },
    { id: 'connect', label: 'Connection note' },
    { id: 'followup', label: 'Follow-up' },
  ];

  async function handlePrewarm() {
    setPrewarmLoading(true);
    setPrewarmGated(false);
    setPrewarmComment('');
    try {
      const identity = extractedData?.identity as Record<string, string> ?? {};
      const { data } = await supabase.functions.invoke('research-company', {
        body: {
          action: 'prewarm_comment',
          company_input: intel.company_url || intel.company_name,
          company_name: intel.company_name,
          services: [],
          freelancer_name: identity.name ?? 'the freelancer',
        },
      });
      const result = data as { gated?: boolean; comment?: string };
      if (result.gated) {
        setPrewarmGated(true);
      } else {
        setPrewarmComment(result.comment ?? '');
      }
    } catch {
      toast.error('Failed to find post — paste it manually below');
      setPrewarmGated(true);
    } finally {
      setPrewarmLoading(false);
    }
  }

  async function handlePrewarmFromPaste() {
    if (!prewarmPost.trim()) return;
    setPrewarmLoading(true);
    try {
      const services = (extractedData?.services as Array<{ name: string }> ?? []).map(s => s.name);
      const identity = extractedData?.identity as Record<string, string> ?? {};
      const { data } = await supabase.functions.invoke('ai-gateway', {
        body: {
          mode: 'chat',
          message: `Write a genuine, peer-level comment (under 3 sentences) on this LinkedIn post from ${intel.company_name}. Rules: do NOT compliment the post. Engage with ONE specific detail or decision. Write as a ${identity.niche ?? 'freelancer'} who offers ${services.slice(0, 2).join(', ')}. Do not pitch services. Here's the post:\n\n"${prewarmPost}"`,
          current_page: 'outreach',
        },
      });
      const parsed = typeof data === 'object' ? data : {};
      setPrewarmComment((parsed as Record<string, string>).message ?? 'Could not generate comment — please try again.');
    } catch {
      toast.error('Failed to generate comment');
    } finally {
      setPrewarmLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold mb-1">Outreach kit — {intel.company_name}</h2>
          <div className="flex items-center gap-2">
            <MatchBadge label={intel.match_label} />
            <span className="text-xs text-muted-foreground">{intel.best_channel.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === t.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        {activeTab === 'email' && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</span>
                <CopyButton text={copyKit.cold_email.subject} />
              </div>
              <Input
                value={copyKit.cold_email.subject}
                onChange={e => onCopyKitChange({ ...copyKit, cold_email: { ...copyKit.cold_email, subject: e.target.value } })}
                className="text-sm bg-muted/40 border-transparent focus-visible:border-input"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Body</span>
                <CopyButton text={copyKit.cold_email.body} />
              </div>
              <Textarea
                value={copyKit.cold_email.body}
                onChange={e => onCopyKitChange({ ...copyKit, cold_email: { ...copyKit.cold_email, body: e.target.value } })}
                rows={10}
                className="text-sm bg-muted/40 border-transparent focus-visible:border-input leading-relaxed resize-y"
              />
            </div>
          </div>
        )}

        {activeTab === 'dm' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  LinkedIn DM <span className="normal-case font-normal">({copyKit.linkedin_dm.length} chars)</span>
                </span>
                <CopyButton text={copyKit.linkedin_dm} />
              </div>
              <Textarea
                value={copyKit.linkedin_dm}
                onChange={e => onCopyKitChange({ ...copyKit, linkedin_dm: e.target.value })}
                rows={5}
                className="text-sm bg-muted/40 border-transparent focus-visible:border-input leading-relaxed resize-y"
              />
            </div>

            {/* Pre-warm suggestion */}
            <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Pre-warm first? <span className="font-normal text-muted-foreground">(recommended)</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Commenting on their recent post before DMing converts 2–3× better. Forgefly finds their latest post and drafts a peer-level comment.
                  </p>
                </div>
              </div>
              {!showPrewarm ? (
                <Button variant="outline" size="sm" onClick={() => { setShowPrewarm(true); handlePrewarm(); }}>
                  Find post + draft comment →
                </Button>
              ) : (
                <div className="space-y-3">
                  {prewarmLoading && (
                    <p className="text-xs text-muted-foreground animate-pulse">Searching for their recent LinkedIn post…</p>
                  )}
                  {!prewarmLoading && prewarmGated && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">LinkedIn is gated — paste their post below and we'll draft the comment.</p>
                      <Textarea
                        placeholder="Paste their LinkedIn post here…"
                        value={prewarmPost}
                        onChange={e => setPrewarmPost(e.target.value)}
                        className="text-sm resize-none"
                        rows={4}
                      />
                      <Button size="sm" onClick={handlePrewarmFromPaste} disabled={prewarmLoading || !prewarmPost.trim()}>
                        {prewarmLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        Generate comment
                      </Button>
                    </div>
                  )}
                  {prewarmComment && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">Your comment</span>
                        <CopyButton text={prewarmComment} />
                      </div>
                      <p className="text-sm bg-muted/40 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">{prewarmComment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'connect' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Connection request note <span className="normal-case font-normal">({copyKit.connection_note.length}/300 chars)</span>
              </span>
              <CopyButton text={copyKit.connection_note} />
            </div>
            <Textarea
              value={copyKit.connection_note}
              onChange={e => onCopyKitChange({ ...copyKit, connection_note: e.target.value })}
              rows={4}
              className="text-sm bg-muted/40 border-transparent focus-visible:border-input leading-relaxed resize-y"
            />
          </div>
        )}

        {activeTab === 'followup' && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</span>
                <CopyButton text={copyKit.follow_up.subject} />
              </div>
              <Input
                value={copyKit.follow_up.subject}
                onChange={e => onCopyKitChange({ ...copyKit, follow_up: { ...copyKit.follow_up, subject: e.target.value } })}
                className="text-sm bg-muted/40 border-transparent focus-visible:border-input"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Body</span>
                <CopyButton text={copyKit.follow_up.body} />
              </div>
              <Textarea
                value={copyKit.follow_up.body}
                onChange={e => onCopyKitChange({ ...copyKit, follow_up: { ...copyKit.follow_up, body: e.target.value } })}
                rows={8}
                className="text-sm bg-muted/40 border-transparent focus-visible:border-input leading-relaxed resize-y"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <Button className="glow-accent flex-1" onClick={onContinue}>
          Start sequence
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 5: Sequence tracker ─────────────────────────────────────────────────

type SequenceTab = 'copy' | 'pipeline' | 'reply';

function Step5({
  intel,
  copyKit,
  leadId,
  sequenceStep,
  onStepAdvance,
  onLeadCreated,
  onMarkDead,
  onBack,
}: {
  intel: CompanyIntel;
  copyKit: CopyKit;
  leadId: string | null;
  sequenceStep: number;
  onStepAdvance: (nextStep: number) => void;
  onLeadCreated: (leadId: string) => void;
  onMarkDead: () => void;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SequenceTab>('copy');
  const [addingToSugar, setAddingToSugar] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyResult, setReplyResult] = useState<ReplyResult | null>(null);
  const [showDeadConfirm, setShowDeadConfirm] = useState(false);
  const { business, extractedData } = useBusiness();
  const { user } = useAuth();

  const addedToSugar = !!leadId;
  const currentSeqStep = SEQUENCE_STEPS[sequenceStep] ?? SEQUENCE_STEPS[0];

  function getCopyForStep(step: typeof SEQUENCE_STEPS[number]): string {
    if (step.copy_key === 'cold_email') return `${copyKit.cold_email.subject}\n\n${copyKit.cold_email.body}`;
    if (step.copy_key === 'follow_up') return `${copyKit.follow_up.subject}\n\n${copyKit.follow_up.body}`;
    if (step.copy_key === 'linkedin_dm') return copyKit.linkedin_dm;
    return copyKit.connection_note;
  }

  async function handleAddToPipeline() {
    if (!business || addedToSugar) return;
    setAddingToSugar(true);
    try {
      // Upsert contact
      const { data: contact } = await supabase
        .from('contacts')
        .insert({
          business_id: business.id,
          name: intel.best_contact_point || intel.company_name,
          company: intel.company_name,
          status: 'Prospect',
        })
        .select('id')
        .single();

      if (!contact) throw new Error('Failed to create contact');

      const nextActionDate = new Date();
      nextActionDate.setDate(nextActionDate.getDate() + 3);

      const { data: leadRow, error } = await supabase
        .from('pipeline_leads')
        .insert({
          business_id: business.id,
          contact_id: contact.id,
          stage: 'Prospect',
          service_name: intel.matched_services[0] ?? null,
          source: 'outreach_kit',
          company_url: intel.company_url || null,
          service_overlap_score: intel.service_overlap_score,
          matched_services: intel.matched_services,
          outreach_sequence_step: sequenceStep,
          outreach_sequence_status: 'in_progress',
          next_action_date: nextActionDate.toISOString().split('T')[0],
          company_intel: intel,
        })
        .select('id')
        .single();

      if (error) throw error;
      onLeadCreated(leadRow.id);
      toast.success(`${intel.company_name} added to pipeline`);
    } catch {
      toast.error('Failed to add to pipeline');
    } finally {
      setAddingToSugar(false);
    }
  }

  async function handleDraftReply() {
    if (!replyText.trim()) return;
    setReplyLoading(true);
    try {
      const services = (extractedData?.services as Array<{ name: string }> ?? []).map(s => s.name);
      const identity = extractedData?.identity as Record<string, string> ?? {};
      const { data, error } = await supabase.functions.invoke('handle-reply-intent', {
        body: {
          reply_text: replyText,
          freelancer_name: identity.name ?? user?.email ?? 'the freelancer',
          freelancer_services: services,
          company_name: intel.company_name,
          current_step: currentSeqStep.label,
          step_copy_summary: getCopyForStep(currentSeqStep).slice(0, 200),
        },
      });
      if (error) throw error;
      setReplyResult(data as ReplyResult);
    } catch {
      toast.error('Failed to classify reply');
    } finally {
      setReplyLoading(false);
    }
  }

  async function handleMarkDead() {
    setShowDeadConfirm(false);
    onMarkDead();
  }

  const tabs: { id: SequenceTab; label: string }[] = [
    { id: 'copy', label: 'Copy for this step' },
    { id: 'pipeline', label: 'Lead card' },
    { id: 'reply', label: 'Got a reply?' },
  ];

  const intentColors: Record<string, string> = {
    soft_defer: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    hard_no: 'bg-red-500/10 text-red-600 border-red-500/20',
    interested: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    wants_material: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    objection: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    auto_reply: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Sequence — {intel.company_name}</h2>
        <p className="text-sm text-muted-foreground">Track where you are and what to do next.</p>
      </div>

      {/* Sequence track */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {SEQUENCE_STEPS.map((s, i) => {
          const done = i < sequenceStep;
          const active = i === sequenceStep;
          return (
            <div key={s.id} className="flex items-center gap-2 shrink-0">
              <div className={`flex flex-col items-center gap-1`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all ${
                  done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : active
                    ? 'bg-foreground border-foreground text-background'
                    : 'border-border text-muted-foreground'
                }`}>
                  {done ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium text-center whitespace-nowrap ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
              {i < SEQUENCE_STEPS.length - 1 && (
                <div className={`w-8 sm:w-12 h-px mb-4 ${done ? 'bg-emerald-500' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Copy for this step */}
      {activeTab === 'copy' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Step {sequenceStep + 1}: {currentSeqStep.label}</p>
              {sequenceStep === 0 && <p className="text-xs text-muted-foreground mt-0.5">Send the connection request first</p>}
              {sequenceStep === 1 && <p className="text-xs text-muted-foreground mt-0.5">Send after they accept your connection</p>}
              {sequenceStep === 2 && <p className="text-xs text-muted-foreground mt-0.5">Send via email if DM goes unanswered</p>}
              {sequenceStep === 3 && <p className="text-xs text-muted-foreground mt-0.5">Day 5–7 follow-up — last touch</p>}
            </div>
            <CopyButton text={getCopyForStep(currentSeqStep)} />
          </div>

          <p className="text-sm bg-muted/40 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
            {getCopyForStep(currentSeqStep)}
          </p>

          {sequenceStep < SEQUENCE_STEPS.length - 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStepAdvance(sequenceStep + 1)}
            >
              <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
              Mark sent → advance to {SEQUENCE_STEPS[sequenceStep + 1].label}
            </Button>
          )}
        </div>
      )}

      {/* Tab: Lead card */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{intel.company_name}</p>
                  <p className="text-xs text-muted-foreground">{intel.best_contact_point}</p>
                </div>
                <Badge variant="outline" className="text-xs bg-gray-500/10 text-gray-600 border-gray-500/20">
                  Prospect
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Service fit</span>
                  <p className="font-medium mt-0.5">{intel.matched_services[0] ?? '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Source</span>
                  <p className="font-medium mt-0.5">Outreach kit</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sequence step</span>
                  <p className="font-medium mt-0.5">{currentSeqStep.label}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Match score</span>
                  <p className="font-medium mt-0.5">{Math.round(intel.service_overlap_score * 100)}%</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground border-t border-border pt-2">
                As you mark steps done, the card moves automatically. You never drag it.
              </p>
            </CardContent>
          </Card>

          {addedToSugar ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <Check className="w-4 h-4" />
              Added to leads
            </div>
          ) : (
            <Button className="glow-accent w-full" onClick={handleAddToPipeline} disabled={addingToSugar}>
              {addingToSugar
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Adding…</>
                : <><Plus className="w-4 h-4 mr-2" />Add to leads</>
              }
            </Button>
          )}
        </div>
      )}

      {/* Tab: Got a reply? */}
      {activeTab === 'reply' && (
        <div className="space-y-4">
          {!replyResult ? (
            <>
              <Textarea
                placeholder="Paste the reply you received…"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={5}
                className="text-sm resize-none"
              />
              <div className="flex gap-3">
                <Button
                  className="glow-accent flex-1"
                  onClick={handleDraftReply}
                  disabled={replyLoading || !replyText.trim()}
                >
                  {replyLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Classifying…</>
                    : <><MessageSquare className="w-4 h-4 mr-2" />Draft my response</>
                  }
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => setShowDeadConfirm(true)}
                >
                  Mark as dead
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-xs ${intentColors[replyResult.intent] ?? ''}`}
                >
                  {replyResult.intent.replace(/_/g, ' ')}
                </Badge>
                <span className="text-sm font-medium">{replyResult.user_facing_label}</span>
              </div>

              <p className="text-xs text-muted-foreground">{replyResult.classification_reasoning}</p>

              {replyResult.reminder_weeks && (
                <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                  Reminder set for <strong>{replyResult.reminder_weeks} weeks</strong>. Lead card stays in Prospect.
                </div>
              )}

              {replyResult.draft_response && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {replyResult.draft_subject ? 'Email reply' : 'Draft response'}
                    </span>
                    <CopyButton text={replyResult.draft_response} />
                  </div>
                  {replyResult.draft_subject && (
                    <p className="text-xs text-muted-foreground mb-2">Subject: {replyResult.draft_subject}</p>
                  )}
                  <p className="text-sm bg-muted/40 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                    {replyResult.draft_response}
                  </p>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => { setReplyResult(null); setReplyText(''); }}>
                Try another reply
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to copy kit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/5"
          onClick={() => setShowDeadConfirm(true)}
        >
          Close sequence
        </Button>
      </div>

      {/* Dead confirm */}
      <Dialog open={showDeadConfirm} onOpenChange={setShowDeadConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close this sequence?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The lead will move to Lost. Doors can still reopen — you can always re-research {intel.company_name} later.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeadConfirm(false)}>Keep it open</Button>
            <Button variant="destructive" onClick={handleMarkDead}>Close sequence</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Research a Company (single-target flow) ───────────────────────────────────

type SingleStep = 1 | 2 | 3 | 4 | 5;

function SingleStepNav({ step }: { step: SingleStep }) {
  const steps = ['Target', 'Researching', 'Intel', 'Copy kit', 'Sequence'];
  return (
    <div className="flex items-center gap-1 mb-8">
      {steps.map((s, i) => {
        const idx = (i + 1) as SingleStep;
        const done = step > idx;
        const active = step === idx;
        return (
          <div key={s} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              done ? 'text-emerald-500' : active ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border transition-all ${
                done
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : active
                  ? 'bg-foreground border-foreground text-background'
                  : 'border-border'
              }`}>
                {done ? <Check className="w-2.5 h-2.5" /> : idx}
              </div>
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < 4 && <div className={`w-4 sm:w-8 h-px transition-colors ${done ? 'bg-emerald-500' : 'bg-border'}`} />}
          </div>
        );
      })}
    </div>
  );
}

function SingleTargetInput({ onSubmit }: { onSubmit: (input: string) => void }) {
  const [input, setInput] = useState('');
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Who do you want to reach?</h2>
        <p className="text-sm text-muted-foreground">
          Paste a company website URL, LinkedIn company page, or just the company name.
        </p>
      </div>

      <div className="space-y-3">
        <Input
          placeholder="e.g. https://acme.com or Acme Corp"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim()) onSubmit(input.trim()); }}
          className="h-12 text-base"
          autoFocus
        />
        <Button
          className="w-full glow-accent"
          size="lg"
          disabled={!input.trim()}
          onClick={() => onSubmit(input.trim())}
        >
          Research + draft
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-4">
          <p className="text-xs font-medium mb-2 text-muted-foreground">What Forgefly looks for</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500 shrink-0" />What the company does and who they serve</li>
            <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500 shrink-0" />Team signals and hiring activity</li>
            <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500 shrink-0" />Best point of contact and channel</li>
            <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500 shrink-0" />Overlap with your services</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

const SINGLE_LOADING_STEPS = [
  { icon: '🌐', label: 'Fetching company website' },
  { icon: '👥', label: 'Extracting team + contact signals' },
  { icon: '📋', label: 'Scanning for hiring activity' },
  { icon: '🔗', label: 'Matching to your service portfolio' },
  { icon: '✍️', label: 'Drafting outreach copy' },
];

function SingleLoading({ progress }: { progress: number }) {
  return (
    <div className="max-w-sm mx-auto space-y-6 py-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-1">Researching…</h2>
        <p className="text-sm text-muted-foreground">Usually takes 15–30 seconds</p>
      </div>
      <div className="space-y-3">
        {SINGLE_LOADING_STEPS.map((s, i) => {
          const done = i < progress;
          const active = i === progress;
          return (
            <div key={s.label} className={`flex items-center gap-3 text-sm transition-opacity ${done || active ? 'opacity-100' : 'opacity-30'}`}>
              <span className="text-base">{s.icon}</span>
              <span className={done ? 'text-foreground' : active ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                {s.label}
              </span>
              {done && <Check className="w-3.5 h-3.5 text-emerald-500 ml-auto shrink-0" />}
              {active && <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto shrink-0 text-muted-foreground" />}
            </div>
          );
        })}
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-700"
          style={{ width: `${(progress / SINGLE_LOADING_STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

function SingleCompanyResearch() {
  const { extractedData } = useBusiness();
  const { user } = useAuth();

  const [step, setStep] = useState<SingleStep>(1);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [intel, setIntel] = useState<CompanyIntel | null>(null);
  const [copyKit, setCopyKit] = useState<CopyKit | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [sequenceStep, setSequenceStep] = useState(0);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startLoadingAnimation() {
    setLoadingProgress(0);
    let progress = 0;
    loadingTimerRef.current = setInterval(() => {
      progress += 1;
      setLoadingProgress(Math.min(progress, 4));
      if (progress >= 4) clearInterval(loadingTimerRef.current!);
    }, 3000);
  }

  async function handleResearch(input: string) {
    setStep(2);
    startLoadingAnimation();

    try {
      const services = (extractedData?.services as Array<{ name: string }> ?? []).map(s => s.name);
      const identity = extractedData?.identity as Record<string, string> ?? {};

      const { data: bizData } = await supabase
        .from('businesses')
        .select('slug')
        .eq('user_id', user?.id ?? '')
        .eq('status', 'active')
        .maybeSingle();
      const portfolioUrl = bizData?.slug
        ? `${window.location.origin}/p/${bizData.slug}`
        : null;

      const { data, error } = await supabase.functions.invoke('research-company', {
        body: {
          company_input: input,
          services,
          freelancer_name: identity.name ?? user?.email ?? 'the freelancer',
          portfolio_url: portfolioUrl,
        },
      });

      if (error) throw error;

      clearInterval(loadingTimerRef.current!);
      setLoadingProgress(5);

      const result = data as { intel: CompanyIntel; copy_kit: CopyKit };
      setIntel(result.intel);
      setCopyKit(result.copy_kit);

      setTimeout(() => setStep(3), 400);
    } catch (err) {
      clearInterval(loadingTimerRef.current!);
      toast.error('Research failed — check your connection and try again');
      setStep(1);
      console.error(err);
    }
  }

  async function handleSequenceAdvance(nextStep: number) {
    setSequenceStep(nextStep);
    if (leadId) {
      await supabase
        .from('pipeline_leads')
        .update({
          outreach_sequence_step: nextStep,
          stage: nextStep >= 1 ? 'Contacted' : 'Prospect',
        })
        .eq('id', leadId);
    }
  }

  async function handleMarkDead() {
    if (leadId) {
      await supabase
        .from('pipeline_leads')
        .update({ outreach_sequence_status: 'dead', stage: 'Lost' })
        .eq('id', leadId);
    }
    toast.success('Sequence closed — lead moved to Lost');
    setStep(1);
    setIntel(null);
    setCopyKit(null);
    setLeadId(null);
    setSequenceStep(0);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end mb-4">
        {step > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStep(1); setIntel(null); setCopyKit(null); }}
          >
            <X className="w-4 h-4 mr-1" />Start over
          </Button>
        )}
      </div>

      <SingleStepNav step={step} />

      {step === 1 && <SingleTargetInput onSubmit={handleResearch} />}
      {step === 2 && <SingleLoading progress={loadingProgress} />}
      {step === 3 && intel && (
        <Step3
          intel={intel}
          onContinue={() => setStep(4)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 4 && intel && copyKit && (
        <Step4
          intel={intel}
          copyKit={copyKit}
          onCopyKitChange={setCopyKit}
          onContinue={() => setStep(5)}
          onBack={() => setStep(3)}
        />
      )}
      {step === 5 && intel && copyKit && (
        <Step5
          intel={intel}
          copyKit={copyKit}
          leadId={leadId}
          sequenceStep={sequenceStep}
          onStepAdvance={handleSequenceAdvance}
          onLeadCreated={setLeadId}
          onMarkDead={handleMarkDead}
          onBack={() => setStep(4)}
        />
      )}
    </div>
  );
}

// ─── Detail panel (right panel) ────────────────────────────────────────────────

function DetailPanel({
  item,
  onDetailStepChange,
  onCopyKitChange,
  onSequenceAdvance,
  onLeadCreated,
  onMarkDead,
  onDeselect,
}: {
  item: QueueItem | null;
  onDetailStepChange: (step: DetailStep) => void;
  onCopyKitChange: (next: CopyKit) => void;
  onSequenceAdvance: (nextStep: number) => void;
  onLeadCreated: (leadId: string) => void;
  onMarkDead: () => void;
  onDeselect: () => void;
}) {
  if (!item || item.status !== 'completed' || !item.intel || !item.copyKit) {
    return (
      <div className="flex-1 flex items-center justify-center text-center py-20">
        <div className="max-w-xs space-y-2">
          <Sparkles className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Select a completed company from the list to view its outreach kit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0">
      {item.detailStep === 3 && (
        <Step3
          intel={item.intel}
          onContinue={() => onDetailStepChange(4)}
          onBack={onDeselect}
        />
      )}
      {item.detailStep === 4 && (
        <Step4
          intel={item.intel}
          copyKit={item.copyKit}
          onCopyKitChange={onCopyKitChange}
          onContinue={() => onDetailStepChange(5)}
          onBack={() => onDetailStepChange(3)}
        />
      )}
      {item.detailStep === 5 && (
        <Step5
          intel={item.intel}
          copyKit={item.copyKit}
          leadId={item.leadId}
          sequenceStep={item.sequenceStep}
          onStepAdvance={onSequenceAdvance}
          onLeadCreated={onLeadCreated}
          onMarkDead={onMarkDead}
          onBack={() => onDetailStepChange(4)}
        />
      )}
    </div>
  );
}

// ─── Research Outreach (persona brainstorm + batch queue flow) ─────────────────

function BatchOutreachTab() {
  const { extractedData } = useBusiness();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('persona');
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [personaLoading, setPersonaLoading] = useState(false);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeIdsRef = useRef<Set<string>>(new Set());
  const idCounterRef = useRef(0);

  function nextId() {
    idCounterRef.current += 1;
    return `q${Date.now()}_${idCounterRef.current}`;
  }

  function updateItem(id: string, patch: Partial<QueueItem>, opts?: { onlyIfRunning?: boolean }) {
    setQueue(prev => prev.map(i => {
      if (i.id !== id) return i;
      if (opts?.onlyIfRunning && i.status !== 'running') return i;
      return { ...i, ...patch };
    }));
  }

  async function generatePersonas() {
    setPersonaLoading(true);
    try {
      const identity = extractedData?.identity as Record<string, string> ?? {};
      const services = (extractedData?.services as Array<{ name: string }> ?? []).map(s => s.name);
      const { data, error } = await supabase.functions.invoke('ai-gateway', {
        body: { mode: 'target_personas', niche: identity.niche ?? '', services },
      });
      if (error) throw error;
      setPersonas((data as { personas: Persona[] }).personas ?? []);
    } catch {
      setPersonas([]);
      toast.error('Could not generate target personas');
    } finally {
      setPersonaLoading(false);
    }
  }

  async function dispatchResearch(item: QueueItem) {
    try {
      const services = (extractedData?.services as Array<{ name: string }> ?? []).map(s => s.name);
      const identity = extractedData?.identity as Record<string, string> ?? {};

      const { data: bizData } = await supabase
        .from('businesses')
        .select('slug')
        .eq('user_id', user?.id ?? '')
        .eq('status', 'active')
        .maybeSingle();
      const portfolioUrl = bizData?.slug ? `${window.location.origin}/p/${bizData.slug}` : null;

      const { data, error } = await supabase.functions.invoke('research-company', {
        body: {
          company_input: item.input,
          services,
          freelancer_name: identity.name ?? user?.email ?? 'the freelancer',
          portfolio_url: portfolioUrl,
        },
      });
      if (error) throw error;

      const result = data as { intel: CompanyIntel; copy_kit: CopyKit };
      updateItem(item.id, { status: 'completed', intel: result.intel, copyKit: result.copy_kit }, { onlyIfRunning: true });
    } catch {
      updateItem(item.id, { status: 'failed' }, { onlyIfRunning: true });
    } finally {
      activeIdsRef.current.delete(item.id);
    }
  }

  // Sliding-window concurrency: whenever the queue changes, fill any free research slots.
  useEffect(() => {
    const runningCount = queue.filter(i => i.status === 'running').length;
    const freeSlots = CONCURRENCY - runningCount;
    if (freeSlots <= 0) return;

    const next = queue.filter(i => i.status === 'queued' && !activeIdsRef.current.has(i.id)).slice(0, freeSlots);
    if (next.length === 0) return;

    next.forEach(item => {
      activeIdsRef.current.add(item.id);
      setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'running' as const } : i));
      dispatchResearch(item);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  // Auto-select the first item that completes if nothing is selected yet.
  useEffect(() => {
    if (selectedId) return;
    const firstDone = queue.find(i => i.status === 'completed');
    if (firstDone) setSelectedId(firstDone.id);
  }, [queue, selectedId]);

  function handleBatchSubmit(inputs: string[]) {
    const items: QueueItem[] = inputs.map(input => ({
      id: nextId(),
      input,
      status: 'queued',
      intel: null,
      copyKit: null,
      detailStep: 3,
      leadId: null,
      sequenceStep: 0,
    }));
    setQueue(items);
    setPhase('queue');
  }

  function handleAddToQueue(inputs: string[]) {
    const existing = new Set(queue.map(i => i.input.toLowerCase()));
    const deduped = inputs.filter(input => !existing.has(input.toLowerCase()));
    const room = MAX_QUEUE_SIZE - queue.length;
    if (room <= 0) {
      toast.error(`You can track up to ${MAX_QUEUE_SIZE} companies at once`);
      return;
    }
    const capped = deduped.slice(0, room);
    if (capped.length === 0) return;
    const items: QueueItem[] = capped.map(input => ({
      id: nextId(),
      input,
      status: 'queued',
      intel: null,
      copyKit: null,
      detailStep: 3,
      leadId: null,
      sequenceStep: 0,
    }));
    setQueue(prev => [...prev, ...items]);
    if (deduped.length > capped.length) {
      toast.error(`Only added ${capped.length} — you can track up to ${MAX_QUEUE_SIZE} companies at once`);
    }
  }

  function handleCancel(id: string) {
    setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'cancelled' as const } : i));
    activeIdsRef.current.delete(id);
    if (selectedId === id) setSelectedId(null);
  }

  function handleStartOver() {
    setPhase('persona');
    setPersonas(null);
    setQueue([]);
    setSelectedId(null);
    activeIdsRef.current.clear();
  }

  const selectedItem = queue.find(i => i.id === selectedId) ?? null;

  return (
    <div className="space-y-2">
      {phase !== 'persona' && (
        <div className="flex items-center justify-end mb-4">
          <Button variant="ghost" size="sm" onClick={handleStartOver}>
            <X className="w-4 h-4 mr-1" />Start over
          </Button>
        </div>
      )}

      {phase === 'persona' && (
        <PersonaBrainstorm
          personas={personas}
          loading={personaLoading}
          onGenerate={generatePersonas}
          onContinue={() => setPhase('batch')}
        />
      )}

      {phase === 'batch' && <BatchInput onSubmit={handleBatchSubmit} />}

      {phase === 'queue' && (
        <div className="flex flex-col md:flex-row gap-6">
          <QueueList
            queue={queue}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCancel={handleCancel}
            onAdd={handleAddToQueue}
          />
          <DetailPanel
            item={selectedItem}
            onDetailStepChange={step => selectedItem && updateItem(selectedItem.id, { detailStep: step })}
            onCopyKitChange={next => selectedItem && updateItem(selectedItem.id, { copyKit: next })}
            onSequenceAdvance={nextStep => {
              if (!selectedItem) return;
              updateItem(selectedItem.id, { sequenceStep: nextStep });
              if (selectedItem.leadId) {
                supabase.from('pipeline_leads').update({
                  outreach_sequence_step: nextStep,
                  stage: nextStep >= 1 ? 'Contacted' : 'Prospect',
                }).eq('id', selectedItem.leadId);
              }
            }}
            onLeadCreated={leadId => selectedItem && updateItem(selectedItem.id, { leadId })}
            onDeselect={() => setSelectedId(null)}
            onMarkDead={async () => {
              if (!selectedItem) return;
              if (selectedItem.leadId) {
                await supabase.from('pipeline_leads').update({ outreach_sequence_status: 'dead', stage: 'Lost' }).eq('id', selectedItem.leadId);
              }
              toast.success('Sequence closed — lead moved to Lost');
              setSelectedId(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function OutreachKitPage() {
  const navigate = useNavigate();
  const { business } = useBusiness();

  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <Send className="w-8 h-8 text-accent" />
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-2">Generate your Business OS first</h3>
          <p className="text-muted-foreground max-w-sm">
            The outreach kit needs your services to generate personalised copy.
          </p>
        </div>
        <Button onClick={() => navigate('/')}>
          Get started
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-balance">B2B Outreach Kit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Find who to target, research them, and get a personalised outreach sequence.
        </p>
      </div>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single"><Building2 className="w-4 h-4 mr-1.5" />Research a Company</TabsTrigger>
          <TabsTrigger value="batch"><Target className="w-4 h-4 mr-1.5" />Research Outreach</TabsTrigger>
        </TabsList>
        <TabsContent value="single" className="pt-6">
          <SingleCompanyResearch />
        </TabsContent>
        <TabsContent value="batch" className="pt-6">
          <BatchOutreachTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
