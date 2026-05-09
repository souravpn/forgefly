import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Send } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProposalsPage() {
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [proposalContent, setProposalContent] = useState({
    title: 'Brand Identity Design Package',
    client: 'TechStart Inc',
    services: 'Complete brand identity including logo design, color palette, typography system, and brand guidelines.',
    pricing: '3200',
    timeline: '4 weeks',
    terms: 'Payment terms: 50% upfront, 50% upon completion. 3 revision rounds included.',
  });

  const proposals = [
    { id: '1', title: 'Brand Identity Package', client: 'TechStart Inc', status: 'sent', value: 3200, date: '2026-05-01' },
    { id: '2', title: 'Website Redesign', client: 'Design Co', status: 'draft', value: 5500, date: '2026-05-05' },
    { id: '3', title: 'Marketing Materials', client: 'Marketing Pro', status: 'accepted', value: 2400, date: '2026-04-28' },
    { id: '4', title: 'Social Media Graphics', client: 'Startup Labs', status: 'sent', value: 1800, date: '2026-05-03' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'sent':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'accepted':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (selectedProposal) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setSelectedProposal(null)}>
            ← Back to Proposals
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {}}>Save Draft</Button>
            <Button onClick={() => {}}>
              <Send className="w-4 h-4 mr-2" />
              Send to Client
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-balance">Edit Proposal</CardTitle>
              <CardDescription>Customize your proposal content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Proposal Title</Label>
                <Input
                  id="title"
                  value={proposalContent.title}
                  onChange={(e) => setProposalContent({ ...proposalContent, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Client Name</Label>
                <Input
                  id="client"
                  value={proposalContent.client}
                  onChange={(e) => setProposalContent({ ...proposalContent, client: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="services">Services Description</Label>
                <Textarea
                  id="services"
                  value={proposalContent.services}
                  onChange={(e) => setProposalContent({ ...proposalContent, services: e.target.value })}
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricing">Total Investment</Label>
                <Input
                  id="pricing"
                  type="number"
                  value={proposalContent.pricing}
                  onChange={(e) => setProposalContent({ ...proposalContent, pricing: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeline">Timeline</Label>
                <Input
                  id="timeline"
                  value={proposalContent.timeline}
                  onChange={(e) => setProposalContent({ ...proposalContent, timeline: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea
                  id="terms"
                  value={proposalContent.terms}
                  onChange={(e) => setProposalContent({ ...proposalContent, terms: e.target.value })}
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Live Preview */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-balance">Live Preview</CardTitle>
              <CardDescription>How your proposal will look to clients</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 p-6 rounded-lg bg-muted/50 border border-border">
                <div className="text-center border-b border-border pb-6">
                  <h1 className="text-3xl font-bold mb-2 text-balance">{proposalContent.title}</h1>
                  <p className="text-muted-foreground">Prepared for {proposalContent.client}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-3 text-balance">Services Included</h2>
                  <p className="text-sm text-muted-foreground text-pretty">{proposalContent.services}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg bg-card">
                    <p className="text-sm text-muted-foreground mb-1">Investment</p>
                    <p className="text-2xl font-bold text-primary">${Number.parseInt(proposalContent.pricing || '0').toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-card">
                    <p className="text-sm text-muted-foreground mb-1">Timeline</p>
                    <p className="text-2xl font-bold">{proposalContent.timeline}</p>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-3 text-balance">Terms & Conditions</h2>
                  <p className="text-sm text-muted-foreground text-pretty">{proposalContent.terms}</p>
                </div>

                <div className="pt-6 border-t border-border text-center">
                  <Button className="w-full" size="lg" onClick={() => {}}>
                    Accept Proposal
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-balance mb-2">Proposals</h1>
          <p className="text-muted-foreground">Create and manage client proposals</p>
        </div>
        <Button onClick={() => setSelectedProposal('new')}>
          <Plus className="w-4 h-4 mr-2" />
          New Proposal
        </Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid gap-4">
            {proposals.map((proposal) => (
              <Card
                key={proposal.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedProposal(proposal.id)}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1 text-balance">{proposal.title}</h3>
                      <p className="text-sm text-muted-foreground">{proposal.client}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <p className="font-semibold text-lg">${proposal.value.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(proposal.date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className={getStatusColor(proposal.status)}>
                      {proposal.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
