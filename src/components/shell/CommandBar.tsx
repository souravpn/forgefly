import { useState } from 'react'
import { Sparkles, X, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface CommandBarProps {
  onClose: () => void
}

export function CommandBar({ onClose }: CommandBarProps) {
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!value.trim() || isSubmitting) return
    setIsSubmitting(true)
    // Gateway call + diff confirmation modal wired in Phase 3 (useCommandBar hook)
    setTimeout(() => {
      setValue('')
      setIsSubmitting(false)
      onClose()
    }, 400)
  }

  return (
    <div className="border-t bg-muted/20 px-4 py-2.5">
      <div className="flex items-end gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mb-2.5" />
        <Textarea
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder='Describe a change to your business OS… e.g. "I now offer brand photography from $800"'
          className="min-h-[52px] max-h-32 resize-none text-sm bg-background"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
            if (e.key === 'Escape') onClose()
          }}
        />
        <div className="flex flex-col gap-1 mb-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
            aria-label="Close command bar"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleSubmit}
            disabled={!value.trim() || isSubmitting}
            aria-label="Submit"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
