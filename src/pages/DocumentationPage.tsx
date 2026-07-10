import { BookOpen, Instagram, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
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

function DocSection({
  icon,
  iconBg,
  title,
  children,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: S.bg2,
        border: `1px solid ${S.border2}`,
        borderRadius: "16px",
        padding: "32px",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <h3 style={{ fontFamily: sora, fontWeight: 600, fontSize: "1.15rem" }}>{title}</h3>
      </div>
      <div style={{ color: S.mid, lineHeight: 1.7, fontSize: "0.95rem" }}>{children}</div>
    </div>
  );
}

function DocSubheading({ children }: { children: ReactNode }) {
  return (
    <p style={{ color: S.text, fontWeight: 600, fontSize: "0.9rem", marginTop: "20px", marginBottom: "6px" }}>
      {children}
    </p>
  );
}

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
          maxWidth: "760px",
          margin: "0 auto",
          padding: "160px 24px 120px",
        }}
      >
        <div style={{ textAlign: "center" }}>
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
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <DocSection
            icon={<Instagram className="w-5 h-5" style={{ color: "#fff" }} />}
            iconBg="linear-gradient(135deg, #FBBF24, #EC4899, #A855F7)"
            title="Social Connections — Instagram"
          >
            <p>
              Connect your Instagram business account under <strong style={{ color: S.text }}>Social → Connections</strong>.
              Forgefly authorizes through Instagram Login (Meta), one connection per business — you don't need a
              developer account or app of your own.
            </p>
            <DocSubheading>Posting</DocSubheading>
            <p>
              Drafts are generated (or written from scratch) under the <strong style={{ color: S.text }}>Compose</strong> tab.
              Every post needs an attached image before it can be approved — Instagram requires media on every post,
              text-only posts aren't supported. Once approved, hit Publish to push it live to your connected account.
            </p>
            <DocSubheading>Disconnecting</DocSubheading>
            <p>
              Disconnecting revokes Forgefly's access but doesn't delete anything already published to Instagram.
              Reconnect any time from the same Connections screen.
            </p>
          </DocSection>

          <DocSection
            icon={<MessageCircle className="w-5 h-5" style={{ color: "#fff" }} />}
            iconBg="#25D366"
            title="Social Connections — WhatsApp"
          >
            <p>
              Connect a WhatsApp Business number under <strong style={{ color: S.text }}>Social → Connections</strong>.
              This uses Facebook Login (Meta) — the number you connect is what your clients will message, and what
              your own lifecycle notifications get sent from.
            </p>
            <DocSubheading>Reading (inbound messages)</DocSubheading>
            <p>
              Messages a client sends to your connected number land automatically in your{" "}
              <strong style={{ color: S.text }}>Messages</strong> hub, matched to the client by phone number when
              possible. If the number doesn't match an existing contact, it shows up as an "Unknown number" thread —
              use Save as client to link it. Every WhatsApp-originated message is tagged{" "}
              <em>via WhatsApp</em> so it's clear which channel it came in on, alongside portal chat in the same
              thread.
            </p>
            <DocSubheading>Sending</DocSubheading>
            <p>
              Forgefly sends WhatsApp notifications automatically for three events: a proposal gets approved, an
              invoice gets paid, and a file gets shared on the client portal — both you and the client receive a
              message. If the client hasn't messaged you in the last 24 hours, the reply falls outside WhatsApp's
              free-form session window and goes out as a pre-approved template message instead of plain text; that's
              expected, not an error.
            </p>
            <DocSubheading>Your own notifications</DocSubheading>
            <p>
              Set a contact phone number under <strong style={{ color: S.text }}>Settings → Business</strong> first —
              that's where your own copies of the notifications above are sent. WhatsApp connect is blocked until
              that's filled in.
            </p>
          </DocSection>
        </div>

        <div
          style={{
            background: S.bg2,
            border: `1px solid ${S.border2}`,
            borderRadius: "16px",
            padding: "48px 32px",
            marginTop: "20px",
            textAlign: "center",
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
            More guides are coming soon — proposals, invoicing, brand kits, and the AI copilot.
          </p>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
