import { Bell, Menu, ExternalLink } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useBusiness } from '@/contexts/CurrentBusinessContext'
import { type UseNudgesResult } from '@/hooks/useNudges'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface MobileTopBarProps {
  onMenuOpen: () => void
  nudges: UseNudgesResult
}

export function MobileTopBar({ onMenuOpen, nudges: { nudges, unreadCount, markRead, markAllRead } }: MobileTopBarProps) {
  const { user, profile } = useAuth()
  const { business, extractedData } = useBusiness()
  const { navigateTo } = useAppNavigation()

  const identity = extractedData?.identity
  const bizName =
    identity?.businessName ?? identity?.name ?? business?.name ?? profile?.username ?? 'My Business'
  const initials = identity?.initials ?? bizName.slice(0, 2).toUpperCase()
  const businessIconUrl = (extractedData as { brand?: { businessIconUrl?: string } } | undefined)?.brand?.businessIconUrl

  const displayName =
    profile?.username || user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const avatarUrl: string | undefined =
    profile?.avatar_url || user?.user_metadata?.avatar_url || undefined
  const initial = displayName.charAt(0).toUpperCase()

  function handleNudgeClick(nudge: { id: string; action_url: string | null; read: boolean }) {
    if (!nudge.read) markRead(nudge.id)
    if (nudge.action_url) navigateTo(nudge.action_url)
  }

  return (
    <div className="flex md:hidden h-12 border-b bg-background shrink-0 items-center px-3">
      {/* Left: avatar + notification */}
      <div className="flex items-center gap-1">
        <Avatar className="h-7 w-7">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="text-xs font-medium">{initial}</AvatarFallback>
        </Avatar>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 relative"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {nudges.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No notifications yet
                </p>
              ) : (
                nudges.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNudgeClick(n)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors flex items-start gap-2',
                      !n.read ? 'bg-primary/5' : '',
                    )}
                  >
                    {!n.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    )}
                    <div className={!n.read ? '' : 'ml-3.5'}>
                      <p className="text-xs font-medium leading-snug">{n.title}</p>
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {n.action_url && (
                      <ExternalLink className="h-3 w-3 shrink-0 mt-1 text-muted-foreground/40 ml-auto" />
                    )}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Center: business icon */}
      <div className="flex-1 flex justify-center">
        <div className="h-8 w-8 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center select-none">
          {businessIconUrl
            ? <img src={businessIconUrl} alt={bizName} className="w-full h-full object-cover" />
            : <span className="text-xs font-bold text-primary">{initials}</span>}
        </div>
      </div>

      {/* Right: hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onMenuOpen}
        aria-label="Open navigation menu"
      >
        <Menu className="h-4 w-4" />
      </Button>
    </div>
  )
}
