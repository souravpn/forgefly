import { MoreHorizontal } from 'lucide-react'
import { NAV_ITEMS } from '@/config/navigation'
import { NavIcon } from './NavIcon'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { cn } from '@/lib/utils'

// The 5 primary footer slots: Overview, Pipeline, Invoices, Clients, More
const FOOTER_IDS = ['overview', 'pipeline', 'invoices', 'clients'] as const
const FOOTER_ITEMS = NAV_ITEMS.filter(i =>
  (FOOTER_IDS as readonly string[]).includes(i.id),
)

interface MobileFooterNavProps {
  onMoreOpen: () => void
  isMoreOpen: boolean
}

export function MobileFooterNav({ onMoreOpen, isMoreOpen }: MobileFooterNavProps) {
  const { navigateTo, activeNavId } = useAppNavigation()

  return (
    <div className="flex md:hidden fixed bottom-0 left-0 right-0 h-14 border-t bg-background z-40 safe-area-inset-bottom">
      {FOOTER_ITEMS.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => navigateTo(item.route)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
            activeNavId === item.id ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <NavIcon name={item.icon} className="h-5 w-5" />
          <span className="text-[10px]">{item.label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onMoreOpen}
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
          isMoreOpen ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        <MoreHorizontal className="h-5 w-5" />
        <span className="text-[10px]">More</span>
      </button>
    </div>
  )
}
