import { AlertCircle, AlertTriangle, Bell, CheckCircle2, ChevronDown, Clock, CreditCard, Download, ExternalLink, Eye, Globe, Loader2, Trash2, Wallet } from "lucide-react";
import QRCode from 'qrcode';
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/common/UpgradeModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/CurrentBusinessContext";
import { supabase } from "@/db/supabase";
import type { BusinessProfile } from "@/types/types";

const TIMEZONES = [
  { value: 'Pacific/Honolulu',    label: 'Hawaii (UTC-10)' },
  { value: 'America/Anchorage',   label: 'Alaska (UTC-9)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (UTC-8/7)' },
  { value: 'America/Denver',      label: 'Mountain Time (UTC-7/6)' },
  { value: 'America/Phoenix',     label: 'Arizona (UTC-7)' },
  { value: 'America/Chicago',     label: 'Central Time (UTC-6/5)' },
  { value: 'America/New_York',    label: 'Eastern Time (UTC-5/4)' },
  { value: 'America/Sao_Paulo',   label: 'São Paulo (UTC-3)' },
  { value: 'Europe/London',       label: 'London (UTC+0/1)' },
  { value: 'Europe/Paris',        label: 'Paris / Berlin (UTC+1/2)' },
  { value: 'Europe/Helsinki',     label: 'Helsinki (UTC+2/3)' },
  { value: 'Asia/Dubai',          label: 'Dubai (UTC+4)' },
  { value: 'Asia/Kolkata',        label: 'India (UTC+5:30)' },
  { value: 'Asia/Singapore',      label: 'Singapore (UTC+8)' },
  { value: 'Asia/Tokyo',          label: 'Tokyo (UTC+9)' },
  { value: 'Australia/Sydney',    label: 'Sydney (UTC+10/11)' },
  { value: 'Pacific/Auckland',    label: 'Auckland (UTC+12/13)' },
];

type ConnectStatus = {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  status: 'not_connected' | 'pending' | 'under_review' | 'active';
  account_id?: string;
};

