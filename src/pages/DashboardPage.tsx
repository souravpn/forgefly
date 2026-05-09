import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { DollarSign, Users, FileText, TrendingUp, Calendar, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Project, Task, Client, CashflowData } from '@/types/types';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeClients: 0,
    pendingInvoices: 0,
    completionRate: 0,
  });
  const [cashflowData, setCashflowData] = useState<CashflowData[]>([]);
  const [whatIfMultiplier, setWhatIfMultiplier] = useState([1]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    // Load projects
    const { data: projectsData } = await supabase
      .from('projects')
      .select('*, client:clients(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (projectsData) {
      setProjects(projectsData);
    }

    // Load tasks
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*, project:projects(*)')
      .eq('user_id', user.id)
      .eq('completed', false)
      .order('due_date', { ascending: true })
      .limit(5);

    if (tasksData) {
      setTasks(tasksData);
    }

    // Load clients
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (clientsData) {
      setClients(clientsData);
    }

    // Calculate stats
    const totalRevenue = projectsData?.reduce((sum, p) => sum + (p.value || 0), 0) || 0;
    const activeClients = clientsData?.length || 0;
    const completedProjects = projectsData?.filter(p => p.status === 'completed').length || 0;
    const totalProjects = projectsData?.length || 1;
    const completionRate = Math.round((completedProjects / totalProjects) * 100);

    setStats({
      totalRevenue,
      activeClients,
      pendingInvoices: 3500,
      completionRate,
    });

    // Generate cashflow data
    const baseCashflow = generateCashflowData();
    setCashflowData(baseCashflow);
  };

  const generateCashflowData = (): CashflowData[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month, index) => ({
      month,
      income: 6000 + index * 400 + Math.random() * 1000,
      expenses: 3000 + Math.random() * 500,
      profit: 0,
    })).map(data => ({
      ...data,
      profit: data.income - data.expenses,
    }));
  };

  const adjustedCashflowData = cashflowData.map(data => ({
    ...data,
    income: data.income * whatIfMultiplier[0],
    profit: (data.income * whatIfMultiplier[0]) - data.expenses,
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'lead':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'in_progress':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'review':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-balance mb-2">Welcome Back</h1>
        <p className="text-muted-foreground">Here's what's happening with your business today</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-success">+12.5%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Clients</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeClients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-success">+2</span> new this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Invoices</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats.pendingInvoices.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">3 invoices awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.completionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">Project success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Cashflow Chart with What-If Slider */}
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Predictive Cashflow</CardTitle>
          <CardDescription>Forecast your income and expenses with what-if scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Income Multiplier</label>
              <span className="text-sm text-muted-foreground">{whatIfMultiplier[0].toFixed(1)}x</span>
            </div>
            <Slider
              value={whatIfMultiplier}
              onValueChange={setWhatIfMultiplier}
              min={0.5}
              max={2}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Adjust to see how changes in client acquisition affect your cashflow
            </p>
          </div>

          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={adjustedCashflowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  name="Income"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  name="Expenses"
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  name="Profit"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-balance">Active Projects</CardTitle>
              <Link to="/projects">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
            <CardDescription>Projects currently in progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projects.slice(0, 4).map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{project.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {project.client?.name || 'No client'}
                    </p>
                  </div>
                  <Badge variant="outline" className={getStatusColor(project.status)}>
                    {project.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
              {projects.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8 text-pretty">
                  No active projects. Create your first project to get started!
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today's Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-balance">Today's Tasks</CardTitle>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardDescription>Upcoming tasks and deadlines</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8 text-pretty">
                  No pending tasks. You're all caught up!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
