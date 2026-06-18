import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Trash2, Car, Users, Receipt, TrendingUp, TrendingDown,
  AlertTriangle, Clock, BarChart3, FileDown, DollarSign, ScanLine, Loader2,
  Link2, Unplug, RefreshCw, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, TooltipProps } from 'recharts';
import type {
  Transaction,
  MileageLog,
  ContractorPayment,
  ExpenseCategory,
} from '@/types/types';
import {
  getExpenseCategories,
  getTransactions,
  createTransaction,
  deleteTransaction,
  getMileageLogs,
  createMileageLog,
  deleteMileageLog,
  getContractorPayments,
  createContractorPayment,
  updateContractorW9,
  deleteContractorPayment,
} from '@/services/financeService';
import { supabase } from '@/db/supabase';
import { useBusiness } from '@/contexts/CurrentBusinessContext';
import { getTimeEntries, getProjectTimeSummaries } from '@/services/timeService';
import { getProjects } from '@/services/projectService';
import LogTimeDialog from '@/components/common/LogTimeDialog';

// ─── Cashflow chart tooltip ───────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-3">
      <div className="font-medium mb-2">{label}</div>
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-medium">${entry.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function fmtSyncAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Contractor summary (group by contractor_name for the current year) ───────

interface ContractorSummary {
  name: string;
  email: string | null;
  ytd: number;
  threshold_flag: boolean;
  w9_on_file: boolean;
  ids: string[];
}

