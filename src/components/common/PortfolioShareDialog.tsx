import { useState } from 'react'
import { Copy, Check, Mail, MessageSquare, Globe, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface PortfolioShareDialogProps {
  open: boolean
  onClose: () => void
  slug: string
  businessName: string
}

export function PortfolioShareDialog({ open, onClose, slug, businessName }: PortfolioShareDialogProps) {
  const [copied, setCopied] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(true)

  const portfolioUrl = `${window.location.origin}/p/${slug}`
  const displayUrl = `forgefly.io/p/${slug}`

  // Reset loading state whenever the dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) setPreviewLoading(true)
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

  const openPortfolio = () => {
    window.open(portfolioUrl, '_blank', 'noopener')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/*
        p-0 removes default padding so we control layout ourselves.
        The built-in close (×) button stays absolutely positioned top-right.
      */}
      <DialogContent className="p-0 gap-0 sm:max-w-3xl overflow-hidden">
        <div className="flex flex-col md:flex-row">

          {/* ── Preview panel ─────────────────────────────────────────── */}
          <div className="relative flex-1 bg-neutral-950 overflow-hidden min-h-[260px] md:min-h-[420px] border-b md:border-b-0 md:border-r border-border/40">

            {/* Loading skeleton */}
            {previewLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
                <p className="text-xs text-white/40">Loading preview…</p>
              </div>
            )}

            {/*
              Scaled iframe: width=250% + scale(0.4) makes it fill the container width.
              Height 1050px × 0.4 = 420px — matches the md:min-h above.
              pointer-events:none prevents interaction with the preview.
            */}
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

            {/* Bottom gradient fade */}
            <div
              className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}
            />

            {/* Open full page pill */}
            <button
              type="button"
              onClick={openPortfolio}
              className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs bg-black/60 text-white/90 px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors z-20"
            >
              <ExternalLink className="h-3 w-3" />
              Open full page
            </button>

            {/* URL chip */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 text-[11px] bg-black/50 text-white/70 px-2.5 py-1 rounded-full backdrop-blur-sm font-mono z-20">
              <Globe className="h-3 w-3" />
              {displayUrl}
            </div>
          </div>

          {/* ── Share panel ───────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 p-5 md:w-[252px] shrink-0">
            <div>
              <p className="font-semibold text-base leading-none">Share your portfolio</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Send your public link to potential clients.
              </p>
            </div>

            {/* URL copy strip */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted rounded-lg border border-border/60">
              <span className="text-xs font-mono text-foreground flex-1 truncate select-all">
                {displayUrl}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 shrink-0"
                onClick={copyLink}
                aria-label="Copy link"
              >
                {copied
                  ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                  : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {/* Share buttons grid */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted/50 hover:bg-muted border border-border/50 transition-colors"
              >
                {copied
                  ? <Check className="h-5 w-5 text-emerald-500" />
                  : <Copy className="h-5 w-5 text-muted-foreground" />}
                <span className="text-[11px] text-muted-foreground">Copy</span>
              </button>

              <button
                type="button"
                onClick={shareEmail}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted/50 hover:bg-muted border border-border/50 transition-colors"
              >
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Email</span>
              </button>

              <button
                type="button"
                onClick={shareMessage}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted/50 hover:bg-muted border border-border/50 transition-colors"
              >
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Message</span>
              </button>
            </div>

            <Button variant="outline" className="w-full mt-auto" onClick={openPortfolio}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open portfolio
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
