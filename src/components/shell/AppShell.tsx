import { useState, type ReactNode } from 'react'
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
import NoBusinessPage from '@/pages/NoBusinessPage'

function AppShellContent({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const { business, isLoading } = useBusiness()
  // Call useNudges once here — both AppSidebar and MobileTopBar receive the result
  // as props so they don't each subscribe to their own Realtime channel.
  const nudges = useNudges()
  useReviewNotification()

  if (!isLoading && !business) {
    return <NoBusinessPage />
  }

  return (
    <div className="flex h-screen p-2 gap-2 bg-muted/60">
      {/* Desktop sidebar */}
      <AppSidebar nudges={nudges} />

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-2xl bg-background border border-border/40">
        {/* Mobile top bar */}
        <MobileTopBar onMenuOpen={() => setMoreOpen(true)} nudges={nudges} />

        {/* Update OS strip */}
        <BusinessBand />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="px-4 md:px-6 py-4 md:py-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile overlays */}
      <MobileFooterNav
        onMoreOpen={() => setMoreOpen(true)}
        isMoreOpen={moreOpen}
      />
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      <AICopilot />
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
