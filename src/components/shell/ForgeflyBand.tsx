import { Bell, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ForgeflyBand() {
  const { user, profile, signOut } = useAuth()
  const { navigateTo } = useAppNavigation()

  const displayName = profile?.username || user?.user_metadata?.name || user?.email || ''
  const avatarUrl: string | undefined =
    profile?.avatar_url || user?.user_metadata?.avatar_url || undefined
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="h-8 flex items-center justify-between px-4 bg-muted/40 border-b shrink-0">
      <span className="text-sm font-semibold tracking-tight text-foreground/80 select-none">
        Forgefly
      </span>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full"
              aria-label="Account menu"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="text-[10px] font-medium">{initial}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigateTo('/dashboard/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
