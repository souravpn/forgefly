import { WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const S = {
  bg: "#080D0B",
  em: "#10B981",
  em2: "#059669",
  text: "#E8EDE8",
  mid: "#8FA98A",
  border: "rgba(16,185,129,0.12)",
} as const;

const sora = "'Sora', sans-serif";

const NAV_LINKS = [
  { label: "How it works", id: "how" },
  { label: "Features", id: "features" },
  { label: "Pricing", id: "pricing" },
];

export function SiteHeader() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const h = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, [isHome]);

  function goToSection(id: string) {
    if (isHome) {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(`/#${id}`);
    }
  }

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        transition: "background 0.3s ease, border-color 0.3s ease",
        background: !isHome || navScrolled ? "rgba(8,13,11,0.85)" : "transparent",
        backdropFilter: !isHome || navScrolled ? "blur(16px)" : "none",
        borderBottom:
          !isHome || navScrolled ? `1px solid ${S.border}` : "1px solid transparent",
      }}
    >
      <div
        style={{
          maxWidth: "1152px",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "64px",
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}
        >
          <img
            src="/forgefly-icon.png"
            alt="Forgefly"
            style={{ width: "32px", height: "32px", borderRadius: "8px" }}
          />
          <span
            style={{
              fontFamily: sora,
              fontWeight: 600,
              fontSize: "1.05rem",
              color: S.text,
            }}
          >
            Forgefly
          </span>
        </Link>

        {/* Center links */}
        <div className="hidden md:flex" style={{ gap: "32px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => goToSection("hero")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: S.mid,
              fontSize: "0.875rem",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = S.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = S.mid)}
          >
            <span
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "6px",
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <WandSparkles className="w-4 h-4 text-violet-200" />
            </span>
            Create With AI
          </button>
          {NAV_LINKS.map(({ label, id }) => (
            <button
              key={id}
              type="button"
              onClick={() => goToSection(id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: S.mid,
                fontSize: "0.875rem",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = S.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = S.mid)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <button
            type="button"
            onClick={() => navigate("/login")}
            style={{
              background: `linear-gradient(135deg, ${S.em}, ${S.em2})`,
              color: "#fff",
              border: "none",
              borderRadius: "9999px",
              padding: "8px 20px",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Sign in
          </button>
        </div>
      </div>
    </nav>
  );
}
