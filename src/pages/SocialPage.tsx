import {
  Crown,
  ExternalLink,
  Loader2,
  Search,
  Share2,
  Sparkles,
  ThumbsDown,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UpgradeModal } from "@/components/common/UpgradeModal";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/CurrentBusinessContext";
import {
  addCompetitor,
  approveSocialPost,
  archiveSocialPost,
  dismissCompetitor,
  fetchCompetitorIntel,
  generateSocialDrafts,
  getCompetitors,
  getCompetitorIntel,
  getSocialPosts,
  suggestCompetitors,
} from "@/services/socialService";
import type { CompetitorProfile, CompetitorSiteIntel, SocialPost } from "@/types/types";

type Tab = "compose" | "competitors";

function CompeteRow({
  competitor,
  onDismiss,
  onConfirm,
}: {
  competitor: { handle: string; source_url: string };
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <div className="min-w-0">
        <p className="font-medium truncate">@{competitor.handle}</p>
        <a
          href={competitor.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
        >
          View profile <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={onDismiss}>
          <X className="w-4 h-4" />
        </Button>
        <Button size="sm" onClick={onConfirm}>
          Track
        </Button>
      </div>
    </div>
  );
}

function TrackedCompetitorCard({ competitor }: { competitor: CompetitorProfile }) {
  const [websiteUrl, setWebsiteUrl] = useState(competitor.website_url ?? "");
  const [intel, setIntel] = useState<CompetitorSiteIntel | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    getCompetitorIntel(competitor.id)
      .then(setIntel)
      .finally(() => setLoadingExisting(false));
  }, [competitor.id]);

  async function handleFetchIntel() {
    if (!websiteUrl.trim()) {
      toast.error("Add their website URL first");
      return;
    }
    setLoading(true);
    try {
      const result = await fetchCompetitorIntel(competitor.id, websiteUrl.trim());
      setIntel(result);
      toast.success("Site intel pulled");
    } catch {
      toast.error("Failed to pull site intel");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold">@{competitor.handle}</p>
          <Badge variant="outline" className="text-xs">
            {competitor.source === "ai_suggested" ? "AI-suggested" : "Manual"}
          </Badge>
        </div>

        <div className="flex gap-2">
          <Input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="Their website URL (optional)"
            className="text-sm"
          />
          <Button size="sm" variant="outline" disabled={loading} onClick={handleFetchIntel}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get intel"}
          </Button>
        </div>

        {!loadingExisting && intel && (
          <div className="text-sm space-y-1.5 pt-2 border-t">
            <p>
              <span className="text-muted-foreground">Pricing: </span>
              {intel.pricing_notes ?? "Not published on their site"}
            </p>
            <p>
              <span className="text-muted-foreground">Turnaround: </span>
              {intel.turnaround_notes ?? "Not published on their site"}
            </p>
            <p>
              <span className="text-muted-foreground">Reviews: </span>
              {intel.review_summary ?? "Not published on their site"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SocialWorkspace() {
  const [tab, setTab] = useState<Tab>("compose");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([]);
  const [candidates, setCandidates] = useState<{ handle: string; source_url: string }[]>([]);
  const [niche, setNiche] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [manualHandle, setManualHandle] = useState("");

  useEffect(() => {
    getSocialPosts()
      .then((data) => setPosts(data.filter((p) => p.status !== "archived")))
      .finally(() => setLoadingPosts(false));
    getCompetitors().then((data) => setCompetitors(data.filter((c) => c.status === "tracking")));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const drafts = await generateSocialDrafts();
      setPosts((prev) => [...drafts, ...prev]);
      toast.success(`${drafts.length} caption${drafts.length === 1 ? "" : "s"} drafted`);
    } catch {
      toast.error("Failed to generate drafts");
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      const updated = await approveSocialPost(id);
      setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch {
      toast.error("Failed to approve");
    }
  }

  async function handleArchive(id: string) {
    try {
      await archiveSocialPost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast.error("Failed to dismiss");
    }
  }

  async function handleSuggest() {
    if (!niche.trim()) {
      toast.error("Describe your niche first (e.g. \"wedding photography\")");
      return;
    }
    setSuggesting(true);
    try {
      const results = await suggestCompetitors(niche.trim());
      setCandidates(results);
      if (results.length === 0) toast.info("No candidates found — try a different niche description");
    } catch {
      toast.error("Failed to suggest competitors");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleConfirmCandidate(candidate: { handle: string; source_url: string }) {
    try {
      const added = await addCompetitor(candidate.handle, "ai_suggested");
      setCompetitors((prev) => [added, ...prev]);
      setCandidates((prev) => prev.filter((c) => c.handle !== candidate.handle));
    } catch {
      toast.error("Failed to add competitor");
    }
  }

  function handleDismissCandidate(handle: string) {
    setCandidates((prev) => prev.filter((c) => c.handle !== handle));
  }

  async function handleAddManual() {
    const handle = manualHandle.trim().replace(/^@/, "");
    if (!handle) return;
    try {
      const added = await addCompetitor(handle, "manual");
      setCompetitors((prev) => [added, ...prev]);
      setManualHandle("");
    } catch {
      toast.error("Failed to add competitor");
    }
  }

  async function handleDismissTracked(id: string) {
    try {
      await dismissCompetitor(id);
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast.error("Failed to remove competitor");
    }
  }

  const draftPosts = posts.filter((p) => p.status === "draft");
  const approvedPosts = posts.filter((p) => p.status === "approved");

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">Social</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          AI-drafted Instagram captions and competitor tracking
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b">
        {(["compose", "competitors"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "compose" ? "Compose" : "Competitors"}
          </button>
        ))}
      </div>

      {tab === "compose" && (
        <div className="space-y-4">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {generating ? "Drafting…" : "Generate captions"}
          </Button>

          {loadingPosts ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : draftPosts.length === 0 && approvedPosts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Share2 className="w-8 h-8 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground max-w-md">
                  No captions yet. Generate a few AI drafts to get started — you'll review and approve each one before posting anywhere.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {draftPosts.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Drafts
                  </p>
                  {draftPosts.map((post) => (
                    <Card key={post.id}>
                      <CardContent className="p-4 space-y-3">
                        <p className="text-sm whitespace-pre-wrap">{post.caption}</p>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApprove(post.id)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleArchive(post.id)}>
                            <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                            Dismiss
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {approvedPosts.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Approved — ready to post manually
                  </p>
                  {approvedPosts.map((post) => (
                    <Card key={post.id} className="border-emerald-500/30">
                      <CardContent className="p-4 space-y-2">
                        <p className="text-sm whitespace-pre-wrap">{post.caption}</p>
                        <p className="text-xs text-muted-foreground">
                          Approved — copy this into Instagram yourself for now. Direct publishing is coming once Instagram integration is connected.
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "competitors" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">Suggest competitors</p>
              <div className="flex gap-2">
                <Input
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Describe your niche (e.g. wedding photography)"
                />
                <Button disabled={suggesting} onClick={handleSuggest}>
                  {suggesting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Candidates come from a live web search, not AI guesswork — confirm the ones that look right before tracking them.
              </p>

              {candidates.length > 0 && (
                <div className="space-y-2 pt-2">
                  {candidates.map((c) => (
                    <CompeteRow
                      key={c.handle}
                      competitor={c}
                      onDismiss={() => handleDismissCandidate(c.handle)}
                      onConfirm={() => handleConfirmCandidate(c)}
                    />
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <Input
                  value={manualHandle}
                  onChange={(e) => setManualHandle(e.target.value)}
                  placeholder="Or add a handle you already know (@handle)"
                />
                <Button variant="outline" onClick={handleAddManual}>
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tracking
            </p>
            {competitors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No competitors tracked yet.
              </p>
            ) : (
              competitors.map((c) => (
                <div key={c.id} className="relative">
                  <button
                    type="button"
                    onClick={() => handleDismissTracked(c.id)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-destructive z-10"
                    title="Stop tracking"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <TrackedCompetitorCard competitor={c} />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SocialLocked({
  message,
  showUpgradeCta,
}: {
  message: string;
  showUpgradeCta: boolean;
}) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">Social</h1>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
            <Share2 className="w-8 h-8 text-accent" />
          </div>
          <p className="text-muted-foreground max-w-md text-pretty">{message}</p>
          {showUpgradeCta && (
            <Button onClick={() => setShowUpgradeModal(true)}>
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Agency
            </Button>
          )}
        </CardContent>
      </Card>
      {showUpgradeCta && (
        <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
      )}
    </div>
  );
}

export default function SocialPage() {
  const { isAgency } = useAuth();
  const { extractedData, isLoading } = useBusiness();

  if (isLoading) return null;

  if (!isAgency) {
    return (
      <SocialLocked
        message="AI-drafted Instagram captions and competitor tracking are an agency-tier feature."
        showUpgradeCta
      />
    );
  }

  // Private beta gate — Instagram/WhatsApp publishing is still being tested against a personal
  // Meta developer account, so this stays hidden from agency-tier beta users until that's further along.
  const settings = (extractedData as Record<string, unknown> | null)?.settings as
    | Record<string, unknown>
    | undefined;
  const betaEnabled = settings?.social_beta_enabled === true;

  if (!betaEnabled) {
    return (
      <SocialLocked
        message="Social is in private beta while we finish testing Instagram and WhatsApp integration. It'll open up to everyone soon."
        showUpgradeCta={false}
      />
    );
  }

  return <SocialWorkspace />;
}
