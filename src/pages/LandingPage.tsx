import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertTriangle, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/db/supabase";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";

function validatePrompt(prompt: string): string | null {
  const trimmed = prompt.trim();
  if (trimmed.length < 30) {
    return "Tell us a bit more — what do you do and who do you work with?";
  }
  const hasService =
    /\b(offer|service|speciali[sz]|package|consult|design|develop|write|photo|coach|audit|sprint|retainer)\b/i.test(
      trimmed,
    );
  if (!hasService) {
    return "Mention at least one service you offer to get the best results.";
  }
  return null;
}

const SEED_EXAMPLES = [
  "Describe your business — what do you do, where are you based, what services or packages do you offer and at what price, who are your ideal clients, and any brand colors you have in mind? You can always add or edit these after your Business OS is created.",
  "I am a UX/UI designer specializing in mobile apps and SaaS dashboards, based in San Francisco, CA. I offer services like UX Audit ($1,800), Design Sprint ($4,500), Full Product Design ($12,000), and a monthly Design Partner retainer ($2,200/mo). I work with Series A startups and scale-ups.",
  "Freelance copywriter based in Austin, TX. I write conversion-focused landing pages ($1,200), email sequences ($800), and brand messaging guides ($2,500). My clients are DTC brands and B2B SaaS companies.",
  "I run Baked By Clara, a custom cake and dessert studio in Seattle, WA. I specialize in wedding cakes ($800–$2,500), custom celebration cakes ($150–$450), and dessert tables for events ($600+). My brand colors are blush pink and warm ivory. I work with brides, event planners, and families who want something beautiful and delicious.",
];

const GEN_STEPS = [
  {
    label: "Parsing business identity",
    subtitle: "Analysing your prompt and extracting your business identity",
  },
  {
    label: "Extracting services and pricing",
    subtitle: "Identifying your services, rates, and package structure",
  },
  {
    label: "Building sales pipeline",
    subtitle: "Setting up your deal stages and prospect workflow",
  },
  {
    label: "Drafting proposal template",
    subtitle: "Creating a tailored proposal intro and scope of work",
  },
  {
    label: "Generating brand kit",
    subtitle: "Picking colours, tone, and keywords that match your niche",
  },
  {
    label: "Assembling your portal",
    subtitle: "Pulling everything together into your business OS",
  },
];

const SEED_CHIPS = ["UX Designer, SF", "Copywriter, remote", "Baker, Seattle"];

const HOW_STEPS = [
  { num: "01", label: "Describe what you do" },
  { num: "02", label: "Watch it assemble" },
  { num: "03", label: "Your business is live" },
  { num: "04", label: "Run everything from one place" },
];

const PAGE_CSS = `
  @keyframes scrollBob {
    0%, 100% { transform: translateY(0);  opacity: 0.4; }
    50%       { transform: translateY(4px); opacity: 0.8; }
  }

  .ff-hero-section {
    position: relative; overflow: hidden;
    background-image: url('/hero-bg.png');
    background-size: cover;
    background-position: center top;
    background-repeat: no-repeat;
  }

  .ff-hero-overlay {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background: linear-gradient(to bottom, rgba(8,13,11,0.35) 0%, rgba(8,13,11,0.6) 100%);
  }

  .ff-scroll-bob { animation: scrollBob 2.5s ease-in-out infinite; }

  .ff-hero-content { position: relative; z-index: 1; }

  .ff-cta-section { position: relative; }

  .ff-cta-section::before {
    content: '';
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background-image: url('/CTA-bg.png');
    background-size: cover;
    background-position: bottom 25% center;
    background-repeat: no-repeat;
    opacity: 0.2;
  }

  .ff-how-panel {
    opacity: 0; transform: translateY(20px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .ff-how-panel.visible { opacity: 1; transform: translateY(0); }

  .ff-feature-pair {
    opacity: 0; transform: translateY(40px);
    transition: opacity 0.7s ease, transform 0.7s ease;
  }
  .ff-feature-pair.visible { opacity: 1; transform: translateY(0); }

  .ff-fade-up {
    opacity: 0; transform: translateY(20px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .ff-fade-up.visible { opacity: 1; transform: translateY(0); }

  .ff-pricing-card {
    opacity: 0; transform: translateY(20px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .ff-pricing-card.visible { opacity: 1; transform: translateY(0); }

  .ff-feature-visual { position: relative; }
  .ff-feature-visual::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    border-radius: 16px;
    background: linear-gradient(to bottom, transparent 60%, rgba(16,185,129,0.05));
  }

  @media (max-width: 1024px) {
    .ff-how-grid  { display: block !important; min-height: auto !important; }
    .ff-how-sticky { position: relative !important; height: auto !important;
      display: flex !important; flex-direction: row !important;
      overflow-x: auto !important; gap: 12px !important;
      margin-bottom: 32px !important; padding-bottom: 8px !important; }
    .ff-how-panel  { min-height: auto !important; padding-top: 32px !important; }
    .ff-feature-pair { display: flex !important; flex-direction: column !important; margin-bottom: 56px !important; }
    .ff-feature-pair > * { order: unset !important; }
    .ff-pricing-grid { grid-template-columns: 1fr !important; max-width: 420px !important; margin: 0 auto !important; }
    .ff-cta-section::before { background-position: bottom 25% center !important; background-size: cover !important; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ff-scroll-bob { animation: none !important; }
    .ff-how-panel, .ff-feature-pair, .ff-fade-up, .ff-pricing-card {
      opacity: 1 !important; transform: none !important;
    }
  }
`;

