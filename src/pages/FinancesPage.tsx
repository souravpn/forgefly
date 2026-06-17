import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Trash2, Car, Users, Receipt, TrendingUp, TrendingDown,
  AlertTriangle, Clock, BarChart3, FileDown, DollarSign, ScanLine, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, TooltipProps } from 'recharts';
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

// ─── FinancesPage ─────────────────────────────────────────────────────────────

export default function FinancesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'overview';

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

  // ── Overview simulator state ──
  const [newClients, setNewClients] = useState([3]);
  const [avgProjectValue, setAvgProjectValue] = useState([2500]);
  const [monthlyExpenses, setMonthlyExpenses] = useState([3000]);

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

  // ── Overview chart data ──
  const baseCashflow = [
    { month: 'Jan', income: 7500, expenses: 3000 },
    { month: 'Feb', income: 8200, expenses: 3100 },
    { month: 'Mar', income: 7800, expenses: 2900 },
    { month: 'Apr', income: 9100, expenses: 3200 },
    { month: 'May', income: 8700, expenses: 3000 },
    { month: 'Jun', income: 9500, expenses: 3100 },
  ];

  const projectedCashflow = baseCashflow.map((d, i) => {
    const projected = newClients[0] * avgProjectValue[0] + i * 200;
    return {
      ...d,
      projectedIncome: projected,
      projectedExpenses: monthlyExpenses[0],
      projectedProfit: projected - monthlyExpenses[0],
    };
  });

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
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">$9,500</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-success" />
                  <span className="text-success">+15.3%</span> from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">$6,500</div>
                <p className="text-xs text-muted-foreground mt-1">4 pending invoices</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">$6,400</div>
                <p className="text-xs text-muted-foreground mt-1">67% profit margin</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cashflow Simulator</CardTitle>
              <CardDescription>Adjust variables to forecast your financial future</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">New Clients/Month</label>
                    <span className="text-sm text-muted-foreground">{newClients[0]}</span>
                  </div>
                  <Slider value={newClients} onValueChange={setNewClients} min={1} max={10} step={1} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Avg Project Value</label>
                    <span className="text-sm text-muted-foreground">${avgProjectValue[0]}</span>
                  </div>
                  <Slider value={avgProjectValue} onValueChange={setAvgProjectValue} min={500} max={10000} step={100} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Monthly Expenses</label>
                    <span className="text-sm text-muted-foreground">${monthlyExpenses[0]}</span>
                  </div>
                  <Slider value={monthlyExpenses} onValueChange={setMonthlyExpenses} min={1000} max={10000} step={100} />
                </div>
              </div>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projectedCashflow}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                    <Line type="monotone" dataKey="income" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" name="Actual Income" dot={false} />
                    <Line type="monotone" dataKey="projectedIncome" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Projected Income" dot={false} />
                    <Line type="monotone" dataKey="projectedExpenses" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Projected Expenses" dot={false} />
                    <Line type="monotone" dataKey="projectedProfit" stroke="hsl(var(--chart-3))" strokeWidth={2} name="Projected Profit" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Income ────────────────────────────────────────────────────────── */}
        <TabsContent value="income" className="mt-6">
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Income analytics coming soon</p>
              <p className="text-sm mt-1">P&amp;L dashboard, 1099 tracker, and income breakdown by client.</p>
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
        <TabsContent value="time" className="mt-6">
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Time tracking coming soon</p>
              <p className="text-sm mt-1">Log hours per project, track effective rate, and run a live timer.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tax ───────────────────────────────────────────────────────────── */}
        <TabsContent value="tax" className="mt-6">
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Tax estimates coming soon</p>
              <p className="text-sm mt-1">Quarterly payment estimates, SE tax, home office deduction, and SEP-IRA opportunity.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Export ────────────────────────────────────────────────────────── */}
        <TabsContent value="export" className="mt-6">
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <FileDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Year-end export coming soon</p>
              <p className="text-sm mt-1">PDF package + CSV exports. Send directly to your accountant.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
