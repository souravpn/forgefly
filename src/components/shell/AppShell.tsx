import { useState, type ReactNode } from 'react'
import { ForgeflyBand } from './ForgeflyBand'
import { BusinessBand } from './BusinessBand'
import { DesktopTabNav } from './DesktopTabNav'
import { MobileFooterNav } from './MobileFooterNav'
import { MobileMoreSheet } from './MobileMoreSheet'
import { AICopilot } from '@/components/layouts/AICopilot'
import { CurrentBusinessProvider } from '@/contexts/CurrentBusinessContext'

export function AppShell({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <CurrentBusinessProvider>
      <div className="flex flex-col min-h-screen bg-background">
        <ForgeflyBand />
        <BusinessBand />
        <DesktopTabNav />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
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
    </CurrentBusinessProvider>
  )
}
