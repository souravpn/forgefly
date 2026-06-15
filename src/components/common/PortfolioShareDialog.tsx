import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Check, Mail, MessageSquare, Globe, ExternalLink, Download, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PortfolioShareDialogProps {
  open: boolean
  onClose: () => void
  slug: string
  businessName: string
  brandPrimary?: string
  tagline?: string
  contactEmail?: string | null
  contactPhone?: string | null
}

type Tab = 'share' | 'qr' | 'wallet'
type QrColorChoice = 'brand' | 'dark' | 'black'

function getLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return 0
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function getSafeQrColor(hex: string): string {
  return getLuminance(hex) > 0.4 ? '#1a1a1a' : hex
}

function generateVcf(
  name: string,
  portfolioUrl: string,
  tagline?: string,
  email?: string | null,
  phone?: string | null,
): string {
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    `ORG:${name}`,
    `URL:${portfolioUrl}`,
  ]
  if (tagline) lines.push(`NOTE:${tagline}`)
  if (email) lines.push(`EMAIL:${email}`)
  if (phone) lines.push(`TEL:${phone}`)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

function downloadBlob(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function PortfolioShareDialog({
  open,
  onClose,
  slug,
  businessName,
  brandPrimary = '#10B981',
  tagline,
  contactEmail,
  contactPhone,
}: PortfolioShareDialogProps) {
  const [copied, setCopied] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('share')
  const [qrColorChoice, setQrColorChoice] = useState<QrColorChoice>('brand')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrPassDataUrl, setQrPassDataUrl] = useState('')
  const [walletLoading, setWalletLoading] = useState(false)

  const portfolioUrl = `${window.location.origin}/p/${slug}`
  const displayUrl = `forgefly.io/p/${slug}`

  const resolvedQrColor = useMemo(() => {
    if (qrColorChoice === 'black') return '#000000'
    if (qrColorChoice === 'dark') return '#1a1a1a'
    return getSafeQrColor(brandPrimary)
  }, [qrColorChoice, brandPrimary])

  // Generate downloadable QR (colored)
  useEffect(() => {
    QRCode.toDataURL(portfolioUrl, {
      width: 400,
      margin: 2,
      color: { dark: resolvedQrColor, light: '#ffffff' },
    }).then(setQrDataUrl).catch(() => {})
  }, [portfolioUrl, resolvedQrColor])

  // Generate pass-preview QR (always white on transparent — displayed on brand bg)
  useEffect(() => {
    QRCode.toDataURL(portfolioUrl, {
      width: 80,
      margin: 1,
      color: { dark: '#ffffff', light: '#00000000' },
    }).then(setQrPassDataUrl).catch(() => {})
  }, [portfolioUrl])

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) { setPreviewLoading(true); setTab('share') }
    else onClose()
  }

  const copyLink = () => {
    navigator.clipboard.writeText(portfolioUrl)
    setCopied(true)
    toast.success('Link copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const shareEmail = () => {
    const subject = encodeURIComponent(`${businessName} — Portfolio`)
    const body = encodeURIComponent(`Check out my portfolio:\n${portfolioUrl}`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const shareMessage = () => {
    if (navigator.share) {
      navigator.share({ title: businessName, url: portfolioUrl }).catch(() => {})
    } else {
      const text = encodeURIComponent(`Check out my portfolio: ${portfolioUrl}`)
      window.open(`sms:?body=${text}`)
    }
  }

  const openPortfolio = () => window.open(portfolioUrl, '_blank', 'noopener')

  const downloadQR = () => {
    if (!qrDataUrl) return
    downloadBlob(qrDataUrl, 'image/png', `${slug}-qr.png`)
  }

  const saveContact = () => {
    const vcf = generateVcf(businessName, portfolioUrl, tagline, contactEmail, contactPhone)
    downloadBlob(vcf, 'text/vcard', `${slug}.vcf`)
    toast.success('Contact file downloaded')
  }

  const addToWallet = async () => {
    setWalletLoading(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-wallet-pass`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ slug }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slug}.pkpass`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(`Couldn't generate pass: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setWalletLoading(false)
    }
  }

  const initials = businessName.slice(0, 2).toUpperCase()
  const passTextColor = getLuminance(brandPrimary) > 0.5 ? '#000000' : '#ffffff'

  const COLOR_OPTIONS: { id: QrColorChoice; hex: string; label: string }[] = [
    { id: 'brand', hex: getSafeQrColor(brandPrimary), label: 'Brand' },
    { id: 'dark', hex: '#1a1a1a', label: 'Dark' },
    { id: 'black', hex: '#000000', label: 'Black' },
  ]

  const TABS: { id: Tab; label: string }[] = [
    { id: 'share', label: 'Share' },
    { id: 'qr', label: 'QR Code' },
    { id: 'wallet', label: 'Wallet' },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="p-0 gap-0 sm:max-w-3xl overflow-hidden">
        <div className="flex flex-col md:flex-row">

          {/* ── Preview panel ─────────────────────────────────────────── */}
          <div className="relative flex-1 bg-neutral-950 overflow-hidden min-h-[260px] md:min-h-[420px] border-b md:border-b-0 md:border-r border-border/40">
            {previewLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
                <p className="text-xs text-white/40">Loading preview…</p>
              </div>
            )}
            <iframe
              key={open ? 'open' : 'closed'}
              src={portfolioUrl}
              title="Portfolio preview"
              loading="lazy"
              onLoad={() => setPreviewLoading(false)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '250%',
                height: 1050,
                transform: 'scale(0.4)',
                transformOrigin: 'top left',
                pointerEvents: 'none',
                border: 'none',
                opacity: previewLoading ? 0 : 1,
                transition: 'opacity 0.4s ease',
              }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}
            />
            <button
              type="button"
              onClick={openPortfolio}
              className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs bg-black/60 text-white/90 px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors z-20"
            >
              <ExternalLink className="h-3 w-3" />
              Open full page
            </button>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 text-[11px] bg-black/50 text-white/70 px-2.5 py-1 rounded-full backdrop-blur-sm font-mono z-20">
              <Globe className="h-3 w-3" />
              {displayUrl}
            </div>
          </div>

          {/* ── Right panel ───────────────────────────────────────────── */}
          <div className="flex flex-col p-5 md:w-[268px] shrink-0 min-h-[320px]">

            {/* Tab nav */}
            <div className="flex gap-0.5 p-0.5 bg-muted rounded-lg mb-4">
              {TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
                    tab === t.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Share tab ── */}
            {tab === 'share' && (
              <div className="flex flex-col gap-4 flex-1">
                <div>
                  <p className="font-semibold text-base leading-none">Share your portfolio</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Send your public link to potential clients.
                  </p>
                </div>

                <div className="flex items-center gap-2 px-3 py-2.5 bg-muted rounded-lg border border-border/60">
                  <span className="text-xs font-mono text-foreground flex-1 truncate select-all">
                    {displayUrl}
                  </span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={copyLink} aria-label="Copy link">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={copyLink} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted/50 hover:bg-muted border border-border/50 transition-colors">
                    {copied ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5 text-muted-foreground" />}
                    <span className="text-[11px] text-muted-foreground">Copy</span>
                  </button>
                  <button type="button" onClick={shareEmail} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted/50 hover:bg-muted border border-border/50 transition-colors">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Email</span>
                  </button>
                  <button type="button" onClick={shareMessage} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted/50 hover:bg-muted border border-border/50 transition-colors">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Message</span>
                  </button>
                </div>

                <Button variant="outline" className="w-full mt-auto" onClick={openPortfolio}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open portfolio
                </Button>
              </div>
            )}

            {/* ── QR tab ── */}
            {tab === 'qr' && (
              <div className="flex flex-col gap-4 flex-1">
                <div>
                  <p className="font-semibold text-base leading-none">QR code</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Show in person — links directly to your portfolio.
                  </p>
                </div>

                {/* QR preview */}
                <div className="flex justify-center">
                  <div className="p-3 bg-white rounded-xl shadow-sm border border-border/40">
                    {qrDataUrl
                      ? <img src={qrDataUrl} alt="QR code" width={160} height={160} className="block" />
                      : <div className="w-40 h-40 flex items-center justify-center text-xs text-muted-foreground">Generating…</div>
                    }
                  </div>
                </div>

                {/* Color chips */}
                <div>
                  <p className="text-[11px] text-muted-foreground mb-2">Color</p>
                  <div className="flex gap-2">
                    {COLOR_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setQrColorChoice(opt.id)}
                        title={opt.label}
                        className={cn(
                          'h-7 w-7 rounded-full border-2 transition-all',
                          qrColorChoice === opt.id ? 'scale-110 border-foreground' : 'border-transparent hover:border-foreground/40',
                        )}
                        style={{ backgroundColor: opt.hex }}
                      />
                    ))}
                    <span className="text-[11px] text-muted-foreground self-center ml-1">
                      {COLOR_OPTIONS.find(o => o.id === qrColorChoice)?.label}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground font-mono text-center -mt-1">{displayUrl}</p>

                <Button onClick={downloadQR} disabled={!qrDataUrl} className="mt-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Download PNG
                </Button>
              </div>
            )}

            {/* ── Wallet tab ── */}
            {tab === 'wallet' && (
              <div className="flex flex-col gap-4 flex-1">
                <div>
                  <p className="font-semibold text-base leading-none">Wallet pass</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Clients save this to Apple Wallet or their contacts.
                  </p>
                </div>

                {/* Pass card preview */}
                <div
                  className="rounded-2xl p-4 flex flex-col gap-2 shadow-md"
                  style={{ backgroundColor: brandPrimary, color: passTextColor }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold mb-2"
                        style={{ backgroundColor: `${passTextColor}20`, color: passTextColor }}
                      >
                        {initials}
                      </div>
                      <p className="font-bold text-sm leading-snug">{businessName}</p>
                      {tagline && (
                        <p className="text-[11px] mt-0.5 leading-snug" style={{ opacity: 0.75 }}>
                          {tagline}
                        </p>
                      )}
                    </div>
                    {qrPassDataUrl && (
                      <img src={qrPassDataUrl} alt="" width={48} height={48} className="rounded-md shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-[10px] font-mono mt-1" style={{ opacity: 0.6 }}>
                    {displayUrl}
                  </p>
                </div>

                <div className="flex flex-col gap-2 mt-auto">
                  <Button
                    onClick={addToWallet}
                    disabled={walletLoading}
                    className="w-full gap-2"
                    style={{ backgroundColor: brandPrimary }}
                  >
                    {walletLoading
                      ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      : <Wallet className="h-4 w-4" />}
                    {walletLoading ? 'Generating…' : 'Add to Apple Wallet'}
                  </Button>
                  <Button variant="outline" onClick={saveContact} className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    Save contact (.vcf)
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground text-center -mt-1">
                  Uses your brand color. Apple Wallet generation coming soon.
                </p>
              </div>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
