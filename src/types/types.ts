export type UserRole = 'user' | 'admin';

export type ProjectStatus = 'lead' | 'in_progress' | 'review' | 'completed' | 'archived';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

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
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  project?: Project;
}

export interface Proposal {
  id: string;
  user_id: string;
  client_id: string | null;
  title: string;
  status: ProposalStatus;
  content: Record<string, unknown> | null;
  value: number | null;
  sent_date: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
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

export interface CalendarEvent {
  id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string | null;
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
