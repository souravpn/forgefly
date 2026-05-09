import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, DollarSign, Briefcase } from 'lucide-react';

export default function ClientPortalPage() {
  const clientData = {
    name: 'TechStart Inc',
    projects: [
      { id: '1', name: 'Brand Identity Design', status: 'in_progress', progress: 65 },
      { id: '2', name: 'Website Mockups', status: 'completed', progress: 100 },
    ],
    proposals: [
      { id: '1', title: 'Social Media Package', status: 'pending', value: 1800 },
    ],
    invoices: [
      { id: '1', number: 'INV-001', amount: 3200, status: 'paid', dueDate: '2026-04-15' },
      { id: '2', number: 'INV-002', amount: 2400, status: 'pending', dueDate: '2026-05-20' },
    ],
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-balance mb-2">Client Portal</h1>
          <p className="text-muted-foreground">Welcome, {clientData.name}</p>
        </div>

        {/* Active Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-primary" />
              <CardTitle className="text-balance">Active Projects</CardTitle>
            </div>
            <CardDescription>Track the progress of your projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clientData.projects.map((project) => (
                <div key={project.id} className="p-4 rounded-lg bg-muted">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-balance">{project.name}</h3>
                    <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{project.progress}% complete</p>
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
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-primary" />
                <CardTitle className="text-balance">Invoices</CardTitle>
              </div>
              <CardDescription>View and pay your invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {clientData.invoices.map((invoice) => (
                  <div key={invoice.id} className="p-4 rounded-lg bg-muted">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{invoice.number}</span>
                      <Badge
                        variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Due: {new Date(invoice.dueDate).toLocaleDateString()}
                    </p>
                    <p className="text-lg font-bold text-primary">
                      ${invoice.amount.toLocaleString()}
                    </p>
                    {invoice.status === 'pending' && (
                      <Button size="sm" className="w-full mt-3" onClick={() => {}}>
                        Pay Now
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
