import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Edit, Trash2, Calendar, DollarSign, User, Clock, Search, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Project, ProjectStatus, Client } from '@/types/types';
import { getProjects, createProject, updateProject, updateProjectStatus, deleteProject, subscribeToProjects } from '@/services/projectService';
import { getClients } from '@/services/clientService';
import { getTimeEntriesByProject } from '@/services/timeService';
import { supabase } from '@/db/supabase';
import { useBusiness } from '@/contexts/CurrentBusinessContext';
import LogTimeDialog from '@/components/common/LogTimeDialog';

const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'https://www.forgefly.io';

const COLUMNS: { id: ProjectStatus; title: string }[] = [
  { id: 'lead', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'completed', title: 'Done' },
];

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onLogTime: (project: Project) => void;
  totalHours: number;
}

function ProjectCard({ project, onEdit, onDelete, onLogTime, totalHours }: ProjectCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const effectiveRate = project.value && totalHours > 0
    ? project.value / totalHours
    : null;
  const budgetPct = project.hour_budget && totalHours > 0
    ? Math.min((totalHours / project.hour_budget) * 100, 100)
    : null;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="card-hover cursor-move">
        <CardContent className="p-4 space-y-3">
          <div>
            <h4 className="font-semibold text-balance mb-1">{project.name}</h4>
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 text-pretty">{project.description}</p>
            )}
          </div>

          {project.client && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4 shrink-0" />
              <span className="truncate">{project.client.name}</span>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm">
            {project.value && (
              <div className="flex items-center gap-1 text-accent">
                <DollarSign className="w-4 h-4" />
                <span className="font-medium">{project.value.toLocaleString()}</span>
              </div>
            )}
            {project.deadline && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{new Date(project.deadline).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Profitability card — shows when hours logged */}
          {totalHours > 0 && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hours logged</span>
                <span className="font-medium tabular-nums">{totalHours.toFixed(1)} hrs</span>
              </div>
              {effectiveRate !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Effective rate</span>
                  <span className="font-medium tabular-nums">${effectiveRate.toFixed(0)}/hr</span>
                </div>
              )}
              {budgetPct !== null && project.hour_budget && (
                <div className="space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Budget</span>
                    <span className={budgetPct >= 95 ? 'text-destructive' : budgetPct >= 80 ? 'text-amber-500' : ''}>
                      {totalHours.toFixed(1)} / {project.hour_budget} hrs
                    </span>
                  </div>
                  <Progress
                    value={budgetPct}
                    className={`h-1.5 ${budgetPct >= 95 ? '[&>div]:bg-destructive' : budgetPct >= 80 ? '[&>div]:bg-amber-500' : ''}`}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onLogTime(project); }}
              title="Log time"
            >
              <Clock className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => { e.stopPropagation(); onEdit(project); }}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onDelete(project); }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex-1 space-y-3 min-h-[200px] rounded-md transition-colors ${isOver ? 'bg-accent/10' : ''}`}>
      {children}
    </div>
  );
}

export default function ProjectsPage() {
  const { business } = useBusiness();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_id: '',
    value: '',
    deadline: '',
    status: 'lead' as ProjectStatus,
    client_visible_status: '' as Project['client_visible_status'] | '',
    client_visible_note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [logTimeProject, setLogTimeProject] = useState<Project | null>(null);
  const [projectHours, setProjectHours] = useState<Record<string, number>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Auto-open create modal when navigated with ?action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsCreateModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    loadData();

    const channel = subscribeToProjects(() => {
      loadProjects();
    });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  async function loadProjectHours(projectIds: string[]) {
    const results = await Promise.all(
      projectIds.map(id => getTimeEntriesByProject(id).then(entries => ({
        id,
        total: entries.reduce((s, e) => s + e.hours, 0),
      })))
    );
    setProjectHours(Object.fromEntries(results.map(r => [r.id, r.total])));
  }

  async function loadData() {
    try {
      const [projectsData, clientsData] = await Promise.all([
        getProjects(),
        getClients(),
      ]);
      setProjects(projectsData);
      setClients(clientsData);
      if (projectsData.length > 0) {
        loadProjectHours(projectsData.map(p => p.id));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
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
      name: '',
      description: '',
      client_id: '',
      value: '',
      deadline: '',
      status: 'lead',
      client_visible_status: '',
      client_visible_note: '',
    });
    setIsCreateModalOpen(true);
  }

  function openEditModal(project: Project) {
    setSelectedProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      client_id: project.client_id || '',
      value: project.value?.toString() || '',
      deadline: project.deadline || '',
      status: project.status,
      client_visible_status: project.client_visible_status ?? '',
      client_visible_note: project.client_visible_note || '',
    });
    setIsEditModalOpen(true);
  }

  function openDeleteDialog(project: Project) {
    setSelectedProject(project);
    setIsDeleteDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Auto-resolve contact_id from the selected client's email → contacts table
      let contactId: string | null = null;
      let contactEmail: string | null = null;
      let contactName: string | null = null;
      let contactPortalToken: string | null = null;
      if (formData.client_id) {
        const client = clients.find(c => c.id === formData.client_id);
        if (client?.email) {
          const { data: match } = await supabase
            .from('contacts')
            .select('id, email, name, portal_token')
            .eq('email', client.email)
            .maybeSingle();
          contactId = match?.id ?? null;
          contactEmail = match?.email ?? null;
          contactName = match?.name ?? null;
          contactPortalToken = match?.portal_token ?? null;
        }
      }

      const projectData = {
        name: formData.name,
        description: formData.description || null,
        client_id: formData.client_id || null,
        contact_id: contactId,
        value: formData.value ? parseFloat(formData.value) : null,
        deadline: formData.deadline || null,
        status: formData.status,
        progress: 0,
        client_visible_status: formData.client_visible_status || null,
        client_visible_note: formData.client_visible_note || null,
      };

      if (isEditModalOpen && selectedProject) {
        await updateProject(selectedProject.id, projectData);
        toast.success('Project updated successfully!');
        setIsEditModalOpen(false);
      } else {
        await createProject(projectData);
        toast.success('Project created successfully!');
        setIsCreateModalOpen(false);
      }

      // Email client when status becomes visible — fire-and-forget
      const statusChanged = isEditModalOpen
        ? projectData.client_visible_status !== selectedProject?.client_visible_status
        : true;
      if (projectData.client_visible_status && contactEmail && statusChanged && business) {
        const statusLabel: Record<string, string> = {
          not_started: 'Not started', in_progress: 'In progress',
          review: 'In review', complete: 'Complete',
        };
        const portalUrl = contactPortalToken
          ? `${SITE_URL}/portal/${contactPortalToken}`
          : undefined;
        const msgBody = [
          `Status: ${statusLabel[projectData.client_visible_status] ?? projectData.client_visible_status}`,
          projectData.client_visible_note ? `\n${projectData.client_visible_note}` : '',
        ].join('');
        supabase.functions.invoke('send-email', {
          body: {
            type: 'client_message',
            to: contactEmail,
            reply_to: business.contact_email ?? undefined,
            data: {
              clientName: contactName ?? 'there',
              senderName: business.name,
              subject: `Project update: ${projectData.name}`,
              message: msgBody,
              portalUrl,
            },
          },
        });
      }

      loadProjects();
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedProject) return;

    try {
      await deleteProject(selectedProject.id);
      toast.success('Project deleted successfully!');
      setIsDeleteDialogOpen(false);
      loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const projectId = active.id as string;
    const overId = over.id as string;

    // over.id is either a column status ID or another card's project ID
    const columnIds = COLUMNS.map(c => c.id as string);
    let newStatus: ProjectStatus;
    if (columnIds.includes(overId)) {
      newStatus = overId as ProjectStatus;
    } else {
      const targetProject = projects.find(p => p.id === overId);
      if (!targetProject) return;
      newStatus = targetProject.status;
    }

    const project = projects.find(p => p.id === projectId);
    if (!project || project.status === newStatus) return;

    // Optimistic update
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p));

    try {
      await updateProjectStatus(projectId, newStatus);
    } catch (error) {
      console.error('Error updating project status:', error);
      toast.error('Failed to update project status');
      loadProjects();
    }
  }

  const activeProject = activeId ? projects.find(p => p.id === activeId) : null;

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-2">Projects</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your projects with Kanban board</p>
        </div>
        <Button size="lg" className="glow-accent w-full md:w-auto" onClick={openCreateModal}>
          <Plus className="w-5 h-5 mr-2" />
          Add Project
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-32 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {COLUMNS.map((column) => {
              const q = searchQuery.toLowerCase();
              const columnProjects = projects.filter(p =>
                p.status === column.id &&
                (!q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || (p as any).client?.name?.toLowerCase().includes(q))
              );
              return (
                <Card key={column.id} className="h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{column.title}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {columnProjects.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-3">
                    <DroppableColumn id={column.id}>
                      <SortableContext items={columnProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
                        {columnProjects.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Briefcase className="w-8 h-8 text-muted-foreground/50 mb-2" />
                            <p className="text-sm text-muted-foreground">No projects</p>
                          </div>
                        ) : (
                          columnProjects.map((project) => (
                            <ProjectCard
                              key={project.id}
                              project={project}
                              onEdit={openEditModal}
                              onDelete={openDeleteDialog}
                              onLogTime={p => setLogTimeProject(p)}
                              totalHours={projectHours[project.id] ?? 0}
                            />
                          ))
                        )}
                      </SortableContext>
                    </DroppableColumn>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <DragOverlay>
            {activeProject ? (
              <Card className="cursor-move opacity-90">
                <CardContent className="p-4">
                  <h4 className="font-semibold">{activeProject.name}</h4>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isCreateModalOpen || isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
        }
      }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditModalOpen ? 'Edit Project' : 'Add New Project'}</DialogTitle>
            <DialogDescription>
              {isEditModalOpen ? 'Update project information' : 'Create a new project'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="value">Value ($)</Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as ProjectStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2 border-t space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Visible to client in portal</p>
                <div className="space-y-2">
                  <Label htmlFor="client_visible_status">Client status</Label>
                  <Select
                    value={formData.client_visible_status || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, client_visible_status: value === 'none' ? '' : value as Project['client_visible_status'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not shared" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not shared</SelectItem>
                      <SelectItem value="not_started">Not started</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="review">In review</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_visible_note">Note for client</Label>
                  <Textarea
                    id="client_visible_note"
                    value={formData.client_visible_note}
                    onChange={(e) => setFormData({ ...formData, client_visible_note: e.target.value })}
                    placeholder="Optional update message shown to the client…"
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="glow-accent">
                {submitting ? 'Saving...' : isEditModalOpen ? 'Update Project' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedProject?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LogTimeDialog
        open={logTimeProject !== null}
        onOpenChange={open => { if (!open) setLogTimeProject(null); }}
        projects={projects}
        defaultProjectId={logTimeProject?.id}
        onSaved={() => {
          if (logTimeProject) {
            getTimeEntriesByProject(logTimeProject.id).then(entries => {
              setProjectHours(prev => ({
                ...prev,
                [logTimeProject.id]: entries.reduce((s, e) => s + e.hours, 0),
              }));
            });
          }
          toast.success('Time logged');
        }}
      />
    </div>
  );
}
