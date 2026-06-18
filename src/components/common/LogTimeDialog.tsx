import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Square, Clock, Loader2 } from 'lucide-react';
import { createTimeEntry } from '@/services/timeService';
import type { Project } from '@/types/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  defaultProjectId?: string;
  onSaved?: () => void;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LogTimeDialog({ open, onOpenChange, projects, defaultProjectId, onSaved }: Props) {
  // Manual fields
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Timer fields
  const [timerProjectId, setTimerProjectId] = useState(defaultProjectId ?? '');
  const [timerNote, setTimerNote] = useState('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerStartedAt, setTimerStartedAt] = useState<Date | null>(null);
  const [savingTimer, setSavingTimer] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setProjectId(defaultProjectId ?? '');
      setDate(new Date().toISOString().slice(0, 10));
      setHours('');
      setNote('');
      setError('');
      setTimerProjectId(defaultProjectId ?? '');
      setTimerNote('');
    }
  }, [open, defaultProjectId]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Clear interval on unmount
  useEffect(() => () => stopInterval(), [stopInterval]);

  function startTimer() {
    const now = new Date();
    setTimerStartedAt(now);
    setElapsed(0);
    setTimerRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed(s => s + 1);
    }, 1000);
  }

  async function stopAndSaveTimer() {
    stopInterval();
    setTimerRunning(false);
    if (!timerStartedAt || elapsed < 60) {
      setElapsed(0);
      return;
    }
    const stoppedAt = new Date();
    const elapsedHours = parseFloat((elapsed / 3600).toFixed(2));

    setSavingTimer(true);
    try {
      await createTimeEntry({
        project_id: timerProjectId || null,
        date: timerStartedAt.toISOString().slice(0, 10),
        hours: elapsedHours,
        note: timerNote || null,
        timer_started_at: timerStartedAt.toISOString(),
        timer_stopped_at: stoppedAt.toISOString(),
      });
      setElapsed(0);
      setTimerStartedAt(null);
      setTimerNote('');
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError('Failed to save timer entry.');
    } finally {
      setSavingTimer(false);
    }
  }

  async function saveManual() {
    setError('');
    const h = parseFloat(hours);
    if (!hours || isNaN(h) || h <= 0) { setError('Enter a valid number of hours.'); return; }
    if (!date) { setError('Pick a date.'); return; }

    setSaving(true);
    try {
      await createTimeEntry({
        project_id: projectId || null,
        date,
        hours: h,
        note: note || null,
      });
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError('Failed to save time entry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!timerRunning) onOpenChange(v); }}>
      {open && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Log time
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="manual">
            <TabsList className="w-full">
              <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
              <TabsTrigger value="timer" className="flex-1">Timer</TabsTrigger>
            </TabsList>

            {/* ── Manual ── */}
            <TabsContent value="manual" className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No project</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Hours</Label>
                  <Input
                    type="number"
                    min="0.25"
                    step="0.25"
                    placeholder="1.5"
                    value={hours}
                    onChange={e => setHours(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="What did you work on?"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveManual(); }}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={saveManual} disabled={saving}>
                  {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Saving…</> : 'Save'}
                </Button>
              </div>
            </TabsContent>

            {/* ── Timer ── */}
            <TabsContent value="timer" className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={timerProjectId} onValueChange={setTimerProjectId} disabled={timerRunning}>
                  <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No project</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="What are you working on?"
                  value={timerNote}
                  onChange={e => setTimerNote(e.target.value)}
                  disabled={timerRunning}
                />
              </div>

              {/* Elapsed display */}
              <div className="rounded-lg bg-muted/50 py-6 text-center">
                <span className="text-4xl font-mono font-semibold tabular-nums tracking-tight">
                  {formatElapsed(elapsed)}
                </span>
                {timerRunning && (
                  <p className="text-xs text-muted-foreground mt-2">Timer running — stop to save</p>
                )}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                {!timerRunning ? (
                  <Button className="flex-1" onClick={startTimer}>
                    <Play className="w-4 h-4 mr-1.5" />Start
                  </Button>
                ) : (
                  <Button className="flex-1" variant="destructive" onClick={stopAndSaveTimer} disabled={savingTimer}>
                    {savingTimer
                      ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Saving…</>
                      : <><Square className="w-4 h-4 mr-1.5" />Stop &amp; save</>
                    }
                  </Button>
                )}
                {!timerRunning && (
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                )}
              </div>
              {timerRunning && (
                <p className="text-xs text-center text-muted-foreground">
                  Dialog stays open while timer is running
                </p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      )}
    </Dialog>
  );
}
