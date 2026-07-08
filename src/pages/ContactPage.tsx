import { Clock, HeadphonesIcon, Mail, Users } from "lucide-react";
import { useState } from "react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";

const S = {
  bg: "#080D0B",
  bg2: "#0D1512",
  em: "#10B981",
  em2: "#059669",
  text: "#E8EDE8",
  mid: "#8FA98A",
  dim: "#4A5C4A",
  border2: "rgba(232,237,232,0.07)",
} as const;

const sora = "'Sora', sans-serif";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${S.border2}`,
  borderRadius: "10px",
  padding: "10px 14px",
  color: S.text,
  fontSize: "0.875rem",
  outline: "none",
};

const HELP_CARDS = [
  {
    icon: Users,
    title: "Help center",
    desc: "Guides and reference material for getting the most out of Forgefly.",
    href: "/documentation",
  },
  {
    icon: HeadphonesIcon,
    title: "Customer support",
    desc: "Submit a request and we'll get back to you from a real person.",
    href: "mailto:support@forgefly.io",
  },
  {
    icon: Mail,
    title: "Sales",
    desc: "Ask about the Agency plan or a custom setup for your team.",
    href: "mailto:sales@forgefly.io",
  },
];

export default function ContactPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = encodeURIComponent(
      `Name: ${firstName} ${lastName}\nEmail: ${email}\nPhone: ${phone}\n\n${message}`,
    );
    window.location.href = `mailto:support@forgefly.io?subject=${encodeURIComponent(
      "Forgefly contact form",
    )}&body=${body}`;
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

      <div style={{ maxWidth: "1152px", margin: "0 auto", padding: "140px 24px 80px" }}>
        <div
          className="ff-contact-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "48px",
            marginBottom: "96px",
          }}
        >
          {/* Left — info */}
          <div>
            <span
              style={{
                display: "inline-block",
                background: "rgba(16,185,129,0.1)",
                color: S.em,
                fontSize: "0.72rem",
                fontWeight: 600,
                padding: "5px 14px",
                borderRadius: "9999px",
                marginBottom: "20px",
              }}
            >
              Contact us
            </span>
            <h1
              style={{
                fontFamily: sora,
                fontWeight: 600,
                fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
                letterSpacing: "-0.02em",
                marginBottom: "16px",
              }}
            >
              We're here to help
            </h1>
            <p style={{ color: S.mid, lineHeight: 1.65, marginBottom: "32px", maxWidth: "420px" }}>
              Need support or have a question? Email us, or fill out the form and
              we'll get back to you shortly.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <a
                href="mailto:support@forgefly.io"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  color: S.text,
                  textDecoration: "none",
                  fontSize: "0.9rem",
                }}
              >
                <span
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(16,185,129,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Mail className="w-4 h-4" style={{ color: S.em }} />
                </span>
                support@forgefly.io
              </a>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.9rem" }}>
                <span
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(16,185,129,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Clock className="w-4 h-4" style={{ color: S.em }} />
                </span>
                <span style={{ color: S.mid }}>Monday to Friday, 9 AM – 5 PM (PT)</span>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <form
            onSubmit={handleSubmit}
            style={{
              background: S.bg2,
              border: `1px solid ${S.border2}`,
              borderRadius: "16px",
              padding: "32px",
            }}
          >
            <h2 style={{ fontFamily: sora, fontWeight: 600, fontSize: "1.15rem", marginBottom: "20px" }}>
              Let's talk
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", color: S.mid, marginBottom: "6px" }}>
                  First name
                </label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", color: S.mid, marginBottom: "6px" }}>
                  Last name
                </label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  style={inputStyle}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: S.mid, marginBottom: "6px" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                required
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: S.mid, marginBottom: "6px" }}>
                Phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message"
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
                required
              />
            </div>

            <button
              type="submit"
              style={{
                width: "100%",
                background: `linear-gradient(135deg, ${S.em}, ${S.em2})`,
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "12px",
                fontSize: "0.9rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Send message
            </button>
          </form>
        </div>

        {/* Help cards */}
        <div>
          <span
            style={{
              display: "inline-block",
              background: "rgba(16,185,129,0.1)",
              color: S.em,
              fontSize: "0.72rem",
              fontWeight: 600,
              padding: "5px 14px",
              borderRadius: "9999px",
              marginBottom: "20px",
            }}
          >
            Contact
          </span>
          <h2
            style={{
              fontFamily: sora,
              fontWeight: 600,
              fontSize: "clamp(1.5rem, 3vw, 2rem)",
              letterSpacing: "-0.02em",
              marginBottom: "12px",
            }}
          >
            We're here to help
          </h2>
          <p style={{ color: S.mid, marginBottom: "36px", maxWidth: "480px" }}>
            Explore more options and find what you're looking for — from help
            center to customer support and sales.
          </p>

          <div
            className="ff-contact-cards"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}
          >
            {HELP_CARDS.map(({ icon: Icon, title, desc, href }) => (
              <div
                key={title}
                style={{
                  background: S.bg2,
                  border: `1px solid ${S.border2}`,
                  borderRadius: "14px",
                  padding: "24px",
                }}
              >
                <span
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(16,185,129,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                  }}
                >
                  <Icon className="w-4 h-4" style={{ color: S.em }} />
                </span>
                <h3 style={{ fontFamily: sora, fontWeight: 600, fontSize: "1rem", marginBottom: "8px" }}>
                  {title}
                </h3>
                <p style={{ color: S.dim, fontSize: "0.85rem", marginBottom: "18px", lineHeight: 1.5 }}>
                  {desc}
                </p>
                <a
                  href={href}
                  style={{
                    display: "inline-block",
                    background: `linear-gradient(135deg, ${S.em}, ${S.em2})`,
                    color: "#fff",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    padding: "8px 16px",
                    borderRadius: "8px",
                    textDecoration: "none",
                  }}
                >
                  Learn more
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .ff-contact-grid { grid-template-columns: 1fr !important; }
          .ff-contact-cards { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <SiteFooter />
    </div>
  );
}
