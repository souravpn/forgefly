import { useState } from 'react'
import { MoreHorizontal, Globe } from 'lucide-react'
import { MORE_ITEMS } from '@/config/navigation'
import { NavIcon } from './NavIcon'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { useAuth } from '@/contexts/AuthContext'
import { useBusiness } from '@/contexts/CurrentBusinessContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { PortfolioShareDialog } from '@/components/common/PortfolioShareDialog'

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '')
}

export function DesktopMoreDropdown() {
  const { navigateTo, activeNavId } = useAppNavigation()
  const { profile } = useAuth()
  const { business } = useBusiness()
  const moreIsActive = MORE_ITEMS.some(i => i.id === activeNavId)
  const [shareOpen, setShareOpen] = useState(false)

  const slug = profile?.username ?? (business ? toSlug(business.name) : '')
  const businessName = business?.name ?? 'My Portfolio'
  const brandPrimary = business?.extracted_data?.brand?.primaryColor ?? '#10B981'
  const tagline = business?.extracted_data?.identity?.tagline ?? undefined

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-9 px-3 gap-1.5 rounded-none border-b-2 -mb-px shrink-0',
              moreIsActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            aria-label="More navigation items"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="hidden lg:inline text-sm">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {MORE_ITEMS.map(item => (
            <DropdownMenuItem
              key={item.id}
              onClick={() => navigateTo(item.route)}
              className={cn(activeNavId === item.id && 'bg-accent')}
            >
              <NavIcon name={item.icon} className="mr-2 h-4 w-4" />
              {item.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShareOpen(true)}
            disabled={!slug}
          >
            <Globe className="mr-2 h-4 w-4" />
            Public Portfolio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
