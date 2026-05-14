import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, TooltipProps } from 'recharts';
import type { CashflowData } from '@/types/types';

// Custom Tooltip Component matching shadcn style
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-3">
      <div className="font-medium mb-2">{label}</div>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-medium">${entry.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FinancesPage() {
  const [newClients, setNewClients] = useState([3]);
  const [avgProjectValue, setAvgProjectValue] = useState([2500]);
  const [monthlyExpenses, setMonthlyExpenses] = useState([3000]);

  const baseCashflow: CashflowData[] = [
    { month: 'Jan', income: 7500, expenses: 3000, profit: 4500 },
    { month: 'Feb', income: 8200, expenses: 3100, profit: 5100 },
    { month: 'Mar', income: 7800, expenses: 2900, profit: 4900 },
    { month: 'Apr', income: 9100, expenses: 3200, profit: 5900 },
    { month: 'May', income: 8700, expenses: 3000, profit: 5700 },
    { month: 'Jun', income: 9500, expenses: 3100, profit: 6400 },
  ];

  const projectedCashflow = baseCashflow.map((data, index) => {
    const projectedIncome = newClients[0] * avgProjectValue[0] + (index * 200);
    const projectedExpenses = monthlyExpenses[0];
    return {
      ...data,
      projectedIncome,
      projectedExpenses,
      projectedProfit: projectedIncome - projectedExpenses,
    };
  });

  const invoices = [
    { id: '1', client: 'TechStart Inc', amount: 2400, status: 'paid', dueDate: '2026-04-15' },
    { id: '2', client: 'Design Co', amount: 1800, status: 'pending', dueDate: '2026-05-20' },
    { id: '3', client: 'Marketing Pro', amount: 3200, status: 'overdue', dueDate: '2026-04-30' },
    { id: '4', client: 'Startup Labs', amount: 1500, status: 'pending', dueDate: '2026-05-25' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'overdue':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-balance mb-2">Finances</h1>
        <p className="text-muted-foreground">Track your cashflow and manage invoices</p>
      </div>

      {/* Summary Cards */}
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

      {/* Cashflow Simulator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Cashflow Simulator</CardTitle>
          <CardDescription>Adjust variables to forecast your financial future</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">New Clients/Month</label>
                <span className="text-sm text-muted-foreground">{newClients[0]}</span>
              </div>
              <Slider
                value={newClients}
                onValueChange={setNewClients}
                min={1}
                max={10}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Avg Project Value</label>
                <span className="text-sm text-muted-foreground">${avgProjectValue[0]}</span>
              </div>
              <Slider
                value={avgProjectValue}
                onValueChange={setAvgProjectValue}
                min={500}
                max={10000}
                step={100}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Monthly Expenses</label>
                <span className="text-sm text-muted-foreground">${monthlyExpenses[0]}</span>
              </div>
              <Slider
                value={monthlyExpenses}
                onValueChange={setMonthlyExpenses}
                min={1000}
                max={10000}
                step={100}
              />
            </div>
          </div>

          <div className="w-full h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectedCashflow}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="hsl(var(--border))" 
                  vertical={false}
                />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Actual Income"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="projectedIncome"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  name="Projected Income"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="projectedExpenses"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  name="Projected Expenses"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="projectedProfit"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  name="Projected Profit"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 font-medium leading-none">
            Based on {newClients[0]} new client{newClients[0] !== 1 ? 's' : ''} per month at ${avgProjectValue[0].toLocaleString()} average project value
          </div>
          <div className="leading-none text-muted-foreground">
            Projected monthly profit: ${(newClients[0] * avgProjectValue[0] - monthlyExpenses[0]).toLocaleString()} 
            ({Math.round(((newClients[0] * avgProjectValue[0] - monthlyExpenses[0]) / (newClients[0] * avgProjectValue[0])) * 100)}% margin)
          </div>
        </CardFooter>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-balance">Recent Invoices</CardTitle>
              <CardDescription>Track your billing and payments</CardDescription>
            </div>
            <Button onClick={() => {}}>
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{invoice.client}</p>
                  <p className="text-sm text-muted-foreground">
                    Due: {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="font-semibold">${invoice.amount.toLocaleString()}</span>
                  <Badge variant="outline" className={getStatusColor(invoice.status)}>
                    {invoice.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
