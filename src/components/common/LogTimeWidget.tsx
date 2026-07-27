import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Square, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getProjects } from '@/services/projectService';
import { createTimeEntry } from '@/services/timeService';
import type { Project } from '@/types/types';

interface Props {
  onSaved?: () => void;
  // Called after a reset (successful save or cancel) — used by callers that
  // wrap this widget in something dismissible (e.g. a mobile dialog). No-op
  // for a persistently-rendered sidebar card.
  onDismiss?: () => void;
  // Hide the built-in "Log Time" header — used when a wrapping dialog
  // already renders its own title.
  showHeader?: boolean;
  // Skip the sidebar-tinted Card chrome — used inside a dialog that already
  // provides its own container.
  bare?: boolean;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function LogTimeWidget({ onSaved, onDismiss, showHeader = true, bare = false }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [stoppedAt, setStoppedAt] = useState<Date | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {});
  }, []);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopInterval(), [stopInterval]);

  function reset() {
    stopInterval();
    setRunning(false);
    setStopped(false);
    setElapsed(0);
    setStartedAt(null);
    setStoppedAt(null);
    setName('');
    setProjectId('');
  }

  function handleStart() {
    if (!projectId) {
      toast.error('Select a project first.');
      return;
    }
    const now = new Date();
    setStartedAt(now);
    setElapsed(0);
    setRunning(true);
    setStopped(false);
    intervalRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }

  function handleStop() {
    stopInterval();
    setRunning(false);
    setStopped(true);
    setStoppedAt(new Date());
    setName(`Time entry — ${format(new Date(), 'MMM d, h:mm a')}`);
  }

  function handleCancel() {
    reset();
    onDismiss?.();
  }

  async function handleSave() {
    if (!startedAt || !stoppedAt || !projectId) return;
    if (elapsed < 60) {
      toast.error('Timer must run for at least a minute before saving.');
      return;
    }
    setSaving(true);
    try {
      await createTimeEntry({
        project_id: projectId,
        date: startedAt.toISOString().slice(0, 10),
        hours: parseFloat((elapsed / 3600).toFixed(2)),
        note: name.trim() || null,
        timer_started_at: startedAt.toISOString(),
        timer_stopped_at: stoppedAt.toISOString(),
      });
      toast.success('Time logged');
      reset();
      onSaved?.();
      onDismiss?.();
    } catch {
      toast.error('Failed to save time entry.');
    } finally {
      setSaving(false);
    }
  }

  const body = (
    <>
        {showHeader && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sidebar-foreground/70">
            <Clock className="h-3.5 w-3.5" />
            Log Time
          </div>
        )}

        <Select
          value={projectId}
          onValueChange={setProjectId}
          disabled={running || stopped}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select a project" /></SelectTrigger>
          <SelectContent>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="rounded-md bg-background/60 py-2.5 text-center">
          <span className="text-xl font-mono font-semibold tabular-nums tracking-tight">
            {formatElapsed(elapsed)}
          </span>
        </div>

        {stopped && (
          <div className="space-y-1">
            <Label className="text-[11px]">Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Time entry name"
              className="h-8 text-xs"
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>
        )}

        <div className="flex gap-1.5">
          {!running && !stopped && (
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleStart} disabled={!projectId}>
              <Play className="w-3.5 h-3.5 mr-1" />Start
            </Button>
          )}
          {running && (
            <Button size="sm" className="flex-1 h-8 text-xs" variant="destructive" onClick={handleStop}>
              <Square className="w-3.5 h-3.5 mr-1" />Stop
            </Button>
          )}
          {stopped && (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
              </Button>
            </>
          )}
        </div>
    </>
  );

  if (bare) {
    return <div className="space-y-2.5">{body}</div>;
  }

  return (
    <Card className="border-sidebar-border/60 bg-sidebar/40">
      <CardContent className="p-3 space-y-2.5">{body}</CardContent>
    </Card>
  );
}
