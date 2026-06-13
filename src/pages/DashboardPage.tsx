import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DollarSign,
  Users,
  FileText,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Sparkles,
  Zap,
  CreditCard,
  Crown,
  ChartBar,
  ArrowRight,
  X,
} from "lucide-react";

type ConfidenceLevel = 'high' | 'medium' | 'low';
interface ConfidenceMap {
  identity: ConfidenceLevel;
  services: ConfidenceLevel;
  pricing: ConfidenceLevel;
  location: ConfidenceLevel;
  niche: ConfidenceLevel;
  brand: ConfidenceLevel;
}
interface NudgeItem {
  priority: number;
  title: string;
  desc: string;
  action: string;
  route?: string;
  isCommandBar?: boolean;
  color: 'warning' | 'info';
}

function getNudgeItems(map: ConfidenceMap): NudgeItem[] {
  const items: NudgeItem[] = [];
  if (map.pricing === 'low') items.push({
    priority: 1,
    title: 'Add pricing to your services',
    desc: "Your services were extracted but no prices were found. Clients can't request a proposal without knowing your rates.",
    action: 'Add prices',
    route: '/dashboard/services',
    color: 'warning',
  });
  if (map.location === 'low') items.push({
    priority: 2,
    title: 'Tell us your location',
    desc: 'We estimated "Remote" — your public portfolio will be more trustworthy with a real city or region.',
    action: 'Add location',
    route: '/dashboard/settings',
    color: 'warning',
  });
  if (map.brand === 'low') items.push({
    priority: 3,
    title: 'Refine your brand colors',
    desc: 'We generated a color palette — but if you have brand colors in mind, update them in Brand Kit.',
    action: 'Open Brand Kit',
    route: '/dashboard/brand',
    color: 'info',
  });
  if (map.niche === 'low') items.push({
    priority: 4,
    title: 'Describe your ideal client',
    desc: 'Knowing your niche helps Forgefly generate better proposals and nudges.',
    action: 'Refine in command bar',
    isCommandBar: true,
    color: 'info',
  });
  return items.slice(0, 3);
}
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  TooltipProps,
} from "recharts";
import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type {
  Project,
  Task,
  Client,
  CashflowData,
  Payment,
} from "@/types/types";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useBusiness } from "@/contexts/CurrentBusinessContext";
import type { Business } from "@/hooks/useCurrentBusiness";

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-3">
      <div className="font-medium mb-2">{label}</div>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-medium">${Math.round(entry.value || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function invoiceStatusClass(status: string) {
  const s = status.toLowerCase();
  if (s === 'paid') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  if (s === 'outstanding' || s === 'unpaid') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  if (s === 'overdue') return 'bg-red-500/10 text-red-600 border-red-500/20';
  return 'bg-muted text-muted-foreground border-border';
}

