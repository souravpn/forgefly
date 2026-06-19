import { useState, type ReactNode } from 'react'
import { ForgeflyBand } from './ForgeflyBand'
import { BusinessBand } from './BusinessBand'
import { DesktopTabNav } from './DesktopTabNav'
import { MobileFooterNav } from './MobileFooterNav'
import { MobileMoreSheet } from './MobileMoreSheet'
import { AICopilot } from '@/components/layouts/AICopilot'
import { CurrentBusinessProvider } from '@/contexts/CurrentBusinessContext'
import { useBusiness } from '@/contexts/CurrentBusinessContext'
import { useReviewNotification } from '@/hooks/useReviewNotification'
import NoBusinessPage from '@/pages/NoBusinessPage'

function AppShellContent({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const { business, isLoading } = useBusiness()
  useReviewNotification()

  if (!isLoading && !business) {
    return <NoBusinessPage />
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ForgeflyBand />
      <BusinessBand />
      <DesktopTabNav />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-4 md:py-6">
          {children}
        </div>
      </main>
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
