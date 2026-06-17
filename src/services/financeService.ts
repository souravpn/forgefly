import { supabase } from '@/db/supabase';
import type {
  Transaction,
  MileageLog,
  TimeEntry,
  ContractorPayment,
  ExpenseCategory,
} from '@/types/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

async function currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

// ─── Expense Categories ───────────────────────────────────────────────────────

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .or(`business_id.is.null,business_id.eq.${businessId}`)
    .order('sort_order');

  if (error) throw error;
  return data ?? [];
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export type TransactionInsert = Omit<
  Transaction,
  'id' | 'business_id' | 'tax_year' | 'created_at' | 'updated_at' | 'expense_category'
>;

export async function getTransactions(year?: number): Promise<Transaction[]> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  let query = supabase
    .from('transactions')
    .select('*, expense_category:expense_categories(*)')
    .eq('business_id', businessId)
    .order('transaction_date', { ascending: false });

  if (year) query = query.eq('tax_year', year);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createTransaction(input: TransactionInsert): Promise<Transaction> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...input, business_id: businessId })
    .select('*, expense_category:expense_categories(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateTransaction(id: string, updates: Partial<TransactionInsert>): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, expense_category:expense_categories(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

// ─── Mileage Logs ─────────────────────────────────────────────────────────────

export type MileageLogInsert = Omit<
  MileageLog,
  'id' | 'business_id' | 'deductible_amount' | 'tax_year' | 'created_at'
>;

export async function getMileageLogs(year?: number): Promise<MileageLog[]> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  let query = supabase
    .from('mileage_logs')
    .select('*')
    .eq('business_id', businessId)
    .order('trip_date', { ascending: false });

  if (year) query = query.eq('tax_year', year);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createMileageLog(input: MileageLogInsert): Promise<MileageLog> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  const { data, error } = await supabase
    .from('mileage_logs')
    .insert({ ...input, business_id: businessId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMileageLog(id: string): Promise<void> {
  const { error } = await supabase.from('mileage_logs').delete().eq('id', id);
  if (error) throw error;
}

// ─── Time Entries ─────────────────────────────────────────────────────────────

export type TimeEntryInsert = Omit<
  TimeEntry,
  'id' | 'business_id' | 'tax_year' | 'created_at' | 'project'
>;

export async function getTimeEntries(year?: number): Promise<TimeEntry[]> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  let query = supabase
    .from('time_entries')
    .select('*, project:projects(*)')
    .eq('business_id', businessId)
    .order('entry_date', { ascending: false });

  if (year) query = query.eq('tax_year', year);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createTimeEntry(input: TimeEntryInsert): Promise<TimeEntry> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  const { data, error } = await supabase
    .from('time_entries')
    .insert({ ...input, business_id: businessId })
    .select('*, project:projects(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const { error } = await supabase.from('time_entries').delete().eq('id', id);
  if (error) throw error;
}

// ─── Contractor Payments ──────────────────────────────────────────────────────

export type ContractorPaymentInsert = Omit<
  ContractorPayment,
  'id' | 'business_id' | 'tax_year' | 'ytd_total' | 'threshold_flag' | 'created_at'
>;

export async function getContractorPayments(year?: number): Promise<ContractorPayment[]> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  let query = supabase
    .from('contractor_payments')
    .select('*')
    .eq('business_id', businessId)
    .order('payment_date', { ascending: false });

  if (year) query = query.eq('tax_year', year);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createContractorPayment(input: ContractorPaymentInsert): Promise<ContractorPayment> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  const taxYear = new Date(input.payment_date).getFullYear();

  // Snapshot ytd before insert so we can detect threshold crossing
  const { data: prev } = await supabase
    .from('contractor_payments')
    .select('ytd_total')
    .eq('business_id', businessId)
    .eq('contractor_name', input.contractor_name)
    .eq('tax_year', taxYear)
    .order('created_at', { ascending: false })
    .limit(1);

  const prevYtd: number = prev?.[0]?.ytd_total ?? 0;

  const { data: row, error } = await supabase
    .from('contractor_payments')
    .insert({ ...input, business_id: businessId })
    .select()
    .single();

  if (error) throw error;

  // Fire nudge when contractor first crosses $600 this year
  if (row.threshold_flag && prevYtd < 600) {
    await supabase.from('nudges').insert({
      user_id: user.id,
      business_id: businessId,
      type: 'contractor_threshold',
      title: `${input.contractor_name} crossed $600`,
      body: `${input.contractor_name} has received $${row.ytd_total?.toFixed(2)} this year. They may require a 1099-NEC. Collect their W-9 if you haven't already. Consult a tax professional for advice specific to your situation.`,
      action_url: '/dashboard/finances?tab=expenses',
    });
  }

  return row;
}

export async function updateContractorW9(id: string, w9OnFile: boolean): Promise<void> {
  const { error } = await supabase
    .from('contractor_payments')
    .update({ w9_on_file: w9OnFile })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteContractorPayment(id: string): Promise<void> {
  const { error } = await supabase.from('contractor_payments').delete().eq('id', id);
  if (error) throw error;
}
