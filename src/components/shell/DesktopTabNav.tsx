import { NAV_ITEMS } from '@/config/navigation'
import { NavIcon } from './NavIcon'
import { DesktopMoreDropdown } from './DesktopMoreDropdown'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function DesktopTabNav() {
  const { navigateTo, activeNavId } = useAppNavigation()

  return (
    <div className="hidden md:flex items-center border-b h-10 px-2 shrink-0 overflow-x-auto">
      {NAV_ITEMS.map(item => (
        <Button
          key={item.id}
          variant="ghost"
          size="sm"
          onClick={() => navigateTo(item.route)}
          className={cn(
            'h-9 px-3 gap-1.5 rounded-none border-b-2 -mb-px shrink-0 transition-colors',
            activeNavId === item.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
          <span className="hidden lg:inline text-sm">{item.label}</span>
        </Button>
      ))}
      <div className="ml-auto shrink-0">
        <DesktopMoreDropdown />
      </div>
    </div>
  )
}
