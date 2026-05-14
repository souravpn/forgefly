import { supabase } from '@/db/supabase';
import type { Package } from '@/types/types';

export async function getPackages(): Promise<Package[]> {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getPackage(id: string): Promise<Package | null> {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createPackage(pkg: Omit<Package, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'stripe_one_time_price_id' | 'stripe_monthly_price_id'>): Promise<Package> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('packages')
    .insert({
      ...pkg,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePackage(id: string, updates: Partial<Package>): Promise<Package> {
  const { data, error } = await supabase
    .from('packages')
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

export async function deletePackage(id: string): Promise<void> {
  const { error } = await supabase
    .from('packages')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function subscribeToPackages(callback: (payload: unknown) => void) {
  return supabase
    .channel('packages_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'packages',
      },
      callback
    )
    .subscribe();
}
