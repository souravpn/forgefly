import { Check as CheckIcon, ChevronDown, ChevronUp, Copy, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import BrandKitTab from '@/components/preview/BrandKitTab';
import ClientPortalTab from '@/components/preview/ClientPortalTab';
import ContactsTab from '@/components/preview/ContactsTab';
import InvoicesTab from '@/components/preview/InvoicesTab';
import MetricCards from '@/components/preview/MetricCards';
import PipelineTab from '@/components/preview/PipelineTab';
import ProposalsTab from '@/components/preview/ProposalsTab';
import SaveGateBadge from '@/components/preview/SaveGateBadge';
import ServicesTab from '@/components/preview/ServicesTab';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedIdentity {
  name?: string;
  businessName?: string;
  initials?: string;
  tagline?: string;
  location?: string;
  niche?: string;
  email?: string;
  accentColor?: string;
}

interface ExtractedService {
  name: string;
  price: string;
  type?: string;
  description?: string;
  deliverables?: string[];
}

interface ExtractedContact {
  name: string;
  email?: string;
  company?: string;
  role?: string;
  status?: string;
}

interface ExtractedInvoice {
  client: string;
  service: string;
  amount: string;
  status: string;
  date?: string;
  number?: string;
}

interface ExtractedPipeline {
  stages?: string[];
  leads?: Array<{ name: string; stage: string; value: string; service?: string }>;
}

interface ExtractedMetrics {
  monthlyRevenue?: string;
  activeClients?: number;
  pipelineValue?: string;
  avgProjectValue?: string;
}

interface ExtractedBrand {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  tone?: string;
  keywords?: string[];
  fonts?: { heading?: string; body?: string };
}

interface ExtractedProposal {
  intro?: string;
  approach?: string;
  whyUs?: string;
  nextSteps?: string[];
}

export interface ExtractedData {
  identity?: ExtractedIdentity;
  services?: ExtractedService[];
  contacts?: ExtractedContact[];
  invoices?: ExtractedInvoice[];
  pipeline?: ExtractedPipeline;
  metrics?: ExtractedMetrics;
  brand?: ExtractedBrand;
  proposal?: ExtractedProposal;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Services', 'Pipeline', 'Invoices', 'Contacts', 'Proposals', 'Brand Kit', 'Client Portal'] as const;
type TabName = typeof TABS[number];

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s === 'paid') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
  if (s === 'outstanding' || s === 'unpaid') return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  if (s === 'overdue') return 'bg-red-500/15 text-red-400 border-red-500/20';
  return 'bg-gray-500/15 text-gray-400 border-gray-500/20';
}

function stageOrder(stage: string): number {
  const order: Record<string, number> = {
    'Closed Won': 0,
    'Negotiating': 1,
    'Proposal Sent': 2,
    'Qualified': 3,
    'Prospect': 4,
  };
  return order[stage] ?? 5;
}

// ─── Estimated value renderer ────────────────────────────────────────────────

