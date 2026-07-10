import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  GripVertical,
  Image,
  Link2,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBusiness } from "@/contexts/CurrentBusinessContext";
import { supabase } from "@/db/supabase";
import { buildPortfolioUrl, displayPortfolioUrl } from "@/lib/portfolioUrl";
import { cn } from "@/lib/utils";
import { getProjects } from "@/services/projectService";
import type { Project } from "@/types/types";

type MainTab = "preview" | "sections" | "work" | "share";
type QrColorChoice = "brand" | "dark" | "black";
type SectionType = "text" | "text_image" | "banner" | "links";
type BannerColor = "info" | "warning" | "closed";

interface PortalSection {
  id: string;
  section_type: SectionType;
  position: number;
  title: string | null;
  body: string | null;
  image_url: string | null;
  banner_color: BannerColor | null;
  links: { label: string; url: string }[] | null;
  is_active: boolean;
}

interface WorkSample {
  id: string;
  title: string | null;
  image_url: string;
  sort_order: number;
  project_id: string | null;
}

interface SectionForm {
  section_type: SectionType;
  title: string;
  body: string;
  image_url: string;
  banner_color: BannerColor;
  links: { label: string; url: string }[];
}

const EMPTY_SECTION: SectionForm = {
  section_type: "text",
  title: "",
  body: "",
  image_url: "",
  banner_color: "info",
  links: [],
};

const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  text: "Text",
  text_image: "Text + Image",
  banner: "Banner",
  links: "Links",
};

const BANNER_COLOR_LABELS: Record<BannerColor, string> = {
  info: "Info (blue)",
  warning: "Warning (amber)",
  closed: "Closed (red)",
};

function getLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getSafeQrColor(hex: string): string {
  return getLuminance(hex) > 0.4 ? "#1a1a1a" : hex;
}

