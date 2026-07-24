import {
  Crown,
  ExternalLink,
  Facebook,
  HelpCircle,
  Home,
  Instagram,
  Linkedin,
  Loader2,
  MessageCircle,
  MessageSquare,
  Music,
  Pin,
  Search,
  Share2,
  Sparkles,
  Twitter,
  X,
  Youtube,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/common/UpgradeModal";
import { DraftPromotionCard } from "@/components/promotions/DraftPromotionCard";
import { EditPromotionModal } from "@/components/promotions/EditPromotionModal";
import { ManualPromotionForm } from "@/components/promotions/ManualPromotionForm";
import { OpenAIIcon } from "@/components/promotions/OpenAIIcon";
import { PromotionCard } from "@/components/promotions/PromotionCard";
import { PromotionList } from "@/components/promotions/PromotionList";
import { PublishWorkflowModal } from "@/components/promotions/PublishWorkflowModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/CurrentBusinessContext";
import { supabase } from "@/db/supabase";
import {
  deletePromotion,
  draftPromotion,
  generateFeaturedPromotion,
  generateFeaturedPromotionOpenAI,
  getFeaturedPromotion,
  getPromotionsByStatus,
} from "@/services/promotionService";
import {
  addCompetitor,
  completeSocialOauth,
  disconnectSocialPlatform,
  dismissCompetitor,
  fetchCompetitorIntel,
  getCompetitorIntel,
  getCompetitors,
  getSocialConnections,
  requestPlatform,
  type SocialConnectionStatus,
  selectFacebookPage,
  startFacebookConnect,
  startInstagramConnect,
  startWhatsappConnect,
  suggestCompetitors,
} from "@/services/socialService";
import type {
  CompetitorProfile,
  CompetitorSiteIntel,
  Promotion,
} from "@/types/types";

type Tab = "promotions" | "connections" | "competitors";
type PromotionsSubTab = "featured" | "create" | "draft" | "published";

function ConnectionsTab({
  businessId,
  contactPhone,
  refreshKey,
}: {
  businessId: string;
  contactPhone: string | null;
  refreshKey: number;
}) {
  const [connections, setConnections] = useState<SocialConnectionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [igConnectLoading, setIgConnectLoading] = useState(false);
  const [waConnectLoading, setWaConnectLoading] = useState(false);
  const [fbConnectLoading, setFbConnectLoading] = useState(false);
  const [fbSelectingPage, setFbSelectingPage] = useState(false);
  const { business, refetch: refetchBusiness } = useBusiness();

  const load = () => {
    getSocialConnections(businessId)
      .then((result) => {
        setConnections(result);
        const anyConnected = result.some((c) => c.status === "connected");
        if (anyConnected && business && !business.onboarding_milestones?.social_connected) {
          supabase.functions
            .invoke("mark-milestone", { body: { milestone: "social_connected" } })
            .then(() => refetchBusiness());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, refreshKey]);

  const connectionFor = (platform: "instagram" | "whatsapp" | "facebook") =>
    connections.find(
      (c) => c.platform === platform && c.status === "connected",
    );

  function handleConnectInstagram() {
    setIgConnectLoading(true);
    startInstagramConnect(businessId);
  }

  function handleConnectWhatsapp() {
    if (!contactPhone) {
      toast.error(
        "Add your contact phone number in Settings → Business tab first — it's where WhatsApp notifications about your own proposals and invoices will be sent.",
      );
      return;
    }
    setWaConnectLoading(true);
    startWhatsappConnect(businessId);
  }

  function handleConnectFacebook() {
    setFbConnectLoading(true);
    startFacebookConnect(businessId);
  }

  async function handleDisconnect(platform: "instagram" | "whatsapp" | "facebook") {
    try {
      await disconnectSocialPlatform(platform, businessId);
      toast.success(
        `${platform === "instagram" ? "Instagram" : platform === "whatsapp" ? "WhatsApp" : "Facebook"} disconnected`,
      );
      load();
    } catch {
      toast.error("Failed to disconnect");
    }
  }

  async function handleSelectFacebookPage(pageId: string) {
    setFbSelectingPage(true);
    try {
      await selectFacebookPage(businessId, pageId);
      toast.success("Facebook Page connected");
      load();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to connect this Page",
      );
    } finally {
      setFbSelectingPage(false);
    }
  }

  const instagramConnection = connectionFor("instagram");
  const whatsappConnection = connectionFor("whatsapp");
  const facebookConnection = connectionFor("facebook");
  const facebookPending = connections.find(
    (c) => c.platform === "facebook" && c.status === "pending_page_selection",
  );

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <PlatformCard
          icon={<Instagram className="w-6 h-6 text-white" />}
          iconClassName="bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"
          name="Instagram"
          description="Publish AI-drafted posts to your Instagram business account."
          connected={!!instagramConnection}
          connectedLabel={`@${instagramConnection?.extra?.username ?? "connected account"}`}
          loading={igConnectLoading || loading}
          onConnect={handleConnectInstagram}
          onDisconnect={() => handleDisconnect("instagram")}
        />
        <PlatformCard
          icon={<MessageCircle className="w-6 h-6 text-white" />}
          iconClassName="bg-[#25D366]"
          name="WhatsApp"
          description="Send and receive client messages over WhatsApp."
          connected={!!whatsappConnection}
          connectedLabel={
            whatsappConnection?.extra?.display_phone_number ??
            "connected number"
          }
          loading={waConnectLoading || loading}
          onConnect={handleConnectWhatsapp}
          onDisconnect={() => handleDisconnect("whatsapp")}
          warning={
            !contactPhone && !whatsappConnection
              ? "Add a contact phone number in Settings → Business tab first — that's where your own WhatsApp notifications will be sent."
              : undefined
          }
        />
        <PlatformCard
          icon={<Music className="w-6 h-6 text-white" />}
          iconClassName="bg-black"
          name="TikTok"
          description="Publish short-form videos directly to TikTok."
          comingSoon
        />
        <PlatformCard
          icon={<Linkedin className="w-6 h-6 text-white" />}
          iconClassName="bg-[#0A66C2]"
          name="LinkedIn"
          description="Share updates and articles to your LinkedIn page."
          comingSoon
        />
        <PlatformCard
          icon={<Youtube className="w-6 h-6 text-white" />}
          iconClassName="bg-[#FF0000]"
          name="YouTube"
          description="Upload and manage videos on your YouTube channel."
          comingSoon
        />
        <PlatformCard
          icon={<Pin className="w-6 h-6 text-white" />}
          iconClassName="bg-[#E60023]"
          name="Pinterest"
          description="Pin your work to boards and drive traffic from Pinterest."
          comingSoon
        />
        <PlatformCard
          icon={<Twitter className="w-6 h-6 text-white" />}
          iconClassName="bg-black"
          name="X"
          description="Post updates and threads directly to X."
          comingSoon
        />
        <PlatformCard
          icon={<Facebook className="w-6 h-6 text-white" />}
          iconClassName="bg-[#1877F2]"
          name="Facebook"
          description="Publish posts and Reels to your Facebook Page."
          connected={!!facebookConnection}
          connectedLabel={facebookConnection?.extra?.page_name ?? "connected Page"}
          loading={fbConnectLoading || loading}
          onConnect={handleConnectFacebook}
          onDisconnect={() => handleDisconnect("facebook")}
          pending={!!facebookPending}
          pendingContent={
            facebookPending && (
              <div className="w-full space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Choose which Page to connect:
                </p>
                {(facebookPending.extra?.pages ?? []).map((page) => (
                  <Button
                    key={page.id}
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    disabled={fbSelectingPage}
                    onClick={() => handleSelectFacebookPage(page.id)}
                  >
                    {page.name}
                  </Button>
                ))}
              </div>
            )
          }
        />
        <PlatformCard
          icon={<Home className="w-6 h-6 text-white" />}
          iconClassName="bg-[#8ED500]"
          name="Nextdoor"
          description="Reach clients in your local neighborhood on Nextdoor."
          comingSoon
        />
        <PlatformCard
          icon={<MessageSquare className="w-6 h-6 text-white" />}
          iconClassName="bg-[#FF4500]"
          name="Reddit"
          description="Engage with communities and share updates on Reddit."
          comingSoon
        />
        <PlatformCard
          icon={<HelpCircle className="w-6 h-6 text-white" />}
          iconClassName="bg-[#B92B27]"
          name="Quora"
          description="Answer questions and build authority on Quora."
          comingSoon
        />
      </div>
      <RequestPlatformCard />
    </div>
  );
}

function RequestPlatformCard() {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!url.trim()) {
      toast.error("Add the platform's homepage URL first");
      return;
    }
    setSubmitting(true);
    try {
      await requestPlatform(url.trim());
      setSubmitted(true);
      setUrl("");
    } catch {
      toast.error("Couldn't send your request — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-4 rounded-2xl">
      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="font-semibold">
            Don't see your preferred social network? Let us know.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Tell us its homepage URL and we'll consider it for a future
            integration.
          </p>
        </div>
        {submitted ? (
          <p className="text-sm text-success shrink-0">
            Thanks — we've got your request.
          </p>
        ) : (
          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
            <Input
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="sm:w-64"
            />
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Request
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlatformCard({
  icon,
  iconClassName,
  name,
  description,
  connected,
  connectedLabel,
  loading,
  comingSoon,
  warning,
  onConnect,
  onDisconnect,
  pending,
  pendingContent,
}: {
  icon: ReactNode;
  iconClassName: string;
  name: string;
  description: string;
  connected?: boolean;
  connectedLabel?: string;
  loading?: boolean;
  comingSoon?: boolean;
  warning?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  /** True once the OAuth exchange succeeded but a follow-up choice (e.g. which Facebook
   * Page) is still needed before the connection is usable — renders `pendingContent`
   * instead of the normal Connect/Disconnect button. */
  pending?: boolean;
  pendingContent?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-4 ${
        connected ? "border-success/30 bg-success/5" : ""
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconClassName}`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold">{name}</p>
          {connected && (
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
          )}
        </div>
        <p
          className={`text-sm mt-1 ${connected ? "text-success" : "text-muted-foreground"}`}
        >
          {connected ? connectedLabel : description}
        </p>
        {warning && <p className="text-xs text-amber-500 mt-2">⚠ {warning}</p>}
      </div>
      {pending ? (
        pendingContent
      ) : comingSoon ? (
        <Button size="sm" variant="outline" disabled className="w-full">
          Coming Soon
        </Button>
      ) : connected ? (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={onDisconnect}
        >
          Disconnect
        </Button>
      ) : (
        <Button
          size="sm"
          className="w-full"
          onClick={onConnect}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Connect
        </Button>
      )}
    </div>
  );
}

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

function TrackedCompetitorCard({
  competitor,
}: {
  competitor: CompetitorProfile;
}) {
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
      const result = await fetchCompetitorIntel(
        competitor.id,
        websiteUrl.trim(),
      );
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
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={handleFetchIntel}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Get intel"
            )}
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
  const { business } = useBusiness();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("promotions");
  const [promoSubTab, setPromoSubTab] = useState<PromotionsSubTab>("featured");
  const [connectionsRefreshKey, setConnectionsRefreshKey] = useState(0);

  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([]);
  const [candidates, setCandidates] = useState<
    { handle: string; source_url: string }[]
  >([]);
  const [niche, setNiche] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [manualHandle, setManualHandle] = useState("");

  const [featured, setFeatured] = useState<Promotion | null>(null);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [generatingFeatured, setGeneratingFeatured] = useState(false);
  const [generatingFeaturedOpenAI, setGeneratingFeaturedOpenAI] =
    useState(false);
  const [drafts, setDrafts] = useState<Promotion[]>([]);
  const [published, setPublished] = useState<Promotion[]>([]);
  const [publishTarget, setPublishTarget] = useState<Promotion | null>(null);
  const [editTarget, setEditTarget] = useState<Promotion | null>(null);

  const loadFeatured = useCallback(() => {
    if (!business) return;
    setLoadingFeatured(true);
    getFeaturedPromotion(business.id)
      .then(setFeatured)
      .finally(() => setLoadingFeatured(false));
  }, [business]);

  const loadDraftsAndPublished = useCallback(() => {
    if (!business) return;
    getPromotionsByStatus(business.id, "draft").then(setDrafts);
    getPromotionsByStatus(business.id, "published").then(setPublished);
  }, [business]);

  useEffect(() => {
    loadFeatured();
    loadDraftsAndPublished();
    getCompetitors().then((data) =>
      setCompetitors(data.filter((c) => c.status === "tracking")),
    );
  }, [loadFeatured, loadDraftsAndPublished]);

  async function handleGenerateFeatured() {
    setGeneratingFeatured(true);
    try {
      const promotion = await generateFeaturedPromotion();
      setFeatured(promotion);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to generate promotion");
    } finally {
      setGeneratingFeatured(false);
    }
  }

  async function handleGenerateFeaturedOpenAI() {
    setGeneratingFeaturedOpenAI(true);
    try {
      const promotion = await generateFeaturedPromotionOpenAI();
      setFeatured(promotion);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to generate promotion");
    } finally {
      setGeneratingFeaturedOpenAI(false);
    }
  }

  function handlePromotionPublished(id: string, platformPostId: string) {
    void platformPostId;
    if (featured?.id === id) setFeatured(null);
    setDrafts((prev) => prev.filter((p) => p.id !== id));
    loadDraftsAndPublished();
  }

  async function handlePromotionDraft(id: string) {
    try {
      await draftPromotion(id);
      if (featured?.id === id) setFeatured(null);
      loadDraftsAndPublished();
      toast.success("Moved to drafts");
    } catch {
      toast.error("Failed to move to drafts");
    }
  }

  async function handlePromotionDelete(id: string) {
    try {
      await deletePromotion(id);
      if (featured?.id === id) setFeatured(null);
      setDrafts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  // Guards the OAuth code exchange below from firing twice — `business` can
  // change reference more than once while its context loads, and the code in
  // searchParams isn't cleared until the async exchange finishes, so without
  // this a second effect run would race a second exchange against the same
  // single-use OAuth code and both would fail.
  const oauthHandledRef = useRef(false);

  // Handle the Meta OAuth redirect back to this page (?code=&state=platform:business_id) —
  // registered as the redirect_uri for both the Instagram Login and Facebook Login products.
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError =
      searchParams.get("error_description") || searchParams.get("error");
    if (oauthError) {
      toast.error(`Connection failed: ${oauthError}`);
      navigate("/dashboard/social", { replace: true });
      return;
    }
    if (code && state && business) {
      if (oauthHandledRef.current) return;
      oauthHandledRef.current = true;
      const [platform, businessId] = state.split(":") as [
        "instagram" | "whatsapp" | "facebook",
        string,
      ];
      if (businessId !== business.id) {
        navigate("/dashboard/social", { replace: true });
        return;
      }
      const platformLabel =
        platform === "instagram"
          ? "Instagram"
          : platform === "whatsapp"
            ? "WhatsApp"
            : "Facebook";
      completeSocialOauth(platform, code, businessId)
        .then((result) => {
          toast.success(
            result.needsSelection
              ? `Choose which ${platformLabel} Page to connect below`
              : `${platformLabel} connected`,
          );
          setConnectionsRefreshKey((k) => k + 1);
        })
        .catch((err) =>
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to complete connection",
          ),
        )
        .finally(() => navigate("/dashboard/social", { replace: true }));
    }
  }, [business]);

  async function handleSuggest() {
    if (!niche.trim()) {
      toast.error('Describe your niche first (e.g. "wedding photography")');
      return;
    }
    setSuggesting(true);
    try {
      const results = await suggestCompetitors(niche.trim());
      setCandidates(results);
      if (results.length === 0)
        toast.info("No candidates found — try a different niche description");
    } catch {
      toast.error("Failed to suggest competitors");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleConfirmCandidate(candidate: {
    handle: string;
    source_url: string;
  }) {
    try {
      const added = await addCompetitor(candidate.handle, "ai_suggested");
      setCompetitors((prev) => [added, ...prev]);
      setCandidates((prev) =>
        prev.filter((c) => c.handle !== candidate.handle),
      );
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

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">
          Social
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          AI-drafted promotion graphics, captions, and competitor tracking
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b overflow-x-auto">
        {(["promotions", "connections", "competitors"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize whitespace-nowrap ${
              tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "promotions"
              ? "Promotions"
              : t === "connections"
                ? "Connections"
                : "Competitors"}
          </button>
        ))}
      </div>

      {tab === "promotions" && (
        <div className="flex gap-0 border-b overflow-x-auto -mt-2">
          {(["featured", "create", "draft", "published"] as PromotionsSubTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPromoSubTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                promoSubTab === t
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "featured"
                ? "Featured"
                : t === "create"
                  ? "+ Create"
                  : t === "draft"
                    ? "Draft"
                    : "Published"}
            </button>
          ))}
        </div>
      )}

      {tab === "promotions" && promoSubTab === "featured" && (
        <div className="space-y-4">
          {loadingFeatured ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : featured ? (
            <PromotionCard
              promotion={featured}
              onChange={setFeatured}
              onPublish={setPublishTarget}
              onDelete={handlePromotionDelete}
              onDraft={handlePromotionDraft}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <Share2 className="w-8 h-8 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground max-w-md">
                  No more Featured promotions for Today.
                </p>
                <div className="flex flex-wrap items-start justify-center gap-4">
                  <div className="flex flex-col items-center gap-1.5">
                    <Button
                      onClick={handleGenerateFeatured}
                      disabled={generatingFeatured || generatingFeaturedOpenAI}
                    >
                      {generatingFeatured ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      {generatingFeatured ? "Generating…" : "Generate with AI"}
                    </Button>
                    <p className="text-xs text-emerald-600">
                      ~$0.001 · text + template render
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <Button
                      variant="outline"
                      onClick={handleGenerateFeaturedOpenAI}
                      disabled={generatingFeatured || generatingFeaturedOpenAI}
                    >
                      {generatingFeaturedOpenAI ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <OpenAIIcon className="w-4 h-4 mr-2" />
                      )}
                      {generatingFeaturedOpenAI
                        ? "Generating…"
                        : "Generate with OpenAI"}
                    </Button>
                    <p className="text-xs text-amber-600">
                      ~$0.05 · gpt-image-2 diffusion image + Reel video
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setPromoSubTab("draft")}
                >
                  Go to Drafts
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "promotions" && promoSubTab === "create" && (
        <ManualPromotionForm
          onCreated={(promotion) => {
            setPromoSubTab("draft");
            setDrafts((prev) => [promotion, ...prev]);
          }}
        />
      )}

      {tab === "promotions" && promoSubTab === "draft" && (
        <div className="space-y-3">
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No drafts yet.
            </p>
          ) : (
            drafts.map((promotion) => (
              <DraftPromotionCard
                key={promotion.id}
                promotion={promotion}
                onPublish={setPublishTarget}
                onEdit={setEditTarget}
                onDelete={handlePromotionDelete}
              />
            ))
          )}
        </div>
      )}

      {tab === "promotions" && promoSubTab === "published" && (
        <PromotionList
          promotions={published}
          emptyLabel="No published promotions yet."
        />
      )}

      {tab === "connections" && business && (
        <ConnectionsTab
          businessId={business.id}
          contactPhone={business.contact_phone ?? null}
          refreshKey={connectionsRefreshKey}
        />
      )}

      <PublishWorkflowModal
        promotion={publishTarget}
        onOpenChange={(open) => {
          if (!open) setPublishTarget(null);
        }}
        onPublished={(id, platformPostId) => {
          handlePromotionPublished(id, platformPostId);
          setPublishTarget(null);
        }}
      />

      <EditPromotionModal
        promotion={editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onChange={(updated) => {
          setDrafts((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p)),
          );
          setEditTarget(null);
        }}
        onApproveAndPublish={(updated) => {
          setEditTarget(null);
          setPublishTarget(updated);
        }}
      />

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
                Candidates come from a live web search, not AI guesswork —
                confirm the ones that look right before tracking them.
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
        <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">
          Promotions
        </h1>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
            <Share2 className="w-8 h-8 text-accent" />
          </div>
          <p className="text-muted-foreground max-w-md text-pretty">
            {message}
          </p>
          {showUpgradeCta && (
            <Button onClick={() => setShowUpgradeModal(true)}>
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Agency
            </Button>
          )}
        </CardContent>
      </Card>
      {showUpgradeCta && (
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
        />
      )}
    </div>
  );
}

export default function SocialPage() {
  const { isAgency } = useAuth();
  const { isLoading } = useBusiness();

  if (isLoading) return null;

  if (!isAgency) {
    return (
      <SocialLocked
        message="AI-drafted promotions and competitor tracking are an agency-tier feature."
        showUpgradeCta
      />
    );
  }

  return <SocialWorkspace />;
}
