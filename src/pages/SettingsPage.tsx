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
import { ExternalLink, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [businessProfile, setBusinessProfile] =
    useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadBusinessProfile();
    }
  }, [user]);

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

      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business">Business Profile</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="client-portal">Client Portal</TabsTrigger>
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
                    src="/public/forgefly-icon.png"
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
      </Tabs>
    </div>
  );
}
