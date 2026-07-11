import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  DollarSign,
  Eye,
  FileText,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/CurrentBusinessContext";
import { MilestoneCard } from "@/components/common/MilestoneCard";
import { QuickWinNudge } from "@/components/common/QuickWinNudge";
import type { Invoice, Project, Proposal } from "@/types/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function relativeDate(dateStr: string | null): string {
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

interface UpcomingItem {
  label: string;
  sublabel: string;
  date: string;
  urgency: 'overdue' | 'soon' | 'normal';
  route: string;
}

interface OverviewData {
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

async function loadOverviewData(userId: string, businessId?: string): Promise<OverviewData> {
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
    supabase.from("invoices").select("*, client:clients(name)").eq("user_id", userId),
    supabase.from("projects").select("*, client:clients(name)").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("proposals").select("*, client:clients(name)").eq("user_id", userId).order("updated_at", { ascending: false }),
    supabase.from("pipeline_leads").select("id, stage, value, contact_id").order("created_at", { ascending: false }),
    businessId
      ? supabase.from("reviews").select("rating").eq("business_id", businessId).eq("portal_eligible", true)
      : Promise.resolve({ data: [] as { rating: number }[] }),
    businessId
      ? supabase.from("portal_events").select("id", { count: "exact", head: true }).eq("business_id", businessId).gte("created_at", thirtyDaysAgo)
      : Promise.resolve({ count: 0 }),
    supabase.from("calendar_events")
      .select("id, title, event_type, start_time, client:clients(name)")
      .eq("user_id", userId)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(15),
    businessId
      ? supabase.from("social_posts")
          .select("id, headline, caption")
          .eq("business_id", businessId)
          .eq("is_featured", true)
          .eq("featured_date", new Date().toISOString().slice(0, 10))
          .eq("status", "draft")
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

// ─── Styling helpers ──────────────────────────────────────────────────────────

function stageColor(stage: string) {
  const s = stage.toLowerCase();
  if (s === 'closed won') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  if (s === 'negotiating') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (s === 'proposal sent') return 'bg-violet-500/10 text-violet-600 border-violet-500/20';
  if (s === 'qualified') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  return 'bg-muted text-muted-foreground border-border';
}

function projectDot(status: string) {
  if (status === 'in_progress') return 'bg-amber-400';
  if (status === 'review') return 'bg-violet-400';
  return 'bg-muted-foreground';
}

function urgencyClass(u: UpcomingItem['urgency']) {
  if (u === 'overdue') return 'text-red-500';
  if (u === 'soon') return 'text-amber-500';
  return 'text-muted-foreground';
}

function milestonesAllDone(business: { onboarding_milestones?: { business_created: boolean; services_reviewed: boolean; portfolio_shared: boolean; prospect_added: boolean; proposal_sent: boolean } | null } | null) {
  const m = business?.onboarding_milestones;
  if (!m) return false;
  return m.business_created && m.services_reviewed && m.portfolio_shared && m.prospect_added && m.proposal_sent;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { business, extractedData, isLoading: bizLoading } = useBusiness();

  const [data, setData] = useState<OverviewData | null>(null);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get('upgrade') === 'success') {
      setShowUpgradeSuccess(true);
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (user) loadOverviewData(user.id, business?.id ?? undefined).then(setData);
  }, [user, business?.id]);

  const identity = extractedData?.identity;
  const milestonesComplete = !bizLoading && !!business && milestonesAllDone(business);
  const showMilestone = !bizLoading && !!business && !milestonesComplete;

  // #75 — visibility deferral: nudge unlocks after portfolio shared OR account > 3 days old
  const nudgeUnlocked = (() => {
    if (!business) return false;
    if (business.onboarding_milestones?.portfolio_shared) return true;
    const ageDays = (Date.now() - new Date(business.created_at).getTime()) / 86_400_000;
    return ageDays >= 3;
  })();

  const showNudge = milestonesComplete && nudgeUnlocked;

