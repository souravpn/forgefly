import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
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
  Sparkles,
  Brain,
  Globe,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

/* ─────────────────────────── CSS keyframes injected once ─────────────────── */
const GLOBAL_STYLES = `
  @keyframes ff-float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-14px); }
  }
  @keyframes ff-float-slow {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(2deg); }
  }
  @keyframes ff-pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(0,240,200,0.2), 0 0 60px rgba(0,240,200,0.05); }
    50% { box-shadow: 0 0 40px rgba(0,240,200,0.5), 0 0 120px rgba(0,240,200,0.15); }
  }
  @keyframes ff-scan {
    0% { top: -2px; opacity: 0; }
    5% { opacity: 1; }
    95% { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes ff-aurora {
    0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 0.4; }
    33% { transform: translate(40px, -30px) scale(1.08) rotate(5deg); opacity: 0.6; }
    66% { transform: translate(-30px, 20px) scale(0.94) rotate(-3deg); opacity: 0.35; }
  }
  @keyframes ff-aurora2 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
    40% { transform: translate(-50px, 40px) scale(1.1); opacity: 0.5; }
    70% { transform: translate(20px, -20px) scale(0.9); opacity: 0.25; }
  }
  @keyframes ff-flicker {
    0%, 89%, 91%, 93%, 100% { opacity: 1; }
    90%, 92% { opacity: 0.75; }
  }
  @keyframes ff-shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes ff-orbit {
    from { transform: rotate(0deg) translateX(180px) rotate(0deg); }
    to { transform: rotate(360deg) translateX(180px) rotate(-360deg); }
  }
  @keyframes ff-spin-ring {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes ff-beam {
    0% { transform: scaleX(0); opacity: 0; transform-origin: left; }
    40% { transform: scaleX(1); opacity: 1; transform-origin: left; }
    60% { transform: scaleX(1); opacity: 1; transform-origin: right; }
    100% { transform: scaleX(0); opacity: 0; transform-origin: right; }
  }
  @keyframes ff-counter {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes ff-dot-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.6); opacity: 0.5; }
  }
  .ff-float { animation: ff-float 5s ease-in-out infinite; }
  .ff-float-slow { animation: ff-float-slow 7s ease-in-out infinite; }
  .ff-pulse-glow { animation: ff-pulse-glow 3s ease-in-out infinite; }
  .ff-flicker { animation: ff-flicker 8s linear infinite; }
  .ff-aurora1 { animation: ff-aurora 9s ease-in-out infinite; }
  .ff-aurora2 { animation: ff-aurora2 12s ease-in-out infinite; }
  .ff-shimmer-text {
    background: linear-gradient(90deg, #00f0c8 0%, #ffffff 45%, #00d4ff 55%, #00f0c8 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: ff-shimmer 4s linear infinite;
  }
  .ff-scan-line {
    position: absolute; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0,240,200,0.8), transparent);
    animation: ff-scan 2.5s linear infinite;
    pointer-events: none;
  }
  .ff-holo-border {
    position: relative;
  }
  .ff-holo-border::before {
    content: '';
    position: absolute; inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(135deg, rgba(0,240,200,0.5), rgba(99,102,241,0.3), rgba(0,200,255,0.4));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
`;

/* ─────────────────────────── Particle field canvas ─────────────────────── */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const onResize = () => resize();
    const onMouse = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouse);

    type RGB = [number, number, number];
    const PALETTE: RGB[] = [
      [0, 240, 200],
      [16, 185, 129],
      [99, 102, 241],
      [139, 92, 246],
      [0, 200, 255],
    ];

    interface Pt {
      x: number; y: number; vx: number; vy: number;
      r: number; op: number; c: RGB; ph: number; ps: number;
    }

    const pts: Pt[] = Array.from({ length: 110 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 2 + 0.4,
      op: Math.random() * 0.5 + 0.15,
      c: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      ph: Math.random() * Math.PI * 2,
      ps: Math.random() * 0.018 + 0.007,
    }));

    let frame = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 115) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,240,200,${0.12 * (1 - d / 115)})`;
            ctx.lineWidth = 0.4;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      for (const p of pts) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 140 && d > 0) {
          p.vx += (dx / d) * 0.07;
          p.vy += (dy / d) * 0.07;
        }
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const pulse = (Math.sin(frame * p.ps + p.ph) + 1) / 2;
        const op = p.op * (0.4 + pulse * 0.6);
        const [r, g, b] = p.c;

        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7);
        grd.addColorStop(0, `rgba(${r},${g},${b},${op * 0.7})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 7, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(op * 2.2, 1)})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}

