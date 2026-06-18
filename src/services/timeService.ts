import { supabase } from '@/db/supabase';
import type { TimeEntry } from '@/types/types';

async function currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

async function resolveBusinessId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No active business found');
  return data.id;
}

const SELECT = `
  id, business_id, user_id, project_id, client_id,
  date, hours, note,
  timer_started_at, timer_stopped_at,
  created_at, updated_at,
  project:projects(id, name),
  client:clients(id, name)
`.trim();

export async function getTimeEntries(year?: number): Promise<TimeEntry[]> {
  const user = await currentUser();
  const bizId = await resolveBusinessId(user.id);

  let q = supabase
    .from('time_entries')
    .select(SELECT)
    .eq('business_id', bizId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (year) {
    q = q
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as TimeEntry[];
}

export async function getTimeEntriesByProject(projectId: string): Promise<TimeEntry[]> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('time_entries')
    .select(SELECT)
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TimeEntry[];
}

export interface CreateTimeEntryInput {
  project_id?: string | null;
  client_id?: string | null;
  date: string;
  hours: number;
  note?: string | null;
  timer_started_at?: string | null;
  timer_stopped_at?: string | null;
}

export async function createTimeEntry(input: CreateTimeEntryInput): Promise<TimeEntry> {
  const user = await currentUser();
  const bizId = await resolveBusinessId(user.id);

  const { data, error } = await supabase
    .from('time_entries')
    .insert({ ...input, user_id: user.id, business_id: bizId })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as unknown as TimeEntry;
}

export async function updateTimeEntry(id: string, updates: Partial<CreateTimeEntryInput>): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from('time_entries')
    .update(updates)
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as unknown as TimeEntry;
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const { error } = await supabase.from('time_entries').delete().eq('id', id);
  if (error) throw error;
}

export interface ProjectTimeSummary {
  projectId: string;
  projectName: string;
  clientId: string | null;
  clientName: string | null;
  totalHours: number;
  quotedValue: number | null;
  hourBudget: number | null;
  effectiveRate: number | null; // value / hours
}

export async function getProjectTimeSummaries(year?: number): Promise<ProjectTimeSummary[]> {
  const entries = await getTimeEntries(year);

  const map = new Map<string, {
    name: string; clientId: string | null; clientName: string | null;
    totalHours: number; value: number | null; budget: number | null;
  }>();

  for (const e of entries) {
    if (!e.project_id || !e.project) continue;
    const existing = map.get(e.project_id);
    if (existing) {
      existing.totalHours += e.hours;
    } else {
      map.set(e.project_id, {
        name: e.project.name,
        clientId: e.client_id,
        clientName: (e.client as { name?: string } | null)?.name ?? null,
        totalHours: e.hours,
        value: null,
        budget: null,
      });
    }
  }

  if (map.size === 0) return [];

  // Fetch project values + budgets
  const { data: projects } = await supabase
    .from('projects')
    .select('id, value, hour_budget')
    .in('id', Array.from(map.keys()));

  for (const p of projects ?? []) {
    const row = map.get(p.id as string);
    if (row) {
      row.value = p.value as number | null;
      row.budget = p.hour_budget as number | null;
    }
  }

  return Array.from(map.entries()).map(([projectId, row]) => ({
    projectId,
    projectName: row.name,
    clientId: row.clientId,
    clientName: row.clientName,
    totalHours: row.totalHours,
    quotedValue: row.value,
    hourBudget: row.budget,
    effectiveRate: row.value && row.totalHours > 0 ? row.value / row.totalHours : null,
  }));
}
