import { Bell, LogOut, Settings, ExternalLink } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { useNudges } from '@/hooks/useNudges'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatDistanceToNow } from 'date-fns'

export function ForgeflyBand() {
  const { user, profile, signOut } = useAuth()
  const { navigateTo } = useAppNavigation()
  const { nudges, unreadCount, markRead, markAllRead } = useNudges()

  const displayName = profile?.username || user?.user_metadata?.name || user?.email || ''
  const avatarUrl: string | undefined =
    profile?.avatar_url || user?.user_metadata?.avatar_url || undefined
  const initial = displayName.charAt(0).toUpperCase()

  function handleNudgeClick(nudge: { id: string; action_url: string | null; read: boolean }) {
    if (!nudge.read) markRead(nudge.id)
    if (nudge.action_url) navigateTo(nudge.action_url)
  }

  return (
    <div className="h-8 flex items-center justify-between px-4 bg-muted/40 border-b shrink-0">
      <span className="text-sm font-semibold tracking-tight text-foreground/80 select-none">
        Forgefly
      </span>
      <div className="flex items-center gap-0.5">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 relative"
              aria-label="Notifications"
            >
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {nudges.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No notifications yet</p>
              ) : (
                nudges.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleNudgeClick(n)}
                    className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors flex items-start gap-2 ${!n.read ? 'bg-primary/5' : ''}`}
                  >
                    {!n.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    )}
                    <div className={!n.read ? '' : 'ml-3.5'}>
                      <p className="text-xs font-medium leading-snug">{n.title}</p>
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {n.action_url && <ExternalLink className="h-3 w-3 shrink-0 mt-1 text-muted-foreground/40 ml-auto" />}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

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
