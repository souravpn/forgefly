import { useState } from 'react';

interface Brand {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  ctaColor?: string;
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
  initials?: string;
  niche?: string;
}

const COLOR_ROLES = [
  {
    key: 'primaryColor' as const,
    role: 'Text & icons',
    desc: 'Main brand color — used for all interactive and branded elements',
    usedIn: ['tab underline', 'avatar text', 'buttons', 'links'],
  },
  {
    key: 'secondaryColor' as const,
    role: 'Soft background',
    desc: 'Light tint for badges, chips, avatar backgrounds, hover states',
    usedIn: ['avatar bg', 'keyword chips', 'save gate bg'],
  },
  {
    key: 'accentColor' as const,
    role: 'Page background',
    desc: 'Base background for cards, modals, and content areas',
    usedIn: ['cards', 'invoices', 'proposals'],
  },
  {
    key: 'ctaColor' as const,
    role: 'Buttons & CTAs',
    desc: 'Action buttons — "Request a proposal", "Save", "Send invoice"',
    usedIn: ['client portal CTA', 'save btn'],
  },
];

const FONT_PAIRS = [
  {
    id: 'clean-modern',
    name: 'Clean & modern',
    heading: 'Inter',
    body: 'Inter',
    headingStyle: { fontFamily: 'sans-serif', fontWeight: 500 as const },
    bodyStyle: { fontFamily: 'sans-serif' },
    bestFor: 'SaaS, tech, dev agencies',
    exampleText: 'Design that works',
    bodyText: 'Clear, functional, built for digital-first businesses.',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    heading: 'DM Serif Display',
    body: 'Plus Jakarta Sans',
    headingStyle: { fontFamily: 'Georgia, serif', fontWeight: 400 as const },
    bodyStyle: { fontFamily: 'sans-serif' },
    bestFor: 'Photographers, writers',
    exampleText: 'Design that works',
    bodyText: 'Refined, considered. A voice that earns attention.',
  },
  {
    id: 'warm-professional',
    name: 'Warm professional',
    heading: 'Playfair Display',
    body: 'Lato',
    headingStyle: { fontFamily: 'Georgia, serif' },
    bodyStyle: { fontFamily: 'sans-serif' },
    bestFor: 'Coaches, consultants',
    exampleText: 'Design that works',
    bodyText: 'Approachable and trustworthy, without losing authority.',
  },
  {
    id: 'bold-studio',
    name: 'Bold studio',
    heading: 'Syne',
    body: 'DM Sans',
    headingStyle: { fontFamily: 'sans-serif', fontWeight: 500 as const, letterSpacing: '-0.03em' },
    bodyStyle: { fontFamily: 'sans-serif' },
    bestFor: 'Designers, creative directors',
    exampleText: 'Design that works',
    bodyText: 'Confident, direct. Says "we have a point of view".',
  },
  {
    id: 'classic-trust',
    name: 'Classic trust',
    heading: 'Merriweather',
    body: 'Source Sans 3',
    headingStyle: { fontFamily: 'Georgia, serif', fontWeight: 400 as const, fontSize: 14 },
    bodyStyle: { fontFamily: 'sans-serif' },
    bestFor: 'Lawyers, financial advisors',
    exampleText: 'Design that works',
    bodyText: 'Steady, authoritative. Signals longevity and expertise.',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    heading: 'Geist',
    body: 'Geist Mono',
    headingStyle: { fontFamily: 'monospace', fontSize: 14 },
    bodyStyle: { fontFamily: 'monospace' },
    bestFor: 'Engineers, developers',
    exampleText: 'Design that works',
    bodyText: 'Precise. No decoration. The work speaks for itself.',
  },
];

function inferFontPair(niche: string): string {
  const n = niche.toLowerCase();
  if (/photo|film|brand|strat|writ|content|copy/.test(n)) return 'editorial';
  if (/coach|consult|therap|wellnes|health/.test(n)) return 'warm-professional';
  if (/design|creative|studio|art/.test(n)) return 'bold-studio';
  if (/law|legal|financ|account|audit/.test(n)) return 'classic-trust';
  if (/engineer|dev|code|software|tech/.test(n)) return 'minimal';
  return 'clean-modern';
}

