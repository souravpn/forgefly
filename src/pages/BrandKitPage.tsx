import QRCode from 'qrcode';
import { ArrowRight, Check, Copy, Download, Plus, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useBusiness } from '@/contexts/CurrentBusinessContext';
import { supabase } from '@/db/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandData {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  ctaColor?: string;
  tone?: string;
  keywords?: string[];
  fonts?: { heading?: string; body?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidHex(hex: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function contrastColor(hex: string): string {
  if (!isValidHex(hex)) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#111827' : '#ffffff';
}

// ─── Color editor ─────────────────────────────────────────────────────────────

function ColorEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hex, setHex] = useState(value);
  const [copied, setCopied] = useState(false);

  // Sync if parent changes (e.g. on extractedData load)
  useEffect(() => { setHex(value); }, [value]);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHex(e.target.value);
    onChange(e.target.value);
  };

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setHex(v);
    if (isValidHex(v)) onChange(v);
  };

  const handleHexBlur = () => {
    if (!isValidHex(hex)) setHex(value); // revert invalid input
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const fg = contrastColor(isValidHex(hex) ? hex : '#888888');

  return (
    <div className="flex flex-col gap-2">
      {/* Swatch */}
      <button
        type="button"
        className="w-16 h-16 rounded-xl border-2 border-border shadow-sm transition-transform hover:scale-105 active:scale-95 relative overflow-hidden"
        style={{ background: isValidHex(hex) ? hex : '#e5e7eb' }}
        onClick={() => inputRef.current?.click()}
        title={`Click to change ${label} color`}
      >
        <input
          ref={inputRef}
          type="color"
          value={isValidHex(hex) ? hex : '#000000'}
          onChange={handleColorChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          tabIndex={-1}
        />
      </button>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {/* Hex input + copy */}
      <div className="flex items-center gap-1">
        <Input
          value={hex}
          onChange={handleHexInput}
          onBlur={handleHexBlur}
          className="h-7 text-xs font-mono px-2 w-[88px]"
          maxLength={7}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleCopy}
          title="Copy hex"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Live preview ─────────────────────────────────────────────────────────────

function LivePreview({
  brand,
  businessName,
  tagline,
  initials,
}: {
  brand: BrandData;
  businessName: string;
  tagline?: string;
  initials?: string;
}) {
  const primary = brand.primaryColor ?? '#1D9E75';
  const accent = brand.accentColor ?? '#E1F5EE';
  const secondary = brand.secondaryColor ?? '#085041';
  const cta = brand.ctaColor ?? primary;

  return (
    <div className="space-y-5">
      {/* Client portal header */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Client portal header</p>
        <div
          className="rounded-xl p-4"
          style={{ background: `${primary}12`, border: `1px solid ${primary}30` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: accent, color: primary }}
              >
                {initials ?? 'FY'}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: primary }}>
                  {businessName}
                </p>
                {tagline && (
                  <p className="text-xs text-muted-foreground">{tagline}</p>
                )}
              </div>
            </div>
            <div className="flex gap-1.5">
              {(brand.keywords ?? []).slice(0, 2).map(kw => (
                <span
                  key={kw}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${primary}18`, color: primary }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice header */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Invoice header</p>
        <div className="rounded-xl p-4 bg-muted/40 border border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: primary }}>
                {businessName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tagline ?? 'hello@yourbusiness.com · Your City'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Invoice
              </p>
              <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">INV-001</p>
            </div>
          </div>
          <div
            className="mt-3 pt-3 border-t text-xs font-medium"
            style={{ borderColor: `${primary}20`, color: primary }}
          >
            Total due: $0.00
          </div>
        </div>
      </div>

      {/* CTA button */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Primary button</p>
        <button
          type="button"
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: cta,
            color: contrastColor(cta),
          }}
        >
          Get in Touch
        </button>
      </div>

      {/* Color harmony strip */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Color harmony</p>
        <div className="flex rounded-xl overflow-hidden h-8 border border-border">
          <div className="flex-1" style={{ background: primary }} />
          <div className="flex-1" style={{ background: secondary }} />
          <div className="flex-1" style={{ background: accent }} />
          <div className="flex-1" style={{ background: cta }} />
        </div>
        <div className="flex text-[10px] text-muted-foreground mt-1 font-mono">
          <span className="flex-1">{primary}</span>
          <span className="flex-1 text-center">{secondary}</span>
          <span className="flex-1 text-center">{accent}</span>
          <span className="flex-1 text-right">{cta}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BrandKitPage() {
  const navigate = useNavigate();
  const { business, extractedData, isLoading: bizLoading, refetch } = useBusiness();

  // Local brand state for immediate live preview
  const [brand, setBrand] = useState<BrandData>({});
  const [newKeyword, setNewKeyword] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);

  // QR download assets
  const [qrLight, setQrLight] = useState('');   // primary on white
  const [qrDark, setQrDark] = useState('');     // white on dark
  const [qrSvg, setQrSvg] = useState('');

  const portfolioSlug = business?.slug ?? '';
  const portfolioUrl = portfolioSlug ? `${window.location.origin}/p/${portfolioSlug}` : '';

  // Sync from extractedData on load
  useEffect(() => {
    if (extractedData?.brand) {
      setBrand(extractedData.brand as BrandData);
    }
  }, [extractedData]);

  // Regenerate QR assets whenever primary color or slug changes
  useEffect(() => {
    if (!portfolioUrl) return;
    const primary = brand.primaryColor ?? '#10B981';
    // If brand primary is too light, fall back to near-black so QR stays scannable
    const r = parseInt(primary.slice(1, 3), 16);
    const g = parseInt(primary.slice(3, 5), 16);
    const b = parseInt(primary.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const safeColor = lum > 0.55 ? '#1a1a1a' : primary;

    QRCode.toDataURL(portfolioUrl, { width: 600, margin: 2, color: { dark: safeColor, light: '#ffffff' } })
      .then(setQrLight).catch(() => {});
    QRCode.toDataURL(portfolioUrl, { width: 600, margin: 2, color: { dark: '#ffffff', light: '#1a1a1a' } })
      .then(setQrDark).catch(() => {});
    QRCode.toString(portfolioUrl, { type: 'svg', margin: 2 })
      .then(setQrSvg).catch(() => {});
  }, [portfolioUrl, brand.primaryColor]);

  const identity = extractedData?.identity;
  const businessName = identity?.businessName ?? identity?.name ?? 'Your Business';
  const initials = identity?.initials ?? businessName.slice(0, 2).toUpperCase();

  // ── Persistence ────────────────────────────────────────────────────────────

  const saveBrand = useCallback(async (updated: BrandData) => {
    if (!business) return;
    setSaving(true);
    const { error } = await supabase
      .from('businesses')
      .update({ extracted_data: { ...extractedData, brand: updated } })
      .eq('id', business.id);
    if (error) {
      toast.error('Failed to save');
    } else {
      refetch();
    }
    setSaving(false);
  }, [business, extractedData, refetch]);

  // Debounced save — used for color picker (fires rapidly)
  const scheduleSave = useCallback((updated: BrandData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveBrand(updated); }, 800);
  }, [saveBrand]);

  // Immediate save — used for text fields on blur and keyword changes
  const immediateSave = useCallback((updated: BrandData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveBrand(updated);
  }, [saveBrand]);

  // ── Field handlers ──────────────────────────────────────────────────────────

  const handleColorChange = (key: 'primaryColor' | 'secondaryColor' | 'accentColor' | 'ctaColor') =>
    (hex: string) => {
      const updated = { ...brand, [key]: hex };
      setBrand(updated);
      scheduleSave(updated);
    };

  const handleFontChange = (key: 'heading' | 'body') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const updated = { ...brand, fonts: { ...brand.fonts, [key]: e.target.value } };
      setBrand(updated);
    };

  const handleFontBlur = () => { immediateSave(brand); };

  const handleToneChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBrand(b => ({ ...b, tone: e.target.value }));
  };

  const handleToneBlur = () => { immediateSave(brand); };

  const handleAddKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw || (brand.keywords ?? []).includes(kw)) {
      setNewKeyword('');
      return;
    }
    const updated = { ...brand, keywords: [...(brand.keywords ?? []), kw] };
    setBrand(updated);
    setNewKeyword('');
    immediateSave(updated);
  };

  const handleRemoveKeyword = (kw: string) => {
    const updated = { ...brand, keywords: (brand.keywords ?? []).filter(k => k !== kw) };
    setBrand(updated);
    immediateSave(updated);
  };

  const hasBusiness = !bizLoading && !!business;

  function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  function downloadSvg() {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${portfolioSlug || 'portfolio'}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">Brand Kit</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {hasBusiness
              ? 'Your AI-generated brand identity — edit anytime'
              : 'Your brand colors, fonts, and voice'}
          </p>
        </div>
        {saving && (
          <span className="text-xs text-muted-foreground animate-pulse">Saving…</span>
        )}
      </div>

      {/* No business CTA */}
      {!bizLoading && !business && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Generate your Business OS first</h3>
            <p className="text-muted-foreground max-w-sm text-pretty">
              Your brand kit — colors, fonts, tone, and keywords — is generated automatically from your business description.
            </p>
          </div>
          <Button onClick={() => navigate('/')}>
            Generate now
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Main content */}
      {hasBusiness && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

          {/* ── Left column: editable brand data ─────────────────────────── */}
          <div className="space-y-6">

            {/* Colors */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Color Palette</CardTitle>
                <CardDescription>Click a swatch to open the color picker</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 flex-wrap">
                  <ColorEditor
                    label="Primary"
                    value={brand.primaryColor ?? '#1D9E75'}
                    onChange={handleColorChange('primaryColor')}
                  />
                  <ColorEditor
                    label="Secondary"
                    value={brand.secondaryColor ?? '#085041'}
                    onChange={handleColorChange('secondaryColor')}
                  />
                  <ColorEditor
                    label="Accent"
                    value={brand.accentColor ?? '#E1F5EE'}
                    onChange={handleColorChange('accentColor')}
                  />
                  <ColorEditor
                    label="CTA"
                    value={brand.ctaColor ?? brand.primaryColor ?? '#1D9E75'}
                    onChange={handleColorChange('ctaColor')}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Primary: text & icons · Secondary: soft backgrounds · Accent: card backgrounds · CTA: action buttons</p>
              </CardContent>
            </Card>

            {/* Typography */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Typography</CardTitle>
                <CardDescription>Font names as suggested by your Business OS</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Heading font</label>
                    <Input
                      value={brand.fonts?.heading ?? ''}
                      onChange={handleFontChange('heading')}
                      onBlur={handleFontBlur}
                      placeholder="e.g., Playfair Display"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Body font</label>
                    <Input
                      value={brand.fonts?.body ?? ''}
                      onChange={handleFontChange('body')}
                      onBlur={handleFontBlur}
                      placeholder="e.g., Inter"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                {brand.fonts?.heading && (
                  <div
                    className="rounded-lg p-3 bg-muted/40"
                    style={{ borderLeft: `3px solid ${brand.primaryColor ?? '#1D9E75'}` }}
                  >
                    <p className="text-xs text-muted-foreground mb-0.5">Heading preview</p>
                    <p className="text-lg font-semibold">{businessName}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Brand voice */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Brand Voice</CardTitle>
                <CardDescription>How your brand communicates with clients</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={brand.tone ?? ''}
                  onChange={handleToneChange}
                  onBlur={handleToneBlur}
                  placeholder="e.g., Approachable yet professional. Warm, direct, and results-focused."
                  rows={3}
                  className="text-sm resize-none"
                />
              </CardContent>
            </Card>

            {/* Keywords */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Brand Keywords</CardTitle>
                <CardDescription>Words that define your brand identity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {(brand.keywords ?? []).map(kw => (
                    <Badge
                      key={kw}
                      variant="secondary"
                      className="gap-1.5 pr-1 pl-3"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(kw)}
                        className="rounded-full hover:bg-foreground/10 p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {(brand.keywords ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No keywords yet. Add some below.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newKeyword}
                    onChange={e => setNewKeyword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                    placeholder="Add a keyword…"
                    className="h-8 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={handleAddKeyword}
                    disabled={!newKeyword.trim()}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* ── Right column: live preview ─────────────────────────────── */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Live Preview</CardTitle>
                <CardDescription>Updates as you edit — reflects your brand in real UI</CardDescription>
              </CardHeader>
              <CardContent>
                <LivePreview
                  brand={brand}
                  businessName={businessName}
                  tagline={identity?.tagline}
                  initials={initials}
                />
              </CardContent>
            </Card>

            {/* Niche / identity context */}
            {identity?.niche && (
              <Card className="bg-muted/30">
                <CardContent className="py-4 px-5">
                  <p className="text-xs text-muted-foreground mb-1">Business niche</p>
                  <p className="text-sm font-medium">{identity.niche}</p>
                </CardContent>
              </Card>
            )}
          </div>

        </div>

        {/* ── QR code download assets ─────────────────────────────────── */}
        {portfolioUrl && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">QR Code Downloads</CardTitle>
              <CardDescription>
                Print-ready QR codes linking to your portfolio — use on business cards, packaging, invoice footers, and stickers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* Light variant */}
                <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border/60 bg-white">
                  {qrLight
                    ? <img src={qrLight} alt="QR — brand color on white" width={120} height={120} className="block" />
                    : <div className="w-[120px] h-[120px] flex items-center justify-center text-xs text-muted-foreground">Generating…</div>
                  }
                  <div className="text-center">
                    <p className="text-xs font-medium">Brand color on white</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">For light print</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                    disabled={!qrLight}
                    onClick={() => downloadDataUrl(qrLight, `${portfolioSlug || 'portfolio'}-qr-light.png`)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PNG
                  </Button>
                </div>

                {/* Dark variant */}
                <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border/60 bg-[#1a1a1a]">
                  {qrDark
                    ? <img src={qrDark} alt="QR — white on dark" width={120} height={120} className="block" />
                    : <div className="w-[120px] h-[120px] flex items-center justify-center text-xs text-white/40">Generating…</div>
                  }
                  <div className="text-center">
                    <p className="text-xs font-medium text-white">White on dark</p>
                    <p className="text-[11px] text-white/50 mt-0.5">For dark backgrounds</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 border-white/20 text-white hover:bg-white/10 hover:text-white"
                    disabled={!qrDark}
                    onClick={() => downloadDataUrl(qrDark, `${portfolioSlug || 'portfolio'}-qr-dark.png`)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PNG
                  </Button>
                </div>

                {/* SVG variant */}
                <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border/60">
                  <div className="w-[120px] h-[120px] flex flex-col items-center justify-center gap-2">
                    <div className="text-4xl font-bold text-muted-foreground/30 select-none">SVG</div>
                    <p className="text-[11px] text-muted-foreground text-center">Scales to any size without quality loss</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium">Vector (scalable)</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">For large-format print</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                    disabled={!qrSvg}
                    onClick={downloadSvg}
                  >
                    <Download className="h-3.5 w-3.5" />
                    SVG
                  </Button>
                </div>

              </div>
              <p className="text-[11px] text-muted-foreground mt-4 font-mono">{`${window.location.origin}/p/${portfolioSlug}`}</p>
            </CardContent>
          </Card>
        )}

      )}
    </div>
  );
}
