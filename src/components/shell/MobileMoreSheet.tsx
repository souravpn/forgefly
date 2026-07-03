import { useState } from 'react'
import { LogOut, Globe } from 'lucide-react'
import { NAV_ITEMS, MORE_ITEMS } from '@/config/navigation'
import { NavIcon } from './NavIcon'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { useAuth } from '@/contexts/AuthContext'
import { useBusiness } from '@/contexts/CurrentBusinessContext'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { PortfolioShareDialog } from '@/components/common/PortfolioShareDialog'

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '')
}

// Secondary nav: Services, Proposals, Project, Brand Kit from NAV_ITEMS
const SECONDARY_IDS = ['services', 'proposals', 'project', 'brandkit']
const SHEET_NAV = NAV_ITEMS.filter(i => SECONDARY_IDS.includes(i.id))

// From MORE_ITEMS, omit Automations on mobile (it's being replaced by the nudge engine)
// and Social (rendered manually, right after Public Portfolio)
const SHEET_MORE = MORE_ITEMS.filter(i => i.id !== 'automations' && i.id !== 'social')
const SOCIAL_ITEM = MORE_ITEMS.find(i => i.id === 'social')!

interface MobileMoreSheetProps {
  open: boolean
  onClose: () => void
}

export function MobileMoreSheet({ open, onClose }: MobileMoreSheetProps) {
  const { navigateTo, activeNavId } = useAppNavigation()
  const { user, profile, signOut } = useAuth()
  const { business } = useBusiness()
  const [shareOpen, setShareOpen] = useState(false)

  const slug = profile?.username ?? (business ? toSlug(business.name) : '')
  const businessName = business?.name ?? 'My Portfolio'
  const brandPrimary = business?.extracted_data?.brand?.primaryColor ?? '#10B981'
  const tagline = business?.extracted_data?.identity?.tagline ?? undefined

  const displayName = profile?.username || user?.user_metadata?.name || user?.email || ''
  const avatarUrl: string | undefined =
    profile?.avatar_url || user?.user_metadata?.avatar_url || undefined
  const initial = displayName.charAt(0).toUpperCase()

  const go = (route: string) => {
    navigateTo(route)
    onClose()
  }

  return (
    <>
    <Sheet open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <SheetContent side="bottom" className="p-0 rounded-t-2xl max-h-[80vh]">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Nav items */}
        <nav className="px-3 pb-1 space-y-0.5">
          {[...SHEET_NAV, ...SHEET_MORE].map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.route)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left',
                activeNavId === item.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground hover:bg-accent',
              )}
            >
              <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ))}
          {slug && (
            <button
              type="button"
              onClick={() => { setShareOpen(true) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left text-foreground hover:bg-accent"
            >
              <Globe className="h-4 w-4 shrink-0" />
              Public Portfolio
            </button>
          )}
          <button
            type="button"
            onClick={() => go(SOCIAL_ITEM.route)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left',
              activeNavId === SOCIAL_ITEM.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground hover:bg-accent',
            )}
          >
            <NavIcon name={SOCIAL_ITEM.icon} className="h-4 w-4 shrink-0" />
            {SOCIAL_ITEM.label}
          </button>
        </nav>

        <Separator className="my-2" />

        {/* User row */}
        <div className="px-4 pb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="text-sm font-medium">{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-none truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { signOut(); onClose() }}
            className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SheetContent>
    </Sheet>

    {slug && (
      <PortfolioShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        slug={slug}
        businessName={businessName}
        brandPrimary={brandPrimary}
        tagline={tagline}
        contactEmail={business?.contact_email ?? null}
        contactPhone={business?.contact_phone ?? null}
      />
    )}
  </>
  )
}
