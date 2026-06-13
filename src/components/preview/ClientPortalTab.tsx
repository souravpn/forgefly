import { Link } from "lucide-react";

interface ExtractedService {
  name: string;
  price: string;
  type?: string;
  description?: string;
}

interface ExtractedData {
  identity?: {
    businessName?: string;
    name?: string;
    initials?: string;
    tagline?: string;
    accentColor?: string;
  };
  services?: ExtractedService[];
  brand?: {
    primaryColor?: string;
    accentColor?: string;
    keywords?: string[];
  };
}

interface ClientPortalTabProps {
  data: ExtractedData;
  slug?: string;
}

export default function ClientPortalTab({ data, slug }: ClientPortalTabProps) {
  const identity = data.identity ?? {};
  const services = data.services ?? [];
  const brand = data.brand ?? {};

  const primary = brand.primaryColor ?? "#1D9E75";
  const accent = brand.accentColor ?? "#E1F5EE";
  const businessName =
    identity.businessName ?? identity.name ?? "Your Business";
  const initials = identity.initials ?? businessName.slice(0, 2).toUpperCase();
  const keywords = brand.keywords ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {/* Context banner */}
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(168,85,247,0.18) 50%, rgba(236,72,153,0.12) 100%)",
          border: "0.5px solid rgba(168,85,247,0.25)",
        }}
      >
        <Link className="w-3.5 h-3.5 shrink-0 text-violet-400" />
        <p className="text-[12px] text-gray-300">
          This is what your clients see at your public portal link
          <br />
          <span
            className="inline-block mt-0.5 font-mono text-[11px] px-2 py-0.5 rounded-md"
            style={{
              background: "linear-gradient(90deg, rgba(139,92,246,0.2) 0%, rgba(192,132,252,0.35) 50%, rgba(139,92,246,0.2) 100%)",
              backgroundSize: "200% 100%",
              color: "#c4b5fd",
              border: "0.5px solid rgba(168,85,247,0.45)",
              animation: "shimmer 2.5s ease-in-out infinite",
            }}
          >
            www.forgefly.io/p/{slug ?? 'your-slug'}
          </span>
        </p>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "0.5px solid rgba(255,255,255,0.1)" }}
      >
        {/* Section 1 — Portal header */}
        <div
          className="p-6"
          style={{
            background: `${primary}14`,
            borderBottom: `0.5px solid ${primary}33`,
          }}
        >
          <div className="flex items-start gap-4">
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: accent,
                color: primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h2
                className="text-[18px] font-[600] text-white leading-tight"
                style={{ color: "var(--preview-primary)" }}
              >
                {businessName}
              </h2>
              {identity.tagline && (
                <p className="text-[13px] text-gray-400 mt-0.5">
                  {identity.tagline}
                </p>
              )}
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {keywords.slice(0, 3).map((kw) => (
                    <span
                      key={kw}
                      className="text-[11px] px-2.5 py-0.5 rounded-full font-medium"
                      style={{
                        background: "var(--preview-accent)",
                        color: "var(--preview-primary)",
                        border: `0.5px solid ${primary}40`,
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2 — Services list */}
        <div className="bg-white/[0.02] mt-6">
          <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium px-6 pt-5 pb-3">
            Services
          </p>
          {services.length === 0 ? (
            <p className="text-[13px] text-gray-600 px-6 pb-5">
              No services listed.
            </p>
          ) : (
            <div>
              {services.map((svc, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-6 py-3.5"
                  style={{
                    borderTop:
                      i > 0 ? "0.5px solid rgba(255,255,255,0.06)" : undefined,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-[500] text-white truncate">
                      {svc.name}
                    </p>
                    {svc.description && (
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        {svc.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {svc.type && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                        {svc.type}
                      </span>
                    )}
                    <p
                      className="text-[13px] font-[500]"
                      style={{ color: "var(--preview-primary)" }}
                    >
                      {svc.price}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3 — CTA */}
        <div
          className="px-6 py-6 flex flex-col items-center gap-2"
          style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
        >
          <button
            type="button"
            className="w-full max-w-xs py-2.5 rounded-lg text-[13px] font-[500] text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--preview-primary)" }}
          >
            Request a proposal →
          </button>
          <p className="text-[11px] text-gray-600">
            Typically responds within 24 hours
          </p>
        </div>
      </div>
    </div>
  );
}
