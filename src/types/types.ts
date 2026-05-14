export type UserRole = 'user' | 'admin';

export type ProjectStatus = 'To Do' | 'In Progress' | 'Review' | 'Done';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export type PaymentStatus = 'unpaid' | 'processing' | 'paid' | 'failed';

export type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
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
  name: string;
  description: string | null;
  status: ProjectStatus;
  value: number | null;
  deadline: string | null;
  progress: number;
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
  client_id: string | null;
  project_id: string | null;
  title: string;
  status: ProposalStatus;
  introduction: string | null;
  services: string | null;
  deliverables: string | null;
  pricing: number | null;
  timeline: string | null;
  terms: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
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
