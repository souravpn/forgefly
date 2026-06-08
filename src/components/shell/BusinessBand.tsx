import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { CommandBar } from './CommandBar'

export function BusinessBand() {
  const { user, profile } = useAuth()
  const [commandOpen, setCommandOpen] = useState(false)

  // Placeholder identity shown until useCurrentBusiness is wired in Phase 3
  const bizName = profile?.username || user?.user_metadata?.name || 'My Business'
  const initial = bizName.charAt(0).toUpperCase()

  return (
    <div className="border-b shrink-0">
      <div className="h-12 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 select-none">
            <span className="text-xs font-bold text-primary">{initial}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none truncate">{bizName}</p>
            <p className="text-xs text-muted-foreground leading-none mt-0.5 truncate">
              Your business OS
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 h-7 gap-1.5 text-xs"
          onClick={() => setCommandOpen(o => !o)}
          aria-label="Open command bar to update your business OS"
        >
          <Sparkles className="h-3 w-3" />
          <span className="hidden sm:inline">Update OS</span>
        </Button>
      </div>
      {commandOpen && <CommandBar onClose={() => setCommandOpen(false)} />}
    </div>
  )
}
