import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { DollarSign, Users, FileText, TrendingUp, Calendar, CheckCircle2, Sparkles, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Project, Task, Client, CashflowData } from '@/types/types';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

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

  const handleTaskComplete = async (taskId: string) => {
    setCompletedTasks(prev => new Set(prev).add(taskId));
    
    await supabase
      .from('tasks')
      .update({ completed: true })
      .eq('id', taskId);

    toast.success('Task completed!', {
      description: 'Great work! Keep it up.',
    });

    setTimeout(() => {
      loadDashboardData();
    }, 600);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-2">Welcome Back</h1>
          <p className="text-sm md:text-base text-muted-foreground">Here's what's happening with your business today</p>
        </div>
        <Button
          size="lg"
          className="glow-accent w-full md:w-auto"
          onClick={() => navigate('/onboarding')}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          <span className="hidden sm:inline">Start New Business Setup</span>
          <span className="sm:hidden">New Setup</span>
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-hover cursor-pointer" onClick={() => navigate('/proposals')}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="font-semibold">Create Proposal</p>
              <p className="text-sm text-muted-foreground">Win new clients</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover cursor-pointer" onClick={() => navigate('/clients')}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Add Client</p>
              <p className="text-sm text-muted-foreground">Grow your network</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover cursor-pointer" onClick={() => navigate('/projects')}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="font-semibold">New Project</p>
              <p className="text-sm text-muted-foreground">Start building</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover cursor-pointer border-accent/20" onClick={() => navigate('/client-portal')}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center glow-accent">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-semibold">Client Portal</p>
              <p className="text-sm text-muted-foreground">Preview demo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-hover border-l-4 border-l-success">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-2">
              <span className="text-success font-semibold">↑ 12.5%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Clients</CardTitle>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeClients}</div>
            <p className="text-xs text-muted-foreground mt-2">
              <span className="text-success font-semibold">+2</span> new this month
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover border-l-4 border-l-warning">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Invoices</CardTitle>
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats.pendingInvoices.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-2">3 invoices awaiting payment</p>
          </CardContent>
        </Card>

        <Card className="card-hover border-l-4 border-l-accent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.completionRate}%</div>
            <p className="text-xs text-muted-foreground mt-2">Project success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Cashflow Chart with What-If Slider */}
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
            <Slider
              value={whatIfMultiplier}
              onValueChange={setWhatIfMultiplier}
              min={0.5}
              max={2}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-3">
              💡 Adjust to see how changes in client acquisition affect your cashflow
            </p>
          </div>

          <div className="w-full h-[250px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={adjustedCashflowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: 8 }} />
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

      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Active Projects */}
        <Card className="card-hover">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-balance">Active Projects</CardTitle>
              <Link to="/projects">
                <Button variant="ghost" size="sm" className="text-accent hover:text-accent">
                  View All →
                </Button>
              </Link>
            </div>
            <CardDescription>Projects currently in progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projects.slice(0, 4).map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-muted/80 transition-colors cursor-pointer"
                  onClick={() => navigate('/projects')}
                >
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
              {tasks.map((task) => {
                const isCompleted = completedTasks.has(task.id);
                return (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/80 transition-all ${
                      isCompleted ? 'animate-success' : ''
                    }`}
                    onClick={() => !isCompleted && handleTaskComplete(task.id)}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 mt-0.5 shrink-0 transition-colors ${
                        isCompleted ? 'text-success' : 'text-muted-foreground'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
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
