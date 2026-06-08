interface Brand {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  tone?: string;
  keywords?: string[];
  fonts?: { heading?: string; body?: string };
}

interface BrandKitTabProps {
  brand: Brand;
  businessName: string;
  tagline?: string;
  email?: string;
  location?: string;
}

function ColorSwatch({ label, color }: { label: string; color?: string }) {
  if (!color) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-11 h-11 rounded-xl border border-white/10"
        style={{ background: color }}
        title={color}
      />
      <div className="text-center">
        <p className="text-[11px] text-gray-400 font-medium">{label}</p>
        <p className="text-[10px] text-gray-600 font-mono">{color}</p>
      </div>
    </div>
  );
}

export default function BrandKitTab({ brand, businessName, tagline, email, location }: BrandKitTabProps) {
  const primary = brand.primaryColor ?? '#1D9E75';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left column */}
      <div className="space-y-6">
        {/* Color palette */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium mb-4">Color Palette</p>
          <div className="flex gap-6">
            <ColorSwatch label="Primary" color={brand.primaryColor} />
            <ColorSwatch label="Secondary" color={brand.secondaryColor} />
            <ColorSwatch label="Accent" color={brand.accentColor} />
          </div>
        </div>

        {/* Typography */}
        {(brand.fonts?.heading || brand.fonts?.body || brand.tone) && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium mb-3">Typography & Tone</p>
            <div className="grid grid-cols-2 gap-3">
              {brand.fonts?.heading && (
                <div
                  className="rounded-xl p-3 bg-white/5"
                  style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}
                >
                  <p className="text-[10px] text-gray-600 mb-1">Heading</p>
                  <p className="text-[13px] text-white font-medium">{brand.fonts.heading}</p>
                </div>
              )}
              {brand.fonts?.body && (
                <div
                  className="rounded-xl p-3 bg-white/5"
                  style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}
                >
                  <p className="text-[10px] text-gray-600 mb-1">Body</p>
                  <p className="text-[13px] text-white font-medium">{brand.fonts.body}</p>
                </div>
              )}
            </div>
            {brand.tone && (
              <div
                className="rounded-xl p-3 bg-white/5 mt-3"
                style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}
              >
                <p className="text-[10px] text-gray-600 mb-1">Brand Tone</p>
                <p className="text-[13px] text-white">{brand.tone}</p>
              </div>
            )}
          </div>
        )}

        {/* Keywords */}
        {brand.keywords && brand.keywords.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium mb-3">Brand Keywords</p>
            <div className="flex flex-wrap gap-2">
              {brand.keywords.map((kw) => (
                <span
                  key={kw}
                  className="text-[12px] px-3 py-1 rounded-full font-medium"
                  style={{ background: `${primary}20`, color: primary, border: `0.5px solid ${primary}40` }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right column — Live preview */}
      <div className="space-y-5">
        <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium">Live Preview</p>

        {/* Client portal header preview */}
        <div>
          <p className="text-[10px] text-gray-600 mb-2">Client portal header</p>
          <div
            className="rounded-xl p-4"
            style={{
              background: `${primary}10`,
              border: `0.5px solid ${primary}30`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: primary }}
                />
                <div>
                  <p className="text-[13px] font-[500] text-white">{businessName}</p>
                  {tagline && <p className="text-[11px] text-gray-400">{tagline}</p>}
                </div>
              </div>
              {brand.keywords && brand.keywords.slice(0, 2).map((kw) => (
                <span
                  key={kw}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: `${primary}20`, color: primary }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Invoice header preview */}
        <div>
          <p className="text-[10px] text-gray-600 mb-2">Invoice header</p>
          <div
            className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="text-[14px] font-[500]"
                  style={{ color: primary }}
                >
                  {businessName}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {[email, location].filter(Boolean).join(' · ') || 'email · location'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-[500] text-gray-300 uppercase tracking-[0.08em]">Invoice</p>
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">INV-001</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
