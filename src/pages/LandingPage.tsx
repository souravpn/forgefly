import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1428] via-[#0F1B35] to-[#0A1428]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0A1428]/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img
                src="/public/forgefly-icon.png"
                alt="Forgefly Logo"
                className="w-10 h-10 rounded-lg"
              />
              <div>
                <h1 className="text-xl font-bold text-white">Forgefly</h1>
                <p className="text-xs text-emerald-400">Forge Your Freedom</p>
              </div>
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
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10  border border-emerald-500/20 text-emerald-400 text-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <TestTubeDiagonal className="w-4 h-4" />
            <span>• In Beta</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            Forge Your Freedom
          </h1>

          <p className="text-2xl md:text-3xl text-emerald-400 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            AI Business OS for Solopreneurs
          </p>

          <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            The all-in-one platform that combines client management, project
            tracking, financial forecasting, and AI assistance to help
            freelancers and solopreneurs scale their business with confidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <Button
              size="lg"
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-lg px-8 py-6 h-auto"
              onClick={() => navigate("/login")}
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-lg px-8 py-6 h-auto"
              onClick={() => {
                const featuresSection = document.getElementById("features");
                if (featuresSection) {
                  featuresSection.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              See How It Works
            </Button>
          </div>

          {/* Hero Visual */}
          <div className="mt-20 relative animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-700">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-amber-500/20 blur-3xl" />
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <img
                src="https://miaoda-conversation-file.s3cdn.medo.dev/user-bj1cwp7n1qm8/conv-bj1thg4coydc/20260511/file-bk5cvo48cv0g.png"
                alt="Forgefly Dashboard"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
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
        <div className="max-w-7xl mx-auto">
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
        <div className="max-w-7xl mx-auto">
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent">
        <div className="max-w-7xl mx-auto">
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
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/public/forgefly-icon.png"
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
