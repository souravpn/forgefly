import { MoreHorizontal } from 'lucide-react'
import { MORE_ITEMS } from '@/config/navigation'
import { NavIcon } from './NavIcon'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export function DesktopMoreDropdown() {
  const { navigateTo, activeNavId } = useAppNavigation()
  const moreIsActive = MORE_ITEMS.some(i => i.id === activeNavId)

  return (
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
      <DropdownMenuContent align="end" className="w-44">
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
