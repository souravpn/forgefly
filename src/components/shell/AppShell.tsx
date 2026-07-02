import { useState, type ReactNode } from 'react'
import { X, Sparkles, Send } from 'lucide-react'
import { AppSidebar } from './AppSidebar'
import { MobileTopBar } from './MobileTopBar'
import { BusinessBand } from './BusinessBand'
import { MobileFooterNav } from './MobileFooterNav'
import { MobileMoreSheet } from './MobileMoreSheet'
import { AICopilot } from '@/components/layouts/AICopilot'
import { CurrentBusinessProvider } from '@/contexts/CurrentBusinessContext'
import { useBusiness } from '@/contexts/CurrentBusinessContext'
import { useReviewNotification } from '@/hooks/useReviewNotification'
import { useNudges } from '@/hooks/useNudges'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { CommandBar } from './CommandBar'
import NoBusinessPage from '@/pages/NoBusinessPage'

type PanelType = 'copilot' | 'upgrade'

function UpgradePanel({ onClose }: { onClose: () => void }) {
  const { business, extractedData, refetch } = useBusiness()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Update OS</h3>
            <p className="text-xs text-muted-foreground">Describe a change — AI updates your profile</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Command bar content fills the rest */}
      <div className="flex-1 overflow-y-auto">
        <CommandBar
          onClose={onClose}
          business={business}
          extractedData={extractedData}
          refetch={refetch}
        />
      </div>
    </div>
  )
}

function AppShellContent({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [panelType, setPanelType] = useState<PanelType | null>(null)
  const { business, isLoading } = useBusiness()
  const nudges = useNudges()
  useReviewNotification()

  if (!isLoading && !business) {
    return <NoBusinessPage />
  }

  function openPanel(type: PanelType) {
    setPanelType(prev => (prev === type ? null : type))
  }

  function closePanel() {
    setPanelType(null)
  }

  return (
    <div className="flex h-screen p-2 gap-2 bg-muted/60">
      {/* Desktop sidebar */}
      <AppSidebar nudges={nudges} />

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-2xl bg-background border border-border/40 relative">
        {/* Mobile top bar */}
        <MobileTopBar onMenuOpen={() => setMoreOpen(true)} nudges={nudges} />

        {/* Header band with AI Copilot + Update OS buttons */}
        <BusinessBand activePanel={panelType} onOpenPanel={openPanel} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="px-4 md:px-6 py-4 md:py-6">
            {children}
          </div>
        </main>

        {/* Right-side panel overlay (copilot or upgrade) */}
        {panelType && (
          <div
            className={cn(
              'absolute right-2 top-[48px] bottom-2 z-40 w-[360px] flex flex-col',
              'bg-background border border-border/40 shadow-2xl rounded-xl overflow-hidden',
              'transition-all duration-200',
            )}
          >
            {panelType === 'copilot' ? (
              <AICopilot onClose={closePanel} />
            ) : (
              <UpgradePanel onClose={closePanel} />
            )}
          </div>
        )}
      </div>

      {/* Mobile overlays */}
      <MobileFooterNav
        onMoreOpen={() => setMoreOpen(true)}
        isMoreOpen={moreOpen}
      />
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CurrentBusinessProvider>
      <AppShellContent>{children}</AppShellContent>
    </CurrentBusinessProvider>
  )
}