  // Context for AI nudge (#73)
  const nudgeContext = data && business ? {
    business_name: business.name,
    account_age_days: Math.floor((Date.now() - new Date(business.created_at).getTime()) / 86_400_000),
    received_this_month_usd: data.receivedThisMonth,
    outstanding_usd: data.outstanding,
    overdue_usd: data.overdueTotal,
    pipeline_lead_count: data.pipelineLeadCount,
    proposals_sent_this_month: data.proposalsSentThisMonth,
    days_since_last_proposal: data.proposalsSentThisMonth > 0 ? 0 : null,
    portfolio_shared: !!(business.onboarding_milestones?.portfolio_shared),
  } : null;

  // Merge viewed proposals + overdue invoices into attention items (max 4)
  const attentionItems: { label: string; sublabel: string; badge: string; badgeClass: string; route: string }[] = [];
  if (data) {
    for (const p of data.viewedProposals) {
      attentionItems.push({ label: p.client_name ?? p.client?.name ?? 'Proposal', sublabel: 'viewed your proposal', badge: 'Follow up', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20', route: '/dashboard/proposals' });
    }
    for (const inv of data.overdueInvoices.slice(0, 4 - attentionItems.length)) {
      attentionItems.push({ label: inv.client?.name ?? 'Invoice', sublabel: `${inv.invoice_number} · ${fmt(Number(inv.amount))}`, badge: 'Overdue', badgeClass: 'bg-red-500/10 text-red-600 border-red-500/20', route: '/dashboard/finances?tab=invoices' });
    }
  }

  return (
    <>
      <Dialog open={showUpgradeSuccess} onOpenChange={setShowUpgradeSuccess}>
        <DialogContent className="sm:max-w-md text-center">
          {showUpgradeSuccess && (
            <>
              <DialogHeader>
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <Crown className="w-8 h-8 text-yellow-500" />
                  </div>
                </div>
                <DialogTitle className="text-2xl font-bold">Welcome to Agency!</DialogTitle>
                <DialogDescription className="text-base mt-2">
                  You've unlocked the full power of Forgefly. Your agency plan is now active.
                </DialogDescription>
              </DialogHeader>
              <div className="my-4 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm text-muted-foreground">
                <p>A confirmation email is on its way to your inbox.</p>
              </div>
              <DialogFooter className="justify-center">
                <Button
                  className="w-full bg-gradient-to-r from-emerald-500 to-yellow-500 text-white font-semibold hover:opacity-90"
                  onClick={() => setShowUpgradeSuccess(false)}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Let's Go!
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-balance">
              {identity?.businessName ?? identity?.name ?? 'Overview'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {identity?.tagline ?? "Here's what's happening with your business"}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="shrink-0 gap-1.5">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => navigate('/dashboard/leads?action=new')}>
                <Users className="w-4 h-4 mr-2" />
                New prospect
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/dashboard/proposals?action=new')}>
                <FileText className="w-4 h-4 mr-2" />
                New proposal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/dashboard/clients?action=new')}>
                <Users className="w-4 h-4 mr-2" />
                New client
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/dashboard/projects?action=new')}>
                <Zap className="w-4 h-4 mr-2" />
                New project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/dashboard/finances?tab=invoices&action=new')}>
                <DollarSign className="w-4 h-4 mr-2" />
                New invoice
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/dashboard/services?action=new')}>
                <Eye className="w-4 h-4 mr-2" />
                New service
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Completeness checklist — shown when profile is < 100% complete */}
        {business && (business.completeness_score ?? 0) > 0 && (business.completeness_score ?? 100) < 100 && (() => {
          const score = business.completeness_score ?? 0;
          const cmap = (business.confidence_map ?? {}) as Record<string, string>;
          const SECTIONS = [
            { key: 'services',  label: 'Services & pricing',    tip: 'List your services with prices',   route: '/dashboard/services' },
            { key: 'brand',     label: 'Brand identity',         tip: 'Add colors, fonts, tone',          route: '/dashboard/brand' },
            { key: 'identity',  label: 'Business identity',      tip: 'Name, tagline, niche, location',   route: null },
            { key: 'location',  label: 'Location / market',      tip: 'Where you operate or serve',       route: null },
            { key: 'niche',     label: 'Niche & target clients', tip: 'Who you work with',                route: null },
          ] as const;
          const weak = SECTIONS.filter(s => cmap[s.key] === 'low' || !cmap[s.key]);
          if (weak.length === 0) return null;
          return (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-sm font-medium">Profile {score}% complete</p>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${score}%` }} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Strengthen these areas to improve proposals, brand kit, and AI accuracy:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {weak.map(s => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => s.route ? navigate(s.route) : null}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                          title={s.tip}
                        >
                          <span className="font-medium">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* ── Row 1: 2-col ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* 1 — Cash position */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cash position</CardTitle>
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-2xl font-bold text-emerald-600">{data ? fmt(data.receivedThisMonth) : '—'}</p>
                <p className="text-xs text-muted-foreground">received this month</p>
              </div>
              <div className="h-px bg-border" />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className={data && data.outstanding > 0 ? 'font-medium text-amber-600' : 'text-muted-foreground'}>
                    {data ? fmt(data.outstanding) : '—'}
                  </span>
                </div>
                {data && data.overdueTotal > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      Overdue
                    </span>
                    <span className="font-medium text-red-600">{fmt(data.overdueTotal)}</span>
                  </div>
                )}
                {data && data.receivedThisMonth > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                    <span>Tax-aside (25%)</span>
                    <span>{fmt(data.receivedThisMonth * 0.25)}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => navigate('/dashboard/finances?tab=invoices')}
              >
                <span>View invoices</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </CardContent>
          </Card>

          {/* 2 — Needs attention */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Needs attention</CardTitle>
                <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {attentionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-pretty leading-relaxed py-4">
                  All clear. Nothing needs your attention right now. Enjoy it while it lasts.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {attentionItems.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full flex items-center justify-between gap-3 text-left hover:bg-muted/50 rounded-md p-1.5 -mx-1.5 transition-colors"
                      onClick={() => navigate(item.route)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${item.badgeClass}`}>
                        {item.badge}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* ── Quick win row card ────────────────────────────────────────────── */}
        {(showMilestone || (showNudge && nudgeContext) || milestonesComplete) && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-end gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              Quick Wins
            </div>
            {showMilestone ? (
              <MilestoneCard />
            ) : showNudge && nudgeContext ? (
              <QuickWinNudge businessId={business!.id} context={nudgeContext} />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                You're making progress. Check back in a few days.
              </p>
            )}
          </div>
        )}

        {/* ── Featured promotion row ──────────────────────────────────────── */}
        {data?.featuredPromotion && (
          <button
            type="button"
            onClick={() => navigate("/dashboard/social")}
            className="promo-glow-border relative w-full text-left rounded-lg p-4 overflow-hidden bg-gradient-to-r from-fuchsia-500/10 via-purple-500/10 to-pink-500/10"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-fuchsia-500 uppercase tracking-wide mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Featured promotion ready
                </div>
                <p className="text-sm font-medium truncate">
                  {data.featuredPromotion.headline || data.featuredPromotion.caption}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-fuchsia-500">
                Review &amp; publish →
              </span>
            </div>
          </button>
        )}

        {/* ── Row 2: 3-col ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Active work */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active work</CardTitle>
                <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {!data || data.activeProjects.length === 0 ? (
                <div className="py-4 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">No active projects yet.</p>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate('/dashboard/projects')}>
                    Start a project
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.activeProjects.map(p => {
                    const d = daysUntil(p.deadline);
                    const dueSoon = d !== null && d >= 0 && d <= 5;
                    const overdue = d !== null && d < 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full flex items-center gap-2.5 text-left hover:bg-muted/50 rounded-md p-1.5 -mx-1.5 transition-colors"
                        onClick={() => navigate('/dashboard/projects')}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${projectDot(p.status)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.client?.name ?? 'No client'}</p>
                        </div>
                        {(dueSoon || overdue) && (
                          <span className={`text-[10px] font-medium shrink-0 ${overdue ? 'text-red-500' : 'text-amber-500'}`}>
                            {overdue ? `${Math.abs(d!)}d over` : `${d}d`}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                    onClick={() => navigate('/dashboard/projects')}
                  >
                    <span>View all projects</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5 — Lead momentum */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lead momentum</CardTitle>
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                  <p className="text-xl font-bold">{data?.pipelineLeadCount ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">leads</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                  <p className="text-xl font-bold">{data?.proposalsSentThisMonth ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">proposals sent</p>
                </div>
              </div>
              {data && data.recentLeads.length > 0 ? (
                <div className="space-y-1.5">
                  {data.recentLeads.map((lead, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Users className="w-3 h-3 text-muted-foreground shrink-0" />
                        <p className="text-xs font-medium truncate">{lead.name}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {lead.value && <span className="text-xs text-muted-foreground">{lead.value}</span>}
                        <Badge variant="outline" className={`text-[10px] ${stageColor(lead.stage)}`}>{lead.stage}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-pretty leading-relaxed">
                  No prospects yet. Add someone you'd love to work with — even a long shot counts.
                </p>
              )}
              <button
                type="button"
                className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => navigate('/dashboard/leads')}
              >
                <span>Open leads</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </CardContent>
          </Card>

          {/* 6 — Upcoming */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upcoming</CardTitle>
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold mt-1">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </CardHeader>
            <CardContent>
              {!data || data.upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nothing on the horizon.</p>
              ) : (
                <div className="space-y-2">
                  {data.upcoming.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full flex items-center gap-2.5 text-left hover:bg-muted/50 rounded-md p-1.5 -mx-1.5 transition-colors"
                      onClick={() => navigate(item.route)}
                    >
                      <Clock className={`w-3.5 h-3.5 shrink-0 ${urgencyClass(item.urgency)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
                      </div>
                      <span className={`text-[10px] font-medium shrink-0 ${urgencyClass(item.urgency)}`}>
                        {relativeDate(item.date)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* ── Analytics chips row ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Win rate */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Win Rate</p>
              <p className="text-2xl font-bold">
                {data?.winRate != null ? `${data.winRate}%` : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">proposals accepted</p>
            </CardContent>
          </Card>

          {/* Avg project value */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Avg Deal</p>
              <p className="text-2xl font-bold">
                {data?.avgProjectValue != null ? fmt(data.avgProjectValue) : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">per paid invoice</p>
            </CardContent>
          </Card>

          {/* Repeat client rate */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Repeat Clients</p>
              <p className="text-2xl font-bold">
                {data?.repeatClientPct != null ? `${data.repeatClientPct}%` : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">clients who returned</p>
            </CardContent>
          </Card>

          {/* Review score */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Review Score</p>
              <p className="text-2xl font-bold">
                {data?.reviewScore != null ? `★ ${data.reviewScore}` : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {data?.reviewCount ? `${data.reviewCount} reviews` : 'no reviews yet'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Portal funnel row card ────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Portfolio funnel · last 30 days</CardTitle>
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Visits */}
              <div className="flex flex-col items-center px-5 py-3 rounded-xl bg-muted/40 min-w-[90px]">
                <p className="text-2xl font-bold">{data?.portalVisits30d ?? '—'}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">visits</p>
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />

              {/* Proposals */}
              <div className="flex flex-col items-center px-5 py-3 rounded-xl bg-muted/40 min-w-[90px]">
                <p className="text-2xl font-bold">{data?.proposalsSentThisMonth ?? '—'}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">proposals</p>
                {data && data.portalVisits30d > 0 && data.proposalsSentThisMonth > 0 && (
                  <p className="text-[10px] text-primary font-medium mt-1">
                    {Math.round((data.proposalsSentThisMonth / data.portalVisits30d) * 100)}% cvr
                  </p>
                )}
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />

              {/* Projects */}
              <div className="flex flex-col items-center px-5 py-3 rounded-xl bg-muted/40 min-w-[90px]">
                <p className="text-2xl font-bold">{data?.projectsThisMonth ?? '—'}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">projects started</p>
                {data && data.proposalsSentThisMonth > 0 && data.projectsThisMonth > 0 && (
                  <p className="text-[10px] text-primary font-medium mt-1">
                    {Math.round((data.projectsThisMonth / data.proposalsSentThisMonth) * 100)}% close
                  </p>
                )}
              </div>

              <div className="ml-auto pl-4 text-right hidden sm:block">
                <p className="text-xs text-muted-foreground">All-time completed</p>
                <p className="text-lg font-semibold">{data?.projectsCompleted ?? '—'} projects</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  );
}
