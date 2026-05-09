import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Project } from '@/types/types';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const stages = [
  { id: 'lead', name: 'Lead', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { id: 'in_progress', name: 'In Progress', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  { id: 'review', name: 'Review', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  { id: 'completed', name: 'Completed', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
];

function ProjectCard({ project }: { project: Project }) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-4 rounded-lg bg-card border border-border hover:shadow-md transition-shadow cursor-move"
    >
      <h4 className="font-semibold mb-2 text-balance">{project.name}</h4>
      {project.client && (
        <p className="text-sm text-muted-foreground mb-2">{project.client.name}</p>
      )}
      {project.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2 text-pretty">{project.description}</p>
      )}
      <div className="flex items-center justify-between text-xs">
        {project.value && (
          <span className="font-semibold text-primary">${project.value.toLocaleString()}</span>
        )}
        {project.deadline && (
          <span className="text-muted-foreground">
            {new Date(project.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
      {project.progress > 0 && (
        <div className="mt-3">
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{project.progress}% complete</p>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  const loadProjects = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('projects')
      .select('*, client:clients(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setProjects(data);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const projectId = active.id as string;
    const newStatus = over.id as string;

    // Update local state immediately
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId ? { ...p, status: newStatus as Project['status'] } : p
      )
    );

    // Update in database
    await supabase
      .from('projects')
      .update({ status: newStatus })
      .eq('id', projectId);

    setActiveId(null);
  };

  const getProjectsByStage = (stageId: string) => {
    return projects.filter(p => p.status === stageId);
  };

  const activeProject = activeId ? projects.find(p => p.id === activeId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-balance mb-2">Projects</h1>
          <p className="text-muted-foreground">Manage your project pipeline</p>
        </div>
        <Button onClick={() => {}}>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stages.map((stage) => {
            const stageProjects = getProjectsByStage(stage.id);
            return (
              <SortableContext
                key={stage.id}
                id={stage.id}
                items={stageProjects.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <Card className="h-full flex flex-col">
                  <CardHeader className="shrink-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-balance">{stage.name}</CardTitle>
                      <Badge variant="outline" className={stage.color}>
                        {stageProjects.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 overflow-y-auto">
                    <div className="space-y-3">
                      {stageProjects.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                      ))}
                      {stageProjects.length === 0 && (
                        <div className="text-center py-8 text-sm text-muted-foreground text-pretty">
                          No projects in this stage
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </SortableContext>
            );
          })}
        </div>

        <DragOverlay>
          {activeProject ? (
            <div className="p-4 rounded-lg bg-card border border-border shadow-lg">
              <h4 className="font-semibold text-balance">{activeProject.name}</h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
