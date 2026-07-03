import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Calendar as CalendarIcon, Plus, Users, ChevronLeft, ChevronRight, Trash2,
  Briefcase, Clock, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CalendarEvent, Client, Project, Invoice } from '@/types/types';
import {
  getCalendarEvents, createCalendarEvent, updateCalendarEvent,
  deleteCalendarEvent, subscribeToCalendarEvents,
} from '@/services/calendarService';
import { getClients } from '@/services/clientService';
import { getProjects } from '@/services/projectService';
import { getInvoices } from '@/services/invoiceService';
// @ts-ignore
import { supabase } from '@/db/supabase';

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  meeting:  { bg: 'bg-blue-500/20',    text: 'text-blue-400',    dot: 'bg-blue-500' },
  task:     { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  deadline: { bg: 'bg-amber-500/20',   text: 'text-amber-400',   dot: 'bg-amber-500' },
  custom:   { bg: 'bg-purple-500/20',  text: 'text-purple-400',  dot: 'bg-purple-500' },
};

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ViewMode = 'month' | 'week';

type FormData = {
  title: string;
  description: string;
  event_type: 'meeting' | 'task' | 'deadline' | 'custom';
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

// ── Pure helpers ───────────────────────────────────────────────────────────────

function toDateTimeLocal(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

function isSyntheticDeadline(event: CalendarEvent) {
  return event.id.startsWith('project-');
}

function isSyntheticInvoice(event: CalendarEvent) {
  return event.id.startsWith('invoice-');
}

function isSynthetic(event: CalendarEvent) {
  return isSyntheticDeadline(event) || isSyntheticInvoice(event);
}

function getWeekStart(from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function weekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (weekStart.getMonth() === end.getMonth()) {
    return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function isToday(day: Date) {
  return isSameDay(day, new Date());
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));

  // Modal state
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
      await Promise.all([loadClients(), loadProjects(), loadEvents()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    try {
      const [data, invoiceData] = await Promise.all([getCalendarEvents(), getInvoices()]);

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

      const now = new Date().toISOString();
      const invoiceDueDates: CalendarEvent[] = invoiceData
        .filter(inv => inv.due_date && inv.payment_status !== 'paid')
        .map(inv => ({
          id: `invoice-${inv.id}`,
          user_id: user.id,
          title: `Invoice Due: ${inv.client?.name ?? 'Unknown'} — $${inv.amount}`,
          description: `Invoice ${inv.invoice_number} due`,
          event_type: 'deadline' as const,
          start_time: inv.due_date!,
          end_time: null,
          all_day: true,
          client_id: inv.client_id,
          project_id: inv.project_id,
          location: null,
          meeting_link: null,
          color: inv.due_date! < now ? '#ef4444' : '#f59e0b',
          created_at: inv.created_at,
          updated_at: inv.updated_at,
          client: inv.client,
          project: inv.project,
          // Stash invoice ref for the info modal
          _invoice: inv,
        } as CalendarEvent & { _invoice: Invoice }));

      setEvents(
        [...data, ...projectDeadlines, ...invoiceDueDates].sort(
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

  // ── Modal openers ────────────────────────────────────────────────────────────

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

  function openEventModal(event: CalendarEvent, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingEvent(event);

    // For synthetic project/invoice events, we show a read-only view — no form prefill needed
    if (!isSynthetic(event)) {
      setFormData({
        title: event.title,
        description: event.description || '',
        event_type: event.event_type as FormData['event_type'],
        start_time: toDateTimeLocal(new Date(event.start_time)),
        end_time: event.end_time ? toDateTimeLocal(new Date(event.end_time)) : '',
        all_day: event.all_day,
        client_id: event.client_id || '',
        project_id: event.project_id || '',
        location: event.location || '',
        meeting_link: event.meeting_link || '',
      });
    }
    setIsModalOpen(true);
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

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

  // ── Navigation ───────────────────────────────────────────────────────────────

  function prevPeriod() {
    if (viewMode === 'month') {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    } else {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() - 7);
      setCurrentWeekStart(d);
    }
  }

  function nextPeriod() {
    if (viewMode === 'month') {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    } else {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + 7);
      setCurrentWeekStart(d);
    }
  }

  function goToToday() {
    if (viewMode === 'month') {
      const now = new Date();
      setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    } else {
      setCurrentWeekStart(getWeekStart(new Date()));
    }
  }

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    // Sync week start to the visible month when switching to week view
    if (mode === 'week') {
      setCurrentWeekStart(getWeekStart(new Date()));
    }
  }

  // ── Calendar helpers ─────────────────────────────────────────────────────────

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
    return events.filter(ev => isSameDay(new Date(ev.start_time), day));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingEvents = events.filter(ev => new Date(ev.start_time) >= today);

  const periodLabel = viewMode === 'month'
    ? currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : weekLabel(currentWeekStart);

  // ── Shared sub-components ────────────────────────────────────────────────────

  function EventPill({ ev, compact = false }: { ev: CalendarEvent; compact?: boolean }) {
    const c = EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.custom;
    return (
      <div
        onClick={(e) => openEventModal(ev, e)}
        title={ev.title}
        className={[
          'rounded truncate cursor-pointer transition-opacity hover:opacity-80',
          compact ? 'text-[10px] leading-snug px-1 py-[1px]' : 'text-xs px-1.5 py-0.5',
          c.bg, c.text,
        ].join(' ')}
      >
        {!compact && !ev.all_day && (
          <span className="opacity-60 mr-1">
            {new Date(ev.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
        {ev.title}
      </div>
    );
  }

  // ── Month view ───────────────────────────────────────────────────────────────

  function MonthView() {
    const days = getCalendarDays();
    return (
      <>
        <div className="grid grid-cols-7 mb-1">
          {DOW_SHORT.map(d => (
            <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-[2px]">
          {days.map((day, i) => {
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
                <div className={[
                  'text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full ml-auto mb-0.5',
                  today_ ? 'bg-accent text-accent-foreground' : 'text-muted-foreground group-hover:text-foreground',
                ].join(' ')}>
                  {day.getDate()}
                </div>
                <div className="space-y-[2px]">
                  {dayEvents.slice(0, 2).map(ev => (
                    <EventPill key={ev.id} ev={ev} compact />
                  ))}
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
      </>
    );
  }

  // ── Week view ────────────────────────────────────────────────────────────────

  function WeekView() {
    const weekDays = getWeekDays(currentWeekStart);
    return (
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[560px] gap-1">
          {weekDays.map(day => {
            const dayEvents = getEventsForDay(day);
            const today_ = isToday(day);
            return (
              <div key={day.toISOString()} className="flex flex-col min-h-[260px]">
                {/* Day header */}
                <div className="text-center pb-2 mb-1 border-b border-border/30">
                  <div className="text-[11px] font-medium text-muted-foreground mb-0.5">
                    {DOW_SHORT[day.getDay()]}
                  </div>
                  <div className={[
                    'text-sm font-semibold w-7 h-7 rounded-full flex items-center justify-center mx-auto',
                    today_ ? 'bg-accent text-accent-foreground' : '',
                  ].join(' ')}>
                    {day.getDate()}
                  </div>
                </div>

                {/* Events + clickable empty zone */}
                <div
                  className="flex-1 cursor-pointer rounded-md transition-colors hover:bg-muted/30 p-1"
                  onClick={() => openCreateModal(new Date(day))}
                >
                  <div className="space-y-1" onClick={e => e.stopPropagation()}>
                    {dayEvents.map(ev => (
                      <EventPill key={ev.id} ev={ev} />
                    ))}
                  </div>
                  {dayEvents.length === 0 && (
                    <div className="flex items-center justify-center h-10 opacity-0 group-hover:opacity-100">
                      <Plus className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const isReadOnlyModal = editingEvent ? isSynthetic(editingEvent) : false;

  return (
    <div className="space-y-6">
      {/* Page header */}
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

          {/* ── Main calendar card ─────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Period label + navigation */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={prevPeriod}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <CardTitle className="text-base min-w-[160px] text-center">{periodLabel}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={nextPeriod}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-8 px-2 ml-1" onClick={goToToday}>
                    Today
                  </Button>
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                  <button
                    onClick={() => switchView('month')}
                    className={[
                      'text-xs px-3 py-1 rounded transition-colors',
                      viewMode === 'month'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => switchView('week')}
                    className={[
                      'text-xs px-3 py-1 rounded transition-colors',
                      viewMode === 'week'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    Week
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-3 pb-3">
              {viewMode === 'month' ? <MonthView /> : <WeekView />}

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

          {/* ── Upcoming list ──────────────────────────────────────────────── */}
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
                    const eventDate = new Date(event.start_time);
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => openEventModal(event, e)}
                        className="p-2.5 rounded-lg border border-border/40 bg-muted/20 transition-colors cursor-pointer hover:bg-muted/60"
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

      {/* ── Modal (create / edit / read-only) ─────────────────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">

          {isReadOnlyModal && editingEvent && isSyntheticInvoice(editingEvent) ? (
            /* ── Read-only: invoice due date info ── */
            (() => {
              const inv = (editingEvent as CalendarEvent & { _invoice?: Invoice })._invoice;
              const isOverdue = editingEvent.start_time < new Date().toISOString();
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isOverdue ? 'bg-red-500' : 'bg-amber-500'}`} />
                      {editingEvent.title}
                    </DialogTitle>
                    <DialogDescription>Invoice due date (auto-generated from Invoices)</DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {new Date(editingEvent.start_time).toLocaleDateString('en-US', {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </span>
                    </div>
                    {editingEvent.client && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{editingEvent.client.name}</span>
                      </div>
                    )}
                    {inv && (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span>{inv.invoice_number} — ${inv.amount}</span>
                      </div>
                    )}
                    <Badge
                      variant="outline"
                      className={isOverdue
                        ? 'bg-red-500/10 text-red-400 border-red-500/20 text-xs'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs'}
                    >
                      {isOverdue ? 'Overdue' : 'Upcoming'}
                    </Badge>
                    <p className="text-xs text-muted-foreground pt-1">
                      To update this invoice, go to the Invoices tab.
                    </p>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button>
                    <Button
                      className="glow-accent"
                      onClick={() => { setIsModalOpen(false); window.location.href = '/dashboard/finances?tab=invoices'; }}
                    >
                      Go to Invoices
                    </Button>
                  </DialogFooter>
                </>
              );
            })()
          ) : isReadOnlyModal && editingEvent ? (
            /* ── Read-only: project deadline info ── */
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  {editingEvent.title}
                </DialogTitle>
                <DialogDescription>Project deadline (auto-generated from Projects)</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {new Date(editingEvent.start_time).toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </span>
                </div>
                {editingEvent.project && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span>{editingEvent.project.name}</span>
                  </div>
                )}
                {editingEvent.client && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>{editingEvent.client.name}</span>
                  </div>
                )}
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                  Deadline
                </Badge>
                <p className="text-xs text-muted-foreground pt-1">
                  To change this deadline, edit the project in the Projects tab.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          ) : (
            /* ── Create / Edit form ── */
            <>
              <DialogHeader>
                <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
                <DialogDescription>
                  {editingEvent
                    ? 'Update the details for this event'
                    : 'Add a meeting, task, deadline, or custom event to your calendar'}
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
                        <SelectItem value="deadline">Deadline</SelectItem>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
