import { supabase } from '@/db/supabase';
import type { Proposal, ProposalStatus } from '@/types/types';

export async function getProposals(): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select(`
      *,
      client:clients(*),
      project:projects(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getProposal(id: string): Promise<Proposal | null> {
  const { data, error } = await supabase
    .from('proposals')
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

export async function createProposal(proposal: Omit<Proposal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'client' | 'project'>): Promise<Proposal> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      ...proposal,
      user_id: user.id,
    })
    .select(`
      *,
      client:clients(*),
      project:projects(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProposal(id: string, updates: Partial<Proposal>): Promise<Proposal> {
  const { data, error } = await supabase
    .from('proposals')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      client:clients(*),
      project:projects(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function sendProposal(id: string): Promise<Proposal> {
  return updateProposal(id, {
    status: 'sent',
    sent_at: new Date().toISOString(),
  });
}

export async function updateProposalStatus(id: string, status: ProposalStatus): Promise<Proposal> {
  return updateProposal(id, { status });
}

export async function deleteProposal(id: string): Promise<void> {
  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function subscribeToProposals(callback: (payload: unknown) => void) {
  return supabase
    .channel('proposals_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'proposals',
      },
      callback
    )
    .subscribe();
}
