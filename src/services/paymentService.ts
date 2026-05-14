import { supabase } from '@/db/supabase';
import type { Payment } from '@/types/types';

export async function getPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      client:clients(*),
      invoice:invoices(*),
      package:packages(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getPayment(id: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      client:clients(*),
      invoice:invoices(*),
      package:packages(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      client:clients(*),
      invoice:invoices(*),
      package:packages(*)
    `)
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getTotalRevenue(): Promise<number> {
  const { data, error } = await supabase
    .from('payments')
    .select('amount')
    .eq('status', 'succeeded');

  if (error) throw error;
  
  const total = data?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
  return total;
}

export function subscribeToPayments(callback: (payload: unknown) => void) {
  return supabase
    .channel('payments_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payments',
      },
      callback
    )
    .subscribe();
}
