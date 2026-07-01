import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBusiness } from '@/contexts/CurrentBusinessContext'
import { CommandBar } from './CommandBar'

export function BusinessBand() {
  const { business, extractedData, refetch } = useBusiness()
  const [commandOpen, setCommandOpen] = useState(false)

  return (
    <div className="shrink-0 border-b">
      <div className="px-4 md:px-6 h-10 flex items-center justify-end">
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
        <div className="px-4 md:px-6 pb-3">
          <CommandBar
            onClose={() => setCommandOpen(false)}
            business={business}
            extractedData={extractedData}
            refetch={refetch}
          />
        </div>
      )}
    </div>
  )
}
