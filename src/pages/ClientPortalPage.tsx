import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, DollarSign, Briefcase, CheckCircle2, Clock, Sparkles, Download, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ClientPortalPage() {
  const navigate = useNavigate();
  
  const clientData = {
    name: 'TechStart Inc',
    contactPerson: 'Sarah Johnson',
    projects: [
      { 
        id: '1', 
        name: 'Brand Identity Design', 
        status: 'in_progress', 
        progress: 65,
        description: 'Complete brand identity including logo, color palette, and brand guidelines',
        startDate: '2026-04-01',
        dueDate: '2026-05-30',
        deliverables: ['Logo Design', 'Brand Guidelines', 'Business Cards', 'Letterhead']
      },
      { 
        id: '2', 
        name: 'Website Mockups', 
        status: 'completed', 
        progress: 100,
        description: 'High-fidelity mockups for homepage and key landing pages',
        startDate: '2026-03-15',
        dueDate: '2026-04-15',
        deliverables: ['Homepage Design', 'About Page', 'Services Page', 'Contact Page']
      },
      { 
        id: '3', 
        name: 'Marketing Collateral', 
        status: 'review', 
        progress: 90,
        description: 'Brochures, flyers, and social media templates',
        startDate: '2026-04-20',
        dueDate: '2026-05-25',
        deliverables: ['Tri-fold Brochure', 'Flyer Design', 'Social Templates']
      },
    ],
    proposals: [
      { 
        id: '1', 
        title: 'Social Media Package', 
        status: 'pending', 
        value: 1800,
        description: 'Monthly social media content creation and management',
        validUntil: '2026-05-31'
      },
      { 
        id: '2', 
        title: 'Video Production Services', 
        status: 'approved', 
        value: 4500,
        description: 'Brand story video and product showcase videos',
        validUntil: '2026-06-15'
      },
    ],
    invoices: [
      { id: '1', number: 'INV-001', amount: 3200, status: 'paid', dueDate: '2026-04-15', description: 'Brand Identity - Initial Payment' },
      { id: '2', number: 'INV-002', amount: 2400, status: 'pending', dueDate: '2026-05-20', description: 'Website Mockups - Final Payment' },
      { id: '3', number: 'INV-003', amount: 1600, status: 'pending', dueDate: '2026-05-28', description: 'Brand Identity - Milestone 2' },
    ],
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'review':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'approved':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'paid':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Branded Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center glow-accent">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-balance">Forgefly</h1>
                <p className="text-xs text-muted-foreground">Client Portal</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/settings')}>
              Exit Preview
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-3">
          <h2 className="text-4xl md:text-5xl font-bold text-balance">
            Welcome back, {clientData.contactPerson}
          </h2>
          <p className="text-lg text-muted-foreground">{clientData.name}</p>
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-accent">{clientData.projects.length}</p>
              <p className="text-sm text-muted-foreground">Active Projects</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-center">
              <p className="text-3xl font-bold text-warning">{clientData.invoices.filter(i => i.status === 'pending').length}</p>
              <p className="text-sm text-muted-foreground">Pending Invoices</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{clientData.proposals.filter(p => p.status === 'pending').length}</p>
              <p className="text-sm text-muted-foreground">Awaiting Review</p>
            </div>
          </div>
        </div>

        {/* Active Projects */}
        <Card className="card-hover">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-balance">Your Projects</CardTitle>
                <CardDescription>Track progress and view deliverables</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {clientData.projects.map((project) => (
                <div key={project.id} className="p-6 rounded-lg bg-muted/50 border border-border hover:border-accent/50 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-balance mb-2">{project.name}</h3>
                      <p className="text-sm text-muted-foreground text-pretty mb-3">{project.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Start: {new Date(project.startDate).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Due: {new Date(project.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge className={getStatusColor(project.status)}>
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Progress</span>
                      <span className="text-sm font-bold text-accent">{project.progress}%</span>
                    </div>
                    <div className="w-full h-3 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent to-primary transition-all duration-500"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Deliverables:</p>
                    <div className="flex flex-wrap gap-2">
                      {project.deliverables.map((deliverable, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {deliverable}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {project.status === 'review' && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <Button className="w-full" variant="outline" onClick={() => {}}>
                        <Eye className="w-4 h-4 mr-2" />
                        Review Deliverables
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Proposals */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <CardTitle className="text-balance">Proposals</CardTitle>
              </div>
              <CardDescription>Review and accept proposals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {clientData.proposals.map((proposal) => (
                  <div key={proposal.id} className="p-4 rounded-lg bg-muted">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-balance">{proposal.title}</h4>
                      <Badge variant="outline">{proposal.status}</Badge>
                    </div>
                    <p className="text-sm font-semibold text-primary mb-3">
                      ${proposal.value.toLocaleString()}
                    </p>
                    <Button size="sm" className="w-full" onClick={() => {}}>
                      View Proposal
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card className="card-hover">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <CardTitle className="text-balance">Invoices</CardTitle>
                  <CardDescription>View and pay outstanding invoices</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {clientData.invoices.map((invoice) => (
                  <div key={invoice.id} className="p-5 rounded-lg bg-muted/50 border border-border hover:border-warning/50 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{invoice.number}</h4>
                          <Badge className={getStatusColor(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground text-pretty">{invoice.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-2xl font-bold">
                          ${invoice.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {}}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      {invoice.status === 'pending' && (
                        <Button size="sm" className="flex-1 glow-success" onClick={() => {}}>
                          <DollarSign className="w-4 h-4 mr-2" />
                          Pay Now
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center pt-8 pb-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-2">
            Powered by <span className="font-semibold text-accent">Forgefly</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Questions? Contact your project manager or email support@forgefly.com
          </p>
        </div>
      </div>
    </div>
  );
}
