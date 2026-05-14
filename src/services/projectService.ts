import { supabase } from '@/db/supabase';
import type { Project, ProjectStatus } from '@/types/types';

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      client:clients(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      client:clients(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createProject(project: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'client'>): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...project,
      user_id: user.id,
    })
    .select(`
      *,
      client:clients(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      client:clients(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
  return updateProject(id, { status });
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function subscribeToProjects(callback: (payload: unknown) => void) {
  return supabase
    .channel('projects_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'projects',
      },
      callback
    )
    .subscribe();
}