function buildContractorSummaries(rows: ContractorPayment[]): ContractorSummary[] {
  const map = new Map<string, ContractorSummary>();
  for (const row of rows) {
    const key = row.contractor_name.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.ids.push(row.id);
    } else {
      map.set(key, {
        name: row.contractor_name,
        email: row.contractor_email,
        ytd: row.ytd_total ?? row.amount,
        threshold_flag: row.threshold_flag,
        w9_on_file: row.w9_on_file,
        ids: [row.id],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.ytd - a.ytd);
}

// ─── P&L helpers ─────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface MonthlyBar { month: string; income: number; expenses: number; }

function buildMonthlyBars(transactions: Transaction[], year: number): MonthlyBar[] {
  const data = MONTH_LABELS.map(m => ({ month: m, income: 0, expenses: 0 }));
  for (const t of transactions) {
    if (t.tax_year !== year) continue;
    const idx = new Date(t.transaction_date + 'T12:00:00').getMonth();
    if (t.type === 'income') data[idx].income += t.amount;
    else data[idx].expenses += t.amount;
  }
  return data;
}

interface CatRow { name: string; amount: number; pct: number; isMeals: boolean; }

function buildCategoryBreakdown(expenses: Transaction[]): CatRow[] {
  const map = new Map<string, { amount: number; isMeals: boolean }>();
  let total = 0;
  for (const e of expenses) {
    const name = e.expense_category?.name ?? 'Uncategorized';
    const isMeals = name === 'Meals with clients';
    const cur = map.get(name);
    if (cur) cur.amount += e.amount;
    else map.set(name, { amount: e.amount, isMeals });
    total += e.amount;
  }
  return Array.from(map.entries())
    .map(([name, { amount, isMeals }]) => ({ name, amount, pct: total > 0 ? (amount / total) * 100 : 0, isMeals }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);
}

interface NineteenNinetyNineRow { label: string; ytd: number; }

function build1099Rows(income: Transaction[], contactNames: Record<string, string>): NineteenNinetyNineRow[] {
  const map = new Map<string, number>();
  for (const t of income) {
    const key = t.client_id ?? `desc:${t.description}`;
    const name = t.client_id
      ? (contactNames[t.client_id] ?? t.description?.split('—')[1]?.trim() ?? 'Unknown')
      : (t.description?.split('—')[1]?.trim() ?? 'Unknown');
    map.set(key, (map.get(key) ?? 0) + t.amount);
    // Store name alongside
    if (!contactNames[key]) contactNames[key] = name;
  }
  return Array.from(map.entries())
    .map(([key, ytd]) => ({ label: contactNames[key] ?? key, ytd }))
    .filter(r => r.ytd > 0)
    .sort((a, b) => b.ytd - a.ytd);
}

function groupIncomeByMonth(income: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const t of income) {
    const key = t.transaction_date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
}

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ─── Tax engine ──────────────────────────────────────────────────────────────

type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh';

const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: 'Single',
  mfj: 'Married Filing Jointly',
  mfs: 'Married Filing Separately',
  hoh: 'Head of Household',
};

const STD_DEDUCTIONS: Record<FilingStatus, number> = {
  single: 14600,
  mfj: 29200,
  mfs: 14600,
  hoh: 21900,
};

// [upperBound, rate] — rate applies from previous cap to upperBound
const BRACKETS: Record<FilingStatus, [number, number][]> = {
  single: [[11600,0.10],[47150,0.12],[100525,0.22],[191950,0.24],[243725,0.32],[609350,0.35],[Infinity,0.37]],
  mfj:    [[23200,0.10],[94300,0.12],[201050,0.22],[383900,0.24],[487450,0.32],[731200,0.35],[Infinity,0.37]],
  mfs:    [[11600,0.10],[47150,0.12],[100525,0.22],[191950,0.24],[243725,0.32],[365600,0.35],[Infinity,0.37]],
  hoh:    [[16550,0.10],[63100,0.12],[100500,0.22],[191950,0.24],[243700,0.32],[609350,0.35],[Infinity,0.37]],
};

function calcBracketTax(income: number, status: FilingStatus): number {
  if (income <= 0) return 0;
  let tax = 0, prev = 0;
  for (const [cap, rate] of BRACKETS[status]) {
    if (income <= prev) break;
    tax += (Math.min(income, cap) - prev) * rate;
    prev = cap;
  }
  return tax;
}

function marginalRate(taxableIncome: number, status: FilingStatus): number {
  let prev = 0, mr = BRACKETS[status][0][1];
  for (const [cap, rate] of BRACKETS[status]) {
    mr = rate;
    if (taxableIncome <= cap) break;
    prev = cap;
  }
  return mr;
}

interface TaxCalc {
  totalDeductibleExpenses: number;
  homeOfficeDeduction: number;
  netProfit: number;
  seTax: number;
  seDeduction: number;
  standardDeduction: number;
  taxableIncome: number;
  estimatedIncomeTax: number;
  totalTax: number;
  effectiveRate: number;
  safeHarbor: number;
  quarterlyPayment: number;
  sepIraMax: number;
  sepIraSavings: number;
}

function computeTax(
  grossIncome: number,
  expenseTotal: number,
  mealsTotal: number,
  mileageDeduction: number,
  sqft: number,
  status: FilingStatus,
  priorYearLiability: number,
): TaxCalc {
  const homeOfficeDeduction = Math.min(sqft, 300) * 5;
  const deductible = (expenseTotal - mealsTotal) + mealsTotal * 0.5 + mileageDeduction + homeOfficeDeduction;
  const netProfit = Math.max(0, grossIncome - deductible);
  const seAdj = netProfit * 0.9235;
  const seTax = seAdj * 0.153;
  const seDeduction = seTax * 0.5;
  const stdDed = STD_DEDUCTIONS[status];
  const taxableIncome = Math.max(0, netProfit - seDeduction - stdDed);
  const incomeTax = calcBracketTax(taxableIncome, status);
  const totalTax = seTax + incomeTax;
  const effectiveRate = grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0;
  const safeHarbor = priorYearLiability > 0
    ? Math.min(totalTax * 0.90, priorYearLiability)
    : totalTax * 0.90;
  const sepIraMax = Math.min(netProfit * 0.25, 69000);
  const mr = marginalRate(taxableIncome, status);
  return {
    totalDeductibleExpenses: deductible,
    homeOfficeDeduction,
    netProfit,
    seTax,
    seDeduction,
    standardDeduction: stdDed,
    taxableIncome,
    estimatedIncomeTax: incomeTax,
    totalTax,
    effectiveRate,
    safeHarbor,
    quarterlyPayment: safeHarbor / 4,
    sepIraMax,
    sepIraSavings: sepIraMax * mr,
  };
}

function quarterlyDueDates(year: number): { label: string; date: Date; quarter: string }[] {
  return [
    { label: 'Q1', quarter: `Jan–Mar ${year}`,   date: new Date(year, 3, 15) },
    { label: 'Q2', quarter: `Apr–May ${year}`,   date: new Date(year, 5, 15) },
    { label: 'Q3', quarter: `Jun–Aug ${year}`,   date: new Date(year, 8, 15) },
    { label: 'Q4', quarter: `Sep–Dec ${year}`,   date: new Date(year + 1, 0, 15) },
  ];
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function toCsv(rows: string[][]): string {
  return rows.map(r =>
    r.map(cell => {
      const s = String(cell ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(',')
  ).join('\n');
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function buildIncomeCsv(transactions: import('@/types/types').Transaction[]): string {
  const header = ['Date', 'Amount', 'Client', 'Description', 'Invoice #'];
  const rows = transactions
    .filter(t => t.type === 'income')
    .map(t => [
      t.transaction_date ?? t.created_at?.slice(0, 10) ?? '',
      String(t.amount),
      t.client_id ?? '',
      t.description ?? '',
      t.invoice_id ?? '',
    ]);
  return toCsv([header, ...rows]);
}

function buildExpenseCsv(transactions: import('@/types/types').Transaction[]): string {
  const header = ['Date', 'Vendor', 'Amount', 'Category', 'Description', 'Recurring'];
  const rows = transactions
    .filter(t => t.type === 'expense')
    .map(t => [
      t.transaction_date ?? '',
      t.vendor ?? '',
      String(t.amount),
      (t.expense_category as { name?: string } | null)?.name ?? '',
      t.description ?? '',
      t.is_recurring ? 'Yes' : 'No',
    ]);
  return toCsv([header, ...rows]);
}

function buildMileageCsv(logs: import('@/types/types').MileageLog[]): string {
  const header = ['Date', 'Miles', 'Purpose', 'IRS Rate', 'Deduction'];
  const rows = logs.map(m => [
    m.trip_date,
    String(m.miles),
    m.purpose,
    String(m.irs_rate),
    String(m.deductible_amount),
  ]);
  return toCsv([header, ...rows]);
}

// ─── FinancesPage ─────────────────────────────────────────────────────────────

export default function FinancesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'overview';
  const { business, refetch: refetchBusiness } = useBusiness();

  // Toggl connection state — derived early so effects can reference them
  const togglExtracted = (business?.extracted_data as Record<string, unknown> | null);
  const togglWorkspaceName = togglExtracted?.toggl_workspace_name as string | undefined;
  const togglLastSyncedAt = togglExtracted?.toggl_last_synced_at as string | undefined;
  const togglUnmappedProjects = (togglExtracted?.toggl_unmapped_projects as string[] | undefined) ?? [];
  const togglConnected = !!togglWorkspaceName;

  function setTab(tab: string) {
    setSearchParams({ tab });
  }

  // ── Expenses state ──
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [mileageLogs, setMileageLogs] = useState<MileageLog[]>([]);
  const [contractors, setContractors] = useState<ContractorPayment[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Expense form ──
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    vendor: '',
    amount: '',
    transaction_date: today(),
    expense_category_id: '',
    description: '',
    notes: '',
    is_recurring: false,
    recurrence_rule: '' as '' | 'monthly' | 'annual',
  });
  const [savingExpense, setSavingExpense] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [receiptExtracted, setReceiptExtracted] = useState(false);
  const [extractedReceiptJson, setExtractedReceiptJson] = useState<string | null>(null);
  const receiptFileRef = useRef<HTMLInputElement>(null);

  // ── Mileage form ──
  const [mileageDialogOpen, setMileageDialogOpen] = useState(false);
  const [mileageForm, setMileageForm] = useState({
    trip_date: today(),
    miles: '',
    purpose: '',
    irs_rate: '0.670',
  });
  const [savingMileage, setSavingMileage] = useState(false);
  const [deleteMileageId, setDeleteMileageId] = useState<string | null>(null);

  // ── Contractor form ──
  const [contractorDialogOpen, setContractorDialogOpen] = useState(false);
  const [contractorForm, setContractorForm] = useState({
    contractor_name: '',
    contractor_email: '',
    payment_date: today(),
    amount: '',
    description: '',
    w9_on_file: false,
  });
  const [savingContractor, setSavingContractor] = useState(false);
  const [deleteContractorId, setDeleteContractorId] = useState<string | null>(null);


  // ── Overview / Income P&L state ──
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [prevYearTransactions, setPrevYearTransactions] = useState<Transaction[]>([]);
  const [unpaidInvoiceTotal, setUnpaidInvoiceTotal] = useState(0);
  const [unpaidInvoiceCount, setUnpaidInvoiceCount] = useState(0);
  const [contactNameMap, setContactNameMap] = useState<Record<string, string>>({});
  const [loadingOverview, setLoadingOverview] = useState(false);

  // ── Tax settings state ──
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  const [homeOfficeSqft, setHomeOfficeSqft] = useState('');
  const [priorYearLiability, setPriorYearLiability] = useState('');
  const [savingTaxSettings, setSavingTaxSettings] = useState(false);

  // ── Time tracking state ──
  const [timeEntries, setTimeEntries] = useState<import('@/types/types').TimeEntry[]>([]);
  const [timeSummaries, setTimeSummaries] = useState<import('@/services/timeService').ProjectTimeSummary[]>([]);
  const [loadingTime, setLoadingTime] = useState(false);
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [allProjects, setAllProjects] = useState<import('@/types/types').Project[]>([]);

  // ── Toggl state ──
  const [togglConnectOpen, setTogglConnectOpen] = useState(false);
  const [togglTokenInput, setTogglTokenInput] = useState('');
  const [togglConnecting, setTogglConnecting] = useState(false);
  const [togglDisconnecting, setTogglDisconnecting] = useState(false);
  const [togglMappingOpen, setTogglMappingOpen] = useState(false);
  const [togglProjects, setTogglProjects] = useState<{ id: number; name: string }[]>([]);
  // key = toggl project name, value = forgefly project id | '__skip__' | '' (unmapped)
  const [togglMappings, setTogglMappings] = useState<Record<string, string>>({});
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [togglSyncing, setTogglSyncing] = useState(false);
  const [togglBannerDismissed, setTogglBannerDismissed] = useState(false);

  // ── Export state ──
  const [accountantEmail, setAccountantEmail] = useState('');
  const [sendingToAccountant, setSendingToAccountant] = useState(false);

  const loadExpensesData = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, txns, miles, contrs] = await Promise.all([
        getExpenseCategories(),
        getTransactions(CURRENT_YEAR),
        getMileageLogs(CURRENT_YEAR),
        getContractorPayments(CURRENT_YEAR),
      ]);
      setExpenseCategories(cats);
      setExpenses(txns.filter(t => t.type === 'expense'));
      setMileageLogs(miles);
      setContractors(contrs);
    } catch {
      toast.error('Failed to load finances data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'expenses') loadExpensesData();
  }, [activeTab, loadExpensesData]);

  const loadOverviewData = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [curr, prev, invResult] = await Promise.all([
        getTransactions(selectedYear),
        getTransactions(selectedYear - 1),
        supabase
          .from('invoices')
          .select('amount')
          .in('payment_status', ['unpaid', 'processing']),
      ]);
      setAllTransactions(curr);
      setPrevYearTransactions(prev);

      const invRows = (invResult.data ?? []) as { amount: number }[];
      setUnpaidInvoiceTotal(invRows.reduce((s, r) => s + r.amount, 0));
      setUnpaidInvoiceCount(invRows.length);

      // Resolve contact names for 1099 tracker
      const clientIds = [...new Set(curr.filter(t => t.client_id).map(t => t.client_id!))] ;
      if (clientIds.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, name')
          .in('id', clientIds);
        if (contacts) {
          setContactNameMap(Object.fromEntries(contacts.map(c => [c.id, c.name])));
        }
      }
    } catch {
      toast.error('Failed to load overview data');
    } finally {
      setLoadingOverview(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'income' || activeTab === 'tax' || activeTab === 'export') loadOverviewData();
  }, [activeTab, selectedYear, loadOverviewData]);

  useEffect(() => {
    if (activeTab === 'tax' || activeTab === 'export') loadExpensesData();
  }, [activeTab, loadExpensesData]);

  // Load tax settings from business extracted_data
  useEffect(() => {
    if (!business?.extracted_data) return;
    const ts = (business.extracted_data as Record<string, unknown>).tax_settings as Record<string, unknown> | undefined;
    if (!ts) return;
    if (ts.filing_status) setFilingStatus(ts.filing_status as FilingStatus);
    if (ts.home_office_sqft != null) setHomeOfficeSqft(String(ts.home_office_sqft));
    if (ts.prior_year_liability != null) setPriorYearLiability(String(ts.prior_year_liability));
  }, [business]);

  async function saveTaxSettings() {
    if (!business) return;
    setSavingTaxSettings(true);
    try {
      const existing = (business.extracted_data ?? {}) as Record<string, unknown>;
      await supabase
        .from('businesses')
        .update({
          extracted_data: {
            ...existing,
            tax_settings: {
              filing_status: filingStatus,
              home_office_sqft: parseFloat(homeOfficeSqft) || 0,
              prior_year_liability: parseFloat(priorYearLiability) || 0,
            },
          },
        })
        .eq('id', business.id);
      toast.success('Tax settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSavingTaxSettings(false);
    }
  }

  const loadTimeData = useCallback(async () => {
    setLoadingTime(true);
    try {
      const [entries, summaries, projs] = await Promise.all([
        getTimeEntries(selectedYear),
        getProjectTimeSummaries(selectedYear),
        getProjects(),
      ]);
      setTimeEntries(entries);
      setTimeSummaries(summaries);
      setAllProjects(projs);
    } catch {
      toast.error('Failed to load time entries');
    } finally {
      setLoadingTime(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (activeTab === 'time') loadTimeData();
  }, [activeTab, loadTimeData]);

  // Re-show banner when unmapped list is refreshed after a sync
  useEffect(() => {
    if (togglUnmappedProjects.length > 0) setTogglBannerDismissed(false);
  }, [togglUnmappedProjects.length]);

  // ── Export helpers ──
  function openPrintReport() {
    const year = selectedYear;
    const bizName = business?.name ?? 'My Business';
    const incRows = allTransactions.filter(t => t.type === 'income');
    const expRows = allTransactions.filter(t => t.type === 'expense');
    const gross = incRows.reduce((s, t) => s + t.amount, 0);
    const totalExp = expRows.reduce((s, t) => s + t.amount, 0);
    const net = gross - totalExp;
    const mileTotal = mileageLogs.reduce((s, m) => s + m.deductible_amount, 0);

    const incomeTable = incRows.map(t =>
      `<tr><td>${t.transaction_date ?? ''}</td><td>${t.description ?? ''}</td><td style="text-align:right">$${t.amount.toLocaleString()}</td></tr>`
    ).join('');

    const expTable = expRows.map(t =>
      `<tr><td>${t.transaction_date ?? ''}</td><td>${(t.expense_category as { name?: string } | null)?.name ?? ''}</td><td>${t.vendor ?? ''}</td><td>${t.description ?? ''}</td><td style="text-align:right">$${t.amount.toLocaleString()}</td></tr>`
    ).join('');

    const mileTable = mileageLogs.map(m =>
      `<tr><td>${m.trip_date}</td><td>${m.miles} mi</td><td>${m.purpose}</td><td style="text-align:right">$${m.deductible_amount.toFixed(2)}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${year} Financial Report — ${bizName}</title>
<style>
body{font-family:system-ui,sans-serif;color:#111;padding:40px;max-width:900px;margin:0 auto}
h1{font-size:24px;margin-bottom:4px}
h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
.kpi{display:flex;gap:40px;margin:16px 0;padding:16px;background:#f9fafb;border-radius:8px}
.kpi div{text-align:center}.kpi .label{font-size:12px;color:#6b7280}.kpi .value{font-size:20px;font-weight:700;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#f3f4f6;text-align:left;padding:6px 8px;font-size:12px;color:#374151}
td{padding:5px 8px;border-bottom:1px solid #f3f4f6}
.footer{margin-top:40px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;text-align:center}
@media print{body{padding:20px}.footer{position:fixed;bottom:0;width:100%}}
</style></head><body>
<h1>${year} Financial Report</h1>
<p style="color:#6b7280;margin:0">${bizName} · Generated ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</p>
<div class="kpi">
  <div><div class="label">Gross Income</div><div class="value">$${gross.toLocaleString()}</div></div>
  <div><div class="label">Total Expenses</div><div class="value">$${totalExp.toLocaleString()}</div></div>
  <div><div class="label">Net Profit</div><div class="value">$${net.toLocaleString()}</div></div>
  <div><div class="label">Mileage Deduction</div><div class="value">$${mileTotal.toFixed(0)}</div></div>
</div>
<h2>Income (${incRows.length} transactions)</h2>
<table><thead><tr><th>Date</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
<tbody>${incomeTable || '<tr><td colspan="3" style="color:#9ca3af">No income transactions</td></tr>'}</tbody></table>
<h2>Expenses (${expRows.length} transactions)</h2>
<table><thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
<tbody>${expTable || '<tr><td colspan="5" style="color:#9ca3af">No expense transactions</td></tr>'}</tbody></table>
<h2>Mileage Log (${mileageLogs.length} trips)</h2>
<table><thead><tr><th>Date</th><th>Miles</th><th>Purpose</th><th style="text-align:right">Deduction</th></tr></thead>
<tbody>${mileTable || '<tr><td colspan="4" style="color:#9ca3af">No mileage logs</td></tr>'}</tbody></table>
<div class="footer">Generated by Forgefly · For informational purposes only · Consult a qualified tax professional before filing.</div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  async function handleSendToAccountant() {
    if (!accountantEmail || !business) return;
    setSendingToAccountant(true);
    try {
      const year = selectedYear;
      const incomeCsv = buildIncomeCsv(allTransactions);
      const expenseCsv = buildExpenseCsv(allTransactions);
      const mileageCsv = buildMileageCsv(mileageLogs);

      const toBase64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          type: 'accountant_export',
          to: accountantEmail,
          data: {
            businessName: business.name ?? 'My Business',
            year,
            freelancerName: business.name ?? 'Your client',
            downloadNote: '',
          },
          attachments: [
            { filename: `${year}_income.csv`,  content: toBase64(incomeCsv) },
            { filename: `${year}_expenses.csv`, content: toBase64(expenseCsv) },
            { filename: `${year}_mileage.csv`,  content: toBase64(mileageCsv) },
          ],
        }),
      });
      if (!res.ok) throw new Error('Send failed');
      toast.success(`Financial records sent to ${accountantEmail}`);
      setAccountantEmail('');
    } catch {
      toast.error('Failed to send to accountant');
    } finally {
      setSendingToAccountant(false);
    }
  }

  // ── Toggl connect / disconnect ──
  async function handleTogglConnect() {
    const token = togglTokenInput.trim();
    if (!token) return;
    setTogglConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('connect-toggl', {
        body: { action: 'connect', token },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Connected to Toggl — ${data.workspace_name}`);
      setTogglConnectOpen(false);
      setTogglTokenInput('');
      refetchBusiness();
      if (data.toggl_projects?.length > 0) {
        handleOpenMappings(data.toggl_projects);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to connect Toggl');
    } finally {
      setTogglConnecting(false);
    }
  }

  async function handleTogglDisconnect() {
    setTogglDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke('connect-toggl', {
        body: { action: 'disconnect' },
      });
      if (error) throw error;
      toast.success('Toggl disconnected');
      refetchBusiness();
    } catch {
      toast.error('Failed to disconnect Toggl');
    } finally {
      setTogglDisconnecting(false);
    }
  }

  async function handleSyncNow() {
    setTogglSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-toggl-entries');
      if (error) throw error;
      const n = (data as { synced?: number })?.synced ?? 0;
      toast.success(n > 0 ? `Synced ${n} entr${n === 1 ? 'y' : 'ies'} from Toggl` : 'Toggl is up to date');
      refetchBusiness();
      loadTimeData();
    } catch {
      toast.error('Sync failed — check your Toggl connection');
    } finally {
      setTogglSyncing(false);
    }
  }

  // ── Toggl project mapping ──
  async function handleOpenMappings(initialProjects?: { id: number; name: string }[]) {
    setTogglMappingOpen(true);
    setLoadingMappings(true);
    try {
      let projects = initialProjects;
      if (!projects) {
        const { data, error } = await supabase.functions.invoke('connect-toggl', {
          body: { action: 'fetch_projects' },
        });
        if (error) throw error;
        projects = data?.toggl_projects ?? [];
      }
      setTogglProjects(projects ?? []);

      // Load any existing mappings from DB
      if (business) {
        const { data: mapRows } = await supabase
          .from('toggl_project_map')
          .select('toggl_project_name, forgefly_project_id')
          .eq('business_id', business.id);
        if (mapRows) {
          const map: Record<string, string> = {};
          for (const row of mapRows) {
            map[row.toggl_project_name] = row.forgefly_project_id ?? '__skip__';
          }
          setTogglMappings(map);
        }
      }

      // Ensure Forgefly project list is loaded
      if (allProjects.length === 0) {
        const projs = await import('@/services/projectService').then(m => m.getProjects());
        setAllProjects(projs);
      }
    } catch {
      toast.error('Failed to load Toggl projects');
      setTogglMappingOpen(false);
    } finally {
      setLoadingMappings(false);
    }
  }

  async function handleSaveMappings() {
    if (!business) return;
    setSavingMappings(true);
    try {
      const rows = togglProjects
        .filter(p => togglMappings[p.name] !== undefined && togglMappings[p.name] !== '')
        .map(p => ({
          business_id: business.id,
          toggl_project_name: p.name,
          forgefly_project_id: togglMappings[p.name] === '__skip__' ? null : togglMappings[p.name],
        }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('toggl_project_map')
          .upsert(rows, { onConflict: 'business_id,toggl_project_name' });
        if (error) throw error;
      }

      toast.success('Mappings saved');
      setTogglMappingOpen(false);
    } catch {
      toast.error('Failed to save mappings');
    } finally {
      setSavingMappings(false);
    }
  }

  // ── Receipt scanning ──
  const CATEGORY_SLUG_TO_NAME: Record<string, string> = {
    software_subscriptions:   'Software & subscriptions',
    hardware_equipment:       'Hardware & equipment',
    phone_internet:           'Phone & internet',
    marketing_advertising:    'Marketing & advertising',
    professional_development: 'Professional development',
    bank_fees:                'Bank & payment fees',
    office_supplies:          'Office supplies',
    travel:                   'Travel — flights & hotels',
    meals_clients:            'Meals with clients',
    professional_services:    'Professional services',
    cogs_materials:           'COGS — materials',
    cogs_packaging:           'COGS — packaging',
    contractor_payments:      'Contractor payments',
    other:                    'Other',
  };

  async function handleReceiptFile(file: File) {
    if (!file) return;
    setScanningReceipt(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const imageBase64 = btoa(binary);
      const mimeType = file.type || 'image/jpeg';

      const { data, error } = await supabase.functions.invoke('extract-receipt', {
        body: { imageBase64, mimeType },
      });

      if (error) throw error;

      const json = data as {
        vendor?: string | null;
        amount?: number | null;
        date?: string | null;
        description?: string | null;
        suggested_category?: string | null;
        confidence?: string;
        notes?: string | null;
      };

      // Pre-fill form fields
      setExpenseForm(f => ({
        ...f,
        vendor:           json.vendor ?? f.vendor,
        amount:           json.amount != null ? String(json.amount) : f.amount,
        transaction_date: json.date ?? f.transaction_date,
        description:      json.description ?? f.description,
        expense_category_id: (() => {
          if (!json.suggested_category) return f.expense_category_id;
          const targetName = CATEGORY_SLUG_TO_NAME[json.suggested_category];
          const match = expenseCategories.find(c => c.name === targetName);
          return match ? match.id : f.expense_category_id;
        })(),
      }));

      setReceiptExtracted(true);
      setExtractedReceiptJson(JSON.stringify(json));
      toast.success('Receipt scanned — please review and save');
    } catch {
      toast.error('Failed to scan receipt');
    } finally {
      setScanningReceipt(false);
      if (receiptFileRef.current) receiptFileRef.current.value = '';
    }
  }

  // ── Save expense ──
  async function handleSaveExpense() {
    if (!expenseForm.amount || !expenseForm.transaction_date) {
      toast.error('Amount and date are required');
      return;
    }
    setSavingExpense(true);
    try {
      const notesValue = (() => {
        if (receiptExtracted && extractedReceiptJson) {
          const manual = expenseForm.notes ? `${expenseForm.notes}\n` : '';
          return `${manual}[receipt:${extractedReceiptJson}]`;
        }
        return expenseForm.notes || null;
      })();

      await createTransaction({
        type: 'expense',
        amount: parseFloat(expenseForm.amount),
        currency: 'USD',
        invoice_id: null,
        client_id: null,
        income_category: null,
        expense_category_id: expenseForm.expense_category_id || null,
        vendor: expenseForm.vendor || null,
        receipt_url: null,
        receipt_extracted: receiptExtracted,
        is_recurring: expenseForm.is_recurring,
        recurrence_rule: expenseForm.recurrence_rule || null,
        description: expenseForm.description || null,
        transaction_date: expenseForm.transaction_date,
        notes: notesValue,
      });
      toast.success('Expense added');
      setExpenseDialogOpen(false);
      setExpenseForm({ vendor: '', amount: '', transaction_date: today(), expense_category_id: '', description: '', notes: '', is_recurring: false, recurrence_rule: '' });
      setReceiptExtracted(false);
      setExtractedReceiptJson(null);
      loadExpensesData();
    } catch {
      toast.error('Failed to add expense');
    } finally {
      setSavingExpense(false);
    }
  }

  // ── Delete expense ──
  async function handleDeleteExpense() {
    if (!deleteExpenseId) return;
    try {
      await deleteTransaction(deleteExpenseId);
      setExpenses(prev => prev.filter(e => e.id !== deleteExpenseId));
      toast.success('Expense deleted');
    } catch {
      toast.error('Failed to delete expense');
    } finally {
      setDeleteExpenseId(null);
    }
  }

  // ── Save mileage ──
  async function handleSaveMileage() {
    if (!mileageForm.miles || !mileageForm.purpose || !mileageForm.trip_date) {
      toast.error('Date, miles, and purpose are required');
      return;
    }
    setSavingMileage(true);
    try {
      await createMileageLog({
        trip_date: mileageForm.trip_date,
        miles: parseFloat(mileageForm.miles),
        purpose: mileageForm.purpose,
        client_id: null,
        project_id: null,
        irs_rate: parseFloat(mileageForm.irs_rate),
      });
      toast.success('Mileage logged');
      setMileageDialogOpen(false);
      setMileageForm({ trip_date: today(), miles: '', purpose: '', irs_rate: '0.670' });
      loadExpensesData();
    } catch {
      toast.error('Failed to log mileage');
    } finally {
      setSavingMileage(false);
    }
  }

  // ── Delete mileage ──
  async function handleDeleteMileage() {
    if (!deleteMileageId) return;
    try {
      await deleteMileageLog(deleteMileageId);
      setMileageLogs(prev => prev.filter(m => m.id !== deleteMileageId));
      toast.success('Mileage entry deleted');
    } catch {
      toast.error('Failed to delete mileage entry');
    } finally {
      setDeleteMileageId(null);
    }
  }

  // ── Save contractor ──
  async function handleSaveContractor() {
    if (!contractorForm.contractor_name || !contractorForm.amount || !contractorForm.payment_date) {
      toast.error('Name, amount, and date are required');
      return;
    }
    setSavingContractor(true);
    try {
      await createContractorPayment({
        contractor_name: contractorForm.contractor_name,
        contractor_email: contractorForm.contractor_email || null,
        payment_date: contractorForm.payment_date,
        amount: parseFloat(contractorForm.amount),
        description: contractorForm.description || null,
        w9_on_file: contractorForm.w9_on_file,
      });
      toast.success('Payment recorded');
      setContractorDialogOpen(false);
      setContractorForm({ contractor_name: '', contractor_email: '', payment_date: today(), amount: '', description: '', w9_on_file: false });
      loadExpensesData();
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setSavingContractor(false);
    }
  }

  // ── W-9 toggle ──
  async function handleToggleW9(contractorName: string, ids: string[], value: boolean) {
    try {
      await Promise.all(ids.map(id => updateContractorW9(id, value)));
      setContractors(prev => prev.map(c =>
        c.contractor_name === contractorName ? { ...c, w9_on_file: value } : c
      ));
    } catch {
      toast.error('Failed to update W-9 status');
    }
  }

  // ── Delete contractor payments ──
  async function handleDeleteContractor() {
    if (!deleteContractorId) return;
    try {
      await deleteContractorPayment(deleteContractorId);
      setContractors(prev => prev.filter(c => c.id !== deleteContractorId));
      toast.success('Payment deleted');
    } catch {
      toast.error('Failed to delete payment');
    } finally {
      setDeleteContractorId(null);
    }
  }

  // ── Derived ──
  const contractorSummaries = buildContractorSummaries(contractors);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMileageDeduction = mileageLogs.reduce((sum, m) => sum + m.deductible_amount, 0);

  const selectedCategory = expenseCategories.find(c => c.id === expenseForm.expense_category_id);
  const isMealCategory = selectedCategory?.name === 'Meals with clients';

  // ── P&L computed ──
  const incomeTransactions = allTransactions.filter(t => t.type === 'income');
  const expTransactions    = allTransactions.filter(t => t.type === 'expense');
  const grossIncome        = incomeTransactions.reduce((s, t) => s + t.amount, 0);
  const plTotalExpenses    = expTransactions.reduce((s, t) => s + t.amount, 0);
  const netProfit          = grossIncome - plTotalExpenses;
  const prevGrossIncome    = prevYearTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const yoyPct             = prevGrossIncome > 0 ? ((grossIncome - prevGrossIncome) / prevGrossIncome) * 100 : null;
  const profitMarginPct    = grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;
  const monthlyBars        = buildMonthlyBars(allTransactions, selectedYear);
  const categoryBreakdown  = buildCategoryBreakdown(expTransactions);
  const incomeByMonth      = groupIncomeByMonth(incomeTransactions);
  const tracker1099        = build1099Rows(incomeTransactions, { ...contactNameMap });
  const availableYears     = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

  // ── Tax computed ──
  const mealsExpenses = expenses.filter(e => e.expense_category?.name === 'Meals with clients').reduce((s, e) => s + e.amount, 0);
  const taxCalc = computeTax(
    grossIncome,
    plTotalExpenses,
    mealsExpenses,
    totalMileageDeduction,
    parseFloat(homeOfficeSqft) || 0,
    filingStatus,
    parseFloat(priorYearLiability) || 0,
  );
  const qDates = quarterlyDueDates(selectedYear);
  const today_ = new Date();
  today_.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-balance mb-2">Finances</h1>
        <p className="text-muted-foreground">Track income, expenses, and plan for taxes.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview"><BarChart3 className="w-4 h-4 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="income"><TrendingUp className="w-4 h-4 mr-1.5" />Income</TabsTrigger>
          <TabsTrigger value="expenses"><Receipt className="w-4 h-4 mr-1.5" />Expenses</TabsTrigger>
          <TabsTrigger value="time"><Clock className="w-4 h-4 mr-1.5" />Time</TabsTrigger>
          <TabsTrigger value="tax"><DollarSign className="w-4 h-4 mr-1.5" />Tax</TabsTrigger>
          <TabsTrigger value="export"><FileDown className="w-4 h-4 mr-1.5" />Export</TabsTrigger>
        </TabsList>

        {/* ─── Overview ──────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-6 space-y-6">

          {/* Year selector */}
          <div className="flex items-center gap-3">
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingOverview && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          {/* KPI cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gross Income</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{fmt(grossIncome)}</div>
                {yoyPct !== null && (
                  <p className="text-xs mt-1 flex items-center gap-1">
                    {yoyPct >= 0
                      ? <><TrendingUp className="w-3 h-3 text-emerald-500" /><span className="text-emerald-500">+{yoyPct.toFixed(1)}%</span></>
                      : <><TrendingDown className="w-3 h-3 text-destructive" /><span className="text-destructive">{yoyPct.toFixed(1)}%</span></>
                    }
                    <span className="text-muted-foreground">vs {selectedYear - 1}</span>
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
                <Receipt className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{fmt(plTotalExpenses)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {expTransactions.length} transactions
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${netProfit < 0 ? 'text-destructive' : ''}`}>
                  {fmt(netProfit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {profitMarginPct.toFixed(0)}% margin
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income vs Expenses</CardTitle>
              <CardDescription>{selectedYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyBars} barGap={4} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '16px' }} iconType="circle" iconSize={8} />
                    <Bar dataKey="income" name="Income" fill="hsl(var(--chart-1))" radius={[3,3,0,0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--chart-2))" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bottom row: category breakdown + unpaid invoices */}
          <div className="grid gap-4 md:grid-cols-2">

            {/* Top expense categories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Expense Categories</CardTitle>
              </CardHeader>
              <CardContent>
                {categoryBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {categoryBreakdown.map(cat => (
                      <div key={cat.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-1.5">
                            {cat.name}
                            {cat.isMeals && <span className="text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">50% deductible</span>}
                          </span>
                          <span className="text-muted-foreground">{fmt(cat.isMeals ? cat.amount * 0.5 : cat.amount)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${cat.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Unpaid invoices */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Outstanding Invoices</CardTitle>
                <CardDescription>Cash flow impact</CardDescription>
              </CardHeader>
              <CardContent>
                {unpaidInvoiceCount === 0 ? (
                  <p className="text-sm text-muted-foreground">No outstanding invoices.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total outstanding</span>
                      <span className="font-semibold text-amber-500">{fmt(unpaidInvoiceTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pending invoices</span>
                      <span className="font-semibold">{unpaidInvoiceCount}</span>
                    </div>
                    <div className="h-px bg-border" />
                    <p className="text-xs text-muted-foreground">
                      Collecting {fmt(unpaidInvoiceTotal)} would bring your net profit to{' '}
                      <span className="font-medium text-foreground">{fmt(netProfit + unpaidInvoiceTotal)}</span>.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Income ────────────────────────────────────────────────────────── */}
        <TabsContent value="income" className="mt-6 space-y-6">

          {/* Year selector */}
          <div className="flex items-center gap-3">
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingOverview && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          {/* KPI summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{fmt(grossIncome)}</div>
                <p className="text-xs text-muted-foreground mt-1">{incomeTransactions.length} transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {fmt(incomeTransactions.filter(t => t.income_category === 'services').reduce((s, t) => s + t.amount, 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Invoice payments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Other Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {fmt(incomeTransactions.filter(t => t.income_category !== 'services').reduce((s, t) => s + t.amount, 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Licensing, products, etc.</p>
              </CardContent>
            </Card>
          </div>

          {/* Income transactions by month */}
          <Card>
            <CardHeader>
              <CardTitle>Income by Month</CardTitle>
              <CardDescription>{selectedYear}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOverview ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : incomeByMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground">No income recorded yet for {selectedYear}.</p>
              ) : (
                <div className="space-y-6">
                  {incomeByMonth.map(([yyyyMm, txns]) => {
                    const monthTotal = txns.reduce((s, t) => s + t.amount, 0);
                    return (
                      <div key={yyyyMm}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold">{monthLabel(yyyyMm)}</h4>
                          <span className="text-sm font-semibold text-emerald-500">{fmt(monthTotal)}</span>
                        </div>
                        <div className="space-y-1.5">
                          {txns.map(t => (
                            <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm truncate">{t.description ?? 'Income'}</p>
                                <p className="text-xs text-muted-foreground">{t.transaction_date} · {t.income_category ?? 'services'}</p>
                              </div>
                              <span className="text-sm font-medium shrink-0">{fmt(t.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 1099 tracker */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                1099-NEC Tracker
              </CardTitle>
              <CardDescription>Clients you've paid $600+ may require a 1099-NEC filing.</CardDescription>
            </CardHeader>
            <CardContent>
              {tracker1099.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clients have crossed $600 this year.</p>
              ) : (
                <div className="space-y-2">
                  {tracker1099.map(row => (
                    <div key={row.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{row.label}</p>
                        {row.ytd >= 600 && (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            Crossed $600 — may require 1099-NEC
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-semibold ${row.ytd >= 600 ? 'text-amber-500' : ''}`}>
                          {fmt(row.ytd)}
                        </span>
                        {row.ytd >= 600 && (
                          <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600 bg-amber-500/10">
                            1099
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-1">
                    These are estimates based on the information you've provided. Consult a qualified tax professional for advice specific to your situation.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Expenses ──────────────────────────────────────────────────────── */}
        <TabsContent value="expenses" className="mt-6 space-y-6">

          {/* ── Manual expenses ── */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-4 h-4" /> Expenses
                </CardTitle>
                <CardDescription>{CURRENT_YEAR} — {fmt(totalExpenses)} total</CardDescription>
              </div>
              <Button size="sm" onClick={() => setExpenseDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add expense
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {expenses.map(expense => (
                    <div key={expense.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {expense.vendor ?? expense.description ?? 'Expense'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {expense.expense_category?.name ?? 'Uncategorized'} · {expense.transaction_date}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-semibold text-sm">{fmt(expense.amount)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteExpenseId(expense.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Mileage ── */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Car className="w-4 h-4" /> Mileage
                </CardTitle>
                <CardDescription>
                  {CURRENT_YEAR} — {mileageLogs.reduce((s, m) => s + m.miles, 0).toFixed(1)} miles · {fmt(totalMileageDeduction)} deductible
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setMileageDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Log trip
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : mileageLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No trips logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {mileageLogs.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{log.purpose}</p>
                        <p className="text-xs text-muted-foreground">{log.trip_date} · {log.miles} mi @ ${log.irs_rate}/mi</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-semibold text-sm">{fmt(log.deductible_amount)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteMileageId(log.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Contractors ── */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-4 h-4" /> Contractors
                </CardTitle>
                <CardDescription>{CURRENT_YEAR} payments · $600 threshold tracked for 1099-NEC</CardDescription>
              </div>
              <Button size="sm" onClick={() => setContractorDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add payment
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : contractorSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contractor payments recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {contractorSummaries.map(c => {
                    const remaining = Math.max(0, 600 - c.ytd);
                    return (
                      <div key={c.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{c.name}</p>
                            {c.threshold_flag && (
                              <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600 bg-amber-500/10">
                                <AlertTriangle className="w-3 h-3 mr-1" /> May need 1099-NEC
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {c.threshold_flag ? (
                              <p className="text-xs text-amber-600">
                                {c.w9_on_file ? 'W-9 on file' : 'W-9 needed'}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {fmt(remaining)} until 1099 threshold
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="font-semibold text-sm">{fmt(c.ytd)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">W-9</span>
                            <Switch
                              checked={c.w9_on_file}
                              onCheckedChange={val => handleToggleW9(c.name, c.ids, val)}
                            />
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteContractorId(c.ids[c.ids.length - 1])}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground pt-1">
                    These are estimates based on the information you've provided. Consult a qualified tax professional for advice specific to your situation.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Time ──────────────────────────────────────────────────────────── */}
        <TabsContent value="time" className="mt-6 space-y-5">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              {loadingTime && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-2">
              {togglConnected ? (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    {togglWorkspaceName}
                    {togglLastSyncedAt && (
                      <span className="text-xs text-muted-foreground/70">
                        · {fmtSyncAgo(togglLastSyncedAt)}
                      </span>
                    )}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    disabled={togglSyncing}
                    onClick={handleSyncNow}
                  >
                    <RefreshCw className={`w-3 h-3 ${togglSyncing ? 'animate-spin' : ''}`} />
                    {togglSyncing ? 'Syncing…' : 'Sync now'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => handleOpenMappings()}
                  >
                    Manage mappings
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-muted-foreground hover:text-destructive text-xs"
                    disabled={togglDisconnecting}
                    onClick={handleTogglDisconnect}
                  >
                    {togglDisconnecting
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Unplug className="w-3.5 h-3.5" />
                    }
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTogglConnectOpen(true)}>
                  <Link2 className="w-3.5 h-3.5" />
                  Connect Toggl
                </Button>
              )}
              <Button size="sm" onClick={() => setLogTimeOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />Log time
              </Button>
            </div>
          </div>

          {/* Unmapped Toggl projects banner */}
          {togglConnected && togglUnmappedProjects.length > 0 && !togglBannerDismissed && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    {togglUnmappedProjects.length === 1
                      ? '1 Toggl project needs mapping'
                      : `${togglUnmappedProjects.length} Toggl projects need mapping`}
                  </p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5 truncate">
                    {togglUnmappedProjects.join(' · ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                  onClick={() => handleOpenMappings()}
                >
                  Map now
                </Button>
                <button
                  type="button"
                  className="text-amber-500/60 hover:text-amber-500 transition-colors"
                  onClick={() => setTogglBannerDismissed(true)}
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Summary KPIs */}
          {(() => {
            const totalHrs = timeEntries.reduce((s, e) => s + e.hours, 0);
            const projectCount = new Set(timeEntries.filter(e => e.project_id).map(e => e.project_id)).size;
            const clientCount = new Set(timeEntries.filter(e => e.client_id).map(e => e.client_id)).size;
            return (
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total hours</p>
                    <p className="text-2xl font-bold tabular-nums mt-1">{totalHrs.toFixed(1)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Projects</p>
                    <p className="text-2xl font-bold tabular-nums mt-1">{projectCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Clients</p>
                    <p className="text-2xl font-bold tabular-nums mt-1">{clientCount}</p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Project breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Breakdown</CardTitle>
              <CardDescription className="text-xs">
                Hours are included in year-end tax export for home office substantiation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTime ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : timeSummaries.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  No time logged for {selectedYear}. Use the Log time button to start.
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-4 gap-2 px-2 pb-2 text-xs text-muted-foreground font-medium border-b">
                    <span className="col-span-2">Project</span>
                    <span className="text-right">Hours</span>
                    <span className="text-right">Eff. rate</span>
                  </div>
                  {timeSummaries.map(s => (
                    <div key={s.projectId} className="grid grid-cols-4 gap-2 px-2 py-2 rounded hover:bg-muted/40 text-sm">
                      <div className="col-span-2 min-w-0">
                        <p className="font-medium truncate">{s.projectName}</p>
                        {s.clientName && <p className="text-xs text-muted-foreground truncate">{s.clientName}</p>}
                      </div>
                      <span className="text-right tabular-nums self-center">{s.totalHours.toFixed(1)}</span>
                      <span className="text-right tabular-nums self-center">
                        {s.effectiveRate != null ? `$${Math.round(s.effectiveRate)}/hr` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent entries */}
          {timeEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Entries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {timeEntries.slice(0, 20).map(e => (
                  <div key={e.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{e.project?.name ?? 'No project'}</p>
                      {e.note && <p className="text-xs text-muted-foreground truncate">{e.note}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {e.source === 'toggl' && (
                        <span
                          title="Synced from Toggl"
                          className="w-1.5 h-1.5 rounded-full bg-orange-400 opacity-70 shrink-0"
                        />
                      )}
                      <div className="text-right">
                        <p className="tabular-nums font-medium">{e.hours.toFixed(2)} hrs</p>
                        <p className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <LogTimeDialog
            open={logTimeOpen}
            onOpenChange={setLogTimeOpen}
            projects={allProjects}
            onSaved={() => { toast.success('Time logged'); loadTimeData(); }}
          />
        </TabsContent>

        {/* ─── Tax ───────────────────────────────────────────────────────────── */}
        <TabsContent value="tax" className="mt-6 space-y-5">

          {/* Disclaimer — non-negotiable */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            These are estimates based on the information you've entered. Tax law is complex and varies by situation. Consult a qualified tax professional before making financial decisions based on these figures.
          </div>

          {/* Year selector */}
          <div className="flex items-center gap-3">
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {(loadingOverview || loading) && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Tax settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tax Settings</CardTitle>
              <CardDescription>Used for estimate calculations only. Never stored with a tax authority.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Filing status</Label>
                  <Select value={filingStatus} onValueChange={v => setFilingStatus(v as FilingStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FILING_STATUS_LABELS) as FilingStatus[]).map(s => (
                        <SelectItem key={s} value={s}>{FILING_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Home office sq ft</Label>
                  <Input
                    type="number"
                    min="0"
                    max="300"
                    placeholder="0"
                    value={homeOfficeSqft}
                    onChange={e => setHomeOfficeSqft(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">IRS simplified method · $5/sqft · max 300 sqft</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Prior year tax liability</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={priorYearLiability}
                    onChange={e => setPriorYearLiability(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Used for safe harbor calculation</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={saveTaxSettings} disabled={savingTaxSettings}>
                  {savingTaxSettings ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : 'Save settings'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tax breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estimated Tax Breakdown — {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Gross income',                value: grossIncome,                      indent: false, muted: false },
                  { label: 'Total deductible expenses',   value: -taxCalc.totalDeductibleExpenses,  indent: true,  muted: true  },
                  { label: '— Home office deduction',     value: -taxCalc.homeOfficeDeduction,      indent: true,  muted: true, show: taxCalc.homeOfficeDeduction > 0 },
                  { label: 'Net profit (Schedule C)',     value: taxCalc.netProfit,                 indent: false, muted: false, bold: true },
                  { label: 'SE tax deduction (½ SE tax)', value: -taxCalc.seDeduction,              indent: true,  muted: true  },
                  { label: `Standard deduction (${FILING_STATUS_LABELS[filingStatus]})`, value: -taxCalc.standardDeduction, indent: true, muted: true },
                  { label: 'Taxable income',              value: taxCalc.taxableIncome,             indent: false, muted: false, bold: true },
                ].filter(r => r.show !== false).map((row, i) => (
                  <div key={i} className={`flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 ${row.indent ? 'pl-4' : ''}`}>
                    <span className={row.muted ? 'text-muted-foreground' : row.bold ? 'font-semibold' : ''}>{row.label}</span>
                    <span className={`tabular-nums ${row.muted ? 'text-muted-foreground' : row.bold ? 'font-semibold' : ''} ${row.value < 0 ? 'text-muted-foreground' : ''}`}>
                      {row.value < 0 ? `(${fmt(-row.value)})` : fmt(row.value)}
                    </span>
                  </div>
                ))}

                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground pl-4">Self-employment tax (15.3%)</span>
                    <span className="tabular-nums text-muted-foreground">{fmt(taxCalc.seTax)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground pl-4">Estimated income tax ({FILING_STATUS_LABELS[filingStatus]})</span>
                    <span className="tabular-nums text-muted-foreground">{fmt(taxCalc.estimatedIncomeTax)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 rounded-lg bg-muted/50 px-3 mt-1">
                    <span className="font-semibold">Total estimated tax</span>
                    <div className="text-right">
                      <span className="font-bold text-lg tabular-nums">{fmt(taxCalc.totalTax)}</span>
                      <p className="text-xs text-muted-foreground">{taxCalc.effectiveRate.toFixed(1)}% effective rate on gross income</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quarterly payments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quarterly Estimated Payments</CardTitle>
              <CardDescription>
                Safe harbor amount: {fmt(taxCalc.safeHarbor)} · {fmt(taxCalc.quarterlyPayment)}/quarter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {qDates.map(({ label, quarter, date }) => {
                  const isPast = date < today_;
                  const daysUntil = Math.ceil((date.getTime() - today_.getTime()) / (1000 * 60 * 60 * 24));
                  const isDueSoon = !isPast && daysUntil <= 30;
                  return (
                    <div key={label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{label}</span>
                          <span className="text-xs text-muted-foreground">{quarter}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Due {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-semibold text-sm tabular-nums">{fmt(taxCalc.quarterlyPayment)}</span>
                        <Badge variant="outline" className={
                          isPast
                            ? 'text-muted-foreground border-muted-foreground/30'
                            : isDueSoon
                              ? 'text-amber-600 border-amber-500/40 bg-amber-500/10'
                              : 'text-emerald-600 border-emerald-500/40 bg-emerald-500/10'
                        }>
                          {isPast ? 'Past' : isDueSoon ? `Due in ${daysUntil}d` : 'Upcoming'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Pay via IRS Direct Pay or EFTPS. Underpayment penalty applies if you pay less than the safe harbor amount.
              </p>
            </CardContent>
          </Card>

          {/* SEP-IRA opportunity */}
          {taxCalc.sepIraMax > 0 && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  SEP-IRA Opportunity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">
                  You could contribute up to{' '}
                  <span className="font-semibold text-emerald-600">{fmt(taxCalc.sepIraMax)}</span>{' '}
                  to a SEP-IRA this year and reduce your estimated tax bill by approximately{' '}
                  <span className="font-semibold text-emerald-600">{fmt(taxCalc.sepIraSavings)}</span>.
                </p>
                <p className="text-xs text-muted-foreground">
                  Maximum is 25% of net profit, capped at $69,000 (2024). Contributions are tax-deductible.{' '}
                  <a
                    href="https://www.irs.gov/retirement-plans/sep-plan-faqs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Learn more at IRS.gov →
                  </a>
                </p>
                <p className="text-xs text-muted-foreground">
                  These are estimates. Consult a qualified tax professional for advice specific to your situation.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Export ────────────────────────────────────────────────────────── */}
        <TabsContent value="export" className="mt-6 space-y-5">
          <div className="flex items-center gap-3">
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {(loadingOverview || loading) && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          {/* PDF report */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Year-End Report</CardTitle>
              <CardDescription>
                Print-ready summary: income, expenses, and mileage. Use your browser's Print → Save as PDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={openPrintReport} className="gap-2">
                <FileDown className="w-4 h-4" />Generate &amp; Print PDF
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Opens a formatted report in a new tab. Use <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs">⌘P</kbd> / <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs">Ctrl+P</kbd> → Save as PDF.
                Footer: "Generated by Forgefly. For informational purposes only. Consult a qualified tax professional before filing."
              </p>
            </CardContent>
          </Card>

          {/* CSV exports */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CSV Exports</CardTitle>
              <CardDescription>Download individual files for your accountant or tax software.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCsv(buildIncomeCsv(allTransactions), `${selectedYear}_income.csv`)}
                >
                  <FileDown className="w-4 h-4 mr-1.5" />Income ({allTransactions.filter(t => t.type === 'income').length} rows)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCsv(buildExpenseCsv(allTransactions), `${selectedYear}_expenses.csv`)}
                >
                  <FileDown className="w-4 h-4 mr-1.5" />Expenses ({allTransactions.filter(t => t.type === 'expense').length} rows)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCsv(buildMileageCsv(mileageLogs), `${selectedYear}_mileage.csv`)}
                >
                  <FileDown className="w-4 h-4 mr-1.5" />Mileage ({mileageLogs.length} trips)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Send to accountant */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Send to Accountant</CardTitle>
              <CardDescription>
                All three CSV files will be attached. Your accountant doesn't need a Forgefly account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 max-w-md">
                <Input
                  type="email"
                  placeholder="accountant@example.com"
                  value={accountantEmail}
                  onChange={e => setAccountantEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendToAccountant(); }}
                />
                <Button
                  onClick={handleSendToAccountant}
                  disabled={!accountantEmail || sendingToAccountant}
                >
                  {sendingToAccountant
                    ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Sending…</>
                    : 'Send'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sends income, expense, and mileage CSVs from <strong>hello@forgefly.io</strong> on your behalf.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Toggl Project Mapping Sheet ──────────────────────────────────── */}
      <Sheet open={togglMappingOpen} onOpenChange={open => { if (!open) setTogglMappingOpen(false); }}>
        {togglMappingOpen && (
          <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
            <SheetHeader>
              <SheetTitle>Map Toggl projects</SheetTitle>
              <SheetDescription>
                Choose which Forgefly project each Toggl project maps to. Unmapped projects are skipped during sync.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-4">
              {loadingMappings ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : togglProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No active projects found in your Toggl workspace.
                </p>
              ) : (
                <div className="space-y-1">
                  {/* Column headers */}
                  <div className="grid grid-cols-2 gap-3 px-1 pb-2 text-xs font-medium text-muted-foreground border-b">
                    <span>Toggl project</span>
                    <span>Maps to</span>
                  </div>
                  {togglProjects.map(tp => {
                    const currentVal = togglMappings[tp.name] ?? '';
                    const isMapped = currentVal !== '' && currentVal !== '__skip__';
                    const isSkipped = currentVal === '__skip__';
                    return (
                      <div key={tp.id} className="grid grid-cols-2 gap-3 items-center py-2 px-1 rounded hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{tp.name}</p>
                          {isSkipped && (
                            <p className="text-xs text-muted-foreground">Won't import</p>
                          )}
                          {isMapped && (
                            <p className="text-xs text-emerald-600">Mapped</p>
                          )}
                        </div>
                        <Select
                          value={currentVal}
                          onValueChange={val => setTogglMappings(prev => ({ ...prev, [tp.name]: val }))}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Choose project…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__skip__">
                              <span className="text-muted-foreground">Don't import</span>
                            </SelectItem>
                            <div className="h-px bg-border my-1" />
                            {allProjects
                              .filter(p => p.status !== 'archived')
                              .map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <SheetFooter className="pt-4 border-t">
              <div className="flex items-center justify-between w-full gap-3">
                <p className="text-xs text-muted-foreground">
                  {Object.values(togglMappings).filter(v => v !== '' && v !== '__skip__').length} of {togglProjects.length} mapped
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setTogglMappingOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveMappings} disabled={savingMappings || loadingMappings}>
                    {savingMappings
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
                      : 'Save mappings'
                    }
                  </Button>
                </div>
              </div>
            </SheetFooter>
          </SheetContent>
        )}
      </Sheet>

      {/* ─── Toggl Connect Dialog ─────────────────────────────────────────── */}
      <Dialog open={togglConnectOpen} onOpenChange={open => {
        setTogglConnectOpen(open);
        if (!open) setTogglTokenInput('');
      }}>
        {togglConnectOpen && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Connect Toggl</DialogTitle>
              <DialogDescription>
                Paste your Toggl API token to sync time entries automatically. Find it in Toggl{' '}
                <strong>Profile Settings → API Token</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>API Token</Label>
                <Input
                  type="password"
                  placeholder="Your Toggl API token"
                  value={togglTokenInput}
                  onChange={e => setTogglTokenInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleTogglConnect(); }}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Your token is stored securely server-side and never exposed to the browser again after this step.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTogglConnectOpen(false)}>Cancel</Button>
              <Button onClick={handleTogglConnect} disabled={togglConnecting || !togglTokenInput.trim()}>
                {togglConnecting
                  ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Connecting…</>
                  : 'Connect'
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ─── Add Expense Dialog ────────────────────────────────────────────── */}
      <Dialog open={expenseDialogOpen} onOpenChange={open => {
        setExpenseDialogOpen(open);
        if (!open) { setReceiptExtracted(false); setExtractedReceiptJson(null); }
      }}>
        {expenseDialogOpen && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Add expense</DialogTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={scanningReceipt}
                  onClick={() => receiptFileRef.current?.click()}
                  className="gap-1.5"
                >
                  {scanningReceipt
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Scanning…</>
                    : <><ScanLine className="w-3.5 h-3.5" />Scan receipt</>
                  }
                </Button>
              </div>
              <DialogDescription>
                {receiptExtracted
                  ? 'Receipt scanned — review the pre-filled fields and save.'
                  : 'Record a business expense manually or scan a receipt.'}
              </DialogDescription>
            </DialogHeader>
            <input
              ref={receiptFileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleReceiptFile(file);
              }}
            />
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={expenseForm.transaction_date}
                    onChange={e => setExpenseForm(f => ({ ...f, transaction_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={expenseForm.expense_category_id}
                  onValueChange={v => setExpenseForm(f => ({ ...f, expense_category_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isMealCategory && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Meals with clients are 50% deductible. Forgefly calculates the deductible amount automatically.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Vendor</Label>
                <Input
                  placeholder="e.g. Adobe, AWS, Starbucks"
                  value={expenseForm.vendor}
                  onChange={e => setExpenseForm(f => ({ ...f, vendor: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  placeholder="Brief description"
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="recurring"
                  checked={expenseForm.is_recurring}
                  onCheckedChange={v => setExpenseForm(f => ({ ...f, is_recurring: v, recurrence_rule: v ? 'monthly' : '' }))}
                />
                <Label htmlFor="recurring">Recurring expense</Label>
              </div>

              {expenseForm.is_recurring && (
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select
                    value={expenseForm.recurrence_rule}
                    onValueChange={v => setExpenseForm(f => ({ ...f, recurrence_rule: v as 'monthly' | 'annual' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Optional notes"
                  className="resize-none"
                  rows={2}
                  value={expenseForm.notes}
                  onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setExpenseDialogOpen(false);
                setReceiptExtracted(false);
                setExtractedReceiptJson(null);
              }}>Cancel</Button>
              <Button onClick={handleSaveExpense} disabled={savingExpense}>
                {savingExpense ? 'Saving…' : 'Add expense'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ─── Add Mileage Dialog ────────────────────────────────────────────── */}
      <Dialog open={mileageDialogOpen} onOpenChange={setMileageDialogOpen}>
        {mileageDialogOpen && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Log trip</DialogTitle>
              <DialogDescription>Record a business mileage trip.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={mileageForm.trip_date}
                    onChange={e => setMileageForm(f => ({ ...f, trip_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Miles *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0.0"
                    value={mileageForm.miles}
                    onChange={e => setMileageForm(f => ({ ...f, miles: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Purpose *</Label>
                <Input
                  placeholder="e.g. Client meeting at downtown office"
                  value={mileageForm.purpose}
                  onChange={e => setMileageForm(f => ({ ...f, purpose: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>IRS Rate ($/mi)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={mileageForm.irs_rate}
                  onChange={e => setMileageForm(f => ({ ...f, irs_rate: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">2024 rate: $0.670/mi. Rate stored per trip.</p>
              </div>
              {mileageForm.miles && mileageForm.irs_rate && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  Deductible: <span className="font-semibold">{fmt(parseFloat(mileageForm.miles) * parseFloat(mileageForm.irs_rate))}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMileageDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveMileage} disabled={savingMileage}>
                {savingMileage ? 'Saving…' : 'Log trip'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ─── Add Contractor Payment Dialog ────────────────────────────────── */}
      <Dialog open={contractorDialogOpen} onOpenChange={setContractorDialogOpen}>
        {contractorDialogOpen && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add contractor payment</DialogTitle>
              <DialogDescription>Record a payment to an independent contractor.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Contractor name *</Label>
                <Input
                  placeholder="Full name or business name"
                  value={contractorForm.contractor_name}
                  onChange={e => setContractorForm(f => ({ ...f, contractor_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="contractor@example.com"
                  value={contractorForm.contractor_email}
                  onChange={e => setContractorForm(f => ({ ...f, contractor_email: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={contractorForm.amount}
                    onChange={e => setContractorForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={contractorForm.payment_date}
                    onChange={e => setContractorForm(f => ({ ...f, payment_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  placeholder="What was this payment for?"
                  value={contractorForm.description}
                  onChange={e => setContractorForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="w9"
                  checked={contractorForm.w9_on_file}
                  onCheckedChange={v => setContractorForm(f => ({ ...f, w9_on_file: v }))}
                />
                <Label htmlFor="w9">W-9 on file</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Payments ≥ $600/year may require a 1099-NEC. Forgefly tracks this — you'll be notified when the threshold is crossed. Consult a tax professional for advice specific to your situation.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setContractorDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveContractor} disabled={savingContractor}>
                {savingContractor ? 'Saving…' : 'Record payment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ─── Delete confirmations ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteExpenseId} onOpenChange={open => { if (!open) setDeleteExpenseId(null); }}>
        {deleteExpenseId && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete expense?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteExpense}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      <AlertDialog open={!!deleteMileageId} onOpenChange={open => { if (!open) setDeleteMileageId(null); }}>
        {deleteMileageId && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete mileage entry?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMileage}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      <AlertDialog open={!!deleteContractorId} onOpenChange={open => { if (!open) setDeleteContractorId(null); }}>
        {deleteContractorId && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete contractor payment?</AlertDialogTitle>
              <AlertDialogDescription>This removes only the selected payment, not the contractor's full history. This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteContractor}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
