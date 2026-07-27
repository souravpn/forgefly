import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock } from 'lucide-react';
import { LogTimeWidget } from './LogTimeWidget';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mobile-only entry point (no persistent left sidebar to host a card there).
// Desktop instead renders <LogTimeWidget /> directly in AppSidebar.
export function QuickLogTimeDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Log time
            </DialogTitle>
          </DialogHeader>
          <LogTimeWidget onDismiss={() => onOpenChange(false)} showHeader={false} bare />
        </DialogContent>
      )}
    </Dialog>
  );
}
