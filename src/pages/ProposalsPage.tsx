import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Send, Sparkles, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProposalsPage() {
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [proposalContent, setProposalContent] = useState({
    title: 'Brand Identity Design Package',
    client: 'TechStart Inc',
    introduction: 'Thank you for considering our services. We\'re excited to partner with you on this transformative brand identity project.',
    services: 'Complete brand identity including logo design, color palette, typography system, and brand guidelines.',
    deliverables: [
      'Custom Logo Design (3 concepts)',
      'Brand Color Palette',
      'Typography System',
      'Brand Guidelines Document',
      'Business Card Design',
      'Letterhead Template'
    ],
    pricing: '3200',
    timeline: '4 weeks',
    milestones: [
      { phase: 'Discovery & Research', duration: '1 week' },
      { phase: 'Concept Development', duration: '1 week' },
      { phase: 'Refinement & Finalization', duration: '1 week' },
      { phase: 'Delivery & Guidelines', duration: '1 week' }
    ],
    terms: 'Payment terms: 50% upfront, 50% upon completion. 3 revision rounds included. Project timeline begins upon receipt of initial payment.',
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
            <Button className="glow-accent" onClick={() => {}}>
              <Send className="w-4 h-4 mr-2" />
              Send to Client
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
          {/* Editor */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-balance">Proposal Details</CardTitle>
                <CardDescription>Edit the core information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Proposal Title</Label>
                  <Input
                    id="title"
                    value={proposalContent.title}
                    onChange={(e) => setProposalContent({ ...proposalContent, title: e.target.value })}
                    placeholder="e.g., Brand Identity Design Package"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client">Client Name</Label>
                  <Input
                    id="client"
                    value={proposalContent.client}
                    onChange={(e) => setProposalContent({ ...proposalContent, client: e.target.value })}
                    placeholder="e.g., TechStart Inc"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="introduction">Introduction</Label>
                  <Textarea
                    id="introduction"
                    value={proposalContent.introduction}
                    onChange={(e) => setProposalContent({ ...proposalContent, introduction: e.target.value })}
                    className="min-h-[80px]"
                    placeholder="Brief introduction to the proposal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pricing">Total Investment ($)</Label>
                    <Input
                      id="pricing"
                      type="number"
                      value={proposalContent.pricing}
                      onChange={(e) => setProposalContent({ ...proposalContent, pricing: e.target.value })}
                      placeholder="3200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeline">Timeline</Label>
                    <Input
                      id="timeline"
                      value={proposalContent.timeline}
                      onChange={(e) => setProposalContent({ ...proposalContent, timeline: e.target.value })}
                      placeholder="e.g., 4 weeks"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-balance">Services & Deliverables</CardTitle>
                <CardDescription>What's included in this proposal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="services">Services Description</Label>
                  <Textarea
                    id="services"
                    value={proposalContent.services}
                    onChange={(e) => setProposalContent({ ...proposalContent, services: e.target.value })}
                    className="min-h-[100px]"
                    placeholder="Describe the services you'll provide"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terms">Terms & Conditions</Label>
                  <Textarea
                    id="terms"
                    value={proposalContent.terms}
                    onChange={(e) => setProposalContent({ ...proposalContent, terms: e.target.value })}
                    className="min-h-[100px]"
                    placeholder="Payment terms, revision policy, etc."
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Preview */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-br from-primary/5 to-accent/5 border-b">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <CardTitle className="text-balance">Live Preview</CardTitle>
                </div>
                <CardDescription>Real-time preview of your proposal</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
                  {/* Preview Document */}
                  <div className="p-8 md:p-12 space-y-8 bg-background">
                    {/* Header */}
                    <div className="text-center space-y-4 pb-8 border-b-2 border-accent/20">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-accent to-primary glow-accent mb-4">
                        <Sparkles className="w-8 h-8 text-white" />
                      </div>
                      <h1 className="text-4xl font-bold text-balance leading-tight">
                        {proposalContent.title || 'Untitled Proposal'}
                      </h1>
                      <div className="space-y-1">
                        <p className="text-lg text-muted-foreground">
                          Prepared for <span className="font-semibold text-foreground">{proposalContent.client || 'Client Name'}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    {/* Introduction */}
                    {proposalContent.introduction && (
                      <div className="space-y-3">
                        <h2 className="text-2xl font-semibold text-balance">Introduction</h2>
                        <p className="text-muted-foreground text-pretty leading-relaxed">
                          {proposalContent.introduction}
                        </p>
                      </div>
                    )}

                    {/* Services */}
                    <div className="space-y-4">
                      <h2 className="text-2xl font-semibold text-balance">Services Included</h2>
                      <p className="text-muted-foreground text-pretty leading-relaxed">
                        {proposalContent.services || 'No services description provided.'}
                      </p>
                      
                      {/* Deliverables */}
                      <div className="grid gap-3 mt-6">
                        {proposalContent.deliverables.map((deliverable, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                            <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                            <span className="text-sm font-medium">{deliverable}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Investment & Timeline */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="p-6 rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 border-2 border-accent/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-accent" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">Total Investment</p>
                        </div>
                        <p className="text-4xl font-bold text-accent">
                          ${Number.parseInt(proposalContent.pricing || '0').toLocaleString()}
                        </p>
                      </div>

                      <div className="p-6 rounded-xl bg-muted/50 border-2 border-border">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-primary" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">Timeline</p>
                        </div>
                        <p className="text-4xl font-bold">
                          {proposalContent.timeline || 'TBD'}
                        </p>
                      </div>
                    </div>

                    {/* Project Milestones */}
                    <div className="space-y-4">
                      <h2 className="text-2xl font-semibold text-balance">Project Milestones</h2>
                      <div className="space-y-3">
                        {proposalContent.milestones.map((milestone, idx) => (
                          <div key={idx} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                              <span className="text-sm font-bold text-accent">{idx + 1}</span>
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold">{milestone.phase}</p>
                              <p className="text-sm text-muted-foreground">{milestone.duration}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Terms */}
                    <div className="space-y-3 p-6 rounded-lg bg-muted/30 border border-border">
                      <h2 className="text-xl font-semibold text-balance">Terms & Conditions</h2>
                      <p className="text-sm text-muted-foreground text-pretty leading-relaxed">
                        {proposalContent.terms || 'No terms specified.'}
                      </p>
                    </div>

                    {/* CTA */}
                    <div className="pt-8 border-t-2 border-accent/20 text-center space-y-4">
                      <Button size="lg" className="w-full md:w-auto px-12 glow-accent" onClick={() => {}}>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Accept Proposal
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        By accepting, you agree to the terms and conditions outlined above
                      </p>
                    </div>

                    {/* Footer */}
                    <div className="pt-8 border-t text-center">
                      <p className="text-sm text-muted-foreground">
                        Powered by <span className="font-semibold text-accent">Forgefly</span>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
