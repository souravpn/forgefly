import {
  BookOpen,
  Facebook,
  Instagram,
  Megaphone,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { getDocumentationCategories } from "@/services/documentationService";
import type { DocumentationCategory } from "@/types/types";

const S = {
  bg: "#080D0B",
  bg2: "#0D1512",
  em: "#10B981",
  text: "#E8EDE8",
  mid: "#8FA98A",
  dim: "#4A5C4A",
  border2: "rgba(232,237,232,0.07)",
} as const;

const sora = "'Sora', sans-serif";

const SLUG_ICON: Record<string, { icon: ReactNode; bg: string }> = {
  instagram: {
    icon: <Instagram className="w-4 h-4" style={{ color: "#fff" }} />,
    bg: "linear-gradient(135deg, #FBBF24, #EC4899, #A855F7)",
  },
  whatsapp: {
    icon: <MessageCircle className="w-4 h-4" style={{ color: "#fff" }} />,
    bg: "#25D366",
  },
  facebook: {
    icon: <Facebook className="w-4 h-4" style={{ color: "#fff" }} />,
    bg: "#1877F2",
  },
};

const CATEGORY_ICON: Record<string, { icon: ReactNode; bg: string }> = {
  "getting-started": {
    icon: <BookOpen className="w-4 h-4" style={{ color: "#fff" }} />,
    bg: S.em,
  },
  freeda: {
    icon: <Sparkles className="w-4 h-4" style={{ color: "#fff" }} />,
    bg: "linear-gradient(135deg, #10B981, #059669)",
  },
  "social-promotions": {
    icon: <Megaphone className="w-4 h-4" style={{ color: "#fff" }} />,
    bg: "#8B5CF6",
  },
  "client-portal": {
    icon: <Users className="w-4 h-4" style={{ color: "#fff" }} />,
    bg: "#3B82F6",
  },
  proposals: {
    icon: <BookOpen className="w-4 h-4" style={{ color: "#fff" }} />,
    bg: "#F59E0B",
  },
};

function sectionIcon(category: string, slug: string) {
  return SLUG_ICON[slug] ?? CATEGORY_ICON[category] ?? CATEGORY_ICON["getting-started"];
}

export default function DocumentationPage() {
  const [categories, setCategories] = useState<DocumentationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    getDocumentationCategories()
      .then((data) => {
        setCategories(data);
        setActiveSlug(data[0]?.sections[0]?.slug ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveSlug(visible.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    for (const el of sectionRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  function scrollToSlug(slug: string) {
    sectionRefs.current.get(slug)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      style={{
        background: S.bg,
        color: S.text,
        fontFamily: "Inter, sans-serif",
        minHeight: "100vh",
      }}
    >
      <SiteHeader />

      <div
        style={{
          maxWidth: "1152px",
          margin: "0 auto",
          padding: "160px 24px 120px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <h1
            style={{
              fontFamily: sora,
              fontWeight: 600,
              fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
              letterSpacing: "-0.02em",
              marginBottom: "12px",
            }}
          >
            Documentation
          </h1>
          <p style={{ color: S.mid }}>
            Guides and reference material for getting the most out of Forgefly
          </p>
        </div>

        {loading ? (
          <p style={{ color: S.dim, textAlign: "center" }}>Loading…</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: "48px",
              alignItems: "start",
            }}
            className="ff-docs-grid"
          >
            <nav
              style={{
                position: "sticky",
                top: "120px",
                maxHeight: "calc(100vh - 140px)",
                overflowY: "auto",
              }}
            >
              {categories.map((cat) => (
                <div key={cat.category} style={{ marginBottom: "24px" }}>
                  <p
                    style={{
                      color: S.dim,
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "8px",
                    }}
                  >
                    {cat.category_label}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    {cat.sections.map((s) => (
                      <button
                        key={s.slug}
                        type="button"
                        onClick={() => scrollToSlug(s.slug)}
                        style={{
                          textAlign: "left",
                          background: "none",
                          border: "none",
                          padding: "6px 10px",
                          borderRadius: "8px",
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          color: activeSlug === s.slug ? S.em : S.mid,
                          backgroundColor:
                            activeSlug === s.slug ? "rgba(16,185,129,0.08)" : "transparent",
                        }}
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {categories.map((cat) =>
                cat.sections.map((s) => {
                  const { icon, bg } = sectionIcon(cat.category, s.slug);
                  return (
                    <div
                      key={s.slug}
                      id={s.slug}
                      ref={(el) => {
                        if (el) sectionRefs.current.set(s.slug, el);
                      }}
                      style={{
                        background: S.bg2,
                        border: `1px solid ${S.border2}`,
                        borderRadius: "16px",
                        padding: "32px",
                        textAlign: "left",
                        scrollMarginTop: "120px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          marginBottom: "20px",
                        }}
                      >
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "10px",
                            background: bg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {icon}
                        </div>
                        <h3 style={{ fontFamily: sora, fontWeight: 600, fontSize: "1.15rem" }}>
                          {s.title}
                        </h3>
                      </div>
                      <div className="ff-docs-body" style={{ color: S.mid, lineHeight: 1.7, fontSize: "0.95rem" }}>
                        <ReactMarkdown
                          components={{
                            h4: ({ children }) => (
                              <p
                                style={{
                                  color: S.text,
                                  fontWeight: 600,
                                  fontSize: "0.9rem",
                                  marginTop: "20px",
                                  marginBottom: "6px",
                                }}
                              >
                                {children}
                              </p>
                            ),
                            strong: ({ children }) => (
                              <strong style={{ color: S.text }}>{children}</strong>
                            ),
                            p: ({ children }) => <p style={{ marginBottom: "10px" }}>{children}</p>,
                            ul: ({ children }) => (
                              <ul style={{ marginBottom: "10px", paddingLeft: "18px" }}>{children}</ul>
                            ),
                          }}
                        >
                          {s.body}
                        </ReactMarkdown>
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 860px) {
          .ff-docs-grid { grid-template-columns: 1fr !important; }
          .ff-docs-grid nav { position: static !important; }
        }
      `}</style>

      <SiteFooter />
    </div>
  );
}