export default function BrandKitTab({ brand, businessName, tagline, email, location, initials, niche }: BrandKitTabProps) {
  const primary = brand.primaryColor ?? '#1D9E75';
  const inferredPair = inferFontPair(niche ?? '');
  const [selectedFontPair, setSelectedFontPair] = useState(inferredPair);

  const updateFont = (pairId: string) => {
    setSelectedFontPair(pairId);
    try {
      const pending = JSON.parse(sessionStorage.getItem('pending_portal') || '{}');
      if (pending.extracted_data?.brand) {
        pending.extracted_data.brand.fontPairId = pairId;
        sessionStorage.setItem('pending_portal', JSON.stringify(pending));
      }
    } catch { /* non-fatal */ }
  };

  const colorValues: Record<string, string | undefined> = {
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    accentColor: brand.accentColor,
    ctaColor: brand.ctaColor ?? brand.primaryColor,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left column */}
      <div className="space-y-6">

        {/* Color palette */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium">Color palette</p>
            <span style={{ fontSize: 10, color: 'rgba(107,114,128,1)', display: 'flex', alignItems: 'center', gap: 4 }}>
              Sign in to edit colors and fonts
            </span>
          </div>

          <div className="space-y-3">
            {COLOR_ROLES.map(({ key, role, desc, usedIn }) => {
              const color = colorValues[key];
              if (!color) return null;
              return (
                <div key={key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                      background: color, border: '1px solid rgba(255,255,255,0.1)',
                    }}
                    title={color}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.8)', marginBottom: 2 }}>{role}</p>
                    <p style={{ fontSize: 10, color: 'rgba(107,114,128,1)', marginBottom: 3, lineHeight: 1.4 }}>{desc}</p>
                    <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(75,85,99,1)', marginBottom: 4 }}>{color}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {usedIn.map(chip => (
                        <span
                          key={chip}
                          style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 4,
                            background: 'rgba(255,255,255,0.05)',
                            border: '0.5px solid rgba(255,255,255,0.1)',
                            color: 'rgba(107,114,128,1)',
                          }}
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            fontSize: 11, color: 'rgba(107,114,128,1)', background: 'rgba(255,255,255,0.03)',
            borderRadius: 8, padding: '9px 12px', marginTop: 10,
            display: 'flex', alignItems: 'flex-start', gap: 6,
            border: '0.5px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>ⓘ</span>
            <span>
              These colors are applied across your portal and client-facing pages. Your clients
              see the same palette on proposals, invoices, and your public portfolio.
            </span>
          </div>
        </div>

        {/* Font pair selector */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium mb-3">Font pairs</p>
          <div className="grid grid-cols-2 gap-2">
            {FONT_PAIRS.map(pair => {
              const isSelected = selectedFontPair === pair.id;
              return (
                <button
                  key={pair.id}
                  type="button"
                  onClick={() => updateFont(pair.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: isSelected ? `1.5px solid ${primary}` : '0.5px solid rgba(255,255,255,0.1)',
                    background: isSelected ? `${primary}14` : 'rgba(255,255,255,0.02)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {isSelected && (
                    <span style={{
                      position: 'absolute', top: 5, right: 5,
                      fontSize: 9, padding: '1px 5px', borderRadius: 3,
                      background: `${primary}25`, color: primary,
                    }}>
                      Selected ✓
                    </span>
                  )}
                  <p style={{ ...pair.headingStyle, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 2, lineHeight: 1.3 }}>
                    {pair.exampleText}
                  </p>
                  <p style={{
                    ...pair.bodyStyle, fontSize: 9, color: 'rgba(107,114,128,1)', marginBottom: 4,
                    lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {pair.bodyText}
                  </p>
                  <p style={{ fontSize: 9, color: 'rgba(75,85,99,1)', marginBottom: 1 }}>{pair.name}</p>
                  <p style={{ fontSize: 8, color: 'rgba(55,65,81,0.8)' }}>{pair.bestFor}</p>
                </button>
              );
            })}
          </div>

          <div style={{
            fontSize: 11, color: 'rgba(107,114,128,1)', background: 'rgba(255,255,255,0.03)',
            borderRadius: 8, padding: '9px 12px', marginTop: 8,
            border: '0.5px solid rgba(255,255,255,0.06)',
          }}>
            ✦ Claude selected{' '}
            <strong style={{ color: 'rgba(156,163,175,1)' }}>
              {FONT_PAIRS.find(p => p.id === inferredPair)?.name}
            </strong>
            {niche ? ` based on your ${niche}` : ''}. Switch any time —
            changes apply across proposals, invoices, and your client portal.
          </div>
        </div>

        {/* Keywords */}
        {brand.keywords && brand.keywords.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium mb-3">Brand keywords</p>
            <div className="flex flex-wrap gap-2">
              {brand.keywords.map((kw) => (
                <span
                  key={kw}
                  className="text-[12px] px-3 py-1 rounded-full font-medium"
                  style={{ background: 'var(--preview-accent)', color: 'var(--preview-primary)', border: `0.5px solid ${primary}40` }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Brand tone */}
        {brand.tone && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium mb-2">Brand tone</p>
            <div
              className="rounded-xl p-3 bg-white/5"
              style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}
            >
              <p className="text-[13px] text-white">{brand.tone}</p>
            </div>
          </div>
        )}
      </div>

      {/* Right column — Live preview */}
      <div className="space-y-5">
        <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium">Live preview</p>

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
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: brand.accentColor || 'var(--preview-accent)',
                  color: brand.primaryColor || 'var(--preview-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 500, fontSize: 13, flexShrink: 0,
                }}>
                  {initials}
                </div>
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
