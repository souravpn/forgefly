import QRCode from "qrcode";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Download,
  Globe,
  GripVertical,
  Image,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { getProjects } from "@/services/projectService";
import type { Project } from "@/types/types";
import { buildPortfolioUrl, displayPortfolioUrl } from "@/lib/portfolioUrl";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "brand" | "portal" | "work";
type SectionType = "text" | "text_image" | "banner" | "links";
type BannerColor = "info" | "warning" | "closed";

interface BrandData {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  ctaColor?: string;
  tone?: string;
  keywords?: string[];
  fonts?: { heading?: string; body?: string };
  businessIconUrl?: string;
  headerCoverUrl?: string;
  portalBgUrl?: string;
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidHex(hex: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

const FONT_PAIRS = [
  { id: 'clean-modern',     name: 'Clean & modern',     heading: 'Inter',              body: 'Inter',             bestFor: 'SaaS, tech, dev agencies',       headingStyle: { fontFamily: 'sans-serif', fontWeight: 500 as const },                              bodyStyle: { fontFamily: 'sans-serif' } },
  { id: 'editorial',        name: 'Editorial',           heading: 'DM Serif Display',   body: 'Plus Jakarta Sans', bestFor: 'Photographers, writers',          headingStyle: { fontFamily: 'Georgia, serif', fontWeight: 400 as const },                         bodyStyle: { fontFamily: 'sans-serif' } },
  { id: 'warm-professional',name: 'Warm professional',   heading: 'Playfair Display',   body: 'Lato',              bestFor: 'Coaches, consultants',            headingStyle: { fontFamily: 'Georgia, serif' },                                                    bodyStyle: { fontFamily: 'sans-serif' } },
  { id: 'bold-studio',      name: 'Bold studio',         heading: 'Syne',               body: 'DM Sans',           bestFor: 'Designers, creative directors',   headingStyle: { fontFamily: 'sans-serif', fontWeight: 500 as const, letterSpacing: '-0.03em' },  bodyStyle: { fontFamily: 'sans-serif' } },
  { id: 'classic-trust',    name: 'Classic trust',       heading: 'Merriweather',       body: 'Source Sans 3',     bestFor: 'Lawyers, financial advisors',     headingStyle: { fontFamily: 'Georgia, serif', fontWeight: 400 as const, fontSize: 13 as const },  bodyStyle: { fontFamily: 'sans-serif' } },
  { id: 'minimal',          name: 'Minimal',             heading: 'Geist',              body: 'Geist Mono',        bestFor: 'Engineers, developers',           headingStyle: { fontFamily: 'monospace', fontSize: 13 as const },                                  bodyStyle: { fontFamily: 'monospace' } },
] as const;

function inferFontPairId(niche: string): string {
  const n = niche.toLowerCase();
  if (/photo|film|brand|strat|writ|content|copy/.test(n)) return 'editorial';
  if (/coach|consult|therap|wellnes|health/.test(n)) return 'warm-professional';
  if (/design|creative|studio|art/.test(n)) return 'bold-studio';
  if (/law|legal|financ|account|audit/.test(n)) return 'classic-trust';
  if (/engineer|dev|code|software|tech/.test(n)) return 'minimal';
  return 'clean-modern';
}

function contrastColor(hex: string): string {
  if (!isValidHex(hex)) return "#ffffff";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#111827" : "#ffffff";
}

// ─── Color editor ─────────────────────────────────────────────────────────────

function ColorEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hex, setHex] = useState(value);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHex(value);
  }, [value]);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHex(e.target.value);
    onChange(e.target.value);
  };

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setHex(v);
    if (isValidHex(v)) onChange(v);
  };

  const handleHexBlur = () => {
    if (!isValidHex(hex)) setHex(value);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="w-16 h-16 rounded-xl border-2 border-border shadow-sm transition-transform hover:scale-105 active:scale-95 relative overflow-hidden"
        style={{ background: isValidHex(hex) ? hex : "#e5e7eb" }}
        onClick={() => inputRef.current?.click()}
        title={`Click to change ${label} color`}
      >
        <input
          ref={inputRef}
          type="color"
          value={isValidHex(hex) ? hex : "#000000"}
          onChange={handleColorChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          tabIndex={-1}
        />
      </button>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        <Input
          value={hex}
          onChange={handleHexInput}
          onBlur={handleHexBlur}
          className="h-7 text-xs font-mono px-2 w-[88px]"
          maxLength={7}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleCopy}
          title="Copy hex"
        >
          {copied ? (
            <Check className="w-3 h-3 text-emerald-500" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Live preview ─────────────────────────────────────────────────────────────

function LivePreview({
  brand,
  businessName,
  tagline,
  initials,
}: {
  brand: BrandData;
  businessName: string;
  tagline?: string;
  initials?: string;
}) {
  const primary = brand.primaryColor ?? "#1D9E75";
  const accent = brand.accentColor ?? "#E1F5EE";
  const secondary = brand.secondaryColor ?? "#085041";
  const cta = brand.ctaColor ?? primary;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground mb-2">
          Client portal header
        </p>
        <div
          className="rounded-xl p-4"
          style={{
            background: `${primary}12`,
            border: `1px solid ${primary}30`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: accent, color: primary }}
              >
                {initials ?? "FY"}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: primary }}>
                  {businessName}
                </p>
                {tagline && (
                  <p className="text-xs text-muted-foreground">{tagline}</p>
                )}
              </div>
            </div>
            <div className="flex gap-1.5">
              {(brand.keywords ?? []).slice(0, 2).map((kw) => (
                <span
                  key={kw}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${primary}18`, color: primary }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">Invoice header</p>
        <div className="rounded-xl p-4 bg-muted/40 border border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: primary }}>
                {businessName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tagline ?? "hello@yourbusiness.com · Your City"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Invoice
              </p>
              <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">
                INV-001
              </p>
            </div>
          </div>
          <div
            className="mt-3 pt-3 border-t text-xs font-medium"
            style={{ borderColor: `${primary}20`, color: primary }}
          >
            Total due: $0.00
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">Primary button</p>
        <button
          type="button"
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: cta, color: contrastColor(cta) }}
        >
          Get in Touch
        </button>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">Color harmony</p>
        <div className="flex rounded-xl overflow-hidden h-8 border border-border">
          <div className="flex-1" style={{ background: primary }} />
          <div className="flex-1" style={{ background: secondary }} />
          <div className="flex-1" style={{ background: accent }} />
          <div className="flex-1" style={{ background: cta }} />
        </div>
        <div className="flex text-[10px] text-muted-foreground mt-1 font-mono">
          <span className="flex-1">{primary}</span>
          <span className="flex-1 text-center">{secondary}</span>
          <span className="flex-1 text-center">{accent}</span>
          <span className="flex-1 text-right">{cta}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Copy link button ─────────────────────────────────────────────────────────

function CopyLinkButton({
  url,
  onCopied,
}: {
  url: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  function handleClick() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className="shrink-0 text-xs h-7 px-2.5 gap-1"
      onClick={handleClick}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

// ─── Sortable work sample item ────────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BrandKitPage() {
  const navigate = useNavigate();
  const {
    business,
    extractedData,
    isLoading: bizLoading,
    refetch,
  } = useBusiness();

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("brand");

  // ── Brand state ────────────────────────────────────────────────────────────
  const [brand, setBrand] = useState<BrandData>({});
  const [newKeyword, setNewKeyword] = useState("");
  const [selectedFontPairId, setSelectedFontPairId] = useState<string>('clean-modern');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [qrLight, setQrLight] = useState("");
  const [qrDark, setQrDark] = useState("");
  const [qrSvg, setQrSvg] = useState("");

  // ── Portal sections state ──────────────────────────────────────────────────
  const [portalSections, setPortalSections] = useState<PortalSection[]>([]);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<PortalSection | null>(null);
  const [sectionForm, setSectionForm] = useState<SectionForm>(EMPTY_SECTION);
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionImageUploading, setSectionImageUploading] = useState(false);

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
  const sectionImageRef = useRef<HTMLInputElement>(null);
  const iconImageRef = useRef<HTMLInputElement>(null);
  const coverImageRef = useRef<HTMLInputElement>(null);
  const bgImageRef = useRef<HTMLInputElement>(null);
  const [iconUploading, setIconUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);

  const [slugInput, setSlugInput] = useState("");
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  const portfolioSlug = business?.slug ?? "";
  const portfolioUrl = portfolioSlug ? buildPortfolioUrl(portfolioSlug) : "";

  const identity = extractedData?.identity;
  const businessName =
    identity?.businessName ?? identity?.name ?? "Your Business";
  const initials = identity?.initials ?? businessName.slice(0, 2).toUpperCase();

  // ── Sync slug input when business loads ────────────────────────────────────
  useEffect(() => {
    if (business?.slug) setSlugInput(business.slug);
  }, [business?.slug]);

  // ── Load brand ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (extractedData?.brand) {
      const b = extractedData.brand as BrandData;
      setBrand(b);
      // Match loaded font to a known pair, or infer from niche
      const niche = (extractedData?.identity as Record<string, string> | null)?.niche ?? '';
      const matchedPair = FONT_PAIRS.find(p => p.heading === b.fonts?.heading);
      setSelectedFontPairId(matchedPair?.id ?? inferFontPairId(niche));
    }
  }, [extractedData]);

  // ── QR regeneration ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!portfolioUrl) return;
    const primary = brand.primaryColor ?? "#10B981";
    const r = parseInt(primary.slice(1, 3), 16);
    const g = parseInt(primary.slice(3, 5), 16);
    const b = parseInt(primary.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const safeColor = lum > 0.55 ? "#1a1a1a" : primary;

    QRCode.toDataURL(portfolioUrl, {
      width: 600,
      margin: 2,
      color: { dark: safeColor, light: "#ffffff" },
    })
      .then(setQrLight)
      .catch(() => {});
    QRCode.toDataURL(portfolioUrl, {
      width: 600,
      margin: 2,
      color: { dark: "#ffffff", light: "#1a1a1a" },
    })
      .then(setQrDark)
      .catch(() => {});
    QRCode.toString(portfolioUrl, { type: "svg", margin: 2 })
      .then(setQrSvg)
      .catch(() => {});
  }, [portfolioUrl, brand.primaryColor]);

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
    if (activeTab !== "work" || completedProjects.length > 0) return;
    getProjects().then((projects) => {
      setCompletedProjects(projects.filter((p) => p.status === "completed"));
    });
  }, [activeTab, completedProjects.length]);

  // ── Brand persistence ──────────────────────────────────────────────────────

  const saveBrand = useCallback(
    async (updated: BrandData) => {
      if (!business) return;
      setSaving(true);
      const { error } = await supabase
        .from("businesses")
        .update({ extracted_data: { ...extractedData, brand: updated } })
        .eq("id", business.id);
      if (error) {
        toast.error("Failed to save");
      } else {
        refetch();
      }
      setSaving(false);
    },
    [business, extractedData, refetch],
  );

  const scheduleSave = useCallback(
    (updated: BrandData) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveBrand(updated);
      }, 800);
    },
    [saveBrand],
  );

  const immediateSave = useCallback(
    (updated: BrandData) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveBrand(updated);
    },
    [saveBrand],
  );

  const handleColorChange =
    (key: "primaryColor" | "secondaryColor" | "accentColor" | "ctaColor") =>
    (hex: string) => {
      const updated = { ...brand, [key]: hex };
      setBrand(updated);
      scheduleSave(updated);
    };

  const handleFontChange =
    (key: "heading" | "body") => (e: React.ChangeEvent<HTMLInputElement>) => {
      const updated = {
        ...brand,
        fonts: { ...brand.fonts, [key]: e.target.value },
      };
      setBrand(updated);
    };

  const handleFontBlur = () => immediateSave(brand);

  const handleFontPairSelect = (pairId: string) => {
    const pair = FONT_PAIRS.find(p => p.id === pairId);
    if (!pair) return;
    setSelectedFontPairId(pairId);
    const updated = { ...brand, fonts: { heading: pair.heading, body: pair.body } };
    setBrand(updated);
    immediateSave(updated);
  };

  const handleToneChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBrand((b) => ({ ...b, tone: e.target.value }));
  };
  const handleToneBlur = () => immediateSave(brand);

  const handleAddKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw || (brand.keywords ?? []).includes(kw)) {
      setNewKeyword("");
      return;
    }
    const updated = { ...brand, keywords: [...(brand.keywords ?? []), kw] };
    setBrand(updated);
    setNewKeyword("");
    immediateSave(updated);
  };

  const handleRemoveKeyword = (kw: string) => {
    const updated = {
      ...brand,
      keywords: (brand.keywords ?? []).filter((k) => k !== kw),
    };
    setBrand(updated);
    immediateSave(updated);
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

  const checkSlugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSlugChange(val: string) {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSlugInput(clean)
    setSlugAvailable(null)
    const err = validateSlugFormat(clean)
    setSlugError(err)
    if (err || clean === portfolioSlug) return
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
    if (!business || !slugInput || slugInput === portfolioSlug) return
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

  const slugChanged = slugInput !== portfolioSlug
  const slugValid = !validateSlugFormat(slugInput)
  const slugSaveEnabled = slugChanged && slugValid && slugAvailable === true && !slugChecking && !slugSaving

  // ── Brand asset uploads ────────────────────────────────────────────────────

  async function uploadBrandAsset(file: File, assetType: string): Promise<string> {
    const ext = file.name.split('.').pop();
    const filename = `brand/${business!.id}/${assetType}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('work-samples')
      .upload(filename, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('work-samples').getPublicUrl(filename);
    return data.publicUrl;
  }

  async function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconUploading(true);
    try {
      const url = await uploadBrandAsset(file, 'icon');
      const updated = { ...brand, businessIconUrl: url };
      setBrand(updated);
      immediateSave(updated);
    } catch { toast.error('Upload failed'); }
    finally { setIconUploading(false); }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const url = await uploadBrandAsset(file, 'cover');
      const updated = { ...brand, headerCoverUrl: url };
      setBrand(updated);
      immediateSave(updated);
    } catch { toast.error('Upload failed'); }
    finally { setCoverUploading(false); }
  }

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgUploading(true);
    try {
      const url = await uploadBrandAsset(file, 'bg');
      const updated = { ...brand, portalBgUrl: url };
      setBrand(updated);
      immediateSave(updated);
    } catch { toast.error('Upload failed'); }
    finally { setBgUploading(false); }
  }

  function removeBrandAsset(key: 'businessIconUrl' | 'headerCoverUrl' | 'portalBgUrl') {
    const updated = { ...brand, [key]: undefined };
    setBrand(updated);
    immediateSave(updated);
  }

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

  // ── Misc ───────────────────────────────────────────────────────────────────

  const hasBusiness = !bizLoading && !!business;

  function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  function downloadSvg() {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${portfolioSlug || "portfolio"}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">
            Brand Kit
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {hasBusiness
              ? "Your AI-generated brand identity — edit anytime"
              : "Your brand colors, fonts, and voice"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Saving…
            </span>
          )}
          {hasBusiness && (
            <Button variant="outline" onClick={() => navigate("/dashboard/portfolio")}>
              <Globe className="w-4 h-4 mr-2" />
              Public Portfolio
            </Button>
          )}
        </div>
      </div>

      {/* No business CTA */}
      {!bizLoading && !business && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">
              Generate your Business OS first
            </h3>
            <p className="text-muted-foreground max-w-sm text-pretty">
              Your brand kit — colors, fonts, tone, and keywords — is generated
              automatically from your business description.
            </p>
          </div>
          <Button onClick={() => navigate("/")}>
            Generate now
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Main content */}
      {hasBusiness && (
        <>
          {/* Tab bar */}
          <div className="flex gap-0 border-b">
            {(["brand", "portal", "work"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                  activeTab === t
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "brand" ? "Brand" : t === "portal" ? "Portal" : "Work"}
              </button>
            ))}
          </div>

          {/* ── Brand tab ───────────────────────────────────────────────────── */}
          {activeTab === "brand" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                {/* Left column */}
                <div className="space-y-6">
                  {/* Colors */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Color Palette</CardTitle>
                      <CardDescription>
                        Click a swatch to open the color picker
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-6 flex-wrap">
                        <ColorEditor
                          label="Primary"
                          value={brand.primaryColor ?? "#1D9E75"}
                          onChange={handleColorChange("primaryColor")}
                        />
                        <ColorEditor
                          label="Secondary"
                          value={brand.secondaryColor ?? "#085041"}
                          onChange={handleColorChange("secondaryColor")}
                        />
                        <ColorEditor
                          label="Accent"
                          value={brand.accentColor ?? "#E1F5EE"}
                          onChange={handleColorChange("accentColor")}
                        />
                        <ColorEditor
                          label="CTA"
                          value={
                            brand.ctaColor ??
                            brand.primaryColor ??
                            "#1D9E75"
                          }
                          onChange={handleColorChange("ctaColor")}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Primary: text & icons · Secondary: soft backgrounds ·
                        Accent: card backgrounds · CTA: action buttons
                      </p>
                    </CardContent>
                  </Card>

                  {/* Visuals */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Visuals</CardTitle>
                      <CardDescription>
                        Business icon, header cover, and portal background
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">

                      {/* Business icon */}
                      <div>
                        <p className="text-xs font-medium mb-2">Business Icon</p>
                        <div className="flex items-center gap-4">
                          <div
                            className="h-14 w-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-border/50"
                            style={{ backgroundColor: brand.businessIconUrl ? undefined : `${brand.primaryColor ?? '#10B981'}18` }}
                          >
                            {brand.businessIconUrl
                              ? <img src={brand.businessIconUrl} alt="Business icon" className="w-full h-full object-cover" />
                              : <span className="text-sm font-bold" style={{ color: brand.primaryColor ?? '#10B981' }}>{initials}</span>}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 text-xs"
                              onClick={() => iconImageRef.current?.click()}
                              disabled={iconUploading}
                            >
                              {iconUploading
                                ? <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                                : <Image className="h-3 w-3" />}
                              {iconUploading ? 'Uploading…' : 'Upload image'}
                            </Button>
                            {brand.businessIconUrl && (
                              <button
                                type="button"
                                onClick={() => removeBrandAsset('businessIconUrl')}
                                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors text-left"
                              >
                                Remove (use initials)
                              </button>
                            )}
                          </div>
                          <input ref={iconImageRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                        </div>
                      </div>

                      <div className="border-t border-border/40" />

                      {/* Header cover image */}
                      <div>
                        <p className="text-xs font-medium mb-1">Header Cover Image</p>
                        <p className="text-[11px] text-muted-foreground mb-2">Full-width image shown behind the portfolio header. Default: no cover.</p>
                        {brand.headerCoverUrl ? (
                          <div className="relative rounded-xl overflow-hidden border border-border/50 aspect-[3/1] mb-2">
                            <img src={brand.headerCoverUrl} alt="Header cover" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeBrandAsset('headerCoverUrl')}
                              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/60 aspect-[3/1] flex items-center justify-center bg-muted/20 mb-2">
                            <p className="text-xs text-muted-foreground">No cover image</p>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => coverImageRef.current?.click()}
                          disabled={coverUploading}
                        >
                          {coverUploading
                            ? <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                            : <Image className="h-3 w-3" />}
                          {coverUploading ? 'Uploading…' : brand.headerCoverUrl ? 'Replace image' : 'Upload image'}
                        </Button>
                        <input ref={coverImageRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                      </div>

                      <div className="border-t border-border/40" />

                      {/* Portal background */}
                      <div>
                        <p className="text-xs font-medium mb-1">Portal Background</p>
                        <p className="text-[11px] text-muted-foreground mb-2">Background image for the public portfolio page. Default: no background.</p>
                        {brand.portalBgUrl ? (
                          <div className="relative rounded-xl overflow-hidden border border-border/50 aspect-[3/1] mb-2">
                            <img src={brand.portalBgUrl} alt="Portal background" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeBrandAsset('portalBgUrl')}
                              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/60 aspect-[3/1] flex items-center justify-center bg-muted/20 mb-2">
                            <p className="text-xs text-muted-foreground">No background image</p>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => bgImageRef.current?.click()}
                          disabled={bgUploading}
                        >
                          {bgUploading
                            ? <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                            : <Image className="h-3 w-3" />}
                          {bgUploading ? 'Uploading…' : brand.portalBgUrl ? 'Replace image' : 'Upload image'}
                        </Button>
                        <input ref={bgImageRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                      </div>

                    </CardContent>
                  </Card>

                  {/* Typography */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Typography</CardTitle>
                      <CardDescription>
                        Choose a font pair that matches your brand
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        {FONT_PAIRS.map(pair => {
                          const isSelected = selectedFontPairId === pair.id;
                          return (
                            <button
                              key={pair.id}
                              type="button"
                              onClick={() => handleFontPairSelect(pair.id)}
                              className={`text-left rounded-lg border p-3 transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                  : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
                              }`}
                            >
                              <p style={{ ...pair.headingStyle, fontSize: 13, color: isSelected ? (brand.primaryColor ?? '#1D9E75') : 'inherit', marginBottom: 2, lineHeight: 1.3 }}>
                                {businessName}
                              </p>
                              <p style={{ ...pair.bodyStyle, fontSize: 9, color: 'hsl(var(--muted-foreground))', marginBottom: 6, lineHeight: 1.4 }}>
                                Professional · Results-driven
                              </p>
                              <p className="text-[10px] font-medium" style={{ color: isSelected ? (brand.primaryColor ?? '#1D9E75') : 'hsl(var(--muted-foreground))' }}>
                                {pair.name}
                              </p>
                              <p className="text-[9px] text-muted-foreground/60 mt-0.5">{pair.bestFor}</p>
                            </button>
                          );
                        })}
                      </div>
                      {brand.fonts?.heading && (
                        <p className="text-[11px] text-muted-foreground mt-3">
                          Active: {brand.fonts.heading} / {brand.fonts.body}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Brand voice */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Brand Voice</CardTitle>
                      <CardDescription>
                        How your brand communicates with clients
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={brand.tone ?? ""}
                        onChange={handleToneChange}
                        onBlur={handleToneBlur}
                        placeholder="e.g., Approachable yet professional. Warm, direct, and results-focused."
                        rows={3}
                        className="text-sm resize-none"
                      />
                    </CardContent>
                  </Card>

                  {/* Keywords */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Brand Keywords</CardTitle>
                      <CardDescription>
                        Words that define your brand identity
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-2 min-h-[32px]">
                        {(brand.keywords ?? []).map((kw) => (
                          <Badge
                            key={kw}
                            variant="secondary"
                            className="gap-1.5 pr-1 pl-3"
                          >
                            {kw}
                            <button
                              type="button"
                              onClick={() => handleRemoveKeyword(kw)}
                              className="rounded-full hover:bg-foreground/10 p-0.5 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                        {(brand.keywords ?? []).length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No keywords yet. Add some below.
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            (e.preventDefault(), handleAddKeyword())
                          }
                          placeholder="Add a keyword…"
                          className="h-8 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={handleAddKeyword}
                          disabled={!newKeyword.trim()}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right column: live preview */}
                <div className="space-y-4">
                  <Card className="sticky top-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Live Preview</CardTitle>
                      <CardDescription>
                        Updates as you edit — reflects your brand in real UI
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LivePreview
                        brand={brand}
                        businessName={businessName}
                        tagline={identity?.tagline}
                        initials={initials}
                      />
                    </CardContent>
                  </Card>
                  {identity?.niche && (
                    <Card className="bg-muted/30">
                      <CardContent className="py-4 px-5">
                        <p className="text-xs text-muted-foreground mb-1">
                          Business niche
                        </p>
                        <p className="text-sm font-medium">{identity.niche}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* QR code section */}
              {portfolioUrl && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      QR Code Downloads
                    </CardTitle>
                    <CardDescription>
                      Print-ready QR codes linking to your portfolio — use on
                      business cards, packaging, invoice footers, and stickers.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border/60 bg-white">
                        {qrLight ? (
                          <img
                            src={qrLight}
                            alt="QR — brand color on white"
                            width={120}
                            height={120}
                            className="block"
                          />
                        ) : (
                          <div className="w-[120px] h-[120px] flex items-center justify-center text-xs text-muted-foreground">
                            Generating…
                          </div>
                        )}
                        <div className="text-center">
                          <p className="text-xs font-medium">
                            Brand color on white
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            For light print
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1.5"
                          disabled={!qrLight}
                          onClick={() =>
                            downloadDataUrl(
                              qrLight,
                              `${portfolioSlug || "portfolio"}-qr-light.png`,
                            )
                          }
                        >
                          <Download className="h-3.5 w-3.5" />
                          PNG
                        </Button>
                      </div>

                      <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border/60 bg-[#1a1a1a]">
                        {qrDark ? (
                          <img
                            src={qrDark}
                            alt="QR — white on dark"
                            width={120}
                            height={120}
                            className="block"
                          />
                        ) : (
                          <div className="w-[120px] h-[120px] flex items-center justify-center text-xs text-white/40">
                            Generating…
                          </div>
                        )}
                        <div className="text-center">
                          <p className="text-xs font-medium text-white">
                            White on dark
                          </p>
                          <p className="text-[11px] text-white/50 mt-0.5">
                            For dark backgrounds
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1.5 border-white/20 text-white hover:bg-white/10 hover:text-white"
                          disabled={!qrDark}
                          onClick={() =>
                            downloadDataUrl(
                              qrDark,
                              `${portfolioSlug || "portfolio"}-qr-dark.png`,
                            )
                          }
                        >
                          <Download className="h-3.5 w-3.5" />
                          PNG
                        </Button>
                      </div>

                      <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border/60">
                        <div className="w-[120px] h-[120px] flex flex-col items-center justify-center gap-2">
                          <div className="text-4xl font-bold text-muted-foreground/30 select-none">
                            SVG
                          </div>
                          <p className="text-[11px] text-muted-foreground text-center">
                            Scales to any size without quality loss
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-medium">
                            Vector (scalable)
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            For large-format print
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1.5"
                          disabled={!qrSvg}
                          onClick={downloadSvg}
                        >
                          <Download className="h-3.5 w-3.5" />
                          SVG
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <p className="text-[11px] text-muted-foreground font-mono flex-1 truncate">{buildPortfolioUrl(portfolioSlug)}</p>
                      <CopyLinkButton
                        url={buildPortfolioUrl(portfolioSlug)}
                        onCopied={() => {
                          if (
                            !business?.onboarding_milestones?.portfolio_shared
                          ) {
                            supabase.functions.invoke("mark-milestone", {
                              body: { milestone: "portfolio_shared" },
                            });
                          }
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ── Portal tab ──────────────────────────────────────────────────── */}
          {activeTab === "portal" && (
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
                  {portfolioSlug && (
                    <p className="text-xs text-muted-foreground font-mono bg-muted/40 rounded-md px-3 py-2">
                      {displayPortfolioUrl(portfolioSlug)}
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

          {/* ── Work tab ────────────────────────────────────────────────────── */}
          {activeTab === "work" && (
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
        </>
      )}
    </div>
  );
}
