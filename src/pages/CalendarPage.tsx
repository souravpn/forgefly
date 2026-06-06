import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Calendar as CalendarIcon, Plus, Users, ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CalendarEvent, Client, Project } from '@/types/types';
import {
  getCalendarEvents, createCalendarEvent, updateCalendarEvent,
  deleteCalendarEvent, subscribeToCalendarEvents,
} from '@/services/calendarService';
import { getClients } from '@/services/clientService';
import { getProjects } from '@/services/projectService';
// @ts-ignore
import { supabase } from '@/db/supabase';

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  meeting:  { bg: 'bg-blue-500/20',    text: 'text-blue-400',    dot: 'bg-blue-500' },
  task:     { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  deadline: { bg: 'bg-amber-500/20',   text: 'text-amber-400',   dot: 'bg-amber-500' },
  custom:   { bg: 'bg-purple-500/20',  text: 'text-purple-400',  dot: 'bg-purple-500' },
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type FormData = {
  title: string;
  description: string;
  event_type: 'meeting' | 'task' | 'custom';
  start_time: string;
  end_time: string;
  all_day: boolean;
  client_id: string;
  project_id: string;
  location: string;
  meeting_link: string;
};

const EMPTY_FORM: FormData = {
  title: '',
  description: '',
  event_type: 'meeting',
  start_time: '',
  end_time: '',
  all_day: false,
  client_id: '',
  project_id: '',
  location: '',
  meeting_link: '',
};

function toDateTimeLocal(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

function isProjectDeadline(event: CalendarEvent) {
  return event.id.startsWith('project-');
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
    const channel = subscribeToCalendarEvents(() => loadEvents());
    return () => { channel.unsubscribe(); };
  }, []);

  async function loadData() {
    try {
      await Promise.all([loadEvents(), loadClients(), loadProjects()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    try {
      const data = await getCalendarEvents();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: projectsData } = await supabase
        .from('projects')
        .select('*, client:clients(*)')
        .eq('user_id', user.id)
        .not('deadline', 'is', null);

      const projectDeadlines: CalendarEvent[] = (projectsData || []).map((project: any) => ({
        id: `project-${project.id}`,
        user_id: user.id,
        title: `${project.name} Deadline`,
        description: `Project deadline for ${project.name}`,
        event_type: 'deadline' as const,
        start_time: project.deadline,
        end_time: null,
        all_day: true,
        client_id: project.client_id,
        project_id: project.id,
        location: null,
        meeting_link: null,
        color: '#F59E0B',
        created_at: project.created_at,
        updated_at: project.updated_at,
        client: project.client,
        project: project,
      }));

      setEvents(
        [...data, ...projectDeadlines].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
      );
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('Failed to load calendar events');
    }
  }

  async function loadClients() {
    try { setClients(await getClients()); } catch {}
  }

  async function loadProjects() {
    try { setProjects(await getProjects()); } catch {}
  }

  function openCreateModal(date?: Date) {
    setEditingEvent(null);
    let startTime = '';
    if (date) {
      const d = new Date(date);
      d.setHours(9, 0, 0, 0);
      startTime = toDateTimeLocal(d);
    }
    setFormData({ ...EMPTY_FORM, start_time: startTime });
    setIsModalOpen(true);
  }

  function openEditModal(event: CalendarEvent, e: React.MouseEvent) {
    e.stopPropagation();
    if (isProjectDeadline(event)) return;
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type === 'deadline' ? 'custom' : event.event_type as 'meeting' | 'task' | 'custom',
      start_time: toDateTimeLocal(new Date(event.start_time)),
      end_time: event.end_time ? toDateTimeLocal(new Date(event.end_time)) : '',
      all_day: event.all_day,
      client_id: event.client_id || '',
      project_id: event.project_id || '',
      location: event.location || '',
      meeting_link: event.meeting_link || '',
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        event_type: formData.event_type,
        start_time: formData.start_time,
        end_time: formData.end_time || null,
        all_day: formData.all_day,
        client_id: formData.client_id || null,
        project_id: formData.project_id || null,
        location: formData.location || null,
        meeting_link: formData.meeting_link || null,
        color: null,
      };
      if (editingEvent) {
        await updateCalendarEvent(editingEvent.id, payload);
        toast.success('Event updated!');
      } else {
        await createCalendarEvent(payload);
        toast.success('Event created!');
      }
      setIsModalOpen(false);
      loadEvents();
    } catch (error) {
      console.error(error);
      toast.error(editingEvent ? 'Failed to update event' : 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editingEvent) return;
    setDeleting(true);
    try {
      await deleteCalendarEvent(editingEvent.id);
      toast.success('Event deleted');
      setIsModalOpen(false);
      loadEvents();
    } catch {
      toast.error('Failed to delete event');
    } finally {
      setDeleting(false);
    }
  }

  // ── Calendar grid helpers ──────────────────────────────────────────────────

  function getCalendarDays(): (Date | null)[] {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }

  function getEventsForDay(day: Date) {
    return events.filter(ev => {
      const d = new Date(ev.start_time);
      return d.getFullYear() === day.getFullYear() &&
             d.getMonth() === day.getMonth() &&
             d.getDate() === day.getDate();
    });
  }

  function isToday(day: Date) {
    const now = new Date();
    return day.getFullYear() === now.getFullYear() &&
           day.getMonth() === now.getMonth() &&
           day.getDate() === now.getDate();
  }

  const calendarDays = getCalendarDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingEvents = events.filter(ev => new Date(ev.start_time) >= today);
  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-2">Calendar</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your schedule and deadlines</p>
        </div>
        <Button size="lg" className="glow-accent w-full md:w-auto" onClick={() => openCreateModal()}>
          <Plus className="w-5 h-5 mr-2" />
          Add Event
        </Button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-96 bg-muted rounded-lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[3fr_1fr] gap-6">

          {/* ── Calendar Grid ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{monthLabel}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="text-xs h-8 px-2"
                    onClick={() => setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {DOW.map(d => (
                  <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1.5">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-[2px]">
                {calendarDays.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} className="min-h-[76px]" />;

                  const dayEvents = getEventsForDay(day);
                  const today_ = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => openCreateModal(new Date(day))}
                      className={[
                        'min-h-[76px] rounded-md p-1 cursor-pointer transition-colors group select-none',
                        today_ ? 'bg-accent/10 ring-1 ring-accent/40' : 'hover:bg-muted/60',
                      ].join(' ')}
                    >
                      {/* Date number */}
                      <div className={[
                        'text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full ml-auto mb-0.5',
                        today_
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground group-hover:text-foreground',
                      ].join(' ')}>
                        {day.getDate()}
                      </div>

                      {/* Event pills */}
                      <div className="space-y-[2px]">
                        {dayEvents.slice(0, 2).map(ev => {
                          const c = EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.custom;
                          const isDeadline = isProjectDeadline(ev);
                          return (
                            <div
                              key={ev.id}
                              onClick={isDeadline ? undefined : (e) => openEditModal(ev, e)}
                              title={ev.title}
                              className={[
                                'text-[10px] leading-snug px-1 py-[1px] rounded truncate',
                                c.bg, c.text,
                                isDeadline ? 'cursor-default' : 'cursor-pointer hover:brightness-125',
                              ].join(' ')}
                            >
                              {ev.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border/50">
                {Object.entries(EVENT_COLORS).map(([type, c]) => (
                  <div key={type} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    <span className="capitalize">{type}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Upcoming List ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Upcoming</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              {upcomingEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CalendarIcon className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No upcoming events</p>
                  <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={() => openCreateModal()}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add one
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-0.5">
                  {upcomingEvents.map(event => {
                    const c = EVENT_COLORS[event.event_type] ?? EVENT_COLORS.custom;
                    const isDeadline = isProjectDeadline(event);
                    const eventDate = new Date(event.start_time);
                    return (
                      <div
                        key={event.id}
                        onClick={isDeadline ? undefined : (e) => openEditModal(event, e)}
                        className={[
                          'p-2.5 rounded-lg border border-border/40 bg-muted/20 transition-colors',
                          isDeadline ? '' : 'cursor-pointer hover:bg-muted/60',
                        ].join(' ')}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${c.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium leading-snug truncate">{event.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {!event.all_day && (
                                <> &middot; {eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
                              )}
                            </p>
                            {event.client && (
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                <Users className="w-2.5 h-2.5 inline mr-0.5 opacity-60" />
                                {event.client.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Create / Edit Modal ────────────────────────────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
            <DialogDescription>
              {editingEvent
                ? 'Update the details for this event'
                : 'Add a meeting, task, or custom event to your calendar'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Client Meeting"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_type">Event Type *</Label>
                <Select
                  value={formData.event_type}
                  onValueChange={(v) => setFormData({ ...formData, event_type: v as FormData['event_type'] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add details about this event..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Date & Time *</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">End Date & Time</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_id">Client (Optional)</Label>
                  <Select
                    value={formData.client_id || 'none'}
                    onValueChange={(v) => setFormData({ ...formData, client_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_id">Project (Optional)</Label>
                  <Select
                    value={formData.project_id || 'none'}
                    onValueChange={(v) => setFormData({ ...formData, project_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Office, Zoom, Coffee Shop"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meeting_link">Meeting Link</Label>
                <Input
                  id="meeting_link"
                  type="url"
                  value={formData.meeting_link}
                  onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                  placeholder="https://zoom.us/j/..."
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {editingEvent && (
                <Button
                  type="button" variant="destructive" size="sm"
                  onClick={handleDelete}
                  disabled={deleting || submitting}
                  className="sm:mr-auto"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={submitting || deleting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || deleting} className="glow-accent">
                {submitting
                  ? (editingEvent ? 'Saving…' : 'Creating…')
                  : (editingEvent ? 'Save Changes' : 'Create Event')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
