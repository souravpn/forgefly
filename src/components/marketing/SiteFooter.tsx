import { useState } from "react";
import { Link } from "react-router-dom";
import { PrivacyModal } from "@/components/common/PrivacyModal";
import { TermsModal } from "@/components/common/TermsModal";

const S = {
  bg: "#080D0B",
  dim: "#4A5C4A",
  mid: "#8FA98A",
  border2: "rgba(232,237,232,0.07)",
} as const;

export function SiteFooter() {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <>
      <footer
        style={{
          borderTop: `1px solid ${S.border2}`,
          padding: "32px 24px",
          background: S.bg,
        }}
      >
        <div
          style={{
            maxWidth: "1152px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <p style={{ color: S.dim, fontSize: "0.82rem" }}>
            © {new Date().getFullYear()} Forgefly. Built for the solo operator.
          </p>
          <div style={{ display: "flex", gap: "24px" }}>
            <button
              type="button"
              onClick={() => setPrivacyOpen(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                color: S.dim,
                fontSize: "0.82rem",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = S.mid)}
              onMouseLeave={(e) => (e.currentTarget.style.color = S.dim)}
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                color: S.dim,
                fontSize: "0.82rem",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = S.mid)}
              onMouseLeave={(e) => (e.currentTarget.style.color = S.dim)}
            >
              Terms
            </button>
            <Link
              to="/documentation"
              style={{
                color: S.dim,
                fontSize: "0.82rem",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = S.mid)}
              onMouseLeave={(e) => (e.currentTarget.style.color = S.dim)}
            >
              Documentation
            </Link>
            <Link
              to="/contact"
              style={{
                color: S.dim,
                fontSize: "0.82rem",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = S.mid)}
              onMouseLeave={(e) => (e.currentTarget.style.color = S.dim)}
            >
              Contact
            </Link>
          </div>
        </div>
      </footer>

      <PrivacyModal open={privacyOpen} onOpenChange={setPrivacyOpen} />
      <TermsModal open={termsOpen} onOpenChange={setTermsOpen} />
    </>
  );
}
