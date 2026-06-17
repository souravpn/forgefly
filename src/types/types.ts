export type UserRole = 'user' | 'admin';

export type ProjectStatus = 'lead' | 'in_progress' | 'review' | 'completed' | 'archived';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export type PaymentStatus = 'unpaid' | 'processing' | 'paid' | 'failed';

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'rejected' | 'expired' | 'withdrawn';

export type ProposalOrigin = 'freelancer' | 'client' | 'pipeline';

export interface ProposalLineItem {
  label: string;
  qty: number;
  unit_price: number;
}

export interface ProposalRequestContext {
  original_request_id?: string;
  company?: string | null;
  service_name?: string | null;
  problem?: string | null;
  timeline?: string | null;
  budget_flexible?: boolean;
  notes?: string | null;
}

export interface Profile {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  stripe_account_id: string | null;
  stripe_account_status: 'not_connected' | 'pending' | 'under_review' | 'active';
  created_at: string;
  updated_at: string;
}

export interface BusinessProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_description: string | null;
  service_type: string | null;
  hourly_rate: number | null;
  branding_colors: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  total_value: number;
  last_interaction: string | null;
  notes: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  client_id: string | null;
  contact_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  value: number | null;
  deadline: string | null;
  progress: number;
  client_visible_status: 'not_started' | 'in_progress' | 'review' | 'complete' | null;
  client_visible_note: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  amount: number;
  description: string | null;
  issue_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  sent_at: string | null;
  notes: string | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  project?: Project;
}

export interface Proposal {
  id: string;
  user_id: string;
  business_id: string | null;
  client_id: string | null;
  project_id: string | null;
  title: string;
  status: ProposalStatus;
  initiated_by: ProposalOrigin;
  // Legacy content fields (freelancer-initiated)
  introduction: string | null;
  services: string | null;
  deliverables: string | null;
  pricing: number | null;
  timeline: string | null;
  terms: string | null;
  // Unified content fields
  client_name: string | null;
  client_email: string | null;
  description: string | null;
  line_items: ProposalLineItem[] | null;
  total_amount: number | null;
  currency: string;
  // AI metadata
  ai_generated: boolean;
  ai_generation_tone: string | null;
  ai_model_used: string | null;
  // Pipeline link
  pipeline_lead_id: string | null;
  // Request context (client-initiated only)
  request_context: ProposalRequestContext | null;
  // Timestamps
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  client?: Client;
  project?: Project;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  project?: Project;
}

export interface Automation {
  id: string;
  user_id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  config: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CalendarEventType = 'meeting' | 'task' | 'deadline' | 'custom';

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_type: CalendarEventType;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  client_id: string | null;
  project_id: string | null;
  location: string | null;
  meeting_link: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  project?: Project;
}

export interface OnboardingPreview {
  type: 'package' | 'branding' | 'proposal' | 'contract';
  title: string;
  content: string;
  details?: Record<string, unknown>;
}

export interface CashflowData {
  month: string;
  income: number;
  expenses: number;
  profit: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Package {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  one_time_price: number | null;
  monthly_price: number | null;
  features: string | null;
  is_active: boolean;
  stripe_one_time_price_id: string | null;
  stripe_monthly_price_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_id: string | null;
  package_id: string | null;
  stripe_payment_intent_id: string;
  stripe_charge_id: string | null;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'refunded';
  payment_method_type: string | null;
  created_at: string;
  client?: Client;
  invoice?: Invoice;
  package?: Package;
}

export type TransactionType = 'income' | 'expense';
export type IncomeCategory = 'services' | 'products' | 'licensing' | 'royalties';
export type RecurrenceRule = 'monthly' | 'annual';

export interface ExpenseCategory {
  id: string;
  business_id: string | null;
  name: string;
  schedule_c_line: string | null;
  is_cogs: boolean;
  is_default: boolean;
  vertical: 'b2c_local' | 'b2b_creative' | 'b2b_professional' | null;
  sort_order: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  business_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  // income
  invoice_id: string | null;
  client_id: string | null;
  income_category: IncomeCategory | null;
  // expense
  expense_category_id: string | null;
  vendor: string | null;
  receipt_url: string | null;
  receipt_extracted: boolean;
  is_recurring: boolean;
  recurrence_rule: RecurrenceRule | null;
  // shared
  description: string | null;
  transaction_date: string;
  tax_year: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // relations
  expense_category?: ExpenseCategory;
}

export interface MileageLog {
  id: string;
  business_id: string;
  trip_date: string;
  miles: number;
  purpose: string;
  client_id: string | null;
  project_id: string | null;
  irs_rate: number;
  deductible_amount: number;
  tax_year: number;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  business_id: string;
  project_id: string;
  client_id: string | null;
  entry_date: string;
  hours: number;
  note: string | null;
  timer_started_at: string | null;
  tax_year: number;
  created_at: string;
  project?: Project;
}

export interface ContractorPayment {
  id: string;
  business_id: string;
  contractor_name: string;
  contractor_email: string | null;
  w9_on_file: boolean;
  payment_date: string;
  amount: number;
  description: string | null;
  tax_year: number;
  ytd_total: number | null;
  threshold_flag: boolean;
  created_at: string;
}
