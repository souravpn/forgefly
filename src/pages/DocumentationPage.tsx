import { BookOpen } from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";

const S = {
  bg: "#080D0B",
  bg2: "#0D1512",
  em: "#10B981",
  text: "#E8EDE8",
  mid: "#8FA98A",
  border2: "rgba(232,237,232,0.07)",
} as const;

const sora = "'Sora', sans-serif";

export default function DocumentationPage() {
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
          maxWidth: "720px",
          margin: "0 auto",
          padding: "160px 24px 120px",
          textAlign: "center",
        }}
      >
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
        <p style={{ color: S.mid, marginBottom: "48px" }}>
          Guides and reference material for getting the most out of Forgefly
        </p>

        <div
          style={{
            background: S.bg2,
            border: `1px solid ${S.border2}`,
            borderRadius: "16px",
            padding: "64px 32px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "9999px",
              background: "rgba(16,185,129,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <BookOpen className="w-6 h-6" style={{ color: S.em }} />
          </div>
          <p style={{ color: S.mid, maxWidth: "420px", margin: "0 auto", lineHeight: 1.6 }}>
            Documentation is coming soon. We're putting together guides on
            proposals, invoicing, brand kits, and the AI copilot.
          </p>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
