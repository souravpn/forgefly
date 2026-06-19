import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Package as PackageIcon, Edit, Trash2, DollarSign,
  Calendar, Search, Sparkles, Check, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBusiness } from '@/contexts/CurrentBusinessContext';
import type { Package } from '@/types/types';
import {
  getPackages, createPackage, updatePackage,
  deletePackage, subscribeToPackages,
} from '@/services/packageService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedService {
  name: string;
  price: string;
  type: 'project' | 'retainer' | 'hourly';
  description?: string;
  deliverables?: string[];
}

interface DbService extends ExtractedService {
  id: string;
  sort_order: number;
}


type ServiceFormData = {
  name: string;
  price: string;
  type: 'project' | 'retainer' | 'hourly';
  description: string;
  deliverables: string;
};

const EMPTY_FORM: ServiceFormData = {
  name: '', price: '', type: 'project', description: '', deliverables: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeLabel(type: string) {
  if (type === 'retainer') return 'Retainer';
  if (type === 'hourly') return 'Hourly';
  return 'Project';
}

function typeBadgeClass(type: string) {
  if (type === 'retainer') return 'bg-violet-500/10 text-violet-600 border-violet-500/20';
  if (type === 'hourly') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
}

// ─── Service card ─────────────────────────────────────────────────────────────

function ServiceCard({
  service,
  onEdit,
  onDelete,
}: {
  service: ExtractedService;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="card-hover h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{service.name}</CardTitle>
          <Badge variant="outline" className={`shrink-0 text-xs ${typeBadgeClass(service.type)}`}>
            {typeLabel(service.type)}
          </Badge>
        </div>
        <p className="text-lg font-bold text-foreground">{service.price}</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-0">
        {service.description && (
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed line-clamp-2">
            {service.description}
          </p>
        )}
        {service.deliverables && service.deliverables.length > 0 && (
          <ul className="space-y-1 mb-4 flex-1">
            {service.deliverables.slice(0, 4).map((d, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="w-3 h-3 shrink-0 text-emerald-500" />
                {d}
              </li>
            ))}
            {service.deliverables.length > 4 && (
              <li className="text-xs text-muted-foreground pl-4.5">
                +{service.deliverables.length - 4} more
              </li>
            )}
          </ul>
        )}
        <div className="flex gap-2 pt-3 border-t border-border mt-auto">
          <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
            <Edit className="w-3.5 h-3.5 mr-1.5" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Service form modal ────────────────────────────────────────────────────────

function ServiceModal({
  open,
  onClose,
  onSave,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: ServiceFormData) => void;
  initial: ServiceFormData;
  saving: boolean;
}) {
  const [form, setForm] = useState<ServiceFormData>(initial);

  // Reset when modal opens with new initial value
  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  const isEdit = initial.name !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Service' : 'Add Service'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this service in your Business OS.' : 'Add a new service to your Business OS.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="svc-name">Name *</Label>
              <Input
                id="svc-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Brand Identity Package"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="svc-price">Price *</Label>
                <Input
                  id="svc-price"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="e.g., $4,200 or $150/hr"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={v => setForm(f => ({ ...f, type: v as ServiceFormData['type'] }))}
                >
                  <SelectTrigger id="svc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="retainer">Retainer</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="svc-desc">Description</Label>
              <Textarea
                id="svc-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What's included in this service..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="svc-deliverables">Deliverables (one per line)</Label>
              <Textarea
                id="svc-deliverables"
                value={form.deliverables}
                onChange={e => setForm(f => ({ ...f, deliverables: e.target.value }))}
                placeholder={"Custom logo design\nBrand guidelines\n3 revision rounds"}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim() || !form.price.trim()} className="glow-accent">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add service'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PackagesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { business, extractedData, isLoading: bizLoading } = useBusiness();

  // Services from the services table (migrated from extracted_data)
  const [dbServices, setDbServices] = useState<DbService[]>([]);
  const [svcsLoaded, setSvcsLoaded] = useState(false);

  // Legacy packages (old architecture)
  const [packages, setPackages] = useState<Package[]>([]);
  const [pkgsLoading, setPkgsLoading] = useState(true);

  // Service modal state (editId = services.id, null for new)
  const [serviceModal, setServiceModal] = useState<{
    open: boolean;
    initial: ServiceFormData;
    editId: string | null;
  }>({ open: false, initial: EMPTY_FORM, editId: null });
  const [saving, setSaving] = useState(false);

  // Delete confirm state (services)
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Legacy package modal / delete state
  const [pkgModal, setPkgModal] = useState<{
    open: boolean;
    isEdit: boolean;
    selected: Package | null;
    form: {
      name: string; description: string; one_time_price: string;
      monthly_price: string; features: string; is_active: boolean;
    };
  }>({
    open: false, isEdit: false, selected: null,
    form: { name: '', description: '', one_time_price: '', monthly_price: '', features: '', is_active: true },
  });
  const [pkgDeleting, setPkgDeleting] = useState<Package | null>(null);
  const [pkgSubmitting, setPkgSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPackages();
    const channel = subscribeToPackages(() => { loadPackages(); });
    return () => { channel.unsubscribe(); };
  }, []);

  async function loadPackages() {
    try {
      const data = await getPackages();
      setPackages(data);
    } catch {
      // non-fatal
    } finally {
      setPkgsLoading(false);
    }
  }

  // ── Load services from table, seed from extracted_data if empty ───────────

  // Auto-open create modal when navigated with ?action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setServiceModal({ open: true, initial: EMPTY_FORM, editId: null });
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Dwell beacon: mark services_reviewed after 10s on page
  useEffect(() => {
    if (!business) return;
    const milestones = business.onboarding_milestones;
    if (milestones?.services_reviewed) return;
    const t = setTimeout(() => {
      supabase.functions.invoke('mark-milestone', { body: { milestone: 'services_reviewed' } });
    }, 10_000);
    return () => clearTimeout(t);
  }, [business]);

  useEffect(() => {
    if (!business || svcsLoaded) return;
    ;(async () => {
      const { data } = await supabase
        .from('services')
        .select('id, name, price, type, description, deliverables, sort_order')
        .eq('business_id', business.id)
        .order('sort_order', { ascending: true });

      if (data && data.length > 0) {
        setDbServices(data as DbService[]);
        setSvcsLoaded(true);
        return;
      }

      // Seed from extracted_data if table is empty
      const raw = (extractedData?.services ?? []) as ExtractedService[];
      if (raw.length === 0) { setSvcsLoaded(true); return; }

      const inserted: DbService[] = [];
      for (let i = 0; i < raw.length; i++) {
        const s = raw[i];
        const { data: row } = await supabase
          .from('services')
          .insert({
            business_id: business.id,
            name: s.name,
            price: s.price,
            type: s.type ?? 'project',
            description: s.description ?? null,
            deliverables: s.deliverables ?? [],
            sort_order: i,
          })
          .select('id, name, price, type, description, deliverables, sort_order')
          .single();
        if (row) inserted.push(row as DbService);
      }
      setDbServices(inserted);
      setSvcsLoaded(true);
    })();
  }, [business, svcsLoaded, extractedData]);

  // ── Service CRUD ──────────────────────────────────────────────────────────

  function openAddService() {
    setServiceModal({ open: true, initial: EMPTY_FORM, editId: null });
  }

  function openEditService(id: string) {
    const svc = dbServices.find(s => s.id === id);
    if (!svc) return;
    setServiceModal({
      open: true,
      editId: id,
      initial: {
        name: svc.name,
        price: svc.price,
        type: svc.type ?? 'project',
        description: svc.description ?? '',
        deliverables: (svc.deliverables ?? []).join('\n'),
      },
    });
  }

  async function handleServiceSave(data: ServiceFormData) {
    if (!business) return;
    setSaving(true);
    try {
      const payload = {
        name: data.name.trim(),
        price: data.price.trim(),
        type: data.type,
        description: data.description.trim() || null,
        deliverables: data.deliverables
          ? data.deliverables.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
      };

      if (serviceModal.editId) {
        await supabase.from('services').update(payload).eq('id', serviceModal.editId);
        setDbServices(prev => prev.map(s =>
          s.id === serviceModal.editId ? { ...s, ...payload, deliverables: payload.deliverables } : s,
        ));
        toast.success('Service updated');
      } else {
        const { data: row } = await supabase
          .from('services')
          .insert({ ...payload, business_id: business.id, sort_order: dbServices.length })
          .select('id, name, price, type, description, deliverables, sort_order')
          .single();
        if (row) setDbServices(prev => [...prev, row as DbService]);
        toast.success('Service added');
      }
      setServiceModal({ open: false, initial: EMPTY_FORM, editId: null });
    } catch {
      toast.error('Failed to save service');
    } finally {
      setSaving(false);
    }
  }

  async function handleServiceDelete(id: string) {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) { toast.error('Failed to delete service'); return; }
    setDbServices(prev => prev.filter(s => s.id !== id));
    setDeleteId(null);
    toast.success('Service deleted');
  }

  // ── Legacy package handlers ───────────────────────────────────────────────

  async function handlePkgSubmit(e: React.FormEvent) {
    e.preventDefault();
    const f = pkgModal.form;
    if (!f.one_time_price && !f.monthly_price) {
      toast.error('Provide at least one price');
      return;
    }
    setPkgSubmitting(true);
    try {
      const data = {
        name: f.name, description: f.description || null,
        one_time_price: f.one_time_price ? parseFloat(f.one_time_price) : null,
        monthly_price: f.monthly_price ? parseFloat(f.monthly_price) : null,
        features: f.features || null, is_active: f.is_active,
      };
      if (pkgModal.isEdit && pkgModal.selected) {
        await updatePackage(pkgModal.selected.id, data);
        toast.success('Package updated');
      } else {
        await createPackage(data);
        toast.success('Package created');
      }
      setPkgModal(s => ({ ...s, open: false }));
      loadPackages();
    } catch {
      toast.error('Failed to save package');
    } finally {
      setPkgSubmitting(false);
    }
  }

  async function handlePkgDelete() {
    if (!pkgDeleting) return;
    try {
      await deletePackage(pkgDeleting.id);
      toast.success('Package deleted');
      setPkgDeleting(null);
      loadPackages();
    } catch {
      toast.error('Failed to delete package');
    }
  }

  async function handlePkgToggle(pkg: Package) {
    try {
      await updatePackage(pkg.id, { is_active: !pkg.is_active });
      loadPackages();
    } catch {
      toast.error('Failed to update package');
    }
  }

  const hasBusiness = !bizLoading && !!business;
  const filteredServices = dbServices.filter(s => {
    const q = searchQuery.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
  });
  const filteredPackages = packages.filter(p => {
    const q = searchQuery.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 md:space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-1">Services</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {hasBusiness
              ? 'Your AI-generated service catalog — edit anytime'
              : 'Manage your service offerings'}
          </p>
        </div>
        {hasBusiness ? (
          <Button size="lg" className="glow-accent w-full md:w-auto" onClick={openAddService}>
            <Plus className="w-5 h-5 mr-2" />
            Add Service
          </Button>
        ) : (
          <Button size="lg" className="glow-accent w-full md:w-auto" onClick={() => setPkgModal(s => ({
            ...s, open: true, isEdit: false, selected: null,
            form: { name: '', description: '', one_time_price: '', monthly_price: '', features: '', is_active: true },
          }))}>
            <Plus className="w-5 h-5 mr-2" />
            Create Package
          </Button>
        )}
      </div>

      {/* ── Generate CTA (no business) ─────────────────────────────────── */}
      {!bizLoading && !business && (
        <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold">Auto-populate from your Business OS</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Generate your business OS and your full service catalog is populated instantly.
                </p>
              </div>
            </div>
            <Button variant="outline" className="shrink-0" onClick={() => navigate('/')}>
              Generate now
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search services…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* ── Business OS services ────────────────────────────────────────── */}
      {hasBusiness && (
        bizLoading ? (
          <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-40 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <PackageIcon className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No services yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm text-pretty">
                Add your first service or update your Business OS prompt to include your offerings.
              </p>
              <Button onClick={openAddService} className="glow-accent">
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map(svc => (
              <ServiceCard
                key={svc.id}
                service={svc}
                onEdit={() => openEditService(svc.id)}
                onDelete={() => setDeleteId(svc.id)}
              />
            ))}
          </div>
        )
      )}

      {/* ── Legacy packages (only if they exist) ───────────────────────── */}
      {!pkgsLoading && packages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Service Packages</h2>
              <p className="text-xs text-muted-foreground">Stripe-linked packages from your legacy catalog</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPkgModal(s => ({
              ...s, open: true, isEdit: false, selected: null,
              form: { name: '', description: '', one_time_price: '', monthly_price: '', features: '', is_active: true },
            }))}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Package
            </Button>
          </div>

          <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPackages.map(pkg => (
              <Card key={pkg.id} className="card-hover h-full flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{pkg.name}</CardTitle>
                    <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                      {pkg.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {pkg.description && (
                    <p className="text-sm text-muted-foreground mb-4 text-pretty">{pkg.description}</p>
                  )}
                  <div className="space-y-2 mb-4">
                    {pkg.one_time_price && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-accent" />
                        <span className="font-semibold text-accent">${pkg.one_time_price.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground">one-time</span>
                      </div>
                    )}
                    {pkg.monthly_price && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-accent" />
                        <span className="font-semibold text-accent">${pkg.monthly_price.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground">per month</span>
                      </div>
                    )}
                  </div>
                  {pkg.features && (
                    <div className="mb-4 flex-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Features</p>
                      <p className="text-sm whitespace-pre-line text-pretty">{pkg.features}</p>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 pt-4 border-t border-border mt-auto">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active</span>
                      <Switch checked={pkg.is_active} onCheckedChange={() => handlePkgToggle(pkg)} />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setPkgModal({
                        open: true, isEdit: true, selected: pkg,
                        form: {
                          name: pkg.name, description: pkg.description ?? '',
                          one_time_price: pkg.one_time_price?.toString() ?? '',
                          monthly_price: pkg.monthly_price?.toString() ?? '',
                          features: pkg.features ?? '', is_active: pkg.is_active,
                        },
                      })}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPkgDeleting(pkg)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── No business + no packages ───────────────────────────────────── */}
      {!hasBusiness && !pkgsLoading && packages.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <PackageIcon className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No packages yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-pretty">
              Create service packages to offer your clients flexible pricing options.
            </p>
            <Button onClick={() => setPkgModal(s => ({
              ...s, open: true, isEdit: false, selected: null,
              form: { name: '', description: '', one_time_price: '', monthly_price: '', features: '', is_active: true },
            }))} className="glow-accent">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Package
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Service modal (Business OS) ─────────────────────────────────── */}
      <ServiceModal
        open={serviceModal.open}
        onClose={() => setServiceModal({ open: false, initial: EMPTY_FORM, editId: null })}
        onSave={handleServiceSave}
        initial={serviceModal.initial}
        saving={saving}
      />

      {/* ── Service delete confirm ──────────────────────────────────────── */}
      <AlertDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{dbServices.find(s => s.id === deleteId)?.name}" from your services? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && handleServiceDelete(deleteId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Legacy package modal ────────────────────────────────────────── */}
      <Dialog open={pkgModal.open} onOpenChange={o => !o && setPkgModal(s => ({ ...s, open: false }))}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pkgModal.isEdit ? 'Edit Package' : 'Create Package'}</DialogTitle>
            <DialogDescription>
              {pkgModal.isEdit ? 'Update package details.' : 'Create a new service package.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePkgSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Package Name *</Label>
                <Input
                  value={pkgModal.form.name}
                  onChange={e => setPkgModal(s => ({ ...s, form: { ...s.form, name: e.target.value } }))}
                  placeholder="e.g., Brand Identity Package"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={pkgModal.form.description}
                  onChange={e => setPkgModal(s => ({ ...s, form: { ...s.form, description: e.target.value } }))}
                  placeholder="What's included..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>One-Time Price ($)</Label>
                  <Input
                    type="number" step="0.01"
                    value={pkgModal.form.one_time_price}
                    onChange={e => setPkgModal(s => ({ ...s, form: { ...s.form, one_time_price: e.target.value } }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Price ($)</Label>
                  <Input
                    type="number" step="0.01"
                    value={pkgModal.form.monthly_price}
                    onChange={e => setPkgModal(s => ({ ...s, form: { ...s.form, monthly_price: e.target.value } }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">* At least one price type required</p>
              <div className="space-y-2">
                <Label>Features (one per line)</Label>
                <Textarea
                  value={pkgModal.form.features}
                  onChange={e => setPkgModal(s => ({ ...s, form: { ...s.form, features: e.target.value } }))}
                  placeholder={"Custom logo\nBrand guidelines\n3 revisions"}
                  rows={4}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={pkgModal.form.is_active}
                  onCheckedChange={v => setPkgModal(s => ({ ...s, form: { ...s.form, is_active: v } }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPkgModal(s => ({ ...s, open: false }))} disabled={pkgSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={pkgSubmitting} className="glow-accent">
                {pkgSubmitting ? 'Saving…' : pkgModal.isEdit ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Legacy package delete confirm ───────────────────────────────── */}
      <AlertDialog open={!!pkgDeleting} onOpenChange={o => !o && setPkgDeleting(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{pkgDeleting?.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePkgDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
