import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useBusiness } from '@/contexts/CurrentBusinessContext'
import { CommandBar } from './CommandBar'

export function BusinessBand() {
  const { user, profile } = useAuth()
  const { business, extractedData, refetch } = useBusiness()
  const [commandOpen, setCommandOpen] = useState(false)

  const identity = extractedData?.identity
  const bizName = identity?.businessName ?? identity?.name ?? profile?.username ?? user?.user_metadata?.name ?? 'My Business'
  const initials = identity?.initials ?? bizName.slice(0, 2).toUpperCase()
  const tagline = identity?.tagline ?? 'Your business OS'

  return (
    <div className="border-b shrink-0">
      <div className="h-12 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 select-none">
            <span className="text-xs font-bold text-primary">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none truncate">{bizName}</p>
            <p className="text-xs text-muted-foreground leading-none mt-0.5 truncate">{tagline}</p>
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
      {commandOpen && (
        <CommandBar
          onClose={() => setCommandOpen(false)}
          business={business}
          extractedData={extractedData}
          refetch={refetch}
        />
      )}
    </div>
  )
}
