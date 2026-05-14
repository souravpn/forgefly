import { supabase } from '@/db/supabase';
import type { CalendarEvent } from '@/types/types';

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select(`
      *,
      client:clients(*),
      project:projects(*)
    `)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getCalendarEvent(id: string): Promise<CalendarEvent | null> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select(`
      *,
      client:clients(*),
      project:projects(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCalendarEvent(event: Omit<CalendarEvent, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'client' | 'project'>): Promise<CalendarEvent> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      ...event,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('calendar_events')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function subscribeToCalendarEvents(callback: (payload: unknown) => void) {
  return supabase
    .channel('calendar_events_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'calendar_events',
      },
      callback
    )
    .subscribe();
}
