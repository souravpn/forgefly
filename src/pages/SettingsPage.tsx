import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { BusinessProfile } from "@/types/types";
import { ExternalLink, Eye, CheckCircle2, AlertCircle, Clock, CreditCard, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

type ConnectStatus = {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  status: 'not_connected' | 'pending' | 'under_review' | 'active';
  account_id?: string;
};

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessProfile, setBusinessProfile] =
    useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectStatusLoading, setConnectStatusLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadBusinessProfile();
      loadConnectStatus();
    }
  }, [user]);

  useEffect(() => {
    const connect = searchParams.get('connect');
    if ((connect === 'success' || connect === 'refresh') && user) {
      loadConnectStatus();
      setSearchParams({ tab: 'payments' }, { replace: true });
    }
  }, []);

  const loadBusinessProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setBusinessProfile(data);
    }
  };

  const loadConnectStatus = async () => {
    if (!user) return;
    setConnectStatusLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-connect-status');
      if (!error && data) {
        setConnectStatus(data);
      }
    } finally {
      setConnectStatusLoading(false);
    }
  };

  const handleConnectStripe = async () => {
    if (!user) return;
    setConnectLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account', {
        body: { returnUrl: window.location.href },
      });
      if (error || !data?.url) {
        toast.error('Failed to start Stripe Connect setup');
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error('Something went wrong');
    } finally {
      setConnectLoading(false);
    }
  };

  const handleSaveBusinessProfile = async () => {
    if (!user || !businessProfile) return;

    setLoading(true);
    const { error } = await supabase.from("business_profiles").upsert({
      ...businessProfile,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      toast.error("Failed to save business profile");
    } else {
      toast.success("Business profile updated successfully");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-balance mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and business preferences
          </p>
        </div>
        <Button
          variant="outline"
          className="glow-accent"
          onClick={() => navigate("/client-portal")}
        >
          <Eye className="w-4 h-4 mr-2" />
          Preview Client Portal
        </Button>
      </div>

      <Tabs defaultValue={searchParams.get('tab') || 'business'}>
        <TabsList>
          <TabsTrigger value="business">Business Profile</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="client-portal">Client Portal</TabsTrigger>
          <TabsTrigger value="ai-history">AI History</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-balance">
                Business Information
              </CardTitle>
              <CardDescription>
                Update your business details and branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={businessProfile?.business_name || ""}
                  onChange={(e) =>
                    setBusinessProfile((prev) =>
                      prev ? { ...prev, business_name: e.target.value } : null,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessDescription">
                  Business Description
                </Label>
                <Textarea
                  id="businessDescription"
                  value={businessProfile?.business_description || ""}
                  onChange={(e) =>
                    setBusinessProfile((prev) =>
                      prev
                        ? { ...prev, business_description: e.target.value }
                        : null,
                    )
                  }
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type</Label>
                <Input
                  id="serviceType"
                  value={businessProfile?.service_type || ""}
                  onChange={(e) =>
                    setBusinessProfile((prev) =>
                      prev ? { ...prev, service_type: e.target.value } : null,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  value={businessProfile?.hourly_rate || ""}
                  onChange={(e) =>
                    setBusinessProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            hourly_rate: Number.parseFloat(e.target.value),
                          }
                        : null,
                    )
                  }
                />
              </div>

              <Button onClick={handleSaveBusinessProfile} disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-balance">
                Account Information
              </CardTitle>
              <CardDescription>
                View and manage your account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={profile?.username || ""} disabled />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile?.email || "Not set"} disabled />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={profile?.role || "user"} disabled />
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  Account created:{" "}
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : "Unknown"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-accent" />
                  <CardTitle className="text-balance">Stripe Connect</CardTitle>
                </div>
                <CardDescription>
                  Connect your Stripe account so your clients can pay you directly. Payments go straight to your Stripe account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {connectStatusLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Checking connection status...</span>
                  </div>
                ) : connectStatus?.status === 'active' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-success">Connected & Active</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Payments from your clients go directly to your Stripe account.
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-muted text-sm">
                        <p className="text-muted-foreground text-xs mb-1">Charges</p>
                        <p className="font-medium text-success">Enabled</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted text-sm">
                        <p className="text-muted-foreground text-xs mb-1">Payouts</p>
                        <p className="font-medium text-success">Enabled</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(`https://dashboard.stripe.com`, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Manage on Stripe Dashboard
                    </Button>
                  </div>
                ) : connectStatus?.status === 'under_review' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <Clock className="w-5 h-5 text-yellow-500 shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-yellow-500">Under Review</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Stripe is reviewing your account. This usually takes 1–2 business days.
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={loadConnectStatus}>
                      Refresh Status
                    </Button>
                  </div>
                ) : connectStatus?.status === 'pending' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-yellow-500">Setup Incomplete</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          You started connecting Stripe but didn't finish. Continue setup to accept payments.
                        </p>
                      </div>
                    </div>
                    <Button
                      className="w-full glow-accent"
                      onClick={handleConnectStripe}
                      disabled={connectLoading}
                    >
                      {connectLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                      Continue Stripe Setup
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-6 rounded-lg bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20">
                      <h3 className="font-semibold mb-2">Get paid by your clients</h3>
                      <p className="text-sm text-muted-foreground text-pretty mb-4">
                        Connect your Stripe account to enable client payments. Stripe handles the payment processing — your money goes directly to your bank account.
                      </p>
                      <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success shrink-0" /> Clients pay via credit card, Apple Pay, and more</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success shrink-0" /> Payouts directly to your bank account</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success shrink-0" /> Stripe's standard fees apply (2.9% + 30¢)</li>
                      </ul>
                    </div>
                    <Button
                      className="w-full glow-accent"
                      onClick={handleConnectStripe}
                      disabled={connectLoading}
                    >
                      {connectLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                      Connect Stripe Account
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="client-portal" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-balance">
                Client Portal Settings
              </CardTitle>
              <CardDescription>
                Customize how clients view their projects and invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-6 rounded-lg bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20">
                <div className="flex items-start gap-4">
                  <img
                    src="/forgefly-icon.png"
                    alt="Forgefly Logo"
                    className="w-10 h-10 rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">
                      Client Portal Preview
                    </h3>
                    <p className="text-sm text-muted-foreground text-pretty mb-4">
                      See how your clients experience their dedicated portal
                      with branded project tracking, invoice management, and
                      proposal approvals.
                    </p>
                    <Button
                      className="glow-accent"
                      onClick={() => navigate("/client-portal")}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Open Preview
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="portalBranding">Portal Branding</Label>
                  <Input
                    id="portalBranding"
                    placeholder="Your Business Name"
                    value={businessProfile?.business_name || ""}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Portal uses your business name from Business Profile
                    settings
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Features Enabled</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-sm">Project Tracking</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-sm">Invoice Management</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-sm">Proposal Approvals</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground text-pretty">
                    💡 <strong>Tip:</strong> Share the client portal link with
                    your clients to give them 24/7 access to their projects,
                    invoices, and proposals. They'll love the transparency!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-history" className="mt-6">
          <AIHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── AI History Tab ────────────────────────────────────────────────────────────

interface UsageRow {
  id: string;
  model: string;
  prompt_type: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

interface PromptSessionRow {
  id: string;
  prompt: string;
  prompt_type: string;
  created_at: string;
  extracted_data_snapshot: { diff_summary?: { sections_updated?: string[] } } | null;
}

function AIHistoryTab() {
  const [usageLogs, setUsageLogs] = useState<UsageRow[]>([]);
  const [promptSessions, setPromptSessions] = useState<PromptSessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [{ data: logs }, { data: sessions }] = await Promise.all([
        supabase
          .from('ai_usage_log')
          .select('id, model, prompt_type, input_tokens, output_tokens, cost_usd, created_at')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('prompt_sessions')
          .select('id, prompt, prompt_type, created_at, extracted_data_snapshot')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      setUsageLogs((logs as UsageRow[]) ?? []);
      setPromptSessions((sessions as PromptSessionRow[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthLogs = usageLogs.filter(r => new Date(r.created_at) >= monthStart);
  const monthTokens = thisMonthLogs.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0);
  const monthCost = thisMonthLogs.reduce((s, r) => s + Number(r.cost_usd), 0);

  const modelLabel = (m: string) => m.includes('haiku') ? 'Haiku' : m.includes('sonnet') ? 'Sonnet' : m.includes('opus') ? 'Opus' : m;

  if (loading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      {/* This month summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Tokens this month</p>
            <p className="text-2xl font-bold">{monthTokens.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Cost this month</p>
            <p className="text-2xl font-bold">${monthCost.toFixed(4)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Prompt history */}
      {promptSessions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Business OS prompts</CardTitle>
            <CardDescription>Prompts you used to generate or update your business</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {promptSessions.map(session => {
                const sections = session.extracted_data_snapshot?.diff_summary?.sections_updated ?? [];
                return (
                  <div key={session.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{session.prompt}</p>
                        {sections.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Updated: {sections.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge variant="outline" className="text-[10px] capitalize">{session.prompt_type}</Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage log table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent AI calls</CardTitle>
          <CardDescription>Last 30 calls across all AI features</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {usageLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-6 text-center">No AI usage recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                    <th className="text-left px-4 py-2 font-medium">Type</th>
                    <th className="text-left px-4 py-2 font-medium">Model</th>
                    <th className="text-right px-4 py-2 font-medium">Tokens</th>
                    <th className="text-right px-4 py-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {usageLogs.map(row => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-2 capitalize">{row.prompt_type.replace('_', ' ')}</td>
                      <td className="px-4 py-2">{modelLabel(row.model)}</td>
                      <td className="px-4 py-2 text-right">{(row.input_tokens + row.output_tokens).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">${Number(row.cost_usd).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