function renderValue(value: string | undefined) {
  if (!value) return null;
  if (value.startsWith('[estimated] ')) {
    const actual = value.replace('[estimated] ', '');
    return (
      <span>
        {actual}
        <span style={{ fontSize: 10, color: 'rgba(107,114,128,1)', marginLeft: 5, fontStyle: 'italic' }}>
          estimated
        </span>
      </span>
    );
  }
  return <>{value}</>;
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ data, accent }: { data: ExtractedData; accent: string }) {
  const invoices = (data.invoices ?? []).slice(0, 3);
  const leads = [...(data.pipeline?.leads ?? [])]
    .sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <MetricCards metrics={data.metrics ?? {}} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent invoices */}
        <div
          className="rounded-xl p-5 bg-white/5"
          style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}
        >
          <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium mb-4">Recent Invoices</p>
          {invoices.length === 0 ? (
            <p className="text-[12px] text-gray-600">No invoices extracted.</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-[500] text-white truncate">{inv.client}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {inv.service}{inv.number ? ` · ${inv.number}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-[500] text-white">{renderValue(inv.amount)}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${statusClass(inv.status)}`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hot pipeline */}
        <div
          className="rounded-xl p-5 bg-white/5"
          style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}
        >
          <p className="text-[11px] uppercase tracking-[0.06em] text-gray-500 font-medium mb-4">Hot Leads</p>
          {leads.length === 0 ? (
            <p className="text-[12px] text-gray-600">No pipeline data extracted.</p>
          ) : (
            <div className="space-y-3">
              {leads.map((lead, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-[500] text-white truncate">{lead.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{lead.service}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-[500]" style={{ color: accent }}>{renderValue(lead.value)}</p>
                    <p className="text-[10px] text-gray-600">{lead.stage}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function GeneratedPortalPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<ExtractedData | null>(null);
  const [prompt, setPrompt] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('Overview');
  const [promptExpanded, setPromptExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('pending_portal');
    if (!raw) {
      navigate('/', { replace: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      // 24h expiry check
      if (parsed.timestamp && Date.now() - parsed.timestamp > 86_400_000) {
        localStorage.removeItem('pending_portal');
        navigate('/', { replace: true });
        return;
      }
      setData(parsed.extracted_data ?? parsed);
      setPrompt(parsed.prompt ?? '');
      setElapsedSeconds(parsed.elapsed_seconds ?? null);
      // Collapse prompt bar on mobile by default
      if (window.innerWidth < 768) setPromptExpanded(false);
    } catch {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!data?.brand) return;
    const root = document.getElementById('preview-root');
    if (!root) return;
    root.style.setProperty('--preview-primary', data.brand.primaryColor || '#1D9E75');
    root.style.setProperty('--preview-secondary', data.brand.secondaryColor || '#085041');
    root.style.setProperty('--preview-accent', data.brand.accentColor || '#E1F5EE');
  }, [data?.brand]);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSave = () => {
    // If already logged in, the pending_portal will be auto-saved by useCurrentBusiness on dashboard load
    navigate(user ? '/dashboard' : '/login?intent=save_portal');
  };

  if (!data) return null;

  const identity = data.identity ?? {};
  const services = data.services ?? [];
  const contacts = data.contacts ?? [];
  const invoices = data.invoices ?? [];
  const pipeline = data.pipeline ?? {};
  const metrics = data.metrics ?? {};
  const brand = data.brand ?? {};
  const proposal = data.proposal ?? {};

  const accent = brand.primaryColor ?? identity.accentColor ?? '#1D9E75';
  const initials = identity.initials ?? (identity.businessName?.slice(0, 2).toUpperCase() ?? 'FY');
  const businessName = identity.businessName ?? identity.name ?? 'Your Business OS';
  const portfolioSlug = businessName.toLowerCase().replace(/\s+/g, '');

  return (
    <div id="preview-root" className="min-h-screen bg-black text-white">
      {/* ── Sticky topbar ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-lg border-b border-white/[0.08]">
        <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'var(--preview-accent)', color: 'var(--preview-primary)' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-[500] text-white leading-none truncate">{businessName}</p>
              {identity.tagline && (
                <p className="text-[11px] text-gray-500 leading-none mt-0.5 truncate">{identity.tagline}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {elapsedSeconds !== null && (
              <div
                className="hidden sm:flex items-center gap-1.5 text-xs rounded-full px-3 py-1"
                style={{ background: 'var(--preview-accent)', color: 'var(--preview-primary)', border: '0.5px solid var(--preview-primary)' }}
              >
                <Sparkles className="w-3 h-3" />
                Generated in {elapsedSeconds}s
              </div>
            )}
            <SaveGateBadge onSave={handleSave} />
          </div>
        </div>
      </div>

      {/* ── Preview banner ────────────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border-b border-white/[0.06]">
        <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-gray-400 shrink-0" />
          <div>
            <p className="text-[14px] font-[500] text-white">This is a preview of your AI-generated Business OS</p>
            <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">
              Sign in to experience the full range of features powered by Forgefly
            </p>
          </div>
        </div>
      </div>

      {/* ── Prompt echo bar ────────────────────────────────────────────────── */}
      {prompt && (
        <div className="border-b border-white/[0.06] bg-white/[0.015]">
          <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-2">
            <button
              type="button"
              onClick={() => setPromptExpanded((v) => !v)}
              className="flex items-center gap-2 text-[11px] text-gray-500 hover:text-gray-400 transition-colors mb-1"
            >
              <span className="uppercase tracking-[0.06em] font-medium">Your prompt</span>
              {promptExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {promptExpanded && (
              <div className="flex items-start gap-3">
                <p className="text-[12px] text-gray-400 flex-1 leading-[1.6] line-clamp-2 break-words">
                  {prompt}
                </p>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="shrink-0 p-1 rounded hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-colors"
                  title="Copy prompt"
                >
                  {copied
                    ? <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                    : <Copy className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab navigation ────────────────────────────────────────────────── */}
      <div className="sticky top-14 z-40 bg-black/95 backdrop-blur border-b border-white/[0.06]">
        <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="relative px-4 py-3 text-[12px] font-medium whitespace-nowrap transition-colors shrink-0"
                  style={{
                    color: isActive ? 'var(--preview-primary)' : 'rgba(156,163,175,1)',
                  }}
                >
                  {tab}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ background: 'var(--preview-primary)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="w-full md:max-w-[60vw] mx-auto px-4 md:px-6 py-5 pb-16">
        {activeTab === 'Overview' && (
          <OverviewTab data={data} accent={accent} />
        )}
        {activeTab === 'Services' && (
          <ServicesTab services={services} accentColor={accent} />
        )}
        {activeTab === 'Pipeline' && (
          <PipelineTab
            leads={pipeline.leads ?? []}
            pipelineValue={metrics.pipelineValue}
            accentColor={accent}
          />
        )}
        {activeTab === 'Invoices' && (
          <InvoicesTab invoices={invoices} />
        )}
        {activeTab === 'Contacts' && (
          <ContactsTab contacts={contacts} accentColor={accent} />
        )}
        {activeTab === 'Proposals' && (
          <ProposalsTab proposal={proposal} accentColor={accent} />
        )}
        {activeTab === 'Brand Kit' && (
          <BrandKitTab
            brand={brand}
            businessName={businessName}
            tagline={identity.tagline}
            email={identity.email}
            location={identity.location}
            initials={initials}
            niche={identity.niche}
          />
        )}
        {activeTab === 'Client Portal' && (
          <ClientPortalTab data={data} slug={portfolioSlug} />
        )}
      </div>
    </div>
  );
}
