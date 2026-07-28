import { supabase } from '@/db/supabase';
import type { Invoice, InvoiceStatus } from '@/types/types';

export async function getInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      project:projects(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
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

export async function createInvoice(invoice: Omit<Invoice, 'id' | 'user_id' | 'invoice_number' | 'created_at' | 'updated_at' | 'client' | 'project'>): Promise<Invoice> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber();

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      ...invoice,
      user_id: user.id,
      invoice_number: invoiceNumber,
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

export async function updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
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

export async function sendInvoice(id: string): Promise<Invoice> {
  return updateInvoice(id, {
    status: 'sent',
    sent_at: new Date().toISOString(),
  });
}

export async function markInvoiceAsPaid(id: string): Promise<Invoice> {
  return updateInvoice(id, {
    status: 'paid',
    paid_at: new Date().toISOString(),
  });
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
  return updateInvoice(id, { status });
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

async function generateInvoiceNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  // Atomic per-user, per-day counter (next_invoice_sequence RPC) — a plain
  // count-then-insert here is racy (two near-simultaneous creates can read
  // the same count and collide on the unique invoice_number constraint).
  const { data: sequence, error } = await supabase.rpc('next_invoice_sequence', { p_date_key: dateStr });
  if (error) throw error;

  return `INV-${dateStr}-${String(sequence).padStart(3, '0')}`;
}

export function subscribeToInvoices(callback: (payload: unknown) => void) {
  return supabase
    .channel('invoices_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'invoices',
      },
      callback
    )
    .subscribe();
}
