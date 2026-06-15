import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Copy, Check, Loader2, ChevronRight, Radio, Zap, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useBusiness } from '@/contexts/CurrentBusinessContext';
import {
  PLAYBOOKS,
  PERSONA_EXAMPLES,
  PRESENCE_TIER_LABELS,
  type VisibilityChannel,
  type ChannelTier,
} from '@/config/visibilityPlaybooks';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BusinessProfile {
  presence_tier?: string;
  motion?: string;
  industry_vertical?: string;
  confidence?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIER_BADGE: Record<ChannelTier, { label: string; className: string }> = {
  now: { label: 'Now', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  grow: { label: 'Grow', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  coming_soon: { label: 'Coming Soon', className: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copy}>
      {copied ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <CopyButton text={value} />
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/40 rounded-lg p-3">{value}</p>
    </div>
  );
}

function CopyKitDisplay({ channelId, kit }: { channelId: string; kit: unknown }) {
  if (!kit) return null;

  if (typeof kit === 'string') {
    return <CopyBlock label="Copy" value={kit} />;
  }

  const obj = kit as Record<string, unknown>;

  // linkedin_kit
  if (channelId === 'linkedin_kit' || channelId === 'linkedin_authority') {
    return (
      <div className="space-y-4 mt-4">
        {!!obj.headline && <CopyBlock label="Headline" value={String(obj.headline)} />}
        {!!obj.about && <CopyBlock label="About" value={String(obj.about)} />}
        {!!obj.featured_caption && <CopyBlock label="Featured caption" value={String(obj.featured_caption)} />}
        {Array.isArray(obj.post_templates) && (obj.post_templates as unknown[]).length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Post templates</span>
            {(obj.post_templates as string[]).map((t, i) => (
              <div key={i} className="relative">
                <p className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/40 rounded-lg p-3 pr-16">{t}</p>
                <div className="absolute top-2 right-2"><CopyButton text={t} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // instagram_kit
  if (channelId === 'instagram_kit') {
    return (
      <div className="space-y-4 mt-4">
        {obj.bio && <CopyBlock label="Bio" value={String(obj.bio)} />}
        {Array.isArray(obj.highlights) && (
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">Highlights</span>
            <div className="flex flex-wrap gap-2">
              {(obj.highlights as string[]).map((h, i) => (
                <Badge key={i} variant="outline" className="text-xs">{h}</Badge>
              ))}
            </div>
          </div>
        )}
        {Array.isArray(obj.caption_templates) && obj.caption_templates.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Caption templates</span>
            {(obj.caption_templates as string[]).map((t, i) => (
              <div key={i} className="relative">
                <p className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/40 rounded-lg p-3 pr-16">{t}</p>
                <div className="absolute top-2 right-2"><CopyButton text={t} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // google_business / google_yelp_pro / wedding_profile / alignable_referral / trust_kit
  return (
    <div className="space-y-4 mt-4">
      {Object.entries(obj).map(([k, v]) => {
        if (!v || typeof v !== 'string') return null;
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return <CopyBlock key={k} label={label} value={v} />;
      })}
    </div>
  );
}

// ─── Channel card ─────────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  kitContent,
  isOutreachEntry,
  onOutreach,
}: {
  channel: VisibilityChannel;
  kitContent?: unknown;
  isOutreachEntry?: boolean;
  onOutreach?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const badge = TIER_BADGE[channel.tier];
  const isComingSoon = channel.tier === 'coming_soon';
  const hasKit = !!kitContent;

  return (
    <Card className={`transition-all ${isComingSoon ? 'opacity-60' : 'card-hover'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-sm">{channel.name}</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badge.className}`}>
                {badge.label}
              </Badge>
              {hasKit && !isComingSoon && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  Generated
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{channel.description}</p>
          </div>

          {isOutreachEntry && !isComingSoon && (
            <Button size="sm" className="shrink-0 glow-accent" onClick={onOutreach}>
              Start
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          )}

          {hasKit && !isOutreachEntry && !isComingSoon && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => setOpen(o => !o)}
            >
              {open ? 'Hide' : 'View'}
            </Button>
          )}

          {isComingSoon && (
            <Badge variant="outline" className="shrink-0 text-[10px]">Soon</Badge>
          )}
        </div>

        {open && hasKit && !isOutreachEntry && (
          <div className="mt-3 pt-3 border-t border-border">
            <CopyKitDisplay channelId={channel.id} kit={kitContent} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Persona picker (fallback when no business_profile) ──────────────────────

const TIER_KEYS = ['b2b_creative', 'b2c_local', 'b2b_professional', 'hybrid_professional'] as const;

function PersonaPicker({ onSelect }: { onSelect: (tier: string) => void }) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold mb-2">Which best describes your business?</h2>
        <p className="text-sm text-muted-foreground">
          We'll load the right visibility playbook for you. You can always switch later.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TIER_KEYS.map(tier => (
          <button
            key={tier}
            type="button"
            onClick={() => onSelect(tier)}
            className="text-left p-4 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all group"
          >
            <div className="font-medium text-sm mb-1 group-hover:text-accent transition-colors">
              {PRESENCE_TIER_LABELS[tier]}
            </div>
            <div className="text-xs text-muted-foreground">{PERSONA_EXAMPLES[tier]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VisibilityPage() {
  const navigate = useNavigate();
  const { business, extractedData, isLoading: bizLoading, refetch: refreshBusiness } = useBusiness();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const ed = extractedData as Record<string, unknown> | null;
  const businessProfile = (ed?.business_profile ?? null) as BusinessProfile | null;
  const presenceTier = businessProfile?.presence_tier;
  const visibilityKit = (ed?.visibility_kit ?? null) as Record<string, unknown> | null;
  const playbook = presenceTier ? PLAYBOOKS[presenceTier] : null;

  // ── Persona picker: save manual selection ────────────────────────────────

  async function handlePersonaSelect(tier: string) {
    if (!business) return;
    setSaving(true);
    try {
      const updated = {
        ...ed,
        business_profile: {
          ...(businessProfile ?? {}),
          presence_tier: tier,
          motion: tier.startsWith('b2b') ? 'b2b' : tier === 'hybrid_professional' ? 'hybrid' : 'b2c',
        },
      };
      await supabase.from('businesses').update({ extracted_data: updated }).eq('id', business.id);
      await refreshBusiness();
    } catch {
      toast.error('Failed to save selection');
    } finally {
      setSaving(false);
    }
  }

  // ── Generate visibility kit ───────────────────────────────────────────────

  async function handleGenerate() {
    if (!business) return;
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke('generate-visibility-kit', {
        body: { business_id: business.id },
      });
      if (error) throw error;
      await refreshBusiness();
      toast.success('Visibility kit generated');
    } catch (err) {
      toast.error('Generation failed — please try again');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (bizLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-accent" />
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-2">Generate your Business OS first</h3>
          <p className="text-muted-foreground max-w-sm text-pretty">
            Your visibility playbook is built from your business description. Generate your OS to get started.
          </p>
        </div>
        <Button onClick={() => navigate('/')}>
          Generate now
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">Let's Make You Visible</h1>
        {playbook ? (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm md:text-base text-muted-foreground">{playbook.headline}</p>
            <div className="flex gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs">{playbook.motionTag}</Badge>
              {playbook.verticalTags.map(t => (
                <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm md:text-base text-muted-foreground">
            Pick your playbook and we'll generate everything you need to get found.
          </p>
        )}
      </div>

      {/* Persona picker if no business_profile yet */}
      {!presenceTier && (
        <div className="py-4">
          {saving ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Saving your playbook…</span>
            </div>
          ) : (
            <PersonaPicker onSelect={handlePersonaSelect} />
          )}
        </div>
      )}

      {/* Playbook view */}
      {playbook && (
        <div className="space-y-8">
          {/* Build my kit CTA */}
          {!visibilityKit && (
            <div className="rounded-xl border border-dashed border-accent/40 bg-accent/5 p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Build your visibility kit</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {playbook.sub}
                </p>
              </div>
              <Button className="glow-accent" onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Build my kit</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Takes about 20–30 seconds · Generated once, yours to keep
              </p>
            </div>
          )}

          {/* Generated — show regenerate option */}
          {visibilityKit && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Kit generated — click any channel to view copy</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Regenerate
              </Button>
            </div>
          )}

          {/* Now channels */}
          <ChannelTierSection
            label="Now"
            icon={<Zap className="w-4 h-4 text-emerald-500" />}
            description="Generates instantly — ready to copy and paste"
            channels={playbook.channels.filter(c => c.tier === 'now')}
            visibilityKit={visibilityKit ?? {}}
            onOutreach={() => navigate('/dashboard/outreach')}
          />

          {/* Grow channels */}
          {playbook.channels.some(c => c.tier === 'grow') && (
            <ChannelTierSection
              label="Grow"
              icon={<TrendingUp className="w-4 h-4 text-amber-500" />}
              description="Secondary channels — build over the next few weeks"
              channels={playbook.channels.filter(c => c.tier === 'grow')}
              visibilityKit={visibilityKit ?? {}}
              onOutreach={() => navigate('/dashboard/outreach')}
            />
          )}

          {/* Coming soon channels */}
          {playbook.channels.some(c => c.tier === 'coming_soon') && (
            <ChannelTierSection
              label="Live signals"
              icon={<Radio className="w-4 h-4 text-violet-500" />}
              description="Demand feeds — see who's looking for your services right now"
              channels={playbook.channels.filter(c => c.tier === 'coming_soon')}
              visibilityKit={{}}
              onOutreach={() => navigate('/dashboard/outreach')}
            />
          )}

          {/* Switch playbook link */}
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={async () => {
                if (!business) return;
                // Clear presence_tier so persona picker re-appears
                const updated = {
                  ...ed,
                  business_profile: { ...(businessProfile ?? {}), presence_tier: undefined },
                };
                await supabase.from('businesses').update({ extracted_data: updated }).eq('id', business.id);
                await refreshBusiness();
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Not the right fit? Switch your playbook →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Channel tier section ─────────────────────────────────────────────────────

function ChannelTierSection({
  label,
  icon,
  description,
  channels,
  visibilityKit,
  onOutreach,
}: {
  label: string;
  icon: React.ReactNode;
  description: string;
  channels: VisibilityChannel[];
  visibilityKit: Record<string, unknown>;
  onOutreach: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-semibold text-sm">{label}</span>
        <span className="text-xs text-muted-foreground">· {description}</span>
      </div>
      <div className="space-y-2">
        {channels.map(channel => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            kitContent={channel.kitKey ? visibilityKit[channel.kitKey] : undefined}
            isOutreachEntry={channel.id === 'outreach_kit_entry'}
            onOutreach={onOutreach}
          />
        ))}
      </div>
    </div>
  );
}
