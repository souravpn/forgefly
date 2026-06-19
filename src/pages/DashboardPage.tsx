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
}

async function loadOverviewData(userId: string): Promise<OverviewData> {
  const monthStart = startOfMonth();

  const [
    { data: invoices },
    { data: projects },
    { data: proposals },
    { data: pipelineLeads },
  ] = await Promise.all([
    supabase.from("invoices").select("*, client:clients(name)").eq("user_id", userId),
    supabase.from("projects").select("*, client:clients(name)").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("proposals").select("*, client:clients(name)").eq("user_id", userId).order("updated_at", { ascending: false }),
    supabase.from("pipeline_leads").select("id, stage, value, contact_id").order("created_at", { ascending: false }),
  ]);

  const allInvoices: Invoice[] = invoices ?? [];
  const allProjects: Project[] = projects ?? [];
  const allProposals: Proposal[] = proposals ?? [];

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
      upcoming.push({ label: inv.client?.name ?? 'Invoice', sublabel: `${inv.invoice_number} due`, date: inv.due_date!, urgency: d < 0 ? 'overdue' : d <= 3 ? 'soon' : 'normal', route: '/dashboard/invoices' });
    }
  }

  for (const prop of allProposals.filter(p => p.expires_at && ['sent', 'viewed'].includes(p.status))) {
    const d = daysUntil(prop.expires_at);
    if (d !== null && d <= 14) {
      upcoming.push({ label: prop.client_name ?? prop.client?.name ?? 'Proposal', sublabel: 'proposal expires', date: prop.expires_at!, urgency: d < 0 ? 'overdue' : d <= 3 ? 'soon' : 'normal', route: '/dashboard/proposals' });
    }
  }

  upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { receivedThisMonth, outstanding, overdueTotal, activeProjects, viewedProposals, overdueInvoices, pipelineLeadCount, proposalsSentThisMonth, recentLeads, upcoming: upcoming.slice(0, 5) };
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
    if (user) loadOverviewData(user.id).then(setData);
  }, [user]);

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
      attentionItems.push({ label: inv.client?.name ?? 'Invoice', sublabel: `${inv.invoice_number} · ${fmt(Number(inv.amount))}`, badge: 'Overdue', badgeClass: 'bg-red-500/10 text-red-600 border-red-500/20', route: '/dashboard/invoices' });
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
              <DropdownMenuItem onClick={() => navigate('/dashboard/pipeline?action=new')}>
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
              <DropdownMenuItem onClick={() => navigate('/dashboard/invoices?action=new')}>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

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
                onClick={() => navigate('/dashboard/invoices')}
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

          {/* 3 — Quick win */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick win</CardTitle>
                <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {showMilestone ? (
                <MilestoneCard />
              ) : showNudge && nudgeContext ? (
                <QuickWinNudge businessId={business!.id} context={nudgeContext} />
              ) : milestonesComplete ? (
                <p className="text-sm text-muted-foreground text-center py-4 leading-relaxed text-pretty">
                  You're making progress. Check back in a few days.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {/* 4 — Active work */}
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

          {/* 5 — Pipeline momentum */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline momentum</CardTitle>
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
                onClick={() => navigate('/dashboard/pipeline')}
              >
                <span>Open pipeline</span>
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
      </div>
    </>
  );
}
