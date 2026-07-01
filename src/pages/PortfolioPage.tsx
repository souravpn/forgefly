import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Copy,
  Check,
  Mail,
  MessageSquare,
  ExternalLink,
  Download,
  Wallet,
  ChevronDown,
  ChevronUp,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBusiness } from "@/contexts/CurrentBusinessContext";
import { buildPortfolioUrl, displayPortfolioUrl } from "@/lib/portfolioUrl";

type MainTab = "portal" | "share";
type QrColorChoice = "brand" | "dark" | "black";

function getLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getSafeQrColor(hex: string): string {
  return getLuminance(hex) > 0.4 ? "#1a1a1a" : hex;
}

function generateVcf(
  name: string,
  portfolioUrl: string,
  tagline?: string,
  email?: string | null,
  phone?: string | null,
): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `ORG:${name}`,
    `URL:${portfolioUrl}`,
  ];
  if (tagline) lines.push(`NOTE:${tagline}`);
  if (email) lines.push(`EMAIL:${email}`);
  if (phone) lines.push(`TEL:${phone}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function downloadBlob(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ShareRow({
  label,
  icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border/40">{children}</div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const { business, extractedData } = useBusiness();

  const [tab, setTab] = useState<MainTab>("portal");
  const [openRow, setOpenRow] = useState<"link" | "qr" | "wallet" | null>(
    "link",
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeResizeObserverRef = useRef<ResizeObserver | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeHeight, setIframeHeight] = useState(0);

  useEffect(() => {
    return () => iframeResizeObserverRef.current?.disconnect();
  }, []);
  const [copied, setCopied] = useState(false);
  const [qrColorChoice, setQrColorChoice] = useState<QrColorChoice>("brand");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrPassDataUrl, setQrPassDataUrl] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);

  const identity = extractedData?.identity;
  const bizName =
    identity?.businessName ?? identity?.name ?? business?.name ?? "My Business";
  const tagline = identity?.tagline;
  const brandPrimary =
    business?.extracted_data?.brand?.primaryColor ?? "#10B981";
  const contactEmail = business?.contact_email ?? null;
  const contactPhone = business?.contact_phone ?? null;

  const slug = business?.slug ?? "";
  // Share URL uses subdomain in prod; iframe preview always uses same-origin path
  const portfolioUrl = slug ? buildPortfolioUrl(slug) : "";
  const iframeUrl = slug ? `${window.location.origin}/p/${slug}` : "";
  const displayUrl = slug ? displayPortfolioUrl(slug) : "";
  const initials = bizName.slice(0, 2).toUpperCase();
  const passTextColor =
    getLuminance(brandPrimary) > 0.5 ? "#000000" : "#ffffff";

  const resolvedQrColor = useMemo(() => {
    if (qrColorChoice === "black") return "#000000";
    if (qrColorChoice === "dark") return "#1a1a1a";
    return getSafeQrColor(brandPrimary);
  }, [qrColorChoice, brandPrimary]);

  useEffect(() => {
    if (!slug) return;
    QRCode.toDataURL(portfolioUrl, {
      width: 400,
      margin: 2,
      color: { dark: resolvedQrColor, light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [portfolioUrl, resolvedQrColor, slug]);

  useEffect(() => {
    if (!slug) return;
    QRCode.toDataURL(portfolioUrl, {
      width: 80,
      margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
    })
      .then(setQrPassDataUrl)
      .catch(() => {});
  }, [portfolioUrl, slug]);

  const copyLink = () => {
    navigator.clipboard.writeText(portfolioUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareEmail = () => {
    const subject = encodeURIComponent(`${bizName} — Portfolio`);
    const body = encodeURIComponent(`Check out my portfolio:\n${portfolioUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareMessage = () => {
    if (navigator.share) {
      navigator.share({ title: bizName, url: portfolioUrl }).catch(() => {});
    } else {
      window.open(
        `sms:?body=${encodeURIComponent(`Check out my portfolio: ${portfolioUrl}`)}`,
      );
    }
  };

  const downloadQR = () => {
    if (qrDataUrl) downloadBlob(qrDataUrl, "image/png", `${slug}-qr.png`);
  };

  const saveContact = () => {
    downloadBlob(
      generateVcf(bizName, portfolioUrl, tagline, contactEmail, contactPhone),
      "text/vcard",
      `${slug}.vcf`,
    );
    toast.success("Contact file downloaded");
  };

  const addToWallet = async () => {
    setWalletLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/generate-wallet-pass`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({ slug }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}.pkpass`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        `Couldn't generate pass: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setWalletLoading(false);
    }
  };

  const COLOR_OPTIONS: { id: QrColorChoice; hex: string; label: string }[] = [
    { id: "brand", hex: getSafeQrColor(brandPrimary), label: "Brand" },
    { id: "dark", hex: "#1a1a1a", label: "Dark" },
    { id: "black", hex: "#000000", label: "Black" },
  ];

  if (!slug) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No public portfolio yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">{bizName}</h1>
          <p className="text-sm text-muted-foreground">
            {tagline ?? "Your public portfolio"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => window.open(portfolioUrl, "_blank", "noopener")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open full page
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 p-0.5 bg-muted rounded-lg mb-5 w-fit">
        {(["portal", "share"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-5 py-1.5 text-sm font-medium rounded-md transition-colors capitalize",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "portal" ? "Portal" : "Share"}
          </button>
        ))}
      </div>

      {/* ── Portal tab ── */}
      {tab === "portal" && (
        <div className="rounded-xl overflow-hidden border border-border/40">
          {iframeLoading && (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60 animate-spin" />
              <p className="text-xs text-muted-foreground">Loading…</p>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={iframeUrl}
            title="Portfolio preview"
            onLoad={() => {
              setIframeLoading(false);
              iframeResizeObserverRef.current?.disconnect();
              try {
                const doc = iframeRef.current?.contentDocument;
                const target = doc?.documentElement;
                if (doc && target) {
                  const updateHeight = () =>
                    setIframeHeight(
                      target.scrollHeight || doc.body.scrollHeight,
                    );
                  updateHeight();
                  const observer = new ResizeObserver(updateHeight);
                  observer.observe(target);
                  iframeResizeObserverRef.current = observer;
                } else {
                  setIframeHeight(800);
                }
              } catch {
                setIframeHeight(800);
              }
            }}
            style={{
              width: "100%",
              height: iframeHeight > 0 ? iframeHeight : undefined,
              display: iframeLoading ? "none" : "block",
              border: "none",
            }}
          />
        </div>
      )}

      {/* ── Share tab ── */}
      {tab === "share" && (
        <div className="flex flex-col gap-3 max-w-2xl">
          {/* Row 1 — Share link */}
          <ShareRow
            label="Share link"
            icon={<Link2 className="h-4 w-4" />}
            open={openRow === "link"}
            onToggle={() => setOpenRow(openRow === "link" ? null : "link")}
          >
            <div className="pt-3 flex flex-col gap-3">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-muted rounded-lg border border-border/60">
                <span className="text-xs font-mono text-foreground flex-1 truncate select-all">
                  {displayUrl}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 shrink-0"
                  onClick={copyLink}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-muted/50 hover:bg-muted border border-border/50 transition-colors text-sm text-muted-foreground"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Copy
                </button>
                <button
                  type="button"
                  onClick={shareEmail}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-muted/50 hover:bg-muted border border-border/50 transition-colors text-sm text-muted-foreground"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={shareMessage}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-muted/50 hover:bg-muted border border-border/50 transition-colors text-sm text-muted-foreground"
                >
                  <MessageSquare className="h-4 w-4" />
                  Message
                </button>
              </div>
            </div>
          </ShareRow>

          {/* Row 2 — QR Code */}
          <ShareRow
            label="QR Code"
            icon={<Download className="h-4 w-4" />}
            open={openRow === "qr"}
            onToggle={() => setOpenRow(openRow === "qr" ? null : "qr")}
          >
            <div className="pt-3 flex gap-5 items-start">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-border/40 shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR code"
                    width={120}
                    height={120}
                    className="block"
                  />
                ) : (
                  <div className="w-[120px] h-[120px] flex items-center justify-center text-xs text-muted-foreground">
                    Generating…
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 flex-1 min-w-0">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Color
                  </p>
                  <div className="flex gap-2 items-center">
                    {COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setQrColorChoice(opt.id)}
                        title={opt.label}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-all",
                          qrColorChoice === opt.id
                            ? "scale-110 border-foreground"
                            : "border-transparent hover:border-foreground/40",
                        )}
                        style={{ backgroundColor: opt.hex }}
                      />
                    ))}
                    <span className="text-[11px] text-muted-foreground ml-1">
                      {COLOR_OPTIONS.find((o) => o.id === qrColorChoice)?.label}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {displayUrl}
                </p>
                <Button
                  size="sm"
                  onClick={downloadQR}
                  disabled={!qrDataUrl}
                  className="w-full gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PNG
                </Button>
              </div>
            </div>
          </ShareRow>

          {/* Row 3 — Wallet Pass */}
          <ShareRow
            label="Wallet Pass"
            icon={<Wallet className="h-4 w-4" />}
            open={openRow === "wallet"}
            onToggle={() => setOpenRow(openRow === "wallet" ? null : "wallet")}
          >
            <div className="pt-3 flex gap-5 items-start">
              {/* Pass card preview */}
              <div
                className="rounded-2xl p-4 flex flex-col gap-2 shadow-md shrink-0 w-48"
                style={{ backgroundColor: brandPrimary, color: passTextColor }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold mb-2"
                      style={{
                        backgroundColor: `${passTextColor}20`,
                        color: passTextColor,
                      }}
                    >
                      {initials}
                    </div>
                    <p className="font-bold text-sm leading-snug">{bizName}</p>
                    {tagline && (
                      <p
                        className="text-[10px] mt-0.5 leading-snug"
                        style={{ opacity: 0.75 }}
                      >
                        {tagline}
                      </p>
                    )}
                  </div>
                  {qrPassDataUrl && (
                    <img
                      src={qrPassDataUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded-md shrink-0 mt-1"
                    />
                  )}
                </div>
                <p
                  className="text-[9px] font-mono mt-1"
                  style={{ opacity: 0.6 }}
                >
                  {displayUrl}
                </p>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <Button
                  onClick={addToWallet}
                  disabled={walletLoading}
                  size="sm"
                  className="w-full gap-2"
                  style={{ backgroundColor: brandPrimary }}
                >
                  {walletLoading ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <Wallet className="h-3.5 w-3.5" />
                  )}
                  {walletLoading ? "Generating…" : "Add to Apple Wallet"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveContact}
                  className="w-full gap-2"
                >
                  <Download className="h-3.5 w-3.5" />
                  Save contact (.vcf)
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Uses your brand color.
                </p>
              </div>
            </div>
          </ShareRow>
        </div>
      )}
    </div>
  );
}