export default function SettingsPage() {
  const { user, profile, signOut, subscription } = useAuth();
  const { business } = useBusiness();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessProfile, setBusinessProfile] =
    useState<BusinessProfile | null>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectStatusLoading, setConnectStatusLoading] = useState(false);
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Public identity (writes to businesses table)
  const [publicIdent, setPublicIdent] = useState({
    name: '',
    slug: '',
    bio: '',
    contact_email: '',
    contact_phone: '',
  });
  const [publicIdentLoading, setPublicIdentLoading] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [originalSlug, setOriginalSlug] = useState('');

  // Notification preferences (timezone for daily digest)
  const [notifTimezone, setNotifTimezone] = useState('');
  const [notifLoading, setNotifLoading] = useState(false);

  // Tax / Finances settings
  const [taxFilingStatus, setTaxFilingStatus] = useState<'single' | 'mfj' | 'mfs' | 'hoh'>('single');
  const [taxHomeOfficeSqft, setTaxHomeOfficeSqft] = useState('');
  const [taxPriorYearLiability, setTaxPriorYearLiability] = useState('');
  const [savingTax, setSavingTax] = useState(false);

  // Delete business
  const [bizDeleteOpen, setBizDeleteOpen] = useState(false);
  const [bizDeleteConfirm, setBizDeleteConfirm] = useState('');
  const [bizDeleting, setBizDeleting] = useState(false);

  // Delete account
  const [acctDeleteOpen, setAcctDeleteOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [acctDeleting, setAcctDeleting] = useState(false);

  // Wallet pass
  const [walletLoading, setWalletLoading] = useState(false);
  const [passQrDataUrl, setPassQrDataUrl] = useState('');

  useEffect(() => {
    if (user) {
      loadBusinessProfile();
      loadConnectStatus();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('subscriptions')
      .select('current_period_end')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setNextBillingDate(data?.current_period_end ?? null));
  }, [user]);

  useEffect(() => {
    if (business) {
      // If businesses.slug isn't set yet, fall back to the user's profile username
      // (which is what PublicPortfolioPage currently uses to resolve the portfolio)
      const slug = business.slug ?? profile?.username ?? '';
      const ident = {
        name: business.name ?? '',
        slug,
        bio: business.bio ?? '',
        contact_email: business.contact_email ?? '',
        contact_phone: business.contact_phone ?? '',
      };
      setPublicIdent(ident);
      setOriginalSlug(slug);

      // Load saved timezone, fall back to browser timezone
      const saved = (business.extracted_data as Record<string, unknown> | null)?.timezone as string | undefined;
      setNotifTimezone(saved ?? Intl.DateTimeFormat().resolvedOptions().timeZone);

      // Load tax settings
      const ts = (business.extracted_data as Record<string, unknown> | null)?.tax_settings as Record<string, unknown> | undefined;
      if (ts) {
        if (ts.filing_status) setTaxFilingStatus(ts.filing_status as 'single' | 'mfj' | 'mfs' | 'hoh');
        if (ts.home_office_sqft != null) setTaxHomeOfficeSqft(String(ts.home_office_sqft));
        if (ts.prior_year_liability != null) setTaxPriorYearLiability(String(ts.prior_year_liability));
      }
    }
  }, [business, profile]);

  useEffect(() => {
    const connect = searchParams.get('connect');
    if ((connect === 'success' || connect === 'refresh') && user) {
      loadConnectStatus();
      setSearchParams({ tab: 'payments' }, { replace: true });
    }
  }, []);

  // Generate pass preview QR whenever the portfolio slug changes
  useEffect(() => {
    const slug = publicIdent.slug;
    if (!slug) return;
    const url = `${window.location.origin}/p/${slug}`;
    QRCode.toDataURL(url, { width: 80, margin: 1, color: { dark: '#ffffff', light: '#00000000' } })
      .then(setPassQrDataUrl).catch(() => {});
  }, [publicIdent.slug]);

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

  const checkSlugAvailability = async (slug: string) => {
    if (!slug || slug === originalSlug) { setSlugStatus('idle'); return; }
    setSlugStatus('checking');
    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .neq('id', business?.id ?? '')
      .maybeSingle();
    setSlugStatus(data ? 'taken' : 'available');
  };

  const handlePublicIdentSlugChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-');
    setPublicIdent(p => ({ ...p, slug: clean }));
    setSlugStatus('idle');
  };

  const addOwnWallet = async () => {
    if (!business) return;
    setWalletLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? anonKey;
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-wallet-pass`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ business_id: business.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${publicIdent.slug || 'portfolio'}.pkpass`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(`Couldn't generate pass: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setWalletLoading(false);
    }
  };

  const handleSavePublicIdent = async () => {
    if (!business) return;
    if (slugStatus === 'taken') { toast.error('That URL slug is already taken.'); return; }
    if (publicIdent.slug !== originalSlug) {
      const confirmed = window.confirm(
        `Changing your public URL from /p/${originalSlug || '(none)'} to /p/${publicIdent.slug} will break any links you've already shared. Continue?`
      );
      if (!confirmed) return;
    }
    setPublicIdentLoading(true);
    const { error } = await supabase
      .from('businesses')
      .update({
        name: publicIdent.name || business.name,
        slug: publicIdent.slug || null,
        bio: publicIdent.bio || null,
        contact_email: publicIdent.contact_email || null,
        contact_phone: publicIdent.contact_phone || null,
      })
      .eq('id', business.id);

    if (user && businessProfile) {
      await supabase.from('business_profiles').upsert({
        ...businessProfile,
        business_description: businessProfile.business_description || null,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      });
    }

    if (error) {
      toast.error('Failed to save public identity');
    } else {
      setOriginalSlug(publicIdent.slug);
      setSlugStatus('idle');
      toast.success('Public identity saved');
    }
    setPublicIdentLoading(false);
  };

  const handleSaveNotifPrefs = async () => {
    if (!business) return;
    setNotifLoading(true);
    const { error } = await supabase
      .from('businesses')
      .update({
        extracted_data: {
          ...(business.extracted_data as Record<string, unknown> ?? {}),
          timezone: notifTimezone,
        },
      })
      .eq('id', business.id);
    if (error) {
      toast.error('Failed to save notification preferences');
    } else {
      toast.success('Notification preferences saved');
    }
    setNotifLoading(false);
  };

  const handleSaveTaxSettings = async () => {
    if (!business) return;
    setSavingTax(true);
    const existing = (business.extracted_data as Record<string, unknown>) ?? {};
    const { error } = await supabase
      .from('businesses')
      .update({
        extracted_data: {
          ...existing,
          tax_settings: {
            filing_status: taxFilingStatus,
            home_office_sqft: parseFloat(taxHomeOfficeSqft) || 0,
            prior_year_liability: parseFloat(taxPriorYearLiability) || 0,
          },
        },
      })
      .eq('id', business.id);
    if (error) {
      toast.error('Failed to save tax settings');
    } else {
      toast.success('Tax settings saved');
    }
    setSavingTax(false);
  };

  const handleDeleteBusiness = async () => {
    if (!business || bizDeleteConfirm !== 'DELETE') return;
    setBizDeleting(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ status: 'archived', archived_at: new Date().toISOString() })
        .eq('id', business.id);
      if (error) throw error;
      toast.success('Business OS archived. You have 7 days to contact support to recover it.');
      navigate('/');
    } catch {
      toast.error('Failed to delete. Please try again.');
    } finally {
      setBizDeleting(false);
    }
  };

  const handleSendOtp = async () => {
    setOtpSending(true);
    try {
      const { error } = await supabase.functions.invoke('request-deletion-otp');
      if (error) throw error;
      setOtpSent(true);
      toast.success('Confirmation code sent to your email.');
    } catch {
      toast.error('Failed to send code. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!otpCode.trim()) return;
    setAcctDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('confirm-account-deletion', {
        body: { code: otpCode.trim() },
      });
      if (error) throw error;
      await signOut();
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code or something went wrong.';
      toast.error(msg);
    } finally {
      setAcctDeleting(false);
    }
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
      </div>

      <Tabs defaultValue={searchParams.get('tab') || 'business'}>
        <TabsList>
          <TabsTrigger value="business">Business Profile</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="finances">Finances</TabsTrigger>
          <TabsTrigger value="ai-history">AI History</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-6 space-y-6">
          {/* Public Identity — writes directly to businesses table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-balance flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Public Identity
              </CardTitle>
              <CardDescription>
                Shown on your public portfolio
                {publicIdent.slug ? (
                  <> at <span className="font-mono text-foreground/80">forgefly.app/p/{publicIdent.slug}</span></>
                ) : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="publicName">Business Name</Label>
                <Input
                  id="publicName"
                  value={publicIdent.name}
                  onChange={(e) => setPublicIdent(p => ({ ...p, name: e.target.value }))}
                  placeholder="Your business name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="publicSlug">Public URL Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">forgefly.app/p/</span>
                  <Input
                    id="publicSlug"
                    value={publicIdent.slug}
                    onChange={(e) => handlePublicIdentSlugChange(e.target.value)}
                    onBlur={() => checkSlugAvailability(publicIdent.slug)}
                    placeholder="your-slug"
                    className="flex-1"
                  />
                </div>
                {slugStatus === 'checking' && <p className="text-xs text-muted-foreground">Checking availability…</p>}
                {slugStatus === 'available' && <p className="text-xs text-emerald-500">✓ Available</p>}
                {slugStatus === 'taken' && <p className="text-xs text-destructive">✗ Already taken — choose another</p>}
                {publicIdent.slug && publicIdent.slug !== originalSlug && slugStatus === 'idle' && (
                  <p className="text-xs text-amber-500">⚠ Changing your slug will break existing shared links</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="publicBio">Bio / About</Label>
                <Textarea
                  id="publicBio"
                  value={publicIdent.bio}
                  onChange={(e) => setPublicIdent(p => ({ ...p, bio: e.target.value }))}
                  placeholder="A short bio shown on your public portfolio…"
                  className="min-h-[80px] resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">{publicIdent.bio.length}/500</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessDescription">
                  Business Description <span className="text-muted-foreground font-normal">(optional)</span>
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
                  placeholder="Describe what your business does…"
                  className="min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="publicEmail">Contact Email (public)</Label>
                  <Input
                    id="publicEmail"
                    type="email"
                    value={publicIdent.contact_email}
                    onChange={(e) => setPublicIdent(p => ({ ...p, contact_email: e.target.value }))}
                    placeholder="hello@yourbusiness.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publicPhone">Contact Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="publicPhone"
                    type="tel"
                    value={publicIdent.contact_phone}
                    onChange={(e) => setPublicIdent(p => ({ ...p, contact_phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">Shown on your public portfolio page</p>

              <Button onClick={handleSavePublicIdent} disabled={publicIdentLoading || slugStatus === 'taken'}>
                {publicIdentLoading ? 'Saving…' : 'Save Public Identity'}
              </Button>
            </CardContent>
          </Card>

          {/* Sharing — wallet pass preview */}
          {business && (() => {
            const primary = business.extracted_data?.brand?.primaryColor ?? '#10B981';
            const r = parseInt(primary.replace('#','').slice(0,2), 16);
            const g = parseInt(primary.replace('#','').slice(2,4), 16);
            const b = parseInt(primary.replace('#','').slice(4,6), 16);
            const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
            const fgColor = lum > 0.5 ? '#000000' : '#ffffff';
            const tagline = business.extracted_data?.identity?.tagline ?? '';
            const bizName = business.extracted_data?.identity?.businessName ?? business.name ?? '';
            const portfolioUrl = publicIdent.slug ? `forgefly.io/p/${publicIdent.slug}` : '';

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-balance flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Sharing
                  </CardTitle>
                  <CardDescription>
                    Your Apple Wallet pass — clients save this after scanning your QR code.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Pass card preview */}
                  <div
                    className="rounded-2xl p-5 flex flex-col gap-3 shadow-md max-w-xs"
                    style={{ backgroundColor: primary, color: fgColor }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div
                          className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold mb-3"
                          style={{ backgroundColor: `${fgColor}20`, color: fgColor }}
                        >
                          {bizName.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="font-bold text-sm leading-snug truncate">{bizName}</p>
                        {tagline && (
                          <p className="text-[11px] mt-1 leading-snug line-clamp-2" style={{ opacity: 0.75 }}>
                            {tagline}
                          </p>
                        )}
                      </div>
                      {passQrDataUrl && (
                        <img src={passQrDataUrl} alt="" width={52} height={52} className="rounded-lg shrink-0 mt-1" />
                      )}
                    </div>
                    {portfolioUrl && (
                      <p className="text-[10px] font-mono" style={{ opacity: 0.6 }}>{portfolioUrl}</p>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Pass uses your brand primary color and auto-updates when your brand kit changes.
                  </p>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={addOwnWallet}
                      disabled={walletLoading || !publicIdent.slug}
                      className="gap-2"
                      style={{ backgroundColor: primary }}
                    >
                      {walletLoading
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Wallet className="h-4 w-4" />}
                      {walletLoading ? 'Generating…' : 'Add to my Wallet'}
                    </Button>
                    {!publicIdent.slug && (
                      <p className="text-xs text-muted-foreground self-center">Set a public URL slug above first.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-balance flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Controls when your daily digest email is delivered
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notifTimezone">Your Timezone</Label>
                <select
                  id="notifTimezone"
                  value={notifTimezone}
                  onChange={(e) => setNotifTimezone(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Your daily digest is sent at 8am in this timezone when you have unread notifications and haven't logged in recently.
                </p>
              </div>
              <Button onClick={handleSaveNotifPrefs} disabled={notifLoading}>
                {notifLoading ? 'Saving…' : 'Save Preferences'}
              </Button>
            </CardContent>
          </Card>

          {/* Delete Business danger zone */}
          <Card className="border-destructive/30">
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => setBizDeleteOpen(o => !o)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-destructive" />
                  <CardTitle className="text-base text-destructive">Delete Business OS</CardTitle>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${bizDeleteOpen ? 'rotate-180' : ''}`}
                />
              </div>
              <CardDescription>
                Permanently remove your Business OS and all its data.
              </CardDescription>
            </CardHeader>

            {bizDeleteOpen && (
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-destructive">This is a destructive action</p>
                    <p className="text-muted-foreground">
                      Deleting your Business OS will archive all associated data including clients, proposals, invoices, and projects.
                      You have <strong>7 days</strong> to contact support to recover it before it is permanently removed.
                      Your account will remain active.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bizDeleteConfirm">
                    Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm
                  </Label>
                  <Input
                    id="bizDeleteConfirm"
                    value={bizDeleteConfirm}
                    onChange={e => setBizDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="border-destructive/30 focus-visible:ring-destructive/50"
                  />
                </div>

                <Button
                  variant="destructive"
                  disabled={bizDeleteConfirm !== 'DELETE' || bizDeleting || !business}
                  onClick={handleDeleteBusiness}
                  className="w-full"
                >
                  {bizDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete Business OS
                </Button>
              </CardContent>
            )}
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

          {/* Billing & Subscription */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-accent" />
                <CardTitle className="text-balance">Billing and Subscription</CardTitle>
              </div>
              <CardDescription>
                Your current plan and billing details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold capitalize">
                      {subscription?.tier ?? "Freelancer"} plan
                    </p>
                    <Badge variant={subscription?.status === "active" ? "default" : "secondary"} className="capitalize">
                      {subscription?.status ?? "active"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {subscription?.tier === "agency"
                      ? `$${subscription.billing_cycle === "yearly" ? "290/yr" : "29/mo"}`
                      : "Free"}
                    {subscription?.billing_cycle && subscription.tier === "agency" && (
                      <span className="capitalize"> · billed {subscription.billing_cycle}</span>
                    )}
                  </p>
                  {nextBillingDate && (
                    <p className="text-sm text-muted-foreground">
                      Next billing date: {new Date(nextBillingDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button onClick={() => setUpgradeModalOpen(true)}>
                  {subscription?.tier === "agency" ? "Manage plan" : "Upgrade your plan"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Delete Account danger zone */}
          <Card className="border-destructive/30 mt-6">
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => setAcctDeleteOpen(o => !o)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-destructive" />
                  <CardTitle className="text-base text-destructive">Delete Account</CardTitle>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${acctDeleteOpen ? 'rotate-180' : ''}`}
                />
              </div>
              <CardDescription>
                Permanently delete your Forgefly account and all data.
              </CardDescription>
            </CardHeader>

            {acctDeleteOpen && (
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-destructive">This action cannot be undone</p>
                    <p className="text-muted-foreground">
                      Deleting your account will permanently erase your profile, Business OS, all clients, proposals, invoices, and projects.
                      You will be signed out immediately and will not be able to recover any data.
                    </p>
                  </div>
                </div>

                {!otpSent ? (
                  <Button
                    variant="outline"
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={handleSendOtp}
                    disabled={otpSending}
                  >
                    {otpSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Send confirmation code to {profile?.email}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="otpCode">Enter the 6-digit code from your email</Label>
                      <Input
                        id="otpCode"
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value)}
                        placeholder="000000"
                        maxLength={6}
                        className="font-mono text-center text-lg tracking-widest border-destructive/30 focus-visible:ring-destructive/50"
                      />
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline"
                        onClick={() => { setOtpSent(false); setOtpCode(''); }}
                      >
                        Resend code
                      </button>
                    </div>

                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={otpCode.length < 6 || acctDeleting}
                      onClick={handleConfirmDeleteAccount}
                    >
                      {acctDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      Permanently Delete My Account
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
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

        <TabsContent value="finances" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tax Estimate Settings</CardTitle>
              <CardDescription>
                Used only for estimates in the Finances → Tax tab. Never filed or sent anywhere.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                These figures are used for rough estimates only. Consult a qualified tax professional before making financial decisions.
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Filing status</Label>
                  <Select value={taxFilingStatus} onValueChange={v => setTaxFilingStatus(v as typeof taxFilingStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="mfj">Married Filing Jointly</SelectItem>
                      <SelectItem value="mfs">Married Filing Separately</SelectItem>
                      <SelectItem value="hoh">Head of Household</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Home office sq ft</Label>
                  <Input
                    type="number"
                    min="0"
                    max="300"
                    placeholder="0"
                    value={taxHomeOfficeSqft}
                    onChange={e => setTaxHomeOfficeSqft(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">IRS simplified method · $5/sqft · max 300 sqft</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Prior year tax liability</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={taxPriorYearLiability}
                    onChange={e => setTaxPriorYearLiability(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Used for safe harbor calculation</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveTaxSettings} disabled={savingTax}>
                  {savingTax ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Saving…</> : 'Save Tax Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="ai-history" className="mt-6">
          <AIHistoryTab />
        </TabsContent>
      </Tabs>

      <UpgradeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} />
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

// Computes the current usage-cycle window anchored to the day-of-month the
// user signed up (e.g. signed up on the 21st → cycle runs 21st to 20th),
// rather than a plain calendar month.
function getUsageCycle(signupDate: Date, now: Date): { start: Date; end: Date } {
  const anchorDay = signupDate.getDate();
  let start = new Date(now.getFullYear(), now.getMonth(), anchorDay);
  if (start > now) {
    start = new Date(now.getFullYear(), now.getMonth() - 1, anchorDay);
  }
  const end = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() - 1);
  return { start, end };
}

function AIHistoryTab() {
  const { profile } = useAuth();
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
  const signupDate = profile?.created_at ? new Date(profile.created_at) : now;
  const cycle = getUsageCycle(signupDate, now);
  const thisMonthLogs = usageLogs.filter(r => new Date(r.created_at) >= cycle.start);
  const monthTokens = thisMonthLogs.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0);
  const monthCost = thisMonthLogs.reduce((s, r) => s + Number(r.cost_usd), 0);
  const cycleLabel = `${cycle.start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} to ${cycle.end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  const modelLabel = (m: string) => m.includes('haiku') ? 'Haiku' : m.includes('sonnet') ? 'Sonnet' : m.includes('opus') ? 'Opus' : m;

  if (loading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Current usage cycle */}
      <div className="w-full rounded-lg bg-primary/10 text-primary text-sm font-medium text-center py-2 px-4">
        {cycleLabel}
      </div>

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
