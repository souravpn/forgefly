import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Plus, Clock, MapPin, Link as LinkIcon, Users, Briefcase, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CalendarEvent, Client, Project } from '@/types/types';
import { getCalendarEvents, createCalendarEvent, subscribeToCalendarEvents } from '@/services/calendarService';
import { getClients } from '@/services/clientService';
import { getProjects } from '@/services/projectService';
import { supabase } from '@/db/supabase';

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'meeting' as const,
    start_time: '',
    end_time: '',
    all_day: false,
    client_id: '',
    project_id: '',
    location: '',
    meeting_link: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();

    const channel = subscribeToCalendarEvents(() => {
      loadEvents();
    });

    return () => {
      channel.unsubscribe();
    };
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

      const projectDeadlines: CalendarEvent[] = (projectsData || []).map(project => ({
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

      const allEvents = [...data, ...projectDeadlines].sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('Failed to load calendar events');
    }
  }

  async function loadClients() {
    try {
      const data = await getClients();
      setClients(data);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }

  async function loadProjects() {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }

  function openCreateModal() {
    setFormData({
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
    });
    setIsCreateModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await createCalendarEvent({
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
      });

      toast.success('Event created successfully!');
      setIsCreateModalOpen(false);
      loadEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    } finally {
      setSubmitting(false);
    }
  }

  function getEventTypeColor(type: string) {
    const colors = {
      meeting: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      task: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      deadline: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      custom: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    };
    return colors[type as keyof typeof colors] || colors.custom;
  }

  function getEventIcon(type: string) {
    const icons = {
      meeting: Users,
      task: CheckCircle2,
      deadline: Clock,
      custom: CalendarIcon,
    };
    const Icon = icons[type as keyof typeof icons] || CalendarIcon;
    return <Icon className="w-4 h-4" />;
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-2">Calendar</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your schedule and deadlines</p>
        </div>
        <Button size="lg" className="glow-accent w-full md:w-auto" onClick={openCreateModal}>
          <Plus className="w-5 h-5 mr-2" />
          Add Event
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <CalendarIcon className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No events scheduled</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-pretty">
              Start adding meetings, tasks, and deadlines to keep track of your schedule.
            </p>
            <Button onClick={openCreateModal} className="glow-accent">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-balance">Upcoming Events</CardTitle>
            <CardDescription>Your schedule and project deadlines</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <CalendarIcon className="w-6 h-6 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-balance">{event.title}</h3>
                      <Badge variant="outline" className={getEventTypeColor(event.event_type)}>
                        {getEventIcon(event.event_type)}
                        <span className="ml-1 capitalize">{event.event_type}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {new Date(event.start_time).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                      {!event.all_day && ` • ${new Date(event.start_time).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                      })}`}
                    </p>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mb-2 text-pretty">{event.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {event.client && (
                        <Badge variant="secondary" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          {event.client.name}
                        </Badge>
                      )}
                      {event.project && (
                        <Badge variant="secondary" className="text-xs">
                          <Briefcase className="w-3 h-3 mr-1" />
                          {event.project.name}
                        </Badge>
                      )}
                      {event.location && (
                        <Badge variant="secondary" className="text-xs">
                          <MapPin className="w-3 h-3 mr-1" />
                          {event.location}
                        </Badge>
                      )}
                      {event.meeting_link && (
                        <Badge variant="secondary" className="text-xs">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          Meeting Link
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Event Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
            <DialogDescription>Add a meeting, task, or custom event to your calendar</DialogDescription>
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
                  onValueChange={(value: any) => setFormData({ ...formData, event_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                    onValueChange={(value) => setFormData({ ...formData, client_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project_id">Project (Optional)</Label>
                  <Select
                    value={formData.project_id || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, project_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="glow-accent">
                {submitting ? 'Creating...' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