function stageClass(stage: string) {
  const s = stage.toLowerCase();
  if (s === 'closed won') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  if (s === 'negotiating') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (s === 'proposal sent') return 'bg-violet-500/10 text-violet-600 border-violet-500/20';
  if (s === 'qualified') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  return 'bg-muted text-muted-foreground border-border';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { business, extractedData, isLoading: bizLoading } = useBusiness();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dbStats, setDbStats] = useState({
    totalRevenue: 0,
    activeClients: 0,
    pendingInvoices: 0,
    completionRate: 0,
  });
  const [cashflowData, setCashflowData] = useState<CashflowData[]>([]);
  const [whatIfMultiplier, setWhatIfMultiplier] = useState([1]);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeItems, setNudgeItems] = useState<NudgeItem[]>([]);
  const [mobileNudgeExpanded, setMobileNudgeExpanded] = useState(false);

  useEffect(() => {
    if (searchParams.get('upgrade') === 'success') {
      setShowUpgradeSuccess(true);
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (bizLoading || !business) return;
    const score = business.completeness_score ?? 0;
    const map = business.confidence_map as ConfidenceMap | null;
    if (score < 90 && map && localStorage.getItem('nudge_dismissed_' + business.id) !== 'true') {
      setNudgeItems(getNudgeItems(map));
      setShowNudge(true);
    }
  }, [business, bizLoading]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    const { data: projectsData } = await supabase
      .from("projects")
      .select("*, client:clients(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (projectsData) setProjects(projectsData);

    const { data: tasksData } = await supabase
      .from("tasks")
      .select("*, project:projects(*)")
      .eq("user_id", user.id)
      .eq("completed", false)
      .order("due_date", { ascending: true })
      .limit(5);
    if (tasksData) setTasks(tasksData);

    const { data: clientsData } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active");
    if (clientsData) setClients(clientsData);

    const { data: paymentsData } = await supabase
      .from("payments")
      .select("*, client:clients(name), invoice:invoices(invoice_number)")
      .eq("user_id", user.id)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(5);
    if (paymentsData) setPayments(paymentsData);

    const { data: allPaymentsData } = await supabase
      .from("payments")
      .select("amount, status")
      .eq("user_id", user.id)
      .eq("status", "succeeded");

    const { data: invoicesData } = await supabase
      .from("invoices")
      .select("amount, status, payment_status")
      .eq("user_id", user.id);

    const totalPaymentRevenue = allPaymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const paidInvoicesRevenue = invoicesData?.filter(i => i.payment_status === "paid").reduce((sum, i) => sum + (Number(i.amount) || 0), 0) || 0;
    const totalProjectRevenue = projectsData?.reduce((sum, p) => sum + (p.value || 0), 0) || 0;
    const totalRevenue = totalPaymentRevenue + paidInvoicesRevenue + totalProjectRevenue;
    const activeClients = clientsData?.length || 0;
    const pendingInvoices = invoicesData?.filter(i => i.payment_status === "unpaid" && (i.status === "sent" || i.status === "overdue")).reduce((sum, i) => sum + (Number(i.amount) || 0), 0) || 0;
    const completedProjects = projectsData?.filter(p => p.status === "completed").length || 0;
    const totalProjects = projectsData?.length || 1;
    const completionRate = Math.round((completedProjects / totalProjects) * 100);

    setDbStats({ totalRevenue, activeClients, pendingInvoices, completionRate });
    setCashflowData(generateCashflowData());
  };

  const generateCashflowData = (): CashflowData[] => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    return months
      .map((month, index) => ({
        month,
        income: 6000 + index * 400 + Math.random() * 1000,
        expenses: 3000 + Math.random() * 500,
        profit: 0,
      }))
      .map(d => ({ ...d, profit: d.income - d.expenses }));
  };

  const adjustedCashflowData = cashflowData.map(d => ({
    ...d,
    income: d.income * whatIfMultiplier[0],
    profit: d.income * whatIfMultiplier[0] - d.expenses,
  }));

  const handleTaskComplete = async (taskId: string) => {
    setCompletedTasks(prev => new Set(prev).add(taskId));
    await supabase.from("tasks").update({ completed: true }).eq("id", taskId);
    toast.success("Task completed!");
    setTimeout(() => { loadDashboardData(); }, 600);
  };

  const dismissNudge = () => {
    if (business) localStorage.setItem('nudge_dismissed_' + business.id, 'true');
    setShowNudge(false);
  };

  // Derived business OS data
  const identity = extractedData?.identity;
  const metrics = extractedData?.metrics;
  const hotLeads = [...(extractedData?.pipeline?.leads ?? [])]
    .sort((a, b) => {
      const order: Record<string, number> = { 'Closed Won': 0, 'Negotiating': 1, 'Proposal Sent': 2, 'Qualified': 3, 'Prospect': 4 };
      return (order[a.stage] ?? 5) - (order[b.stage] ?? 5);
    })
    .slice(0, 3);
  const recentInvoices = (extractedData?.invoices ?? []).slice(0, 3);
  const hasBusinessOS = !bizLoading && !!business;

  // Metric cards: use AI metrics when available, fall back to DB stats
  const metricCards = metrics
    ? [
        { label: 'Monthly Revenue', value: metrics.monthlyRevenue ?? '$0', icon: DollarSign, colorClass: 'border-l-emerald-500 bg-emerald-500/5', iconClass: 'text-emerald-600', hint: 'from your business OS' },
        { label: 'Active Clients', value: String(metrics.activeClients ?? 0), icon: Users, colorClass: 'border-l-blue-500 bg-blue-500/5', iconClass: 'text-blue-600', hint: 'from your business OS' },
        { label: 'Pipeline Value', value: metrics.pipelineValue ?? '$0', icon: ChartBar, colorClass: 'border-l-violet-500 bg-violet-500/5', iconClass: 'text-violet-600', hint: 'from your business OS' },
        { label: 'Avg Project Value', value: metrics.avgProjectValue ?? '$0', icon: TrendingUp, colorClass: 'border-l-amber-500 bg-amber-500/5', iconClass: 'text-amber-600', hint: 'from your business OS' },
      ]
    : [
        { label: 'Total Revenue', value: `$${Math.round(dbStats.totalRevenue).toLocaleString()}`, icon: DollarSign, colorClass: 'border-l-emerald-500', iconClass: 'text-success', hint: '↑ 12.5% from last month' },
        { label: 'Active Clients', value: String(dbStats.activeClients), icon: Users, colorClass: 'border-l-blue-500', iconClass: 'text-primary', hint: '+2 new this month' },
        { label: 'Pending Invoices', value: `$${Math.round(dbStats.pendingInvoices).toLocaleString()}`, icon: FileText, colorClass: 'border-l-amber-500', iconClass: 'text-warning', hint: 'awaiting payment' },
        { label: 'Completion Rate', value: `${dbStats.completionRate}%`, icon: TrendingUp, colorClass: 'border-l-accent', iconClass: 'text-accent', hint: 'project success rate' },
      ];

  return (
    <>
      <Dialog open={showUpgradeSuccess} onOpenChange={setShowUpgradeSuccess}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Crown className="w-8 h-8 text-yellow-500" />
              </div>
            </div>
            <DialogTitle className="text-2xl font-bold">Welcome to Agency!</DialogTitle>
            <DialogDescription className="text-base mt-2">
              You've unlocked the full power of Forgefly. Your agency plan is now active — unlimited clients, advanced AI, and priority support are all yours.
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
        </DialogContent>
      </Dialog>

      <div className="space-y-6 md:space-y-8">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">
              {identity?.businessName ?? identity?.name ?? 'Overview'}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {identity?.tagline ?? "Here's what's happening with your business today"}
            </p>
          </div>
          {!bizLoading && !business && (
            <Button
              size="lg"
              className="glow-accent w-full md:w-auto"
              onClick={() => navigate("/")}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Generate your Business OS
            </Button>
          )}
        </div>

        {/* ── Generate CTA banner (no business yet) ───────────────────── */}
        {!bizLoading && !business && (
          <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
              <div>
                <p className="font-semibold">Your Business OS isn't set up yet</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Describe your business in plain English and Forgefly generates your full OS in seconds.
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() => navigate("/")}
              >
                Generate now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Completion nudge banner ──────────────────────────────────── */}
        {showNudge && nudgeItems.length > 0 && business && (
          <>
            {/* Desktop */}
            <Card className="hidden md:block border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/10">
                  <div>
                    <p className="text-sm font-semibold">
                      Your portal is {business.completeness_score ?? 0}% complete
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="h-1.5 bg-muted rounded-full w-48">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all"
                          style={{ width: `${business.completeness_score ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {nudgeItems.length} thing{nudgeItems.length !== 1 ? 's' : ''} that would make it stronger
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={dismissNudge}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="divide-y divide-border/40">
                  {nudgeItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-xs"
                        onClick={() => {
                          if (item.route) navigate(item.route);
                          else if (item.isCommandBar) window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        {item.action}
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-3 text-xs text-muted-foreground">
                  Or use the command bar above to describe any changes
                </div>
              </CardContent>
            </Card>

            {/* Mobile — collapsed / expanded inline */}
            <div className="md:hidden">
              <button
                type="button"
                onClick={() => setMobileNudgeExpanded(v => !v)}
                className="w-full text-left px-4 py-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-sm font-medium flex items-center justify-between"
              >
                <span>Complete your profile ({business.completeness_score ?? 0}%)</span>
                <span className="text-muted-foreground text-xs">{mobileNudgeExpanded ? '▲' : '▼'}</span>
              </button>
              {mobileNudgeExpanded && (
                <div className="mt-2 space-y-2">
                  {nudgeItems.map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 px-4 py-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-xs"
                        onClick={() => {
                          if (item.route) navigate(item.route);
                          else if (item.isCommandBar) window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        {item.action}
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-end px-1">
                    <button type="button" onClick={dismissNudge} className="text-xs text-muted-foreground underline">
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Metric cards ─────────────────────────────────────────────── */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {metricCards.map(({ label, value, icon: Icon, colorClass, iconClass, hint }) => (
            <Card key={label} className={`card-hover border-l-4 ${colorClass}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${iconClass}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground mt-2">{hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Business OS snapshot (hot leads + recent invoices) ─────────── */}
        {hasBusinessOS && (hotLeads.length > 0 || recentInvoices.length > 0) && (
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Hot leads */}
            <Card className="card-hover">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Hot Leads</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs text-accent hover:text-accent" onClick={() => navigate('/dashboard/pipeline')}>
                    View pipeline →
                  </Button>
                </div>
                <CardDescription>Top pre-sales opportunities from your OS</CardDescription>
              </CardHeader>
              <CardContent>
                {hotLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No pipeline data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {hotLeads.map((lead, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{lead.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{lead.service}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{lead.value}</p>
                          <Badge variant="outline" className={`text-[10px] ${stageClass(lead.stage)}`}>
                            {lead.stage}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent invoices */}
            <Card className="card-hover">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Recent Invoices</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs text-accent hover:text-accent" onClick={() => navigate('/dashboard/invoices')}>
                    View all →
                  </Button>
                </div>
                <CardDescription>Latest invoices from your business OS</CardDescription>
              </CardHeader>
              <CardContent>
                {recentInvoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No invoices yet.</p>
                ) : (
                  <div className="space-y-3">
                    {recentInvoices.map((inv, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{inv.client}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {inv.service}{inv.number ? ` · ${inv.number}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{inv.amount}</p>
                          <Badge variant="outline" className={`text-[10px] ${invoiceStatusClass(inv.status)}`}>
                            {inv.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Cashflow chart ────────────────────────────────────────────── */}
        <Card className="card-hover glow-accent/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              <CardTitle className="text-balance">Predictive Cashflow</CardTitle>
            </div>
            <CardDescription>Forecast your income and expenses with what-if scenarios</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-8 p-4 rounded-lg bg-accent/5 border border-accent/20">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold">Income Multiplier</label>
                <span className="text-lg font-bold text-accent">{whatIfMultiplier[0].toFixed(1)}x</span>
              </div>
              <Slider value={whatIfMultiplier} onValueChange={setWhatIfMultiplier} min={0.5} max={2} step={0.1} className="w-full" />
              <p className="text-xs text-muted-foreground mt-3">
                Adjust to see how changes in client acquisition affect your cashflow
              </p>
            </div>
            <div className="w-full h-[250px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={adjustedCashflowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: 8 }} />
                  <Line type="monotone" dataKey="income" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Income" />
                  <Line type="monotone" dataKey="expenses" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Expenses" />
                  <Line type="monotone" dataKey="profit" stroke="hsl(var(--chart-3))" strokeWidth={2} name="Profit" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ── Active projects + tasks ───────────────────────────────────── */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          <Card className="card-hover">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-balance">Active Projects</CardTitle>
                <Link to="/dashboard/projects">
                  <Button variant="ghost" size="sm" className="text-accent hover:text-accent">View All →</Button>
                </Link>
              </div>
              <CardDescription>Projects currently in progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projects.slice(0, 4).map(project => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-muted/80 transition-colors cursor-pointer"
                    onClick={() => navigate("/dashboard/projects")}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{project.client?.name || "No client"}</p>
                    </div>
                    <Badge variant="outline" className={
                      project.status === 'in_progress' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      project.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      project.status === 'review' ? 'bg-violet-500/10 text-violet-600 border-violet-500/20' :
                      'bg-muted text-muted-foreground'
                    }>
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
                {projects.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8 text-pretty">
                    No active projects yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-balance">Today's Tasks</CardTitle>
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </div>
              <CardDescription>Upcoming tasks and deadlines</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasks.map(task => {
                  const isCompleted = completedTasks.has(task.id);
                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 p-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/80 transition-all ${isCompleted ? "animate-success" : ""}`}
                      onClick={() => !isCompleted && handleTaskComplete(task.id)}
                    >
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 transition-colors ${isCompleted ? "text-success" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                        {task.due_date && (
                          <p className="text-xs text-muted-foreground">Due: {new Date(task.due_date).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8 text-pretty">No pending tasks. You're all caught up!</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Recent payments ───────────────────────────────────────────── */}
        <Card className="card-hover">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-balance">Recent Payments</CardTitle>
                <CardDescription>Latest Stripe transactions</CardDescription>
              </div>
              <CreditCard className="w-5 h-5 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map(payment => (
                <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{payment.client?.name || "Unknown Client"}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.invoice?.invoice_number || "N/A"} · {new Date(payment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-semibold text-success">+${Math.round(payment.amount).toLocaleString()}</p>
                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">Paid</Badge>
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8 text-pretty">
                  No payments received yet. Start accepting payments with Stripe!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
