import { CheckCircle2, Sparkles, Download, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/db/supabase";

interface ExtractedService {
  name: string;
  price: string;
  type: "project" | "retainer" | "hourly";
  description?: string;
}

interface Business {
  id: string;
  name: string;
  bio?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  extracted_data: {
    identity?: { businessName?: string; tagline?: string; niche?: string };
    brand?: {
      primaryColor?: string;
      secondaryColor?: string;
      keywords?: string[];
      businessIconUrl?: string;
      headerCoverUrl?: string;
      portalBgUrl?: string;
    };
    services?: ExtractedService[];
  };
}

interface RequestForm {
  name: string;
  company: string;
  email: string;
  service_name: string;
  problem: string;
  timeline: string;
  budget_flexible: boolean;
  notes: string;
}

const EMPTY_FORM: RequestForm = {
  name: "",
  company: "",
  email: "",
  service_name: "",
  problem: "",
  timeline: "",
  budget_flexible: false,
  notes: "",
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  project: "Project",
  retainer: "Retainer",
  hourly: "Hourly",
};

interface PortalSection {
  id: string;
  section_type: "text" | "text_image" | "banner" | "links";
  position: number;
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  banner_color?: "info" | "warning" | "closed" | null;
  links?: Array<{ label: string; url: string }> | null;
}

interface WorkSample {
  id: string;
  title?: string | null;
  image_url: string;
  sort_order: number;
}

interface Review {
  id: string;
  client_name: string;
  rating: number;
  comment?: string | null;
  freelancer_reply?: string | null;
  submitted_at: string;
}

const BANNER_COLORS = {
  info: "bg-blue-50 text-blue-700 border-blue-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  closed: "bg-red-50 text-red-700 border-red-200",
} as const;

function PortalSectionRenderer({
  section,
  primaryColor,
}: {
  section: PortalSection;
  primaryColor: string;
}) {
  if (section.section_type === "text") {
    return (
      <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-8">
        {section.title && (
          <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
        )}
        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {section.body}
        </p>
      </div>
    );
  }
  if (section.section_type === "text_image") {
    return (
      <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-8">
        {section.title && (
          <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
        )}
        {section.body && (
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {section.body}
          </p>
        )}
        {section.image_url && (
          <img
            src={section.image_url}
            alt={section.title ?? ""}
            className="w-full rounded-xl object-cover mt-4"
          />
        )}
      </div>
    );
  }
  if (section.section_type === "banner") {
    const colorClass = BANNER_COLORS[section.banner_color ?? "info"];
    return (
      <div
        className={`w-full border-y px-6 py-3 text-sm text-center ${colorClass}`}
      >
        {section.body}
      </div>
    );
  }
  if (section.section_type === "links") {
    const links = section.links ?? [];
    return (
      <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-8">
        {section.title && (
          <h2 className="text-lg font-semibold mb-4">{section.title}</h2>
        )}
        <div className="flex flex-wrap gap-3">
          {links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-full border text-sm hover:shadow-sm transition-shadow"
              style={{ borderColor: `${primaryColor}50`, color: primaryColor }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function StarRating({ rating, color }: { rating: number; color: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill={i <= rating ? color : "none"}
          stroke={i <= rating ? color : "#d1d5db"}
          strokeWidth="1"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function formatReviewDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export default function PublicPortfolioPage() {
  const { slug } = useParams<{ slug: string }>();

  // Always render in light mode — this is a public page for clients
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => {
      if (wasDark) html.classList.add("dark");
    };
  }, []);

  const [business, setBusiness] = useState<Business | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM);
  const [selectedService, setSelectedService] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [portalSections, setPortalSections] = useState<PortalSection[]>([]);
  const [workSamples, setWorkSamples] = useState<WorkSample[]>([]);
  const [testimonials, setTestimonials] = useState<Review[]>([]);
  const [lightboxSample, setLightboxSample] = useState<WorkSample | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, bio, contact_email, contact_phone, extracted_data")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setBusiness(data as unknown as Business);
        const [sectionsRes, samplesRes, reviewsRes] = await Promise.all([
          supabase
            .from("portal_sections")
            .select("*")
            .eq("business_id", data.id)
            .eq("is_active", true)
            .order("position"),
          supabase
            .from("work_samples")
            .select("id, title, image_url, sort_order")
            .eq("business_id", data.id)
            .eq("is_active", true)
            .order("sort_order"),
          supabase
            .from("reviews")
            .select(
              "id, client_name, rating, comment, freelancer_reply, submitted_at",
            )
            .eq("business_id", data.id)
            .eq("ai_selected", true)
            .eq("portal_eligible", true)
            .order("ai_selected_at", { ascending: false }),
        ]);
        if (sectionsRes.data)
          setPortalSections(sectionsRes.data as PortalSection[]);
        if (samplesRes.data) setWorkSamples(samplesRes.data as WorkSample[]);
        if (reviewsRes.data) setTestimonials(reviewsRes.data as Review[]);
      }
    })();
  }, [slug]);

  const identity = business?.extracted_data?.identity;
  const brand = business?.extracted_data?.brand;
  const services: ExtractedService[] = business?.extracted_data?.services ?? [];
  const primaryColor = brand?.primaryColor ?? "#10B981";
  const bio = business?.bio ?? null;
  const contactEmail = business?.contact_email ?? null;
  const contactPhone = business?.contact_phone ?? null;
  const bizName = identity?.businessName ?? business?.name ?? "";

  const portfolioUrl = `${window.location.origin}/p/${slug}`;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  function saveContact() {
    const lines: string[] = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${bizName}`,
      `ORG:${bizName}`,
      `URL:${portfolioUrl}`,
    ];
    if (identity?.tagline) lines.push(`NOTE:${identity.tagline}`);
    if (contactEmail) lines.push(`EMAIL:${contactEmail}`);
    if (contactPhone) lines.push(`TEL:${contactPhone}`);
    lines.push("END:VCARD");
    const blob = new Blob([lines.join("\r\n")], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function addToWallet() {
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
  }

  function openModal(serviceName?: string) {
    setForm(EMPTY_FORM);
    setSelectedService(serviceName ?? "");
    setSubmitted(false);
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    if (!business) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke(
        "submit-proposal-request",
        {
          body: {
            business_id: business.id,
            name: form.name.trim(),
            company: form.company.trim() || null,
            email: form.email.trim(),
            service_name: selectedService || null,
            problem: form.problem.trim() || null,
            timeline: form.timeline || null,
            budget_flexible: form.budget_flexible,
            notes: form.notes.trim() || null,
          },
        },
      );
      if (error) throw error;
      setSubmitted(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    console.log("slug: ", slug);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Portfolio not found</h1>
          <p className="text-muted-foreground">
            This freelancer's portfolio doesn't exist or isn't active.
          </p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">
          Loading…
        </div>
      </div>
    );
  }

  const bannerSections = portalSections.filter(
    (s) => s.section_type === "banner",
  );
  const customSections = portalSections.filter(
    (s) => s.section_type !== "banner",
  );
  return (
    <div>
      <div
        className="min-h-screen bg-background"
        style={
          brand?.portalBgUrl
            ? {
                backgroundImage: `url(${brand.portalBgUrl})`,
                backgroundSize: "cover",
                backgroundAttachment: "fixed",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {/* 1. Header */}
        <header
          className="relative py-16 px-6 text-center border-b overflow-hidden"
          style={{ borderColor: `${primaryColor}30` }}
        >
          {brand?.headerCoverUrl && (
            <div
              className="absolute inset-0 z-0"
              style={{
                backgroundImage: `url(${brand.headerCoverUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 bg-background/60" />
            </div>
          )}
          <div className="relative z-10">
            <div
              className="inline-flex h-16 w-16 rounded-2xl items-center justify-center mb-4 overflow-hidden"
              style={
                brand?.businessIconUrl
                  ? undefined
                  : { backgroundColor: primaryColor }
              }
            >
              {brand?.businessIconUrl ? (
                <img
                  src={brand.businessIconUrl}
                  alt={bizName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-2xl">
                  {bizName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{bizName}</h1>
            {identity?.tagline && (
              <p className="mt-2 text-lg text-muted-foreground">
                {identity.tagline}
              </p>
            )}
            {identity?.niche && (
              <Badge variant="secondary" className="mt-3">
                {identity.niche}
              </Badge>
            )}
            {brand?.keywords && brand.keywords.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {brand.keywords.map((k) => (
                  <span
                    key={k}
                    className="text-xs text-muted-foreground border rounded-full px-2.5 py-0.5"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-6">
              <Button
                size="default"
                onClick={() => openModal()}
                style={{ backgroundColor: primaryColor }}
                className="gap-2 text-white"
              >
                <Sparkles className="h-4 w-4" />
                Request a Proposal
              </Button>
            </div>
          </div>
        </header>

        {/* 2. Banner section(s) — shown immediately after header if any exist */}
        {bannerSections.map((s) => (
          <PortalSectionRenderer
            key={s.id}
            section={s}
            primaryColor={primaryColor}
          />
        ))}

        {/* 3. About — always shown; directly under header when no banner, after banner otherwise */}
        {bio && (
          <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 pt-10">
            <h2 className="text-lg font-semibold mb-3">About</h2>
            <p className="text-muted-foreground leading-relaxed">{bio}</p>
          </div>
        )}

        {/* 4. Custom sections (non-banner), in position order */}
        {customSections.map((s) => (
          <PortalSectionRenderer
            key={s.id}
            section={s}
            primaryColor={primaryColor}
          />
        ))}

        {/* 5. Services */}
        <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-12">
          {services.length > 0 ? (
            <>
              <h2 className="text-xl font-semibold mb-6">Services</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((svc, i) => (
                  <div
                    key={i}
                    className="border rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm leading-snug">
                        {svc.name}
                      </h3>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {SERVICE_TYPE_LABELS[svc.type] ?? svc.type}
                      </Badge>
                    </div>
                    {svc.description && (
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {svc.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-1">
                      <span
                        className="text-sm font-bold"
                        style={{ color: primaryColor }}
                      >
                        {svc.price}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => openModal(svc.name)}
                      >
                        Request →
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">
              No services listed yet.
            </p>
          )}
        </div>

        {/* 6. Work samples */}
        {workSamples.length > 0 && (
          <div
            className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-12 border-t"
            style={{ borderColor: `${primaryColor}20` }}
          >
            <h2 className="text-xl font-semibold mb-6">Work</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {workSamples.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => setLightboxSample(sample)}
                  className="group relative overflow-hidden rounded-xl border aspect-video bg-muted cursor-zoom-in text-left"
                >
                  <img
                    src={sample.image_url}
                    alt={sample.title ?? ""}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {sample.title && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-3 py-2 translate-y-full group-hover:translate-y-0 transition-transform">
                      {sample.title}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Testimonials — only renders when ≥ 3 ai_selected reviews */}
        {testimonials.length >= 3 && (
          <div
            className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-12 border-t"
            style={{ borderColor: `${primaryColor}20` }}
          >
            <h2 className="text-xl font-semibold mb-8">What clients say</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {testimonials.map((review) => (
                <div
                  key={review.id}
                  className="border rounded-xl p-5 flex flex-col gap-3"
                >
                  <StarRating rating={review.rating} color={primaryColor} />
                  {review.comment && (
                    <p className="text-sm text-foreground leading-relaxed">
                      "{review.comment}"
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    — {review.client_name} ·{" "}
                    {formatReviewDate(review.submitted_at)}
                  </p>
                  {review.freelancer_reply && (
                    <p className="text-xs text-muted-foreground border-t pt-3 mt-auto">
                      ↳ "{review.freelancer_reply}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Footer */}
        <footer
          className="border-t mt-8"
          style={{ borderColor: `${primaryColor}20` }}
        >
          <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
              {/* Left — contact + save */}
              <div className="flex flex-col gap-2">
                {contactEmail && (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-sm hover:underline"
                    style={{ color: primaryColor }}
                  >
                    {contactEmail}
                  </a>
                )}
                {contactPhone && (
                  <a
                    href={`tel:${contactPhone}`}
                    className="text-sm hover:underline"
                    style={{ color: primaryColor }}
                  >
                    {contactPhone}
                  </a>
                )}
                <div className="mt-1">
                  {isIos ? (
                    <button
                      type="button"
                      onClick={addToWallet}
                      disabled={walletLoading}
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
                    >
                      {walletLoading ? (
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                      ) : (
                        <Wallet className="h-3.5 w-3.5" />
                      )}
                      {walletLoading ? "Generating…" : "Add to Apple Wallet"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={saveContact}
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Save contact
                    </button>
                  )}
                </div>
              </div>

              {/* Center — CTA */}
              <div className="flex justify-center">
                <Button
                  size="default"
                  onClick={() => openModal()}
                  style={{ backgroundColor: primaryColor }}
                  className="gap-2 text-white"
                >
                  <Sparkles className="h-4 w-4" />
                  Request a Proposal
                </Button>
              </div>

              {/* Right — copyright */}
              <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:text-right">
                <p>
                  © {new Date().getFullYear()} · {bizName}
                </p>
                <p>All Rights Reserved</p>
                <a
                  href="https://forgefly.io?ref=portfolio_footer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: primaryColor }}
                >
                  Powered by Forgefly
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Work sample lightbox */}
      <Dialog
        open={!!lightboxSample}
        onOpenChange={(open) => {
          if (!open) setLightboxSample(null);
        }}
      >
        {lightboxSample && (
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>{lightboxSample.title ?? "Work sample"}</DialogTitle>
            </DialogHeader>
            <img
              src={lightboxSample.image_url}
              alt={lightboxSample.title ?? ""}
              className="w-full object-contain max-h-[80vh]"
            />
            {lightboxSample.title && (
              <div className="px-4 py-3 text-sm font-medium border-t">
                {lightboxSample.title}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>

      {/* Proposal Request Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request a Proposal</DialogTitle>
            <DialogDescription>
              Fill in your details and {bizName} will get back to you with a
              tailored proposal.
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <h3 className="font-semibold text-lg">Request sent!</h3>
              <p className="text-muted-foreground text-sm">
                {bizName} will review your request and reach out shortly.
              </p>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Close
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="req-name">Name *</Label>
                    <Input
                      id="req-name"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="req-company">Company</Label>
                    <Input
                      id="req-company"
                      value={form.company}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, company: e.target.value }))
                      }
                      placeholder="Company (optional)"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="req-email">Email *</Label>
                  <Input
                    id="req-email"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="your@email.com"
                  />
                </div>

                {services.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Service</Label>
                    <div className="flex flex-wrap gap-2">
                      {services.map((svc) => (
                        <button
                          key={svc.name}
                          type="button"
                          onClick={() =>
                            setSelectedService((s) =>
                              s === svc.name ? "" : svc.name,
                            )
                          }
                          className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                            selectedService === svc.name
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          {svc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="req-problem">
                    What's the problem you're trying to solve?
                  </Label>
                  <Textarea
                    id="req-problem"
                    value={form.problem}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, problem: e.target.value }))
                    }
                    placeholder="Describe your situation or goals…"
                    className="resize-none"
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Timeline</Label>
                  <Select
                    value={form.timeline}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, timeline: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="When do you need this?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASAP">ASAP</SelectItem>
                      <SelectItem value="1-3 months">1–3 months</SelectItem>
                      <SelectItem value="3-6 months">3–6 months</SelectItem>
                      <SelectItem value="6+ months">6+ months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="req-budget"
                    checked={form.budget_flexible}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, budget_flexible: !!v }))
                    }
                  />
                  <Label
                    htmlFor="req-budget"
                    className="text-sm font-normal cursor-pointer"
                  >
                    My budget is flexible
                  </Label>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="req-notes">Additional notes</Label>
                  <Textarea
                    id="req-notes"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    placeholder="Anything else we should know? (optional)"
                    className="resize-none"
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !form.name || !form.email}
                >
                  {submitting ? "Sending…" : "Send Request"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
