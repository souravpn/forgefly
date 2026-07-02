import { MessageSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PanelType = 'copilot' | 'upgrade'

interface BusinessBandProps {
  activePanel: PanelType | null
  onOpenPanel: (type: PanelType) => void
}

export function BusinessBand({ activePanel, onOpenPanel }: BusinessBandProps) {
  return (
    <div className="shrink-0 border-b">
      <div className="px-4 md:px-6 h-10 flex items-center justify-end gap-2">
        <Button
          variant={activePanel === 'copilot' ? 'default' : 'outline'}
          size="sm"
          className={cn('shrink-0 h-7 gap-1.5 text-xs', activePanel === 'copilot' && 'bg-primary text-primary-foreground')}
          onClick={() => onOpenPanel('copilot')}
        >
          <MessageSquare className="h-3 w-3" />
          <span className="hidden sm:inline">AI Copilot</span>
        </Button>
        <Button
          variant={activePanel === 'upgrade' ? 'default' : 'outline'}
          size="sm"
          className={cn('shrink-0 h-7 gap-1.5 text-xs', activePanel === 'upgrade' && 'bg-primary text-primary-foreground')}
          onClick={() => onOpenPanel('upgrade')}
        >
          <Sparkles className="h-3 w-3" />
          <span className="hidden sm:inline">Update OS</span>
        </Button>
      </div>
    </div>
  )
}
