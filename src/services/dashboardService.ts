import { supabase } from '@/db/supabase';
import type { Invoice, Project, Proposal } from '@/types/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

export function relativeDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = daysUntil(dateStr);
  if (d === null) return '';
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d <= 7) return `in ${d}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UpcomingItem {
  label: string;
  sublabel: string;
  date: string;
  urgency: 'overdue' | 'soon' | 'normal';
  route: string;
}

export interface OverviewData {
  receivedThisMonth: number;
  outstanding: number;
  overdueTotal: number;
  activeProjects: Project[];
  viewedProposals: Proposal[];
  overdueInvoices: Invoice[];
  pipelineLeadCount: number;
  proposalsSentThisMonth: number;
  recentLeads: { name: string; value: string | null; stage: string }[];
  upcoming: UpcomingItem[];
  // Analytics
  winRate: number | null;
  avgProjectValue: number | null;
  repeatClientPct: number | null;
  reviewScore: number | null;
  reviewCount: number;
  portalVisits30d: number;
  projectsThisMonth: number;
  projectsCompleted: number;
  featuredPromotion: { id: string; headline: string | null; caption: string } | null;
}

// This is the single source of truth for "what's on the Dashboard" — both
// DashboardPage and Freeda's KPI-catalog query answers read from here, so a
// number Freeda states can never drift from what's shown on screen.
export async function loadOverviewData(userId: string, businessId?: string): Promise<OverviewData> {
  const monthStart = startOfMonth();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: invoices },
    { data: projects },
    { data: proposals },
    { data: pipelineLeads },
    { data: reviews },
    { count: portalVisits },
    { data: calendarEvents },
    { data: featuredPromotionRow },
  ] = await Promise.all([
    supabase.from('invoices').select('*, client:clients(name)').eq('user_id', userId),
    supabase.from('projects').select('*, client:clients(name)').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('proposals').select('*, client:clients(name)').eq('user_id', userId).order('updated_at', { ascending: false }),
    supabase.from('pipeline_leads').select('id, stage, value, contact_id').order('created_at', { ascending: false }),
    businessId
      ? supabase.from('reviews').select('rating').eq('business_id', businessId).eq('portal_eligible', true)
      : Promise.resolve({ data: [] as { rating: number }[] }),
    businessId
      ? supabase.from('portal_events').select('id', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', thirtyDaysAgo)
      : Promise.resolve({ count: 0 }),
    supabase.from('calendar_events')
      .select('id, title, event_type, start_time, client:clients(name)')
      .eq('user_id', userId)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(15),
    businessId
      ? supabase.from('social_posts')
          .select('id, headline, caption')
          .eq('business_id', businessId)
          .eq('is_featured', true)
          .eq('featured_date', new Date().toISOString().slice(0, 10))
          .eq('status', 'draft')
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const allInvoices: Invoice[] = invoices ?? [];
  const allProjects: Project[] = projects ?? [];
  const allProposals: Proposal[] = proposals ?? [];
  const allCalendarEvents = calendarEvents ?? [];

  const receivedThisMonth = allInvoices
    .filter(i => i.payment_status === 'paid' && i.paid_at && i.paid_at >= monthStart)
    .reduce((s, i) => s + Number(i.amount), 0);

  const outstanding = allInvoices
    .filter(i => i.payment_status === 'unpaid' && (i.status === 'sent' || i.status === 'overdue'))
    .reduce((s, i) => s + Number(i.amount), 0);

  const overdueInvoices = allInvoices.filter(i => i.status === 'overdue');
  const overdueTotal = overdueInvoices.reduce((s, i) => s + Number(i.amount), 0);

  const activeProjects = allProjects.filter(p => p.status === 'in_progress' || p.status === 'review').slice(0, 4);
  const viewedProposals = allProposals.filter(p => p.status === 'viewed').slice(0, 2);
  const pipelineLeadCount = (pipelineLeads ?? []).length;
  const proposalsSentThisMonth = allProposals.filter(p => p.sent_at && p.sent_at >= monthStart).length;

  const recentLeads = (pipelineLeads ?? [])
    .filter(l => !['Closed Won', 'Closed Lost'].includes(l.stage))
    .slice(0, 2)
    .map(l => ({
      name: l.contact_id ?? '—',
      value: l.value ? fmt(Number(l.value)) : null,
      stage: l.stage ?? 'Prospect',
    }));

  // Upcoming items (next 30d for projects, 14d for invoices/proposals)
  const upcoming: UpcomingItem[] = [];

  for (const p of allProjects.filter(p => p.deadline && p.status !== 'completed' && p.status !== 'archived')) {
    const d = daysUntil(p.deadline);
    if (d !== null && d <= 30) {
      upcoming.push({ label: p.name, sublabel: 'project deadline', date: p.deadline!, urgency: d < 0 ? 'overdue' : d <= 3 ? 'soon' : 'normal', route: '/dashboard/projects' });
    }
  }

  for (const inv of allInvoices.filter(i => i.payment_status === 'unpaid' && i.due_date)) {
    const d = daysUntil(inv.due_date);
    if (d !== null && d <= 14) {
      upcoming.push({ label: inv.client?.name ?? 'Invoice', sublabel: `${inv.invoice_number} due`, date: inv.due_date!, urgency: d < 0 ? 'overdue' : d <= 3 ? 'soon' : 'normal', route: '/dashboard/finances?tab=invoices' });
    }
  }

  for (const prop of allProposals.filter(p => p.expires_at && ['sent', 'viewed'].includes(p.status))) {
    const d = daysUntil(prop.expires_at);
    if (d !== null && d <= 14) {
      upcoming.push({ label: prop.client_name ?? prop.client?.name ?? 'Proposal', sublabel: 'proposal expires', date: prop.expires_at!, urgency: d < 0 ? 'overdue' : d <= 3 ? 'soon' : 'normal', route: '/dashboard/proposals' });
    }
  }

  for (const ev of allCalendarEvents as Array<{ id: string; title: string; event_type: string | null; start_time: string; client: { name: string } | null }>) {
    const d = daysUntil(ev.start_time);
    if (d !== null && d <= 14) {
      const time = new Date(ev.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      upcoming.push({
        label: ev.title,
        sublabel: ev.client?.name ? `${time} · ${ev.client.name}` : time,
        date: ev.start_time,
        urgency: d === 0 ? 'soon' : 'normal',
        route: '/dashboard/calendar',
      });
    }
  }

  upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // ── Analytics ──────────────────────────────────────────────────────────────
  const decidedProposals = allProposals.filter(p => p.status === 'accepted' || p.status === 'declined');
  const winRate = decidedProposals.length >= 2
    ? Math.round((allProposals.filter(p => p.status === 'accepted').length / decidedProposals.length) * 100)
    : null;

  const paidInvoices = allInvoices.filter(i => i.payment_status === 'paid');
  const avgProjectValue = paidInvoices.length >= 2
    ? paidInvoices.reduce((s, i) => s + Number(i.amount), 0) / paidInvoices.length
    : null;

  const projectsByClient = new Map<string, number>();
  for (const p of allProjects.filter(p => p.client_id)) {
    projectsByClient.set(p.client_id!, (projectsByClient.get(p.client_id!) ?? 0) + 1);
  }
  const repeatClientPct = projectsByClient.size >= 2
    ? Math.round(([...projectsByClient.values()].filter(c => c > 1).length / projectsByClient.size) * 100)
    : null;

  const allReviews = (reviews ?? []) as { rating: number }[];
  const reviewScore = allReviews.length > 0
    ? Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length) * 10) / 10
    : null;

  const projectsThisMonth = allProjects.filter(p => p.created_at >= monthStart).length;
  const projectsCompleted = allProjects.filter(p => p.status === 'completed').length;

  return {
    receivedThisMonth, outstanding, overdueTotal, activeProjects, viewedProposals,
    overdueInvoices, pipelineLeadCount, proposalsSentThisMonth, recentLeads,
    upcoming: upcoming.slice(0, 6),
    winRate, avgProjectValue, repeatClientPct,
    reviewScore, reviewCount: allReviews.length,
    portalVisits30d: portalVisits ?? 0,
    projectsThisMonth, projectsCompleted,
    featuredPromotion: featuredPromotionRow ?? null,
  };
}
