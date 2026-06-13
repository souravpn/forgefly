import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  TestTubeDiagonal,
  Zap,
  Target,
  TrendingUp,
  Users,
  Calendar,
  FileText,
  DollarSign,
  Briefcase,
  ArrowRight,
  CheckCircle2,
  Rocket,
  ChevronLeft,
  ChevronRight,
  Star,
  Check,
  Crown,
  AlertTriangle,
} from "lucide-react";

function validatePrompt(prompt: string): string | null {
  const trimmed = prompt.trim();
  if (trimmed.length < 30) {
    return "Tell us a bit more — what do you do and who do you work with?";
  }
  const hasService = /\b(offer|service|speciali[sz]|package|consult|design|develop|write|photo|coach|audit|sprint|retainer)\b/i.test(trimmed);
  if (!hasService) {
    return "Mention at least one service you offer to get the best results.";
  }
  return null;
}
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/db/supabase";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const SEED_EXAMPLES = [
  "I am a UX/UI designer specializing in mobile apps and SaaS dashboards, based in San Francisco, CA. I offer services like UX Audit ($1,800), Design Sprint ($4,500), Full Product Design ($12,000), and a monthly Design Partner retainer ($2,200/mo). I work with Series A startups and scale-ups.",
  "Freelance copywriter based in Austin, TX. I write conversion-focused landing pages ($1,200), email sequences ($800), and brand messaging guides ($2,500). My clients are DTC brands and B2B SaaS companies.",
  "Full-stack dev agency in NYC. We build MVPs ($15,000–$30,000), do ongoing retainers ($5,000/mo), and run code audits ($2,500). We specialize in React, Node, and Postgres. 3-person team.",
  "Brand strategist and identity designer. Services: Brand Discovery Workshop ($950), Full Brand Identity ($4,200), Brand Guidelines doc ($1,800). I work remotely with purpose-driven founders and small businesses.",
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

