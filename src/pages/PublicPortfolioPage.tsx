import { CheckCircle2, Sparkles } from "lucide-react";
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

export default function PublicPortfolioPage() {
  const { slug } = useParams<{ slug: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM);
  const [selectedService, setSelectedService] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      // Step 1: resolve username → id (profiles.id = auth.users.id)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", slug)
        .maybeSingle();

      if (profileError || !profile) {
        setNotFound(true);
        return;
      }

      // Step 2: fetch the active business for that user
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, bio, contact_email, contact_phone, extracted_data")
        .eq("user_id", profile.id)
        .eq("status", "active")
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setBusiness(data as unknown as Business);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="py-16 px-6 text-center border-b"
        style={{ borderColor: `${primaryColor}30` }}
      >
        <div
          className="inline-flex h-16 w-16 rounded-2xl items-center justify-center mb-4 text-white font-bold text-2xl"
          style={{ backgroundColor: primaryColor }}
        >
          {bizName.slice(0, 2).toUpperCase()}
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
      </header>

      {/* Bio / About */}
      {bio && (
        <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 pt-10">
          <h2 className="text-lg font-semibold mb-3">About</h2>
          <p className="text-muted-foreground leading-relaxed">{bio}</p>
        </div>
      )}

      {/* Services grid */}
      <main className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-12">
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

        {/* Global CTA */}
        <div className="mt-12 text-center space-y-4">
          <Button
            size="lg"
            className="gap-2"
            style={{ backgroundColor: primaryColor }}
            onClick={() => openModal()}
          >
            <Sparkles className="h-4 w-4" />
            Request a Proposal
          </Button>
          {(contactEmail || contactPhone) && (
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              {contactEmail && (
                <a href={`mailto:${contactEmail}`} className="hover:underline" style={{ color: primaryColor }}>
                  {contactEmail}
                </a>
              )}
              {contactEmail && contactPhone && <span>·</span>}
              {contactPhone && (
                <a href={`tel:${contactPhone}`} className="hover:underline" style={{ color: primaryColor }}>
                  {contactPhone}
                </a>
              )}
            </div>
          )}
        </div>
      </main>

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