/* ─────────────────────────── Glassmorphism card ────────────────────────── */
function HoloCard({
  children,
  className = "",
  glow = "0,240,200",
  delay = 0,
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
  delay?: number;
  hover?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true }}
      whileHover={hover ? { y: -6, scale: 1.01 } : undefined}
      className={`relative group rounded-2xl overflow-hidden ${className}`}
      style={{
        background: "rgba(4, 12, 30, 0.72)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid rgba(${glow}, 0.18)`,
        boxShadow: `0 8px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      {/* Top glow bar */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(${glow}, 0.6), transparent)`,
        }}
      />
      {/* Scan line on hover */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="ff-scan-line opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        />
      </div>
      {/* Corner accent */}
      <div
        className="absolute top-0 right-0 w-12 h-12 opacity-20 group-hover:opacity-50 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at top right, rgba(${glow}, 0.8), transparent)`,
        }}
      />
      {children}
    </motion.div>
  );
}

/* ─────────────────────────── Main page ─────────────────────────────────── */
export default function LandingPageV2() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  /* Mouse parallax values */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 25 });
  const heroRotX = useTransform(springY, [-300, 300], [3, -3]);
  const heroRotY = useTransform(springX, [-400, 400], [-4, 4]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left - rect.width / 2);
      mouseY.set(e.clientY - rect.top - rect.height / 2);
    },
    [mouseX, mouseY],
  );

  /* Carousel */
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start" },
    [Autoplay({ delay: 5000, stopOnInteraction: false })],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
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
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  /* Data */
  const features = [
    { icon: Users, title: "Client Management", desc: "Organize clients, track relationships, and manage communications in one unified workspace.", glow: "0,240,200" },
    { icon: Briefcase, title: "Project Tracking", desc: "Monitor progress, deadlines, and deliverables with intelligent visual timelines.", glow: "99,102,241" },
    { icon: FileText, title: "Smart Proposals", desc: "Generate professional proposals with AI assistance and send them instantly.", glow: "0,200,255" },
    { icon: DollarSign, title: "Financial Insights", desc: "Track income, forecast cashflow, and make data-driven decisions effortlessly.", glow: "245,158,11" },
    { icon: Calendar, title: "Unified Calendar", desc: "Manage deadlines, meetings, and tasks in one integrated calendar view.", glow: "16,185,129" },
    { icon: Brain, title: "AI Co-pilot", desc: "Context-aware AI that understands your business and takes meaningful action.", glow: "139,92,246" },
  ];

  const steps = [
    { icon: Rocket, title: "Quick Setup", desc: "Describe your business in plain English. Our AI understands your needs instantly.", num: "01" },
    { icon: Sparkles, title: "AI Configuration", desc: "Watch as Forgefly automatically sets up your workspace, packages, and workflows.", num: "02" },
    { icon: Target, title: "Start Growing", desc: "Manage clients, send proposals, track finances, and scale your business effortlessly.", num: "03" },
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
    { quote: "Forgefly turned my chaotic freelance life into a real business in under 10 minutes. The AI onboarding is pure magic.", name: "Sarah Chen", role: "Brand Designer", avatar: "https://miaoda-site-img.s3cdn.medo.dev/images/KLing_b3e4f5ce-8894-444b-9753-7c3a08c58518.jpg", rating: 5 },
    { quote: "Finally one tool that handles proposals, invoices, clients AND cashflow forecasting. I closed two clients this week.", name: "Marcus Okoro", role: "Web Developer", avatar: "https://miaoda-site-img.s3cdn.medo.dev/images/KLing_5453a9f8-1e61-4b65-8d1e-812b5d956173.jpg", rating: 5 },
    { quote: "The contextual AI Co-pilot feels like having a business partner. It actually understands my agency workflow.", name: "Priya Sharma", role: "Freelance Strategist", avatar: "https://miaoda-site-img.s3cdn.medo.dev/images/KLing_d60fe409-c0ac-4f94-aa01-824044ec4c3d.jpg", rating: 5 },
    { quote: "Stripe integration is seamless. Getting paid feels effortless now.", name: "Diego Morales", role: "Graphic Illustrator", avatar: "https://miaoda-site-img.s3cdn.medo.dev/images/KLing_652adae2-c426-40ff-b4ed-42987dbf4d24.jpg", rating: 5 },
    { quote: "I went from 7 different tools to just Forgefly. My clients love the professional portal too.", name: "Aisha Khan", role: "UI/UX Designer", avatar: "https://miaoda-site-img.s3cdn.medo.dev/images/KLing_4514af45-40f3-43c5-ab0a-3b85ec13b583.jpg", rating: 5 },
    { quote: "Best investment of 2026 for any solopreneur. Highly recommend.", name: "Jamal Wright", role: "Motion Designer", avatar: "https://miaoda-site-img.s3cdn.medo.dev/images/KLing_f020a5e2-d58e-4919-92bd-11122bb19132.jpg", rating: 5 },
  ];

  return (
    <>
      {/* Inject global keyframes */}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS keyframe injection */}
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />

      <div
        className="min-h-screen relative overflow-x-hidden"
        style={{ background: "#020810" }}
      >
        {/* Particle field */}
        <ParticleField />

        {/* Ambient aurora orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div
            className="ff-aurora1 absolute"
            style={{
              width: 700, height: 700,
              borderRadius: "50%",
              top: "-15%", left: "5%",
              background: "radial-gradient(circle, rgba(0,240,200,0.12) 0%, rgba(0,240,200,0.04) 50%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <div
            className="ff-aurora2 absolute"
            style={{
              width: 600, height: 600,
              borderRadius: "50%",
              top: "10%", right: "-5%",
              background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(99,102,241,0.06) 50%, transparent 70%)",
              filter: "blur(70px)",
            }}
          />
          <div
            className="ff-aurora1 absolute"
            style={{
              width: 500, height: 500,
              borderRadius: "50%",
              bottom: "20%", left: "40%",
              background: "radial-gradient(circle, rgba(0,200,255,0.1) 0%, transparent 70%)",
              filter: "blur(80px)",
              animationDelay: "-4s",
            }}
          />
        </div>

        {/* ── NAV ────────────────────────────────────────────────────────── */}
        <nav
          className="fixed top-0 left-0 right-0 z-50"
          style={{
            background: "rgba(2, 8, 16, 0.75)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(0, 240, 200, 0.1)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div
                  className="relative ff-pulse-glow rounded-xl overflow-hidden"
                  style={{ width: 40, height: 40 }}
                >
                  <img
                    src="https://miaoda-conversation-file.s3cdn.medo.dev/user-bj1cwp7n1qm8/conv-bj1thg4coydc/20260510/file-bj7c19f23ym8.png"
                    alt="Forgefly"
                    className="w-full h-full object-cover rounded-xl"
                  />
                </div>
                <div>
                  <div className="text-lg font-bold text-white tracking-tight ff-flicker">Forgefly</div>
                  <div className="text-xs" style={{ color: "#00f0c8" }}>Forge Your Freedom</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  className="text-white/70 hover:text-white hover:bg-white/5 text-sm"
                  onClick={() => navigate("/login")}
                >
                  Sign In
                </Button>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    className="text-sm font-semibold px-5 py-2 rounded-xl relative overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, #00f0c8, #00aeff)",
                      color: "#020810",
                      boxShadow: "0 0 24px rgba(0,240,200,0.35)",
                      border: "none",
                    }}
                    onClick={() => navigate("/login")}
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>
        </nav>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <section
          className="relative pt-36 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden"
          style={{ zIndex: 2 }}
          onMouseMove={handleMouseMove}
        >
          {/* Perspective grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,240,200,0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,240,200,0.04) 1px, transparent 1px)
              `,
              backgroundSize: "60px 60px",
              maskImage: "radial-gradient(ellipse 80% 60% at 50% 80%, black 30%, transparent 100%)",
            }}
          />

          <div className="max-w-7xl mx-auto text-center relative">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
              style={{
                background: "rgba(0,240,200,0.06)",
                border: "1px solid rgba(0,240,200,0.25)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: "#00f0c8",
                  boxShadow: "0 0 8px #00f0c8",
                  animation: "ff-dot-pulse 1.8s ease-in-out infinite",
                }}
              />
              <TestTubeDiagonal className="w-3.5 h-3.5" style={{ color: "#00f0c8" }} />
              <span className="text-sm font-medium" style={{ color: "#00f0c8" }}>In Beta — Free Early Access</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-6xl md:text-8xl font-black mb-5 leading-none tracking-tighter"
            >
              <span className="ff-shimmer-text">Forge Your</span>
              <br />
              <span
                className="text-white ff-flicker"
                style={{ textShadow: "0 0 60px rgba(255,255,255,0.15)" }}
              >
                Freedom
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-2xl md:text-3xl font-semibold mb-5"
              style={{
                color: "#00f0c8",
                textShadow: "0 0 30px rgba(0,240,200,0.4)",
              }}
            >
              AI Business OS for Solopreneurs
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              The all-in-one platform combining client management, project tracking,
              financial forecasting, and an AI co-pilot built for freelancers who mean business.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
            >
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="lg"
                  className="px-10 py-6 h-auto text-base font-bold rounded-xl relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, #00f0c8, #00aeff)",
                    color: "#020810",
                    boxShadow: "0 0 40px rgba(0,240,200,0.4), 0 8px 32px rgba(0,0,0,0.4)",
                    border: "none",
                  }}
                  onClick={() => navigate("/login")}
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="lg"
                  variant="ghost"
                  className="px-10 py-6 h-auto text-base font-semibold rounded-xl text-white/80 hover:text-white"
                  style={{
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                  onClick={() => {
                    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  See How It Works
                </Button>
              </motion.div>
            </motion.div>

            {/* Hero image — holographic frame with parallax */}
            <motion.div
              style={{ rotateX: heroRotX, rotateY: heroRotY, perspective: 1200 }}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.6 }}
              className="relative mx-auto max-w-5xl"
            >
              {/* Outer glow */}
              <div
                className="absolute -inset-4 rounded-3xl"
                style={{
                  background: "radial-gradient(ellipse at center, rgba(0,240,200,0.15) 0%, rgba(99,102,241,0.08) 50%, transparent 70%)",
                  filter: "blur(20px)",
                }}
              />
              {/* Frame */}
              <div
                className="relative rounded-2xl overflow-hidden ff-holo-border"
                style={{
                  boxShadow: "0 0 80px rgba(0,240,200,0.15), 0 40px 80px rgba(0,0,0,0.6)",
                  border: "1px solid rgba(0,240,200,0.2)",
                }}
              >
                {/* Top bar of "window" */}
                <div
                  className="flex items-center gap-2 px-4 py-3"
                  style={{ background: "rgba(4,12,30,0.95)", borderBottom: "1px solid rgba(0,240,200,0.12)" }}
                >
                  <div className="flex gap-1.5">
                    {["#ff5f56", "#ffbd2e", "#27c93f"].map((c, i) => (
                      <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                  <div
                    className="flex-1 mx-4 h-6 rounded-md text-xs flex items-center px-3 text-white/30"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    app.forgefly.com/dashboard
                  </div>
                  <Globe className="w-4 h-4 text-white/20" />
                </div>
                <img
                  src="https://miaoda-conversation-file.s3cdn.medo.dev/user-bj1cwp7n1qm8/conv-bj1thg4coydc/20260511/file-bk5cvo48cv0g.png"
                  alt="Forgefly Dashboard"
                  className="w-full h-auto block"
                />
              </div>

              {/* Floating stat widgets */}
              <motion.div
                className="absolute -left-8 top-1/4 ff-float rounded-2xl px-4 py-3 hidden md:flex items-center gap-3"
                style={{
                  background: "rgba(4,12,30,0.85)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(0,240,200,0.25)",
                  boxShadow: "0 0 30px rgba(0,240,200,0.12)",
                  animationDelay: "0s",
                  zIndex: 10,
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2, duration: 0.6 }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,240,200,0.15)" }}>
                  <TrendingUp className="w-4 h-4" style={{ color: "#00f0c8" }} />
                </div>
                <div>
                  <div className="text-xs text-white/40">Monthly Revenue</div>
                  <div className="text-base font-bold text-white">$12,450</div>
                </div>
              </motion.div>

              <motion.div
                className="absolute -right-8 top-1/3 ff-float rounded-2xl px-4 py-3 hidden md:flex items-center gap-3"
                style={{
                  background: "rgba(4,12,30,0.85)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  boxShadow: "0 0 30px rgba(139,92,246,0.12)",
                  animationDelay: "-2.5s",
                  zIndex: 10,
                }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4, duration: 0.6 }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.15)" }}>
                  <Zap className="w-4 h-4" style={{ color: "#a78bfa" }} />
                </div>
                <div>
                  <div className="text-xs text-white/40">Time Saved</div>
                  <div className="text-base font-bold text-white">12 hrs/wk</div>
                </div>
              </motion.div>

              <motion.div
                className="absolute -right-4 bottom-1/4 ff-float rounded-2xl px-4 py-3 hidden md:flex items-center gap-3"
                style={{
                  background: "rgba(4,12,30,0.85)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  boxShadow: "0 0 30px rgba(245,158,11,0.1)",
                  animationDelay: "-1.2s",
                  zIndex: 10,
                }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.6, duration: 0.6 }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
                  <Briefcase className="w-4 h-4" style={{ color: "#fbbf24" }} />
                </div>
                <div>
                  <div className="text-xs text-white/40">Active Projects</div>
                  <div className="text-base font-bold text-white">8 Running</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="relative py-28 px-4 sm:px-6 lg:px-8"
          style={{ zIndex: 2 }}
        >
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <div
                className="inline-block text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
                style={{ color: "#00f0c8", background: "rgba(0,240,200,0.08)", border: "1px solid rgba(0,240,200,0.2)" }}
              >
                Process
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
                How It{" "}
                <span style={{ color: "#00f0c8", textShadow: "0 0 40px rgba(0,240,200,0.4)" }}>
                  Works
                </span>
              </h2>
              <p className="text-white/40 text-xl max-w-xl mx-auto">
                Get started in minutes with our AI-powered setup
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 relative">
              {/* Connecting lines */}
              <div
                className="absolute top-16 left-1/3 right-1/3 h-px hidden md:block"
                style={{ background: "linear-gradient(90deg, rgba(0,240,200,0.3), rgba(99,102,241,0.3))" }}
              />

              {steps.map((step, i) => (
                <HoloCard key={i} delay={i * 0.15} glow="0,240,200">
                  <div className="p-8">
                    <div className="flex items-start justify-between mb-6">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center relative"
                        style={{
                          background: "rgba(0,240,200,0.08)",
                          border: "1px solid rgba(0,240,200,0.25)",
                          boxShadow: "0 0 20px rgba(0,240,200,0.15)",
                        }}
                      >
                        <step.icon className="w-7 h-7" style={{ color: "#00f0c8" }} />
                      </div>
                      <span
                        className="text-4xl font-black tabular-nums"
                        style={{ color: "rgba(0,240,200,0.15)", fontVariantNumeric: "tabular-nums" }}
                      >
                        {step.num}
                      </span>
                    </div>
                    <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#00f0c8" }}>
                      Step {i + 1}
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">{step.title}</h3>
                    <p className="text-white/50 leading-relaxed">{step.desc}</p>
                  </div>
                </HoloCard>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ───────────────────────────────────────────────────── */}
        <section
          id="features"
          className="relative py-28 px-4 sm:px-6 lg:px-8"
          style={{ zIndex: 2 }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 80% 40% at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)",
            }}
          />
          <div className="max-w-7xl mx-auto relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-20"
            >
              <div
                className="inline-block text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
                style={{ color: "#a78bfa", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}
              >
                Capabilities
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
                Everything You Need{" "}
                <span style={{ color: "#a78bfa", textShadow: "0 0 40px rgba(139,92,246,0.4)" }}>
                  to Scale
                </span>
              </h2>
              <p className="text-white/40 text-xl max-w-xl mx-auto">
                Powerful modules designed for solopreneurs and freelancers
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f, i) => (
                <HoloCard key={i} delay={i * 0.08} glow={f.glow} className="h-full">
                  <div className="p-6">
                    <motion.div
                      whileHover={{ scale: 1.12, rotate: 5 }}
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{
                        background: `rgba(${f.glow},0.1)`,
                        border: `1px solid rgba(${f.glow},0.25)`,
                        boxShadow: `0 0 16px rgba(${f.glow},0.2)`,
                      }}
                    >
                      <f.icon className="w-6 h-6" style={{ color: `rgb(${f.glow})` }} />
                    </motion.div>
                    <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                    <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </HoloCard>
              ))}
            </div>
          </div>
        </section>

        {/* ── BENEFITS ───────────────────────────────────────────────────── */}
        <section className="relative py-28 px-4 sm:px-6 lg:px-8" style={{ zIndex: 2 }}>
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-20"
            >
              <div
                className="inline-block text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
                style={{ color: "#10b981", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
              >
                Why Forgefly
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
                Built for Freelancers{" "}
                <br />
                <span style={{ color: "#10b981", textShadow: "0 0 40px rgba(16,185,129,0.4)" }}>
                  Who Want More
                </span>
              </h2>
              <p className="text-white/40 text-xl max-w-xl mx-auto">
                Stop juggling tools. One intelligent platform.
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-3">
                {benefits.map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.07 }}
                    className="flex items-center gap-3 group"
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)" }}
                    >
                      <CheckCircle2 className="w-4 h-4" style={{ color: "#10b981" }} />
                    </div>
                    <span className="text-white/70 group-hover:text-white transition-colors duration-200 text-base">
                      {b}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Holographic metrics panel */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                className="relative"
              >
                <div
                  className="ff-float-slow rounded-3xl p-6 space-y-4"
                  style={{
                    background: "rgba(4,12,30,0.8)",
                    backdropFilter: "blur(24px)",
                    border: "1px solid rgba(0,240,200,0.15)",
                    boxShadow: "0 0 60px rgba(0,240,200,0.08), 0 40px 80px rgba(0,0,0,0.4)",
                  }}
                >
                  {/* Panel header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#00f0c8" }}>
                      Live Dashboard
                    </span>
                    <span
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: "#10b981" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" style={{ boxShadow: "0 0 6px #10b981" }} />
                      Online
                    </span>
                  </div>

                  {[
                    { label: "Monthly Revenue", value: "$12,450", icon: TrendingUp, glow: "0,240,200", change: "+18%" },
                    { label: "Active Projects", value: "8", icon: Briefcase, glow: "245,158,11", change: "+2 this week" },
                    { label: "Time Saved", value: "12 hrs/week", icon: Zap, glow: "99,102,241", change: "vs before" },
                    { label: "Proposals Sent", value: "24", icon: FileText, glow: "139,92,246", change: "+60% close rate" },
                  ].map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 + i * 0.08 }}
                      className="flex items-center justify-between p-4 rounded-xl"
                      style={{
                        background: `rgba(${m.glow},0.06)`,
                        border: `1px solid rgba(${m.glow},0.15)`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ background: `rgba(${m.glow},0.12)` }}
                        >
                          <m.icon className="w-4 h-4" style={{ color: `rgb(${m.glow})` }} />
                        </div>
                        <div>
                          <div className="text-xs text-white/40">{m.label}</div>
                          <div className="text-lg font-bold text-white">{m.value}</div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: `rgb(${m.glow})` }}>
                        {m.change}
                      </span>
                    </motion.div>
                  ))}
                </div>
                {/* Glow under panel */}
                <div
                  className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse, rgba(0,240,200,0.2) 0%, transparent 70%)",
                    filter: "blur(20px)",
                  }}
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ───────────────────────────────────────────────── */}
        <section
          className="relative py-28 px-4 sm:px-6 lg:px-8"
          style={{ zIndex: 2 }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 80% 40% at 50% 50%, rgba(245,158,11,0.04) 0%, transparent 70%)",
            }}
          />
          <div className="max-w-7xl mx-auto relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-20"
            >
              <div
                className="inline-block text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
                style={{ color: "#fbbf24", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
              >
                Social Proof
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
                Real Freelancers,{" "}
                <span style={{ color: "#fbbf24", textShadow: "0 0 40px rgba(245,158,11,0.4)" }}>
                  Real Freedom
                </span>
              </h2>
              <p className="text-white/40 text-xl max-w-xl mx-auto">
                Join solopreneurs who transformed their business with Forgefly
              </p>
            </motion.div>

            <div className="relative">
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex ml-[-20px]">
                  {testimonials.map((t, i) => (
                    <div
                      key={i}
                      className="flex-[0_0_100%] md:flex-[0_0_50%] lg:flex-[0_0_33.333%] min-w-0 pl-5"
                    >
                      <div
                        className="h-full rounded-2xl p-6 flex flex-col relative overflow-hidden group"
                        style={{
                          background: "rgba(4,12,30,0.72)",
                          backdropFilter: "blur(20px)",
                          border: "1px solid rgba(245,158,11,0.15)",
                          boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
                        }}
                      >
                        <div
                          className="absolute top-0 left-0 right-0 h-px"
                          style={{ background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.5), transparent)" }}
                        />
                        <div className="ff-scan-line opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        <div className="flex gap-0.5 mb-4">
                          {Array.from({ length: t.rating }).map((_, j) => (
                            <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                        <p className="text-white/65 text-sm leading-relaxed flex-1 mb-6">"{t.quote}"</p>
                        <div className="flex items-center gap-3">
                          <div
                            className="relative rounded-full p-0.5"
                            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.6), rgba(0,240,200,0.4))" }}
                          >
                            <img
                              src={t.avatar}
                              alt={t.name}
                              className="w-11 h-11 rounded-full object-cover block"
                            />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{t.name}</div>
                            <div className="text-xs" style={{ color: "#10b981" }}>{t.role}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Arrows */}
              {[{ label: "prev", fn: scrollPrev, side: "left" as const }, { label: "next", fn: scrollNext, side: "right" as const }].map(
                ({ label, fn, side }) => (
                  <Button
                    key={label}
                    variant="ghost"
                    size="icon"
                    onClick={fn}
                    aria-label={label}
                    className={`absolute top-1/2 -translate-y-1/2 w-11 h-11 rounded-full ${
                      side === "left" ? "-translate-x-5 md:-translate-x-14" : "translate-x-5 md:translate-x-14"
                    }`}
                    style={{
                      left: side === "left" ? 0 : "auto",
                      right: side === "right" ? 0 : "auto",
                      background: "rgba(4,12,30,0.85)",
                      border: "1px solid rgba(0,240,200,0.2)",
                      color: "white",
                    }}
                  >
                    {side === "left" ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </Button>
                ),
              )}

              {/* Dots */}
              <div className="flex justify-center gap-2 mt-8">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => scrollTo(i)}
                    aria-label={`Testimonial ${i + 1}`}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === selectedIndex ? 28 : 8,
                      height: 8,
                      background: i === selectedIndex ? "#00f0c8" : "rgba(255,255,255,0.2)",
                      boxShadow: i === selectedIndex ? "0 0 10px rgba(0,240,200,0.6)" : "none",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <section className="relative py-28 px-4 sm:px-6 lg:px-8" style={{ zIndex: 2 }}>
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative rounded-3xl overflow-hidden text-center p-16"
              style={{
                background: "rgba(4,12,30,0.8)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(0,240,200,0.2)",
              }}
            >
              {/* Background glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at center, rgba(0,240,200,0.08) 0%, rgba(99,102,241,0.06) 50%, transparent 70%)",
                }}
              />
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(0,240,200,0.8), rgba(99,102,241,0.6), transparent)" }}
              />

              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8"
                  style={{
                    background: "rgba(0,240,200,0.1)",
                    border: "1px solid rgba(0,240,200,0.3)",
                    boxShadow: "0 0 40px rgba(0,240,200,0.2)",
                  }}
                >
                  <Rocket className="w-8 h-8" style={{ color: "#00f0c8" }} />
                </motion.div>

                <h2 className="text-4xl md:text-6xl font-black text-white mb-5 tracking-tight">
                  Ready to Forge Your{" "}
                  <span className="ff-shimmer-text">Freedom?</span>
                </h2>
                <p className="text-xl text-white/50 mb-10 max-w-lg mx-auto">
                  Join solopreneurs scaling their business with AI-powered automation
                </p>

                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    size="lg"
                    className="px-14 py-7 h-auto text-lg font-bold rounded-2xl relative overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, #00f0c8, #00aeff, #7c3aed)",
                      color: "white",
                      boxShadow: "0 0 60px rgba(0,240,200,0.35), 0 20px 60px rgba(0,0,0,0.4)",
                      border: "none",
                    }}
                    onClick={() => navigate("/login")}
                  >
                    Start Your Free Trial
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </motion.div>
                <p className="text-sm text-white/30 mt-5">
                  No credit card required · Setup in 5 minutes
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <footer
          className="relative py-10 px-4 sm:px-6 lg:px-8"
          style={{
            zIndex: 2,
            borderTop: "1px solid rgba(0,240,200,0.08)",
          }}
        >
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="https://miaoda-conversation-file.s3cdn.medo.dev/user-bj1cwp7n1qm8/conv-bj1thg4coydc/20260510/file-bj7c19f23ym8.png"
                alt="Forgefly"
                className="w-8 h-8 rounded-lg"
              />
              <div>
                <div className="text-sm font-bold text-white">Forgefly</div>
                <div className="text-xs" style={{ color: "rgba(0,240,200,0.6)" }}>Forge Your Freedom</div>
              </div>
            </div>
            <div className="text-sm text-white/30">
              Built with ❤️ in California by Sourav Nayak
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