const SEED_CHIPS = [
  "UX Designer, SF",
  "Copywriter, remote",
  "Dev agency, NYC",
  "Brand strategist, Austin",
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [seedPrompt, setSeedPrompt] = useState("");
  const [activeChip, setActiveChip] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Typewriter cycling through examples
  useEffect(() => {
    let charIndex = 0;
    let exampleIndex = 0;
    let cancelled = false;

    const typeNext = () => {
      if (cancelled) return;
      const target = SEED_EXAMPLES[exampleIndex];
      if (charIndex <= target.length) {
        setSeedPrompt(target.slice(0, charIndex));
        charIndex++;
        typingRef.current = setTimeout(typeNext, 18);
      } else {
        // Pause, then clear and move to next
        cycleRef.current = setTimeout(() => {
          if (cancelled) return;
          exampleIndex = (exampleIndex + 1) % SEED_EXAMPLES.length;
          setActiveChip(exampleIndex);
          charIndex = 0;
          setSeedPrompt("");
          typingRef.current = setTimeout(typeNext, 400);
        }, 3000);
      }
    };

    typingRef.current = setTimeout(typeNext, 600);
    return () => {
      cancelled = true;
      if (typingRef.current) clearTimeout(typingRef.current);
      if (cycleRef.current) clearTimeout(cycleRef.current);
    };
  }, []);

  const features = [
    {
      icon: Users,
      title: "Client Management",
      description:
        "Organize clients, track relationships, and manage communications in one place.",
    },
    {
      icon: Briefcase,
      title: "Project Tracking",
      description:
        "Monitor project progress, deadlines, and deliverables with visual timelines.",
    },
    {
      icon: FileText,
      title: "Smart Proposals",
      description:
        "Generate professional proposals with AI assistance and send them instantly.",
    },
    {
      icon: DollarSign,
      title: "Financial Insights",
      description:
        "Track income, expenses, and forecast cashflow with interactive simulators.",
    },
    {
      icon: Calendar,
      title: "Unified Calendar",
      description:
        "Manage deadlines, meetings, and tasks in a single integrated calendar.",
    },
    {
      icon: Zap,
      title: "AI Co-pilot",
      description:
        "Context-aware AI assistant that understands your business and takes action.",
    },
  ];

  const steps = [
    {
      icon: Rocket,
      title: "Quick Setup",
      description:
        "Describe your business in plain English. Our AI understands your needs instantly.",
    },
    {
      icon: Sparkles,
      title: "AI Configuration",
      description:
        "Watch as Forgefly automatically sets up your workspace, packages, and workflows.",
    },
    {
      icon: Target,
      title: "Start Growing",
      description:
        "Manage clients, send proposals, track finances, and scale your business effortlessly.",
    },
  ];

  const benefits = [
    "Save 10+ hours per week on admin tasks",
    "Professional proposals in minutes, not hours",
    "Never miss a deadline or payment",
    "Data-driven decisions with financial forecasting",
    "Client portal for seamless collaboration",
    "All-in-one platform, no tool juggling",
    "24/7 on-call support for your business needs",
    "Effortless payments with secure Stripe integration",
  ];

  const testimonials = [
    {
      quote:
        "Forgefly turned my chaotic freelance life into a real business in under 10 minutes. The AI onboarding is pure magic.",
      name: "Sarah Chen",
      role: "Brand Designer",
      avatar:
        "https://miaoda-site-img.s3cdn.medo.dev/images/KLing_b3e4f5ce-8894-444b-9753-7c3a08c58518.jpg",
      rating: 5,
    },
    {
      quote:
        "Finally one tool that handles proposals, invoices, clients AND cashflow forecasting. I closed two clients this week because of the professional proposals.",
      name: "Marcus Okoro",
      role: "Web Developer",
      avatar:
        "https://miaoda-site-img.s3cdn.medo.dev/images/KLing_5453a9f8-1e61-4b65-8d1e-812b5d956173.jpg",
      rating: 5,
    },
    {
      quote:
        "The contextual AI Co-pilot feels like having a business partner. It actually understands my agency workflow.",
      name: "Priya Sharma",
      role: "Freelance Strategist",
      avatar:
        "https://miaoda-site-img.s3cdn.medo.dev/images/KLing_d60fe409-c0ac-4f94-aa01-824044ec4c3d.jpg",
      rating: 5,
    },
    {
      quote:
        "Stripe integration is seamless. Getting paid feels effortless now.",
      name: "Diego Morales",
      role: "Graphic Illustrator",
      avatar:
        "https://miaoda-site-img.s3cdn.medo.dev/images/KLing_652adae2-c426-40ff-b4ed-42987dbf4d24.jpg",
      rating: 5,
    },
    {
      quote:
        "I went from 7 different tools to just Forgefly. My clients love the professional portal too.",
      name: "Aisha Khan",
      role: "UI/UX Designer",
      avatar:
        "https://miaoda-site-img.s3cdn.medo.dev/images/KLing_4514af45-40f3-43c5-ab0a-3b85ec13b583.jpg",
      rating: 5,
    },
    {
      quote: "Best investment of 2026 for any solopreneur. Highly recommend.",
      name: "Jamal Wright",
      role: "Motion Designer",
      avatar:
        "https://miaoda-site-img.s3cdn.medo.dev/images/KLing_f020a5e2-d58e-4919-92bd-11122bb19132.jpg",
      rating: 5,
    },
  ];

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start" },
    [Autoplay({ delay: 5000, stopOnInteraction: false })],
  );

  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi],
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const handleGenerate = async () => {
    const prompt = seedPrompt.trim();
    if (!prompt || generating) return;
    if (typingRef.current) clearTimeout(typingRef.current);
    if (cycleRef.current) clearTimeout(cycleRef.current);

    setGenerating(true);
    setGenStep(0);
    const startedAt = Date.now();

    // Auto-advance steps every 1.8s (stops at last step)
    let step = 0;
    stepRef.current = setInterval(() => {
      step += 1;
      setGenStep((s) => Math.min(s + 1, GEN_STEPS.length - 1));
      if (step >= GEN_STEPS.length - 1 && stepRef.current) {
        clearInterval(stepRef.current);
      }
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

      // Save to localStorage as same-device fallback
      localStorage.setItem("pending_portal", JSON.stringify(pendingPayload));

      // Save to DB so the token can travel through the email verification link
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
        // Non-fatal: same-device localStorage fallback still works
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

  // ── Generating screen ────────────────────────────────────────────────────
  if (generating) {
    const current = GEN_STEPS[genStep];
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          {/* Spinner */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-full border-[3px] border-white/10 border-t-emerald-400 animate-spin" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-2">
            Building your business OS…
          </h2>
          <p className="text-gray-400 text-sm mb-10 min-h-[20px] transition-all duration-500">
            {current.subtitle}
          </p>

          {/* Steps */}
          <div className="space-y-4 text-left max-w-xs mx-auto">
            {GEN_STEPS.map((step, i) => {
              const done = i < genStep;
              const active = i === genStep;
              return (
                <div key={step.label} className="flex items-center gap-3">
                  <span
                    className={`w-5 shrink-0 text-center text-sm font-bold transition-colors duration-300 ${
                      done
                        ? "text-emerald-400"
                        : active
                          ? "text-gray-400"
                          : "text-gray-700"
                    }`}
                  >
                    {done ? "✓" : "·"}
                  </span>
                  <span
                    className={`text-base font-medium transition-colors duration-300 ${
                      done
                        ? "text-emerald-400"
                        : active
                          ? "text-white"
                          : "text-gray-600"
                    }`}
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

  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-lg">
        <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img
                src="/forgefly-icon.png"
                alt="Forgefly Logo"
                className="w-10 h-10 rounded-lg"
              />
              <div>
                <h1 className="text-xl font-bold text-white">Forgefly</h1>
                <p className="text-xs text-emerald-400">Forge Your Freedom</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-1">
              <Button
                variant="ghost"
                className="text-gray-300 hover:text-white hover:bg-white/5 text-sm"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                Home
              </Button>
              {[
                { label: "How", id: "how-it-works" },
                { label: "Reviews", id: "reviews" },
                { label: "Pricing", id: "pricing" },
              ].map(({ label, id }) => (
                <Button
                  key={id}
                  variant="ghost"
                  className="text-gray-300 hover:text-white hover:bg-white/5 text-sm"
                  onClick={() =>
                    document
                      .getElementById(id)
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                className="text-white hover:text-emerald-400 hover:bg-white/5"
                onClick={() => navigate("/login")}
              >
                Sign In
              </Button>
              <Button
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => navigate("/login")}
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="w-full md:max-w-[60vw] mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10  border border-emerald-500/20 text-emerald-400 text-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <TestTubeDiagonal className="w-4 h-4" />
            <span>• Coming Soon</span>
          </div>

          <p className="text-2xl md:text-3xl text-emerald-400 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            AI Business OS for Solopreneurs
          </p>

          <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            The all-in-one platform that combines client management, project
            tracking, financial forecasting, and AI assistance to help
            freelancers and solopreneurs scale their business with confidence.
          </p>

          {/* Seed Prompt Hero */}
          <div className="mt-10 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700 delay-400">
            <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm shadow-2xl overflow-hidden">
              {/* Textarea */}
              <textarea
                value={seedPrompt}
                onChange={(e) => setSeedPrompt(e.target.value)}
                onFocus={() => {
                  if (typingRef.current) clearTimeout(typingRef.current);
                  if (cycleRef.current) clearTimeout(cycleRef.current);
                }}
                placeholder="Describe your business — what you do, who you serve, what you charge..."
                className="w-full bg-transparent text-white text-lg leading-relaxed p-6 pb-4 resize-none outline-none placeholder:text-gray-500 min-h-[160px]"
                rows={5}
              />

              {/* Validation hint */}
              {validatePrompt(seedPrompt) && seedPrompt.trim().length > 0 && (
                <div className="flex items-center gap-2 px-6 pb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">{validatePrompt(seedPrompt)}</p>
                </div>
              )}

              {/* Bottom bar */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
                <span className="text-sm text-gray-500">
                  No account needed to generate
                </span>
                <Button
                  size="lg"
                  className="bg-white text-gray-900 hover:bg-gray-100 font-semibold px-6 disabled:opacity-60"
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
                      Generate my business OS
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Example chips */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
              {SEED_CHIPS.map((chip, i) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    if (typingRef.current) clearTimeout(typingRef.current);
                    if (cycleRef.current) clearTimeout(cycleRef.current);
                    setSeedPrompt(SEED_EXAMPLES[i]);
                    setActiveChip(i);
                  }}
                  className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                    activeChip === i
                      ? "border-emerald-500/60 text-emerald-400 bg-emerald-500/10"
                      : "border-white/20 text-gray-400 hover:border-white/40 hover:text-gray-200"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="w-full md:max-w-[60vw] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Get started in minutes with our AI-powered setup process
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <Card
                key={index}
                className="bg-white/5 backdrop-blur-sm border-white/10 hover:border-emerald-500/30 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <CardContent className="p-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                    <step.icon className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="text-sm font-semibold text-emerald-400 mb-2">
                    Step {index + 1}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent"
      >
        <div className="w-full md:max-w-[60vw] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need to Scale
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Powerful features designed specifically for solopreneurs and
              freelancers
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="bg-white/5 backdrop-blur-sm border-white/10 hover:border-amber-500/30 transition-all duration-300 group animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="w-full md:max-w-[60vw] mx-auto">
          {/* Centered Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 text-balance">
              Built for Freelancers Who Want More
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto text-pretty">
              Stop juggling multiple tools and spreadsheets. Forgefly brings
              everything together in one beautiful, intelligent platform.
            </p>
          </div>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 animate-in fade-in slide-in-from-left-4"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-lg text-gray-300">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="relative">
              <Card className="relative bg-white/5 backdrop-blur-sm border-white/10">
                <CardContent className="p-8 space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div>
                      <div className="text-sm text-emerald-400 mb-1">
                        Monthly Revenue
                      </div>
                      <div className="text-2xl font-bold text-white">
                        $12,450
                      </div>
                    </div>
                    <TrendingUp className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div>
                      <div className="text-sm text-amber-400 mb-1">
                        Active Projects
                      </div>
                      <div className="text-2xl font-bold text-white">8</div>
                    </div>
                    <Briefcase className="w-8 h-8 text-amber-400" />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div>
                      <div className="text-sm text-blue-400 mb-1">
                        Time Saved
                      </div>
                      <div className="text-2xl font-bold text-white">
                        12 hrs/week
                      </div>
                    </div>
                    <Zap className="w-8 h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section
        id="reviews"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent"
      >
        <div className="w-full md:max-w-[60vw] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Real Freelancers, Real Freedom
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Join thousands of solopreneurs who transformed their business with
              Forgefly
            </p>
          </div>

          <div className="relative">
            {/* Carousel Container */}
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex ml-[-24px]">
                {testimonials.map((testimonial, index) => (
                  <div
                    key={index}
                    className="flex-[0_0_100%] md:flex-[0_0_50%] lg:flex-[0_0_33.333%] min-w-0 pl-6"
                  >
                    <Card className="h-full bg-white/5 backdrop-blur-sm border-white/10 hover:border-amber-500/30 transition-all duration-300">
                      <CardContent className="p-8 flex flex-col h-full">
                        {/* Rating Stars */}
                        <div className="flex gap-1 mb-4">
                          {Array.from({ length: testimonial.rating }).map(
                            (_, i) => (
                              <Star
                                key={i}
                                className="w-5 h-5 fill-amber-400 text-amber-400"
                              />
                            ),
                          )}
                        </div>

                        {/* Quote */}
                        <p className="text-gray-300 text-pretty mb-6 flex-1 leading-relaxed">
                          "{testimonial.quote}"
                        </p>

                        {/* Author */}
                        <div className="flex items-center gap-4">
                          <img
                            src={testimonial.avatar}
                            alt={testimonial.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/30"
                          />
                          <div>
                            <div className="font-semibold text-white">
                              {testimonial.name}
                            </div>
                            <div className="text-sm text-emerald-400">
                              {testimonial.role}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Arrows */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 w-12 h-12 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/30 text-white"
              onClick={scrollPrev}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 w-12 h-12 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/30 text-white"
              onClick={scrollNext}
            >
              <ChevronRight className="w-6 h-6" />
            </Button>

            {/* Dot Indicators */}
            <div className="flex justify-center gap-2 mt-8">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === selectedIndex
                      ? "bg-emerald-400 w-8"
                      : "bg-white/20 hover:bg-white/40"
                  }`}
                  onClick={() => scrollTo(index)}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="w-full md:max-w-[60vw] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Simple, Honest Pricing
            </h2>
            <p className="text-xl text-gray-400">
              Start free. Upgrade when you're ready to scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Freelancer — Free */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm flex flex-col">
              <CardContent className="p-8 flex flex-col flex-1">
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">
                    Freelancer
                  </p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-5xl font-bold text-white">$0</span>
                    <span className="text-gray-400 mb-2">/month</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Everything you need to get started
                  </p>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {[
                    "Up to 5 active clients",
                    "Basic project tracking",
                    "AI proposal generation",
                    "Invoice management",
                    "Financial dashboard",
                    "Email support",
                  ].map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-3 text-gray-300 text-sm"
                    >
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                  onClick={() => navigate("/login")}
                >
                  Start Free
                </Button>
              </CardContent>
            </Card>

            {/* Agency — $29/$290 */}
            <Card className="relative bg-gradient-to-br from-emerald-500/10 to-emerald-900/20 border-emerald-500/40 backdrop-blur-sm flex flex-col overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  <Crown className="w-3 h-3" /> Most Popular
                </span>
              </div>
              <CardContent className="p-8 flex flex-col flex-1">
                <div className="mb-6">
                  <p className="text-sm font-medium text-emerald-400 uppercase tracking-wider mb-2">
                    Agency
                  </p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-5xl font-bold text-white">$29</span>
                    <span className="text-gray-400 mb-2">/month</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    or $290/year — save $58
                  </p>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {[
                    "Unlimited clients",
                    "Advanced project tracking",
                    "AI proposal generation",
                    "Invoice management",
                    "Financial dashboard",
                    "Team member management",
                    "Advanced proposal templates",
                    "Priority support",
                    "Custom branding",
                    "API access",
                  ].map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-3 text-gray-300 text-sm"
                    >
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  size="lg"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => navigate("/login")}
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-gray-500 text-sm mt-8">
            No credit card required to start • Cancel anytime
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-emerald-500/10 via-amber-500/10 to-blue-500/10 backdrop-blur-sm border-white/10 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-amber-500/20 blur-3xl" />
            <CardContent className="relative p-12 text-center">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Ready to Forge Your Freedom?
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Join solopreneurs who are scaling their business with AI-powered
                automation
              </p>
              <Button
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-lg px-12 py-6 h-auto"
                onClick={() => navigate("/login")}
              >
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="text-sm text-gray-400 mt-4">
                No credit card required • Setup in 5 minutes
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full md:max-w-[60vw] mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/forgefly-icon.png"
                alt="Forgefly Logo"
                className="w-8 h-8 rounded-lg"
              />
              <div>
                <div className="text-sm font-semibold text-white">Forgefly</div>
                <div className="text-xs text-gray-400">Forge Your Freedom</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
              <span>• Built with ❤️ in California by Sourav Nayak</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
