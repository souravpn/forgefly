import { fmt, type OverviewData, relativeDate } from '@/services/dashboardService';

// Every entry here MUST have a matching id in the KPI_CATALOG list inside
// supabase/functions/ai-gateway/index.ts (routeIntent's query-matching step)
// — the backend only ever returns an id from that list, and this file is what
// turns an id into an actual on-screen value + route. Keep both lists in sync
// by hand; the edge function can't import from src/.
export interface FreedaKpiEntry {
  id: string;
  label: string;
  description: string; // used by the backend matcher, kept here for reference
  route: string;
  routeLabel: string;
}

export const FREEDA_KPI_CATALOG: FreedaKpiEntry[] = [
  { id: 'cash_position', label: 'Cash position', description: 'revenue/money received this month, and how much is outstanding or overdue', route: '/dashboard/finances?tab=invoices', routeLabel: 'View invoices' },
  { id: 'overdue_invoices', label: 'Overdue invoices', description: 'which invoices are overdue and their amounts', route: '/dashboard/finances?tab=invoices', routeLabel: 'View invoices' },
  { id: 'active_projects', label: 'Active projects', description: 'which projects are currently in progress or in review', route: '/dashboard/projects', routeLabel: 'View projects' },
  { id: 'lead_momentum', label: 'Lead momentum', description: 'how many pipeline leads exist and how many proposals were sent this month', route: '/dashboard/leads', routeLabel: 'Open leads' },
  { id: 'upcoming', label: 'Upcoming', description: 'upcoming deadlines, invoice due dates, proposal expirations, or calendar events', route: '/dashboard/calendar', routeLabel: 'View calendar' },
  { id: 'win_rate', label: 'Win rate', description: 'percentage of proposals that were accepted', route: '/dashboard/proposals', routeLabel: 'View proposals' },
  { id: 'avg_project_value', label: 'Average project value', description: 'average revenue per project or per paid invoice, average deal size', route: '/dashboard/finances', routeLabel: 'View finances' },
  { id: 'repeat_client_rate', label: 'Repeat client rate', description: 'percentage of clients who hired again / repeat business', route: '/dashboard/clients', routeLabel: 'View clients' },
  { id: 'review_score', label: 'Review score', description: 'average client review rating and number of reviews', route: '/dashboard/reviews', routeLabel: 'View reviews' },
  { id: 'portfolio_funnel', label: 'Portfolio funnel', description: 'portfolio visits, proposals, and projects started in the last 30 days', route: '/dashboard/visibility', routeLabel: 'View visibility' },
];

export type FreedaKpiResult =
  | { kind: 'stat'; label: string; value: string; sublabel?: string; route: string; routeLabel: string }
  | { kind: 'stat-group'; label: string; stats: { value: string; caption: string }[]; route: string; routeLabel: string }
  | { kind: 'list'; label: string; items: { label: string; sublabel?: string }[]; emptyMessage: string; route: string; routeLabel: string };

export function resolveFreedaKpi(id: string, data: OverviewData): FreedaKpiResult | null {
  const entry = FREEDA_KPI_CATALOG.find(e => e.id === id);
  if (!entry) return null;
  const { route, routeLabel, label } = entry;

  switch (id) {
    case 'cash_position':
      return {
        kind: 'stat', label, value: fmt(data.receivedThisMonth), route, routeLabel,
        sublabel: data.overdueTotal > 0
          ? `${fmt(data.outstanding)} outstanding · ${fmt(data.overdueTotal)} overdue`
          : `${fmt(data.outstanding)} outstanding`,
      };

    case 'overdue_invoices':
      return {
        kind: 'list', label, route, routeLabel,
        emptyMessage: 'No overdue invoices right now.',
        items: data.overdueInvoices.map(inv => ({
          label: inv.client?.name ?? 'Invoice',
          sublabel: `${inv.invoice_number} · ${fmt(Number(inv.amount))}`,
        })),
      };

    case 'active_projects':
      return {
        kind: 'list', label, route, routeLabel,
        emptyMessage: 'No active projects right now.',
        items: data.activeProjects.map(p => ({
          label: p.name,
          sublabel: p.client?.name ?? 'No client',
        })),
      };

    case 'lead_momentum':
      return {
        kind: 'stat-group', label, route, routeLabel,
        stats: [
          { value: String(data.pipelineLeadCount), caption: 'leads' },
          { value: String(data.proposalsSentThisMonth), caption: 'proposals sent' },
        ],
      };

    case 'upcoming':
      return {
        kind: 'list', label, route, routeLabel,
        emptyMessage: 'Nothing on the horizon.',
        items: data.upcoming.map(u => ({
          label: u.label,
          sublabel: `${u.sublabel} · ${relativeDate(u.date)}`,
        })),
      };

    case 'win_rate':
      return {
        kind: 'stat', label, route, routeLabel,
        value: data.winRate != null ? `${data.winRate}%` : 'Not enough data yet',
        sublabel: data.winRate != null ? 'of decided proposals accepted' : 'Send a few more proposals first',
      };

    case 'avg_project_value':
      return {
        kind: 'stat', label, route, routeLabel,
        value: data.avgProjectValue != null ? fmt(data.avgProjectValue) : 'Not enough data yet',
        sublabel: data.avgProjectValue != null ? 'per paid invoice' : 'Needs at least 2 paid invoices',
      };

    case 'repeat_client_rate':
      return {
        kind: 'stat', label, route, routeLabel,
        value: data.repeatClientPct != null ? `${data.repeatClientPct}%` : 'Not enough data yet',
        sublabel: 'of clients who hired you again',
      };

    case 'review_score':
      return {
        kind: 'stat', label, route, routeLabel,
        value: data.reviewScore != null ? `★ ${data.reviewScore}` : 'No reviews yet',
        sublabel: data.reviewCount > 0 ? `${data.reviewCount} reviews` : undefined,
      };

    case 'portfolio_funnel':
      return {
        kind: 'stat-group', label, route, routeLabel,
        stats: [
          { value: String(data.portalVisits30d), caption: 'visits (30d)' },
          { value: String(data.proposalsSentThisMonth), caption: 'proposals' },
          { value: String(data.projectsThisMonth), caption: 'projects started' },
        ],
      };

    default:
      return null;
  }
}