function generateVcf(
  name: string,
  portfolioUrl: string,
  tagline?: string,
  email?: string | null,
  phone?: string | null,
): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `ORG:${name}`,
    `URL:${portfolioUrl}`,
  ];
  if (tagline) lines.push(`NOTE:${tagline}`);
  if (email) lines.push(`EMAIL:${email}`);
  if (phone) lines.push(`TEL:${phone}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function downloadBlob(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ShareRow({
  label,
  icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border/40">{children}</div>
      )}
    </div>
  );
}

function SortableWorkItem({
  sample,
  onRemove,
}: {
  sample: WorkSample;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sample.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-xl border bg-card"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
        <img
          src={sample.image_url}
          alt={sample.title ?? ""}
          className="w-full h-full object-cover"
        />
      </div>
      <p className="flex-1 text-sm font-medium truncate">
        {sample.title ?? "Untitled"}
      </p>
      <button
        type="button"
        onClick={() => onRemove(sample.id)}
        className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function PortfolioPage() {
  const { business, extractedData, refetch } = useBusiness();

  const [tab, setTab] = useState<MainTab>("preview");
  const [openRow, setOpenRow] = useState<"link" | "qr" | "wallet" | null>(
    "link",
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeResizeObserverRef = useRef<ResizeObserver | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeHeight, setIframeHeight] = useState(0);

  useEffect(() => {
    return () => iframeResizeObserverRef.current?.disconnect();
  }, []);
  const [copied, setCopied] = useState(false);
  const [qrColorChoice, setQrColorChoice] = useState<QrColorChoice>("brand");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrPassDataUrl, setQrPassDataUrl] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);

  // ── Portal sections state ──────────────────────────────────────────────────
  const [portalSections, setPortalSections] = useState<PortalSection[]>([]);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<PortalSection | null>(null);
  const [sectionForm, setSectionForm] = useState<SectionForm>(EMPTY_SECTION);
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionImageUploading, setSectionImageUploading] = useState(false);
  const sectionImageRef = useRef<HTMLInputElement>(null);

  // ── Work samples state ─────────────────────────────────────────────────────
  const [workSamples, setWorkSamples] = useState<WorkSample[]>([]);
  const [workModalOpen, setWorkModalOpen] = useState(false);
  const [workMode, setWorkMode] = useState<"project" | "direct">("direct");
  const [workTitle, setWorkTitle] = useState("");
  const [workImageUrl, setWorkImageUrl] = useState("");
  const [workProjectId, setWorkProjectId] = useState<string | null>(null);
  const [workImageUploading, setWorkImageUploading] = useState(false);
  const [workSaving, setWorkSaving] = useState(false);
  const [completedProjects, setCompletedProjects] = useState<Project[]>([]);
  const workImageRef = useRef<HTMLInputElement>(null);

  // ── Portfolio URL (slug) editor state ──────────────────────────────────────
  const [slugInput, setSlugInput] = useState("");
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const checkSlugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const identity = extractedData?.identity;
  const bizName =
    identity?.businessName ?? identity?.name ?? business?.name ?? "My Business";
  const tagline = identity?.tagline;
  const brandPrimary =
    business?.extracted_data?.brand?.primaryColor ?? "#10B981";
  const contactEmail = business?.contact_email ?? null;
  const contactPhone = business?.contact_phone ?? null;

  const slug = business?.slug ?? "";
  // Share URL uses subdomain in prod; iframe preview always uses same-origin path
  const portfolioUrl = slug ? buildPortfolioUrl(slug) : "";
  const iframeUrl = slug ? `${window.location.origin}/p/${slug}` : "";
  const displayUrl = slug ? displayPortfolioUrl(slug) : "";
  const initials = bizName.slice(0, 2).toUpperCase();
  const passTextColor =
    getLuminance(brandPrimary) > 0.5 ? "#000000" : "#ffffff";

  const resolvedQrColor = useMemo(() => {
    if (qrColorChoice === "black") return "#000000";
    if (qrColorChoice === "dark") return "#1a1a1a";
    return getSafeQrColor(brandPrimary);
  }, [qrColorChoice, brandPrimary]);

  useEffect(() => {
    if (!slug) return;
    QRCode.toDataURL(portfolioUrl, {
      width: 400,
      margin: 2,
      color: { dark: resolvedQrColor, light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [portfolioUrl, resolvedQrColor, slug]);

  useEffect(() => {
    if (!slug) return;
    QRCode.toDataURL(portfolioUrl, {
      width: 80,
      margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
    })
      .then(setQrPassDataUrl)
      .catch(() => {});
  }, [portfolioUrl, slug]);

  // ── Sync slug input when business loads ────────────────────────────────────
  useEffect(() => {
    if (business?.slug) setSlugInput(business.slug);
  }, [business?.slug]);

  // ── Load portal sections ───────────────────────────────────────────────────
  useEffect(() => {
    if (!business) return;
    supabase
      .from("portal_sections")
      .select("*")
      .eq("business_id", business.id)
      .order("position")
      .then(({ data }) => {
        if (data) setPortalSections(data as PortalSection[]);
      });
  }, [business?.id]);

  // ── Load work samples ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!business) return;
    supabase
      .from("work_samples")
      .select("id, title, image_url, sort_order, project_id")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data) setWorkSamples(data as WorkSample[]);
      });
  }, [business?.id]);

  // ── Load completed projects (lazy, when Work tab opens) ────────────────────
  useEffect(() => {
    if (tab !== "work" || completedProjects.length > 0) return;
    getProjects().then((projects) => {
      setCompletedProjects(projects.filter((p) => p.status === "completed"));
    });
  }, [tab, completedProjects.length]);

  const copyLink = () => {
    navigator.clipboard.writeText(portfolioUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareEmail = () => {
    const subject = encodeURIComponent(`${bizName} — Portfolio`);
    const body = encodeURIComponent(`Check out my portfolio:\n${portfolioUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareMessage = () => {
    if (navigator.share) {
      navigator.share({ title: bizName, url: portfolioUrl }).catch(() => {});
    } else {
      window.open(
        `sms:?body=${encodeURIComponent(`Check out my portfolio: ${portfolioUrl}`)}`,
      );
    }
  };

  const downloadQR = () => {
    if (qrDataUrl) downloadBlob(qrDataUrl, "image/png", `${slug}-qr.png`);
  };

  const saveContact = () => {
    downloadBlob(
      generateVcf(bizName, portfolioUrl, tagline, contactEmail, contactPhone),
      "text/vcard",
      `${slug}.vcf`,
    );
    toast.success("Contact file downloaded");
  };

  const addToWallet = async () => {
    setWalletLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/generate-wallet-pass`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({ slug }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}.pkpass`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        `Couldn't generate pass: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setWalletLoading(false);
    }
  };

  // ── Slug editor ────────────────────────────────────────────────────────────

  const RESERVED_SLUGS = new Set(['www', 'api', 'app', 'admin', 'mail', 'cdn', 'dev', 'beta',
    'portal', 'blog', 'help', 'support', 'dashboard', 'login', 'signup', 'forgefly', 'p'])

  function validateSlugFormat(s: string): string | null {
    if (s.length < 3) return 'Min 3 characters'
    if (s.length > 30) return 'Max 30 characters'
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s)) return 'Lowercase letters, numbers, hyphens only'
    if (RESERVED_SLUGS.has(s)) return 'This name is reserved'
    return null
  }

  function handleSlugChange(val: string) {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSlugInput(clean)
    setSlugAvailable(null)
    const err = validateSlugFormat(clean)
    setSlugError(err)
    if (err || clean === slug) return
    if (checkSlugDebounceRef.current) clearTimeout(checkSlugDebounceRef.current)
    setSlugChecking(true)
    checkSlugDebounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('businesses').select('id').eq('slug', clean).neq('id', business!.id).maybeSingle()
      setSlugAvailable(!data)
      setSlugChecking(false)
    }, 600)
  }

  async function saveSlug() {
    if (!business || !slugInput || slugInput === slug) return
    setSlugSaving(true)
    try {
      const { error } = await supabase.from('businesses').update({ slug: slugInput }).eq('id', business.id)
      if (error) throw error
      await refetch()
      toast.success('Portfolio URL updated')
    } catch {
      toast.error('Failed to save URL')
    } finally {
      setSlugSaving(false)
    }
  }

  const slugChanged = slugInput !== slug;
  const slugValid = !validateSlugFormat(slugInput);
  const slugSaveEnabled = slugChanged && slugValid && slugAvailable === true && !slugChecking && !slugSaving;

  // ── Portal section CRUD ────────────────────────────────────────────────────

  function openAddSection() {
    setEditingSection(null);
    setSectionForm(EMPTY_SECTION);
    setSectionModalOpen(true);
  }

  function openEditSection(section: PortalSection) {
    setEditingSection(section);
    setSectionForm({
      section_type: section.section_type,
      title: section.title ?? "",
      body: section.body ?? "",
      image_url: section.image_url ?? "",
      banner_color: section.banner_color ?? "info",
      links: section.links ?? [],
    });
    setSectionModalOpen(true);
  }

  async function uploadSectionImage(file: File): Promise<string> {
    const ext = file.name.split(".").pop();
    const filename = `sections/${business!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("work-samples")
      .upload(filename, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("work-samples").getPublicUrl(filename);
    return data.publicUrl;
  }

  async function handleSectionImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSectionImageUploading(true);
    try {
      const url = await uploadSectionImage(file);
      setSectionForm((f) => ({ ...f, image_url: url }));
    } catch {
      toast.error("Image upload failed");
    } finally {
      setSectionImageUploading(false);
    }
  }

  async function saveSection() {
    if (!business) return;
    setSectionSaving(true);
    try {
      const position = editingSection
        ? editingSection.position
        : portalSections.length + 1;

      const payload = {
        business_id: business.id,
        section_type: sectionForm.section_type,
        position,
        title: sectionForm.title.trim() || null,
        body: sectionForm.body.trim() || null,
        image_url: sectionForm.section_type === "text_image" ? (sectionForm.image_url || null) : null,
        banner_color: sectionForm.section_type === "banner" ? sectionForm.banner_color : null,
        links: sectionForm.section_type === "links" ? sectionForm.links : null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (editingSection) {
        const { error } = await supabase
          .from("portal_sections")
          .update(payload)
          .eq("id", editingSection.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("portal_sections")
          .insert(payload);
        if (error) throw error;
      }

      const { data } = await supabase
        .from("portal_sections")
        .select("*")
        .eq("business_id", business.id)
        .order("position");
      if (data) setPortalSections(data as PortalSection[]);
      setSectionModalOpen(false);
      toast.success(editingSection ? "Section updated" : "Section added");
    } catch {
      toast.error("Failed to save section");
    } finally {
      setSectionSaving(false);
    }
  }

  async function deleteSection(id: string) {
    await supabase.from("portal_sections").delete().eq("id", id);
    setPortalSections((prev) => prev.filter((s) => s.id !== id));
    toast.success("Section removed");
  }

  // ── Work sample CRUD ───────────────────────────────────────────────────────

  const dndSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWorkSamples((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id);
      const newIdx = prev.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);
      reordered.forEach((s, i) => {
        supabase.from("work_samples").update({ sort_order: i }).eq("id", s.id);
      });
      return reordered;
    });
  }

  function openAddWork(mode: "direct" | "project" = "direct") {
    setWorkMode(mode);
    setWorkTitle("");
    setWorkImageUrl("");
    setWorkProjectId(null);
    setWorkModalOpen(true);
  }

  async function uploadWorkImage(file: File): Promise<string> {
    const ext = file.name.split(".").pop();
    const filename = `${business!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("work-samples")
      .upload(filename, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("work-samples").getPublicUrl(filename);
    return data.publicUrl;
  }

  async function handleWorkImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setWorkImageUploading(true);
    try {
      const url = await uploadWorkImage(file);
      setWorkImageUrl(url);
    } catch {
      toast.error("Image upload failed");
    } finally {
      setWorkImageUploading(false);
    }
  }

  function handleProjectSelect(project: Project) {
    setWorkProjectId(project.id);
    setWorkTitle(project.name);
  }

  async function saveWorkSample() {
    if (!business) return;
    if (!workImageUrl) {
      toast.error("Please upload an image");
      return;
    }
    if (!workTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    const activeCount = workSamples.length;
    if (activeCount >= 5) {
      toast.error("Maximum 5 work samples");
      return;
    }

    setWorkSaving(true);
    try {
      const { error } = await supabase.from("work_samples").insert({
        business_id: business.id,
        project_id: workProjectId,
        title: workTitle.trim(),
        image_url: workImageUrl,
        sort_order: activeCount,
        is_active: true,
      });
      if (error) throw error;

      const { data } = await supabase
        .from("work_samples")
        .select("id, title, image_url, sort_order, project_id")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("sort_order");
      if (data) setWorkSamples(data as WorkSample[]);
      setWorkModalOpen(false);
      toast.success("Work sample added");
    } catch {
      toast.error("Failed to save");
    } finally {
      setWorkSaving(false);
    }
  }

  async function removeWorkSample(id: string) {
    await supabase
      .from("work_samples")
      .update({ is_active: false })
      .eq("id", id);
    setWorkSamples((prev) => prev.filter((s) => s.id !== id));
  }

  const COLOR_OPTIONS: { id: QrColorChoice; hex: string; label: string }[] = [
    { id: "brand", hex: getSafeQrColor(brandPrimary), label: "Brand" },
    { id: "dark", hex: "#1a1a1a", label: "Dark" },
    { id: "black", hex: "#000000", label: "Black" },
  ];

  if (!slug) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No public portfolio yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">{bizName}</h1>
          <p className="text-sm text-muted-foreground">
            {tagline ?? "Your public portfolio"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => window.open(portfolioUrl, "_blank", "noopener")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open full page
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 p-0.5 bg-muted rounded-lg mb-5 w-fit flex-wrap">
        {(["preview", "sections", "work", "share"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-5 py-1.5 text-sm font-medium rounded-md transition-colors capitalize",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "preview" ? "Preview" : t === "sections" ? "Portal" : t === "work" ? "Work" : "Share"}
          </button>
        ))}
      </div>

      {/* ── Preview tab ── */}
      {tab === "preview" && (
        <div className="rounded-xl overflow-hidden border border-border/40">
          {iframeLoading && (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60 animate-spin" />
              <p className="text-xs text-muted-foreground">Loading…</p>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={iframeUrl}
            title="Portfolio preview"
            scrolling="no"
            onLoad={() => {
              setIframeLoading(false);
              iframeResizeObserverRef.current?.disconnect();
              try {
                const doc = iframeRef.current?.contentDocument;
                const target = doc?.documentElement;
                if (doc && target) {
                  const updateHeight = () =>
                    setIframeHeight(
                      target.scrollHeight || doc.body.scrollHeight,
                    );
                  updateHeight();
                  const observer = new ResizeObserver(updateHeight);
                  observer.observe(target);
                  iframeResizeObserverRef.current = observer;
                } else {
                  setIframeHeight(800);
                }
              } catch {
                setIframeHeight(800);
              }
            }}
            style={{
              width: "100%",
              height: iframeHeight > 0 ? iframeHeight : undefined,
              display: iframeLoading ? "none" : "block",
              border: "none",
            }}
          />
        </div>
      )}

      {/* ── Portal (sections) tab ── */}
      {tab === "sections" && (
        <div className="max-w-2xl space-y-4">

          {/* Slug editor */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Portfolio URL</CardTitle>
              <CardDescription>
                Your public portfolio address — must be unique across all Forgefly users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {slug && (
                <p className="text-xs text-muted-foreground font-mono bg-muted/40 rounded-md px-3 py-2">
                  {displayPortfolioUrl(slug)}
                </p>
              )}
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <div className="relative">
                    <Input
                      value={slugInput}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="your-url-name"
                      className="h-9 text-sm pr-8 font-mono"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      {slugChecking && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      {!slugChecking && slugChanged && slugValid && slugAvailable === true && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                      {!slugChecking && slugChanged && slugValid && slugAvailable === false && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                    </div>
                  </div>
                  {slugError && <p className="text-[11px] text-destructive">{slugError}</p>}
                  {!slugError && slugChanged && slugValid && slugAvailable === false && (
                    <p className="text-[11px] text-destructive">Already taken — try a different name</p>
                  )}
                  {!slugError && slugChanged && slugValid && slugAvailable === true && (
                    <p className="text-[11px] text-emerald-600">Available</p>
                  )}
                </div>
                <Button
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={saveSlug}
                  disabled={!slugSaveEnabled}
                >
                  {slugSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Lowercase letters, numbers, and hyphens only · 3–30 characters
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Add up to 2 custom sections to your public portfolio page.
                Both appear above your services section, after your bio.
              </p>
            </div>
            <Button
              size="sm"
              onClick={openAddSection}
              disabled={portalSections.length >= 2}
              className="shrink-0 ml-4"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add section
            </Button>
          </div>

          {portalSections.length === 0 ? (
            <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground text-sm">
              No custom sections yet. Add one to personalise your portfolio.
            </div>
          ) : (
            <div className="space-y-3">
              {portalSections.map((section) => (
                <div
                  key={section.id}
                  className="flex items-start gap-4 p-4 rounded-xl border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Position {section.position}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {SECTION_TYPE_LABELS[section.section_type]}
                      </span>
                    </div>
                    {section.title && (
                      <p className="text-sm font-medium truncate">
                        {section.title}
                      </p>
                    )}
                    {section.body && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {section.body}
                      </p>
                    )}
                    {section.section_type === "banner" &&
                      section.banner_color && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {BANNER_COLOR_LABELS[section.banner_color]}
                        </p>
                      )}
                    {section.section_type === "links" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(section.links ?? []).length} link
                        {(section.links ?? []).length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => openEditSection(section)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteSection(section.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Section editor modal */}
          <Dialog
            open={sectionModalOpen}
            onOpenChange={setSectionModalOpen}
          >
            {sectionModalOpen && (
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingSection ? "Edit section" : "Add section"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Type selector */}
                  {!editingSection && (
                    <div className="space-y-1.5">
                      <Label>Section type</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            "text",
                            "text_image",
                            "banner",
                            "links",
                          ] as SectionType[]
                        ).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() =>
                              setSectionForm((f) => ({
                                ...f,
                                section_type: t,
                              }))
                            }
                            className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                              sectionForm.section_type === t
                                ? "border-foreground bg-foreground/5 font-medium"
                                : "border-border text-muted-foreground hover:border-foreground/40"
                            }`}
                          >
                            {SECTION_TYPE_LABELS[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Title (all types except banner) */}
                  {sectionForm.section_type !== "banner" && (
                    <div className="space-y-1.5">
                      <Label>
                        Title{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        value={sectionForm.title}
                        onChange={(e) =>
                          setSectionForm((f) => ({
                            ...f,
                            title: e.target.value,
                          }))
                        }
                        placeholder="Section heading…"
                      />
                    </div>
                  )}

                  {/* Body (text, text_image, banner) */}
                  {sectionForm.section_type !== "links" && (
                    <div className="space-y-1.5">
                      <Label>
                        {sectionForm.section_type === "banner"
                          ? "Banner text"
                          : "Body"}
                      </Label>
                      <Textarea
                        value={sectionForm.body}
                        onChange={(e) =>
                          setSectionForm((f) => ({
                            ...f,
                            body: e.target.value,
                          }))
                        }
                        placeholder={
                          sectionForm.section_type === "banner"
                            ? "Short message shown in the banner…"
                            : "Write your content here…"
                        }
                        rows={sectionForm.section_type === "banner" ? 2 : 4}
                        className="resize-none text-sm"
                      />
                    </div>
                  )}

                  {/* Image upload (text_image) */}
                  {sectionForm.section_type === "text_image" && (
                    <div className="space-y-1.5">
                      <Label>Image</Label>
                      {sectionForm.image_url ? (
                        <div className="relative w-40 h-28 rounded-lg overflow-hidden border group">
                          <img
                            src={sectionForm.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setSectionForm((f) => ({
                                ...f,
                                image_url: "",
                              }))
                            }
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => sectionImageRef.current?.click()}
                          disabled={sectionImageUploading}
                          className="flex flex-col items-center justify-center gap-2 w-full h-24 border border-dashed rounded-lg text-sm text-muted-foreground hover:border-foreground/40 transition-colors disabled:opacity-60"
                        >
                          <Image className="w-5 h-5" />
                          {sectionImageUploading
                            ? "Uploading…"
                            : "Click to upload image"}
                        </button>
                      )}
                      <input
                        ref={sectionImageRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleSectionImageUpload}
                      />
                    </div>
                  )}

                  {/* Banner color (banner) */}
                  {sectionForm.section_type === "banner" && (
                    <div className="space-y-1.5">
                      <Label>Color</Label>
                      <div className="flex gap-2">
                        {(
                          ["info", "warning", "closed"] as BannerColor[]
                        ).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() =>
                              setSectionForm((f) => ({
                                ...f,
                                banner_color: c,
                              }))
                            }
                            className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              sectionForm.banner_color === c
                                ? c === "info"
                                  ? "bg-blue-50 text-blue-700 border-blue-300"
                                  : c === "warning"
                                    ? "bg-amber-50 text-amber-700 border-amber-300"
                                    : "bg-red-50 text-red-700 border-red-300"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {c === "info"
                              ? "Info"
                              : c === "warning"
                                ? "Warning"
                                : "Closed"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Links editor (links) */}
                  {sectionForm.section_type === "links" && (
                    <div className="space-y-2">
                      <Label>Links</Label>
                      {sectionForm.links.map((link, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <Input
                            value={link.label}
                            onChange={(e) =>
                              setSectionForm((f) => {
                                const links = [...f.links];
                                links[i] = {
                                  ...links[i],
                                  label: e.target.value,
                                };
                                return { ...f, links };
                              })
                            }
                            placeholder="Label"
                            className="h-8 text-sm flex-1"
                          />
                          <Input
                            value={link.url}
                            onChange={(e) =>
                              setSectionForm((f) => {
                                const links = [...f.links];
                                links[i] = {
                                  ...links[i],
                                  url: e.target.value,
                                };
                                return { ...f, links };
                              })
                            }
                            placeholder="https://…"
                            className="h-8 text-sm flex-1"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setSectionForm((f) => ({
                                ...f,
                                links: f.links.filter((_, j) => j !== i),
                              }))
                            }
                            className="text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() =>
                          setSectionForm((f) => ({
                            ...f,
                            links: [...f.links, { label: "", url: "" }],
                          }))
                      }
                      >
                        <Plus className="w-3 h-3" />
                        Add link
                      </Button>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setSectionModalOpen(false)}
                    disabled={sectionSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={saveSection} disabled={sectionSaving}>
                    {sectionSaving ? "Saving…" : "Save section"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            )}
          </Dialog>
        </div>
      )}

      {/* ── Work tab ── */}
      {tab === "work" && (
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Up to 5 work samples shown on your portfolio. Drag to reorder.
            </p>
            <div className="flex gap-2 shrink-0 ml-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openAddWork("project")}
                disabled={workSamples.length >= 5}
                className="text-xs"
              >
                From project
              </Button>
              <Button
                size="sm"
                onClick={() => openAddWork("direct")}
                disabled={workSamples.length >= 5}
              >
                <Plus className="w-4 h-4 mr-1" />
                Upload
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {workSamples.length} / 5 samples
          </p>

          {workSamples.length === 0 ? (
            <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground text-sm">
              No work samples yet. Add some to showcase your best work.
            </div>
          ) : (
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={workSamples.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {workSamples.map((sample) => (
                    <SortableWorkItem
                      key={sample.id}
                      sample={sample}
                      onRemove={removeWorkSample}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Work sample modal */}
          <Dialog open={workModalOpen} onOpenChange={setWorkModalOpen}>
            {workModalOpen && (
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add work sample</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Mode toggle */}
                  <div className="flex gap-1 p-1 bg-muted rounded-lg">
                    {(["direct", "project"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setWorkMode(m);
                          setWorkProjectId(null);
                          setWorkTitle("");
                        }}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          workMode === m
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {m === "direct" ? "Direct upload" : "From project"}
                      </button>
                    ))}
                  </div>

                  {/* Project picker */}
                  {workMode === "project" && (
                    <div className="space-y-1.5">
                      <Label>Completed project</Label>
                      {completedProjects.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          No completed projects found.
                        </p>
                      ) : (
                        <div className="max-h-36 overflow-y-auto space-y-1 border rounded-lg p-1">
                          {completedProjects.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleProjectSelect(p)}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                workProjectId === p.id
                                  ? "bg-foreground/10 font-medium"
                                  : "hover:bg-muted"
                              }`}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Image upload */}
                  <div className="space-y-1.5">
                    <Label>Image</Label>
                    {workImageUrl ? (
                      <div className="relative w-full h-36 rounded-lg overflow-hidden border group">
                        <img
                          src={workImageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setWorkImageUrl("")}
                          className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => workImageRef.current?.click()}
                        disabled={workImageUploading}
                        className="flex flex-col items-center justify-center gap-2 w-full h-32 border border-dashed rounded-lg text-sm text-muted-foreground hover:border-foreground/40 transition-colors disabled:opacity-60"
                      >
                        <Image className="w-5 h-5" />
                        {workImageUploading
                          ? "Uploading…"
                          : "Click to upload (JPG, PNG, WebP · max 5 MB)"}
                      </button>
                    )}
                    <input
                      ref={workImageRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleWorkImageUpload}
                    />
                  </div>

                  {/* Title */}
                  <div className="space-y-1.5">
                    <Label>Title *</Label>
                    <Input
                      value={workTitle}
                      onChange={(e) => setWorkTitle(e.target.value)}
                      placeholder="e.g., Brand identity for Acme Co."
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setWorkModalOpen(false)}
                    disabled={workSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveWorkSample}
                    disabled={
                      workSaving ||
                      !workImageUrl ||
                      !workTitle.trim() ||
                      workImageUploading
                    }
                  >
                    {workSaving ? "Saving…" : "Add sample"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            )}
          </Dialog>
        </div>
      )}

      {/* ── Share tab ── */}
      {tab === "share" && (
        <div className="flex flex-col gap-3 max-w-2xl">
          {/* Row 1 — Share link */}
          <ShareRow
            label="Share link"
            icon={<Link2 className="h-4 w-4" />}
            open={openRow === "link"}
            onToggle={() => setOpenRow(openRow === "link" ? null : "link")}
          >
            <div className="pt-3 flex flex-col gap-3">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-muted rounded-lg border border-border/60">
                <span className="text-xs font-mono text-foreground flex-1 truncate select-all">
                  {displayUrl}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 shrink-0"
                  onClick={copyLink}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-muted/50 hover:bg-muted border border-border/50 transition-colors text-sm text-muted-foreground"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Copy
                </button>
                <button
                  type="button"
                  onClick={shareEmail}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-muted/50 hover:bg-muted border border-border/50 transition-colors text-sm text-muted-foreground"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={shareMessage}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-muted/50 hover:bg-muted border border-border/50 transition-colors text-sm text-muted-foreground"
                >
                  <MessageSquare className="h-4 w-4" />
                  Message
                </button>
              </div>
            </div>
          </ShareRow>

          {/* Row 2 — QR Code */}
          <ShareRow
            label="QR Code"
            icon={<Download className="h-4 w-4" />}
            open={openRow === "qr"}
            onToggle={() => setOpenRow(openRow === "qr" ? null : "qr")}
          >
            <div className="pt-3 flex gap-5 items-start">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-border/40 shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR code"
                    width={120}
                    height={120}
                    className="block"
                  />
                ) : (
                  <div className="w-[120px] h-[120px] flex items-center justify-center text-xs text-muted-foreground">
                    Generating…
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 flex-1 min-w-0">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Color
                  </p>
                  <div className="flex gap-2 items-center">
                    {COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setQrColorChoice(opt.id)}
                        title={opt.label}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-all",
                          qrColorChoice === opt.id
                            ? "scale-110 border-foreground"
                            : "border-transparent hover:border-foreground/40",
                        )}
                        style={{ backgroundColor: opt.hex }}
                      />
                    ))}
                    <span className="text-[11px] text-muted-foreground ml-1">
                      {COLOR_OPTIONS.find((o) => o.id === qrColorChoice)?.label}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {displayUrl}
                </p>
                <Button
                  size="sm"
                  onClick={downloadQR}
                  disabled={!qrDataUrl}
                  className="w-full gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PNG
                </Button>
              </div>
            </div>
          </ShareRow>

          {/* Row 3 — Wallet Pass */}
          <ShareRow
            label="Wallet Pass"
            icon={<Wallet className="h-4 w-4" />}
            open={openRow === "wallet"}
            onToggle={() => setOpenRow(openRow === "wallet" ? null : "wallet")}
          >
            <div className="pt-3 flex gap-5 items-start">
              {/* Pass card preview */}
              <div
                className="rounded-2xl p-4 flex flex-col gap-2 shadow-md shrink-0 w-48"
                style={{ backgroundColor: brandPrimary, color: passTextColor }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold mb-2"
                      style={{
                        backgroundColor: `${passTextColor}20`,
                        color: passTextColor,
                      }}
                    >
                      {initials}
                    </div>
                    <p className="font-bold text-sm leading-snug">{bizName}</p>
                    {tagline && (
                      <p
                        className="text-[10px] mt-0.5 leading-snug"
                        style={{ opacity: 0.75 }}
                      >
                        {tagline}
                      </p>
                    )}
                  </div>
                  {qrPassDataUrl && (
                    <img
                      src={qrPassDataUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded-md shrink-0 mt-1"
                    />
                  )}
                </div>
                <p
                  className="text-[9px] font-mono mt-1"
                  style={{ opacity: 0.6 }}
                >
                  {displayUrl}
                </p>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <Button
                  onClick={addToWallet}
                  disabled={walletLoading}
                  size="sm"
                  className="w-full gap-2"
                  style={{ backgroundColor: brandPrimary }}
                >
                  {walletLoading ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <Wallet className="h-3.5 w-3.5" />
                  )}
                  {walletLoading ? "Generating…" : "Add to Apple Wallet"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveContact}
                  className="w-full gap-2"
                >
                  <Download className="h-3.5 w-3.5" />
                  Save contact (.vcf)
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Uses your brand color.
                </p>
              </div>
            </div>
          </ShareRow>
        </div>
      )}
    </div>
  );
}
