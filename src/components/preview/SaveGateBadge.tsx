import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SaveGateBadgeProps {
  onSave: () => void;
}

export default function SaveGateBadge({ onSave }: SaveGateBadgeProps) {
  return (
    <div className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/25 rounded-full px-3 py-1.5">
      <Lock className="w-3 h-3 text-teal-400 shrink-0" />
      <span className="text-xs text-teal-300 hidden sm:block whitespace-nowrap">Sign in to save</span>
      <Button
        size="sm"
        onClick={onSave}
        className="h-6 px-3 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-full"
      >
        Save with Google
      </Button>
    </div>
  );
}