const S = {
  bg: "#080D0B",
  bg2: "#0D1512",
  em: "#10B981",
  em2: "#059669",
  text: "#E8EDE8",
  mid: "#8FA98A",
  dim: "#4A5C4A",
  border: "rgba(16,185,129,0.12)",
  border2: "rgba(232,237,232,0.07)",
} as const;

const sora = "'Sora', sans-serif";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [seedPrompt, setSeedPrompt] = useState("");
  const [activeChip, setActiveChip] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [activeHowStep, setActiveHowStep] = useState(0);

  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const howPanelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const seedTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const focusSeedPrompt = () => {
    seedTextareaRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    seedTextareaRef.current?.focus();
  };

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  // Scroll to section when arriving via a cross-page hash link (e.g. /#pricing from Contact)
  useEffect(() => {
    if (!window.location.hash) return;
    const id = window.location.hash.slice(1);
    const el = document.getElementById(id);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  // Inject Sora font
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&display=swap";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // How-it-works IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    howPanelRefs.current.forEach((panel, i) => {
      if (!panel) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            panel.classList.add("visible");
            setActiveHowStep(i);
          }
        },
        { threshold: 0.5 },
      );
      obs.observe(panel);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // Scroll reveal — features, pricing, fade-ups
  useEffect(() => {
    const els = document.querySelectorAll(
      ".ff-feature-pair, .ff-pricing-card, .ff-fade-up",
    );
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const handleGenerate = async () => {
    const prompt = seedPrompt.trim();
    if (!prompt || generating) return;
    setGenerating(true);
    setGenStep(0);
    const startedAt = Date.now();
    let step = 0;
    stepRef.current = setInterval(() => {
      step += 1;
      setGenStep((s) => Math.min(s + 1, GEN_STEPS.length - 1));
      if (step >= GEN_STEPS.length - 1 && stepRef.current)
        clearInterval(stepRef.current);
    }, 1800);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ mode: "extract", prompt }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      const pendingPayload = {
        extracted_data: data.extracted_data,
        prompt,
        elapsed_seconds: elapsedSeconds,
        timestamp: Date.now(),
        confidence_map: data.confidence_map ?? null,
        completeness_score: data.completeness_score ?? 0,
      };
      localStorage.setItem("pending_portal", JSON.stringify(pendingPayload));
      try {
        const { data: row } = await supabase
          .from("pending_businesses")
          .insert({
            extracted_data: data.extracted_data,
            prompt,
            elapsed_seconds: elapsedSeconds,
            confidence_map: data.confidence_map ?? null,
            completeness_score: data.completeness_score ?? 0,
          })
          .select("token")
          .single();
        if (row?.token) localStorage.setItem("pending_portal_token", row.token);
      } catch {
        /* non-fatal */
      }
      if (stepRef.current) clearInterval(stepRef.current);
      navigate("/preview");
    } catch (err) {
      console.error("Generate error:", err);
      if (stepRef.current) clearInterval(stepRef.current);
      setGenerating(false);
      navigate("/login");
    }
  };

  // ── Generating screen ───────────────────────────────────────────────────────
  if (generating) {
    const current = GEN_STEPS[genStep];
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-full border-[3px] border-white/10 border-t-emerald-400 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Building your business OS…
          </h2>
          <p className="text-gray-400 text-sm mb-10 min-h-[20px] transition-all duration-500">
            {current.subtitle}
          </p>
          <div className="space-y-4 text-left max-w-xs mx-auto">
            {GEN_STEPS.map((step, i) => {
              const done = i < genStep;
              const active = i === genStep;
              return (
                <div key={step.label} className="flex items-center gap-3">
                  <span
                    className={`w-5 shrink-0 text-center text-sm font-bold transition-colors duration-300 ${done ? "text-emerald-400" : active ? "text-gray-400" : "text-gray-700"}`}
                  >
                    {done ? "✓" : "·"}
                  </span>
                  <span
                    className={`text-base font-medium transition-colors duration-300 ${done ? "text-emerald-400" : active ? "text-white" : "text-gray-600"}`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Main page ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: S.bg,
        color: S.text,
        fontFamily: "Inter, sans-serif",
        minHeight: "100vh",
      }}
    >
      <style>{PAGE_CSS}</style>

      <SiteHeader />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        id="hero"
        className="ff-hero-section"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "flex-end",
          paddingTop: "80px",
          paddingBottom: "30px",
        }}
      >
        <div className="ff-hero-overlay" />

        <div
          className="ff-hero-content"
          style={{
            width: "100%",
            maxWidth: "896px",
            margin: "0 auto",
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          {/* Headline */}
          <h1
            style={{
              fontFamily: sora,
              fontWeight: 600,
              fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
              lineHeight: 1.15,
              color: S.text,
              marginBottom: "20px",
              letterSpacing: "-0.02em",
            }}
          >
            Your Business,
            <br />
            <span style={{ color: S.em }}> Fully Assembled.</span>
          </h1>

          {/* Sub */}
          <p
            style={{
              color: S.mid,
              fontSize: "clamp(1rem, 2vw, 1.15rem)",
              maxWidth: "520px",
              margin: "0 auto 48px",
              lineHeight: 1.65,
            }}
          >
            Describe what you do. Forgefly builds the rest.
          </p>
          <div style={{ height: "80px" }} />

          {/* ── SEED PROMPT + PILLS ────────────────────────────────────────── */}
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700 delay-400">
            <div className="rounded-2xl border border-white/45 bg-white/10 backdrop-blur-sm shadow-2xl overflow-hidden">
              <textarea
                ref={seedTextareaRef}
                value={seedPrompt}
                onChange={(e) => {
                  setSeedPrompt(e.target.value);
                  setActiveChip(null);
                }}
                placeholder="Describe your business - For Example: What do you do? Where are you based? Who is your potential clientele? What Services/Packagaes/Options you provide? Any Brand specific color?  ** You can always add/edit these after creating the Business OS."
                className="w-full bg-transparent text-white text-base italic leading-relaxed p-6 pb-4 resize-none outline-none placeholder:text-gray-400 placeholder:italic min-h-[100px]"
                rows={3}
                a
              />
              {/* Fixed-height warning row — always reserves space */}
              <div className="h-8 flex items-center px-6">
                {validatePrompt(seedPrompt) && seedPrompt.trim().length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-400">
                      {validatePrompt(seedPrompt)}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {/* Full-width button outside the card */}
            <Button
              size="lg"
              className="w-4/5 mt-3 bg-emerald-500 text-white hover:bg-emerald-600 font-base py-4 text-base disabled:opacity-70"
              onClick={handleGenerate}
              disabled={generating || !seedPrompt.trim()}
            >
              {generating ? (
                <>
                  <span className="w-4 h-4 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin mr-2" />
                  Building your OS…
                </>
              ) : (
                <>
                  Generate my business
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
              {SEED_CHIPS.map((chip, i) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setActiveChip(i);
                    setSeedPrompt(SEED_EXAMPLES[i + 1]);
                  }}
                  className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                    activeChip === i
                      ? "border-emerald-500/60 text-emerald-400 bg-emerald-500/10"
                      : "border-white/80 text-white/80 hover:border-white/40 hover:text-gray-200"
                  }`}
                >
                  {chip}
                </button>
              ))}
              {(activeChip !== null || seedPrompt.trim().length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveChip(null);
                    setSeedPrompt("");
                  }}
                  className="px-4 py-2 rounded-full text-sm border border-white/80 text-white/80 hover:border-white/40 hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          {/* ── END SEED SECTION ──────────────────────────────────────────── */}

          <div
            className="ff-scroll-bob"
            style={{
              marginTop: "56px",
              color: S.dim,
              fontSize: "0.75rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>↓</span>
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────────── */}
      <section id="how" style={{ padding: "120px 0", background: S.bg }}>
        <div
          style={{ maxWidth: "1152px", margin: "0 auto", padding: "0 24px" }}
        >
          <div
            className="ff-fade-up"
            style={{ textAlign: "center", marginBottom: "80px" }}
          >
            <p
              style={{
                color: S.em,
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "12px",
              }}
            >
              How it works
            </p>
            <h2
              style={{
                fontFamily: sora,
                fontWeight: 600,
                fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
                color: S.text,
                letterSpacing: "-0.02em",
              }}
            >
              From prompt to business OS
              <br />
              in under 60 seconds
            </h2>
          </div>

          <div
            className="ff-how-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              minHeight: "400vh",
              gap: "0 80px",
            }}
          >
            {/* Left sticky indicators */}
            <div
              className="ff-how-sticky"
              style={{
                position: "sticky",
                top: 0,
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              {HOW_STEPS.map((step, i) => (
                <div
                  key={step.num}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "22px 0",
                    borderBottom:
                      i < HOW_STEPS.length - 1
                        ? `1px solid ${S.border2}`
                        : "none",
                    opacity: activeHowStep === i ? 1 : 0.35,
                    transition: "opacity 0.35s ease",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      background:
                        activeHowStep === i ? S.em : "rgba(16,185,129,0.08)",
                      color: activeHowStep === i ? S.bg : S.em,
                      border:
                        activeHowStep === i
                          ? "none"
                          : `1px solid rgba(16,185,129,0.18)`,
                      transition: "background 0.35s ease, color 0.35s ease",
                    }}
                  >
                    {step.num}
                  </div>
                  <span
                    style={{
                      fontFamily: sora,
                      fontSize: "1rem",
                      fontWeight: activeHowStep === i ? 500 : 400,
                      color: activeHowStep === i ? S.text : S.dim,
                      transition: "color 0.35s ease",
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Right scrolling panels */}
            <div>
              {/* Panel 1 */}
              <div
                className="ff-how-panel"
                ref={(el) => {
                  howPanelRefs.current[0] = el;
                }}
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "80px",
                }}
              >
                <div
                  style={{
                    background: S.bg2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "16px",
                    padding: "28px",
                    marginBottom: "28px",
                  }}
                >
                  <p
                    style={{
                      color: S.dim,
                      fontSize: "0.7rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "12px",
                    }}
                  >
                    Your prompt
                  </p>
                  <p
                    style={{
                      color: S.text,
                      fontSize: "0.9rem",
                      lineHeight: 1.65,
                      marginBottom: "20px",
                    }}
                  >
                    "I'm a brand strategist + identity designer. Full Brand
                    Identity $4,200, Discovery Workshop $950, Brand Guidelines
                    $1,800. Remote, purpose-driven founders."
                  </p>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
                  >
                    {[
                      "Brand Strategist",
                      "Identity Designer",
                      "Remote",
                      "3 services",
                      "$4,200 avg",
                    ].map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: "3px 10px",
                          borderRadius: "6px",
                          background: "rgba(16,185,129,0.07)",
                          border: `1px solid rgba(16,185,129,0.14)`,
                          color: S.em,
                          fontSize: "0.72rem",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <h3
                  style={{
                    fontFamily: sora,
                    fontWeight: 600,
                    fontSize: "1.4rem",
                    color: S.text,
                    marginBottom: "12px",
                  }}
                >
                  Describe what you do
                </h3>
                <p style={{ color: S.mid, lineHeight: 1.65 }}>
                  Write freely — your niche, services, rates, and clients.
                  Forgefly's AI classifies every detail into a structured
                  business profile.
                </p>
              </div>

              {/* Panel 2 */}
              <div
                className="ff-how-panel"
                ref={(el) => {
                  howPanelRefs.current[1] = el;
                }}
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "80px",
                }}
              >
                <div
                  style={{
                    background: S.bg2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "16px",
                    padding: "28px",
                    marginBottom: "28px",
                  }}
                >
                  <p
                    style={{
                      color: S.dim,
                      fontSize: "0.7rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "16px",
                    }}
                  >
                    Generating
                  </p>
                  {GEN_STEPS.slice(0, 5).map((step, i) => (
                    <div
                      key={step.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "10px",
                      }}
                    >
                      <span
                        style={{
                          color: S.em,
                          fontSize: "0.75rem",
                          width: "16px",
                        }}
                      >
                        ✓
                      </span>
                      <span
                        style={{
                          color: i < 3 ? S.text : S.dim,
                          fontSize: "0.85rem",
                        }}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "12px",
                      background: "rgba(16,185,129,0.04)",
                      borderRadius: "8px",
                      border: `1px solid rgba(16,185,129,0.1)`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      {["#0A4228", "#10B981", "#E1F5EE", "#085041"].map((c) => (
                        <div
                          key={c}
                          style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "4px",
                            background: c,
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        />
                      ))}
                    </div>
                    <p style={{ color: S.mid, fontSize: "0.72rem" }}>
                      Brand palette extracted from your niche
                    </p>
                  </div>
                </div>
                <h3
                  style={{
                    fontFamily: sora,
                    fontWeight: 600,
                    fontSize: "1.4rem",
                    color: S.text,
                    marginBottom: "12px",
                  }}
                >
                  Watch it assemble
                </h3>
                <p style={{ color: S.mid, lineHeight: 1.65 }}>
                  Services are packaged, a proposal drafted, your brand kit
                  generated, and pipeline stages mapped — in seconds.
                </p>
              </div>

              {/* Panel 3 */}
              <div
                className="ff-how-panel"
                ref={(el) => {
                  howPanelRefs.current[2] = el;
                }}
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "80px",
                }}
              >
                <div
                  style={{
                    background: S.bg2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "16px",
                    padding: "28px",
                    marginBottom: "28px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "20px",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        background: `linear-gradient(135deg, ${S.em}, ${S.em2})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}
                    >
                      P
                    </div>
                    <div>
                      <p
                        style={{
                          color: S.text,
                          fontWeight: 600,
                          fontSize: "0.9rem",
                        }}
                      >
                        PacUX Studio
                      </p>
                      <p style={{ color: S.dim, fontSize: "0.72rem" }}>
                        pacux.forgefly.io
                      </p>
                    </div>
                    <span
                      style={{
                        marginLeft: "auto",
                        padding: "3px 10px",
                        borderRadius: "6px",
                        background: "rgba(16,185,129,0.08)",
                        border: `1px solid rgba(16,185,129,0.18)`,
                        color: S.em,
                        fontSize: "0.68rem",
                        fontWeight: 600,
                      }}
                    >
                      Live
                    </span>
                  </div>
                  {[
                    "Brand Discovery Workshop — $950",
                    "Full Brand Identity — $4,200",
                    "Brand Guidelines — $1,800",
                  ].map((s) => (
                    <div
                      key={s}
                      style={{
                        padding: "10px 12px",
                        marginBottom: "8px",
                        background: "rgba(255,255,255,0.025)",
                        borderRadius: "8px",
                        color: S.mid,
                        fontSize: "0.85rem",
                        borderLeft: `2px solid rgba(16,185,129,0.3)`,
                      }}
                    >
                      {s}
                    </div>
                  ))}
                </div>
                <h3
                  style={{
                    fontFamily: sora,
                    fontWeight: 600,
                    fontSize: "1.4rem",
                    color: S.text,
                    marginBottom: "12px",
                  }}
                >
                  Your business is live
                </h3>
                <p style={{ color: S.mid, lineHeight: 1.65 }}>
                  A shareable client portal appears instantly — your services,
                  brand colors, and contact details, ready to send to prospects.
                </p>
              </div>

              {/* Panel 4 */}
              <div
                className="ff-how-panel"
                ref={(el) => {
                  howPanelRefs.current[3] = el;
                }}
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: "80px",
                }}
              >
                <div
                  style={{
                    background: S.bg2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "16px",
                    padding: "28px",
                    marginBottom: "28px",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    {[
                      { label: "Revenue MTD", value: "$8,400", color: S.em },
                      { label: "Active clients", value: "7", color: S.em },
                      { label: "Open proposals", value: "3", color: "#F59E0B" },
                      {
                        label: "Invoices due",
                        value: "$2,950",
                        color: "#F59E0B",
                      },
                    ].map((cell) => (
                      <div
                        key={cell.label}
                        style={{
                          padding: "16px",
                          background: "rgba(255,255,255,0.025)",
                          borderRadius: "10px",
                          border: `1px solid ${S.border2}`,
                        }}
                      >
                        <p
                          style={{
                            color: S.dim,
                            fontSize: "0.65rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: "6px",
                          }}
                        >
                          {cell.label}
                        </p>
                        <p
                          style={{
                            color: cell.color,
                            fontWeight: 700,
                            fontSize: "1.4rem",
                            fontFamily: sora,
                          }}
                        >
                          {cell.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <h3
                  style={{
                    fontFamily: sora,
                    fontWeight: 600,
                    fontSize: "1.4rem",
                    color: S.text,
                    marginBottom: "12px",
                  }}
                >
                  Run everything from one place
                </h3>
                <p style={{ color: S.mid, lineHeight: 1.65 }}>
                  Proposals, invoices, projects, calendar, finances, and AI
                  insights — your full business command center, no tab-juggling
                  required.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: "120px 0", background: S.bg }}>
        <div
          style={{ maxWidth: "1152px", margin: "0 auto", padding: "0 24px" }}
        >
          <div
            className="ff-fade-up"
            style={{ textAlign: "center", marginBottom: "80px" }}
          >
            <p
              style={{
                color: S.em,
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "12px",
              }}
            >
              Features
            </p>
            <h2
              style={{
                fontFamily: sora,
                fontWeight: 600,
                fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
                color: S.text,
                letterSpacing: "-0.02em",
              }}
            >
              Everything a freelance business needs.
              <br />
              <span style={{ color: S.mid, fontWeight: 400 }}>
                Nothing you don't.
              </span>
            </h2>
          </div>

          {[
            {
              title: "Generate, then gate",
              desc: "Get your business OS first. No form, no credit card, no friction. The AI builds your entire workspace from a single prompt. Sign up happens after — because seeing is believing.",
              reverse: false,
              visual: (
                <div
                  style={{
                    background: S.bg2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "16px",
                    padding: "28px",
                  }}
                >
                  {GEN_STEPS.map((s, i) => (
                    <div
                      key={s.label}
                      style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "center",
                        marginBottom: "12px",
                      }}
                    >
                      <span
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.58rem",
                          flexShrink: 0,
                          background:
                            i < 4
                              ? "rgba(16,185,129,0.12)"
                              : "rgba(255,255,255,0.04)",
                          border: `1px solid ${i < 4 ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}`,
                          color: i < 4 ? S.em : S.dim,
                        }}
                      >
                        ✓
                      </span>
                      <span
                        style={{
                          color: i < 4 ? S.text : S.dim,
                          fontSize: "0.85rem",
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              title: "Let's make you visible",
              desc: "A public portfolio page that actually converts. Custom sections, work samples, AI-selected testimonials, and a live client portal — all under your brand, not ours.",
              reverse: true,
              visual: (
                <div
                  style={{
                    background: S.bg2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "16px",
                    padding: "28px",
                  }}
                >
                  {[
                    "Public portfolio page",
                    "Client portal link",
                    "Work samples gallery",
                    "Testimonials (AI-curated)",
                    "Custom brand colors + logo",
                    "forgefly.io/yourname",
                  ].map((item, i) => (
                    <div
                      key={item}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "9px 0",
                        borderBottom: i < 5 ? `1px solid ${S.border2}` : "none",
                      }}
                    >
                      <span style={{ color: S.em, fontSize: "0.75rem" }}>
                        ✦
                      </span>
                      <span
                        style={{
                          color: i < 5 ? S.text : S.em,
                          fontSize: "0.85rem",
                        }}
                      >
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              title: "Client portal",
              desc: "Give every client a private space with proposals, active contracts, invoices, and a direct message thread. Professional, without the agency overhead.",
              reverse: false,
              visual: (
                <div
                  style={{
                    background: S.bg2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "16px",
                    padding: "28px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "16px",
                    }}
                  >
                    {["Overview", "Proposal", "Invoice", "Messages"].map(
                      (tab, i) => (
                        <span
                          key={tab}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "0.72rem",
                            background:
                              i === 1 ? "rgba(16,185,129,0.1)" : "transparent",
                            color: i === 1 ? S.em : S.dim,
                            border:
                              i === 1
                                ? `1px solid rgba(16,185,129,0.18)`
                                : "none",
                          }}
                        >
                          {tab}
                        </span>
                      ),
                    )}
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      borderRadius: "10px",
                      padding: "16px",
                      border: `1px solid ${S.border2}`,
                    }}
                  >
                    <p
                      style={{
                        color: S.text,
                        fontWeight: 600,
                        marginBottom: "6px",
                        fontSize: "0.9rem",
                      }}
                    >
                      Brand Identity Project
                    </p>
                    <p
                      style={{
                        color: S.mid,
                        fontSize: "0.78rem",
                        marginBottom: "14px",
                      }}
                    >
                      Full Brand Identity · $4,200
                    </p>
                    <div
                      style={{
                        height: "4px",
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: "2px",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: "65%",
                          background: `linear-gradient(90deg, ${S.em}, ${S.em2})`,
                          borderRadius: "2px",
                        }}
                      />
                    </div>
                    <p
                      style={{
                        color: S.dim,
                        fontSize: "0.68rem",
                        marginTop: "6px",
                      }}
                    >
                      65% complete
                    </p>
                  </div>
                </div>
              ),
            },
            {
              title: "Proposals that close",
              desc: "AI-generated proposals tailored to your niche and the client. Send directly from Forgefly, track opens, and get notified the moment someone views or accepts.",
              reverse: true,
              visual: (
                <div
                  style={{
                    background: S.bg2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "16px",
                    padding: "28px",
                  }}
                >
                  {[
                    {
                      name: "Novo Agency",
                      service: "Brand Identity",
                      value: "$4,200",
                      status: "Accepted",
                      c: S.em,
                    },
                    {
                      name: "Drift Labs",
                      service: "Discovery Workshop",
                      value: "$950",
                      status: "Viewed",
                      c: "#F59E0B",
                    },
                    {
                      name: "Mira & Co.",
                      service: "Brand Guidelines",
                      value: "$1,800",
                      status: "Sent",
                      c: S.mid,
                    },
                  ].map((p) => (
                    <div
                      key={p.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 0",
                        borderBottom: `1px solid ${S.border2}`,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            color: S.text,
                            fontSize: "0.85rem",
                            fontWeight: 500,
                          }}
                        >
                          {p.name}
                        </p>
                        <p style={{ color: S.dim, fontSize: "0.72rem" }}>
                          {p.service} · {p.value}
                        </p>
                      </div>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.68rem",
                          background: `${p.c}18`,
                          color: p.c,
                          border: `1px solid ${p.c}28`,
                        }}
                      >
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              title: "Finances without the spreadsheet",
              desc: "P&L at a glance. Cashflow forecast. Tax estimates. SEP-IRA nudges. Forgefly turns your invoice data into financial clarity — no accountant degree required.",
              reverse: false,
              visual: (
                <div
                  style={{
                    background: S.bg2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "16px",
                    padding: "28px",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginBottom: "16px",
                    }}
                  >
                    {[
                      { l: "Revenue", v: "$31,400", c: S.em },
                      { l: "Expenses", v: "$4,200", c: "#F87171" },
                      { l: "Net profit", v: "$27,200", c: S.em },
                      { l: "Tax reserve", v: "$8,160", c: "#F59E0B" },
                    ].map((cell) => (
                      <div
                        key={cell.l}
                        style={{
                          padding: "12px",
                          background: "rgba(255,255,255,0.025)",
                          borderRadius: "8px",
                          border: `1px solid ${S.border2}`,
                        }}
                      >
                        <p
                          style={{
                            color: S.dim,
                            fontSize: "0.62rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: "4px",
                          }}
                        >
                          {cell.l}
                        </p>
                        <p
                          style={{
                            color: cell.c,
                            fontWeight: 700,
                            fontSize: "1.1rem",
                            fontFamily: sora,
                          }}
                        >
                          {cell.v}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "rgba(245,158,11,0.05)",
                      borderRadius: "8px",
                      border: "1px solid rgba(245,158,11,0.14)",
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    <span style={{ color: "#F59E0B" }}>⚠</span>
                    <p style={{ color: S.mid, fontSize: "0.75rem" }}>
                      Q3 estimated tax due Sept 15 · $2,720
                    </p>
                  </div>
                </div>
              ),
            },
            {
              title: "Time tracking that pays",
              desc: "Log hours per project. Forgefly maps time to revenue and flags scope creep before it eats your margin. See exactly which clients are profitable — and which aren't.",
              reverse: true,
              visual: (
                <div
                  style={{
                    background: S.bg2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "16px",
                    padding: "28px",
                  }}
                >
                  {[
                    {
                      project: "Novo Brand Identity",
                      hours: "14.5h",
                      rate: "$290/hr effective",
                      margin: "92%",
                      c: S.em,
                    },
                    {
                      project: "Drift Discovery",
                      hours: "9.0h",
                      rate: "$105/hr effective",
                      margin: "71%",
                      c: "#F59E0B",
                    },
                    {
                      project: "Mira Guidelines",
                      hours: "22.0h",
                      rate: "$82/hr effective",
                      margin: "55%",
                      c: "#F87171",
                    },
                  ].map((r) => (
                    <div
                      key={r.project}
                      style={{
                        padding: "12px 0",
                        borderBottom: `1px solid ${S.border2}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "4px",
                        }}
                      >
                        <span style={{ color: S.text, fontSize: "0.85rem" }}>
                          {r.project}
                        </span>
                        <span
                          style={{
                            color: r.c,
                            fontSize: "0.8rem",
                            fontWeight: 600,
                          }}
                        >
                          {r.margin}
                        </span>
                      </div>
                      <p style={{ color: S.dim, fontSize: "0.72rem" }}>
                        {r.hours} · {r.rate}
                      </p>
                    </div>
                  ))}
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "10px 12px",
                      background: "rgba(16,185,129,0.04)",
                      borderRadius: "8px",
                      border: `1px solid rgba(16,185,129,0.1)`,
                    }}
                  >
                    <p style={{ color: S.em, fontSize: "0.75rem" }}>
                      ↑ Novo is your most profitable client. Consider a retainer
                      offer.
                    </p>
                  </div>
                </div>
              ),
            },
            {
              title: "Freeda, your AI copilot",
              desc: "One panel, always open. Ask what your pipeline looks like, update a price, or draft a follow-up — Freeda reads your real data, never guesses, and never touches anything without showing you first.",
              reverse: false,
              visual: (
                <div
                  style={{
                    background: S.bg2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "16px",
                    padding: "28px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginBottom: "12px",
                    }}
                  >
                    <p
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${S.border2}`,
                        borderRadius: "10px",
                        padding: "9px 12px",
                        color: S.text,
                        fontSize: "0.82rem",
                        maxWidth: "78%",
                      }}
                    >
                      Which client owes me the most right now?
                    </p>
                  </div>
                  <div
                    style={{
                      background: "rgba(16,185,129,0.05)",
                      border: `1px solid ${S.border}`,
                      borderRadius: "10px",
                      padding: "12px",
                    }}
                  >
                    <p
                      style={{
                        color: S.text,
                        fontSize: "0.82rem",
                        lineHeight: 1.6,
                        marginBottom: "10px",
                      }}
                    >
                      Novo Agency — $2,400 outstanding, 6 days overdue. Want me
                      to draft a reminder?
                    </p>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "5px 11px",
                        borderRadius: "999px",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        background: "rgba(16,185,129,0.12)",
                        color: S.em,
                        border: `1px solid rgba(16,185,129,0.25)`,
                      }}
                    >
                      Draft reminder →
                    </span>
                  </div>
                </div>
              ),
            },
            {
              title: "AI-drafted social promotions",
              desc: "A photo, a caption, and a short Reel — generated from your business and ready to review. Connect Instagram and Facebook once; publishing after that is one click.",
              reverse: true,
              visual: (
                <div
                  style={{
                    background: S.bg2,
                    border: `1px solid ${S.border}`,
                    borderRadius: "16px",
                    padding: "28px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "16px",
                    }}
                  >
                    <span
                      style={{
                        color: S.em,
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Promotion ready
                    </span>
                    <span style={{ color: S.dim, fontSize: "0.72rem" }}>
                      Photo + Reel
                    </span>
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      border: `1px solid ${S.border2}`,
                      borderRadius: "10px",
                      padding: "14px",
                      marginBottom: "14px",
                    }}
                  >
                    <p
                      style={{
                        color: S.text,
                        fontSize: "0.82rem",
                        lineHeight: 1.6,
                      }}
                    >
                      "Fresh batch, fresh week 🍞 Custom cakes made to order —
                      link in bio to get started."
                    </p>
                  </div>
                  {["Instagram", "Facebook"].map((p, i) => (
                    <div
                      key={p}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "9px 0",
                        borderBottom:
                          i === 0 ? `1px solid ${S.border2}` : "none",
                      }}
                    >
                      <span style={{ color: S.mid, fontSize: "0.82rem" }}>
                        {p}
                      </span>
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: "6px",
                          fontSize: "0.68rem",
                          background: "rgba(16,185,129,0.1)",
                          color: S.em,
                          border: `1px solid rgba(16,185,129,0.18)`,
                        }}
                      >
                        Connected
                      </span>
                    </div>
                  ))}
                </div>
              ),
            },
          ].map((feat, i) => (
            <div
              key={feat.title}
              className="ff-feature-pair"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "60px",
                alignItems: "center",
                marginBottom: i < 7 ? "96px" : "0",
              }}
            >
              <div
                className="ff-feature-visual"
                style={{ order: feat.reverse ? 2 : 1 }}
              >
                {feat.visual}
              </div>
              <div style={{ order: feat.reverse ? 1 : 2 }}>
                <h3
                  style={{
                    fontFamily: sora,
                    fontWeight: 600,
                    fontSize: "1.55rem",
                    color: S.text,
                    marginBottom: "16px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {feat.title}
                </h3>
                <p
                  style={{
                    color: S.mid,
                    lineHeight: 1.7,
                    fontSize: "0.975rem",
                  }}
                >
                  {feat.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Commenting for now - Will re-think this later */}
      {/* ── About ─────────────────────────────────────────────────────────────
      <section id="about" style={{ padding: "120px 0", background: S.bg2 }}>
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "0 24px" }}>
          <div className="ff-fade-up" style={{ textAlign: "center" }}>
            <p
              style={{
                color: S.em,
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "12px",
              }}
            >
              About
            </p>
            <h2
              style={{
                fontFamily: sora,
                fontWeight: 600,
                fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
                color: S.text,
                letterSpacing: "-0.02em",
                marginBottom: "28px",
              }}
            >
              Built for people who'd rather
              <br />
              <span style={{ color: S.mid, fontWeight: 400 }}>
                be doing the work.
              </span>
            </h2>
            <p
              style={{
                color: S.mid,
                lineHeight: 1.8,
                fontSize: "1.02rem",
              }}
            >
              Most freelancers end up running their business out of five tools
              that don't talk to each other — one for invoices, one for the
              portfolio, one for messages, a spreadsheet named "FINAL_v3."
              Forgefly is what happens when all of it lives in one place: built
              from a single description of your business, kept moving by an AI
              copilot that actually knows what's in it, and ready to post,
              invoice, and follow up without you copy-pasting between tabs to
              make it happen.
            </p>
            <p
              style={{
                color: S.mid,
                lineHeight: 1.8,
                fontSize: "1.02rem",
                marginTop: "18px",
              }}
            >
              No procurement process, no onboarding call. Describe your
              business, and it's already running.
            </p>
          </div>
        </div>
      </section> */}

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: "120px 0", background: S.bg }}>
        <div
          style={{ maxWidth: "1152px", margin: "0 auto", padding: "0 24px" }}
        >
          <div
            className="ff-fade-up"
            style={{ textAlign: "center", marginBottom: "64px" }}
          >
            <p
              style={{
                color: S.em,
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "12px",
              }}
            >
              Pricing
            </p>
            <h2
              style={{
                fontFamily: sora,
                fontWeight: 600,
                fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
                color: S.text,
                letterSpacing: "-0.02em",
                marginBottom: "12px",
              }}
            >
              Start free. Scale when you're ready.
            </h2>
            <p style={{ color: S.mid }}>
              30-day free trial on all plans. No credit card required.
            </p>
          </div>

          <div
            className="ff-pricing-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "24px",
              alignItems: "stretch",
            }}
          >
            {[
              {
                name: "Solo",
                price: "$9.99",
                period: "/mo",
                desc: "Core ops for solo freelancers",
                featured: false,
                delay: "0s",
                features: [
                  "Client portal + public portfolio",
                  "Pipeline + project tracking",
                  "AI proposal generation",
                  "Invoice management",
                  "Brand kit",
                  "Basic AI copilot",
                  "–",
                  "–",
                ],
              },
              {
                name: "Pro",
                price: "$14.99",
                period: "/mo",
                desc: "Full AI suite for serious freelancers",
                featured: true,
                delay: "0.1s",
                features: [
                  "Everything in Solo",
                  "Visibility engine + outreach",
                  "Per-client portals",
                  "Finances + cashflow forecast",
                  "Time tracking + profitability",
                  "Testimonial engine",
                  "Advanced AI copilot",
                  "Priority support",
                ],
              },
              {
                name: "Agency",
                price: "Contact for Pricing",
                period: "",
                desc: "For teams who want a customized business OS",
                featured: false,
                delay: "0.2s",
                contactSales: true,
                features: [
                  "Everything in Pro",
                  "Opus-tier AI (highest accuracy)",
                  "Custom domain",
                  "Demand signals",
                  "Tax export (CSV)",
                  "White-label portals",
                  "Team member management",
                  "API access",
                ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className="ff-pricing-card"
                style={{
                  position: "relative",
                  background: plan.featured
                    ? "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.03))"
                    : S.bg2,
                  border: plan.featured
                    ? `1px solid rgba(16,185,129,0.32)`
                    : `1px solid ${S.border2}`,
                  borderRadius: "16px",
                  padding: "32px",
                  display: "flex",
                  flexDirection: "column",
                  transitionDelay: plan.delay,
                }}
              >
                {plan.featured && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-12px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: `linear-gradient(135deg, ${S.em}, ${S.em2})`,
                      color: "#fff",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      padding: "4px 14px",
                      borderRadius: "9999px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Most popular
                  </div>
                )}
                <p
                  style={{
                    color: plan.featured ? S.em : S.mid,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: "8px",
                  }}
                >
                  {plan.name}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "4px",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: sora,
                      fontWeight: 600,
                      fontSize: plan.contactSales ? "1.5rem" : "2.8rem",
                      color: S.text,
                      lineHeight: 1.2,
                    }}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span style={{ color: S.dim, marginBottom: "6px" }}>
                      {plan.period}
                    </span>
                  )}
                </div>
                <p
                  style={{
                    color: S.dim,
                    fontSize: "0.82rem",
                    marginBottom: "28px",
                  }}
                >
                  {plan.desc}
                </p>
                <ul
                  style={{
                    flex: 1,
                    marginBottom: "28px",
                    listStyle: "none",
                    padding: 0,
                  }}
                >
                  {plan.features.map((f, fi) => (
                    <li
                      key={fi}
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "flex-start",
                        marginBottom: "10px",
                      }}
                    >
                      <span
                        style={{
                          color: f === "–" ? S.border2 : S.em,
                          fontSize: "0.8rem",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      >
                        {f === "–" ? "–" : "✓"}
                      </span>
                      <span
                        style={{
                          color: f === "–" ? S.dim : S.mid,
                          fontSize: "0.875rem",
                        }}
                      >
                        {f === "–" ? "Not included" : f}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() =>
                    navigate(plan.contactSales ? "/contact" : "/login")
                  }
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "opacity 0.2s",
                    background: plan.featured
                      ? `linear-gradient(135deg, ${S.em}, ${S.em2})`
                      : "transparent",
                    color: plan.featured ? "#fff" : S.text,
                    border: plan.featured ? "none" : `1px solid ${S.border2}`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.82")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  {plan.contactSales ? "Contact sales" : "Start free trial"}
                </button>
              </div>
            ))}
          </div>
          <p
            style={{
              textAlign: "center",
              color: S.dim,
              fontSize: "0.78rem",
              marginTop: "20px",
            }}
          >
            Compare plans in detail →
          </p>
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────────────────── */}
      <section
        id="closing"
        className="ff-cta-section"
        style={{
          padding: "120px 0",
          background: S.bg,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="ff-bloom"
          style={{ top: "-20%", left: "50%", transform: "translateX(-50%)" }}
        />
        <div
          style={{
            maxWidth: "720px",
            margin: "0 auto",
            padding: "0 24px",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h2
            className="ff-fade-up"
            style={{
              fontFamily: sora,
              fontWeight: 600,
              fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
              color: S.text,
              letterSpacing: "-0.02em",
              marginBottom: "20px",
              lineHeight: 1.2,
            }}
          >
            Stop running your business
            <br />
            from a dozen different tabs.
          </h2>
          <p
            className="ff-fade-up"
            style={{
              color: S.mid,
              fontSize: "1.05rem",
              maxWidth: "460px",
              margin: "0 auto 40px",
              lineHeight: 1.65,
            }}
          >
            Proposals, invoices, clients, projects, finances, and AI assistance
            — all in one place. Built specifically for people who work for
            themselves.
          </p>
          <div
            className="ff-fade-up"
            style={{
              display: "flex",
              gap: "16px",
              justifyContent: "center",
              flexWrap: "wrap",
              marginBottom: "56px",
            }}
          >
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("hero")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: `linear-gradient(135deg, ${S.em}, ${S.em2})`,
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "14px 28px",
                fontSize: "1rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Generate my business <ArrowRight size={18} />
            </button>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("how")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "transparent",
                color: S.text,
                border: `1px solid ${S.border2}`,
                borderRadius: "10px",
                padding: "14px 28px",
                fontSize: "1rem",
                cursor: "pointer",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = S.border2)
              }
            >
              See how it works
            </button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
