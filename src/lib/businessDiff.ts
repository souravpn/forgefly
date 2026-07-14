import { supabase } from '@/db/supabase';
import type { Business } from '@/hooks/useCurrentBusiness';

export interface DiffLine {
  type: '+' | '~';
  label: string;
  detail?: string;
}

export interface PendingDiff {
  mergedData: Record<string, unknown>;
  sections: string[];
  lines: DiffLine[];
}

type RawData = Record<string, unknown>;

function asArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asObj<T>(v: unknown): Partial<T> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Partial<T>) : {};
}

export function buildDiffLines(old: RawData, next: RawData, sections: string[]): DiffLine[] {
  const lines: DiffLine[] = [];

  for (const section of sections) {
    const o = old[section];
    const n = next[section];

    if (section === 'services') {
      type Svc = { name?: string; price?: string };
      const oldSvcs = asArr<Svc>(o);
      const newSvcs = asArr<Svc>(n);
      const oldNames = new Set(oldSvcs.map(s => s.name));
      const newNames = new Set(newSvcs.map(s => s.name));
      for (const svc of newSvcs) {
        if (!oldNames.has(svc.name)) {
          lines.push({ type: '+', label: 'service', detail: `${svc.name}${svc.price ? ` · ${svc.price}` : ''}` });
        } else {
          const prev = oldSvcs.find(s => s.name === svc.name);
          if (prev?.price !== svc.price) {
            lines.push({ type: '~', label: svc.name ?? 'service', detail: `${prev?.price ?? '—'} → ${svc.price}` });
          }
        }
      }
      for (const svc of oldSvcs) {
        if (!newNames.has(svc.name)) {
          lines.push({ type: '~', label: 'service removed', detail: svc.name ?? '' });
        }
      }
    }

    if (section === 'metrics') {
      type M = { monthlyRevenue?: string; pipelineValue?: string; avgProjectValue?: string };
      const om = asObj<M>(o);
      const nm = asObj<M>(n);
      const pairs: Array<[string, keyof M]> = [
        ['monthly revenue', 'monthlyRevenue'],
        ['avg. project value', 'avgProjectValue'],
        ['pipeline value', 'pipelineValue'],
      ];
      for (const [label, key] of pairs) {
        if (nm[key] && om[key] !== nm[key]) {
          lines.push({ type: '~', label, detail: `${om[key] ?? '—'} → ${nm[key]}` });
        }
      }
    }

    if (section === 'identity') {
      type Id = { tagline?: string; niche?: string; businessName?: string };
      const oi = asObj<Id>(o);
      const ni = asObj<Id>(n);
      if (ni.businessName && oi.businessName !== ni.businessName) {
        lines.push({ type: '~', label: 'business name', detail: `${oi.businessName ?? '—'} → ${ni.businessName}` });
      }
      if (ni.tagline && oi.tagline !== ni.tagline) {
        lines.push({ type: '~', label: 'tagline', detail: `"${oi.tagline ?? ''}" → "${ni.tagline}"` });
      }
      if (ni.niche && oi.niche !== ni.niche) {
        lines.push({ type: '~', label: 'niche', detail: `${oi.niche ?? '—'} → ${ni.niche}` });
      }
    }

    if (section === 'brand') {
      type Br = { primaryColor?: string; secondaryColor?: string; keywords?: string[] };
      const ob = asObj<Br>(o);
      const nb = asObj<Br>(n);
      if (nb.primaryColor && ob.primaryColor !== nb.primaryColor) {
        lines.push({ type: '~', label: 'brand color', detail: `${ob.primaryColor ?? '—'} → ${nb.primaryColor}` });
      }
      const oldKw = new Set(ob.keywords ?? []);
      const added = (nb.keywords ?? []).filter(k => !oldKw.has(k));
      if (added.length > 0) {
        lines.push({ type: '+', label: 'keyword', detail: added.join(', ') });
      }
    }

    if (section === 'contacts') {
      type Contact = { name?: string; email?: string; phone?: string; company?: string };
      const oldContacts = asArr<Contact>(o);
      const newContacts = asArr<Contact>(n);
      const oldNames = new Set(oldContacts.map(c => c.name?.toLowerCase()));
      for (const c of newContacts) {
        if (c.name && !oldNames.has(c.name.toLowerCase())) {
          const detail = [c.name, c.email, c.phone, c.company].filter(Boolean).join(' · ');
          lines.push({ type: '+', label: 'client', detail });
        }
      }
    }

    if (section === 'pipeline') {
      type Lead = { name?: string; value?: string; stage?: string };
      type Pipeline = { leads?: Lead[] };
      const oldLeads = asArr<Lead>(asObj<Pipeline>(o).leads);
      const newLeads = asArr<Lead>(asObj<Pipeline>(n).leads);
      const oldNames = new Set(oldLeads.map(l => l.name));
      for (const lead of newLeads) {
        if (!oldNames.has(lead.name)) {
          lines.push({
            type: '+',
            label: 'lead',
            detail: `${lead.name}${lead.value ? ` · ${lead.value}` : ''}${lead.stage ? ` (${lead.stage})` : ''}`,
          });
        }
      }
    }

    if (section === 'proposal') {
      type Pr = { intro?: string; approach?: string };
      const op = asObj<Pr>(o);
      const np = asObj<Pr>(n);
      if (np.intro && op.intro !== np.intro) lines.push({ type: '~', label: 'proposal intro', detail: 'updated' });
      if (np.approach && op.approach !== np.approach) lines.push({ type: '~', label: 'proposal approach', detail: 'updated' });
    }
  }

  // Fallback: if no specific diff lines generated, summarise by section name
  if (lines.length === 0) {
    for (const sec of sections) {
      lines.push({ type: '~', label: sec, detail: 'updated' });
    }
  }

  return lines;
}

// Writes the merged extracted_data back to the business, then syncs new
// services/contacts into their own tables. Pulled out of the old CommandBar
// component so both the (now retired) top bar and the merged Freeda panel
// apply changes identically.
export async function applyBusinessDiff(
  business: Business,
  currentExtractedData: RawData | null,
  pending: PendingDiff,
): Promise<void> {
  const { error } = await supabase
    .from('businesses')
    .update({ extracted_data: pending.mergedData })
    .eq('id', business.id);
  if (error) throw error;

  // Sync new services → services table
  if (pending.sections.includes('services')) {
    type Svc = { name?: string; price?: string; type?: string; description?: string; deliverables?: string[] };
    const oldSvcs = asArr<Svc>(currentExtractedData?.services);
    const newSvcs = asArr<Svc>(pending.mergedData?.services);
    const oldNames = new Set(oldSvcs.map(s => s.name?.toLowerCase()).filter(Boolean));
    const toInsert = newSvcs.filter(s => s.name && !oldNames.has(s.name.toLowerCase()));
    if (toInsert.length > 0) {
      const { data: existing } = await supabase
        .from('services')
        .select('sort_order')
        .eq('business_id', business.id)
        .order('sort_order', { ascending: false })
        .limit(1);
      const maxOrder = (existing?.[0]?.sort_order ?? -1) as number;
      const rows = toInsert.map((s, i) => ({
        business_id: business.id,
        name: s.name!,
        price: s.price ?? null,
        type: s.type ?? 'project',
        description: s.description ?? null,
        deliverables: s.deliverables ?? [],
        sort_order: maxOrder + 1 + i,
      }));
      const { error: svcErr } = await supabase.from('services').insert(rows);
      if (svcErr) console.warn('Service sync warning (non-fatal):', svcErr);
    }
  }

  // Sync new contacts → clients table
  if (pending.sections.includes('contacts')) {
    type Contact = { name?: string; email?: string; phone?: string; company?: string; status?: string };
    const oldContacts = asArr<Contact>(currentExtractedData?.contacts);
    const newContacts = asArr<Contact>(pending.mergedData?.contacts);
    const oldNames = new Set(oldContacts.map(c => c.name?.toLowerCase()).filter(Boolean));
    const toInsert = newContacts.filter(c => c.name && !oldNames.has(c.name.toLowerCase()));
    if (toInsert.length > 0) {
      const rows = toInsert.map(c => ({
        user_id: business.user_id,
        name: c.name!,
        email: c.email ?? null,
        phone: c.phone ?? null,
        company: c.company ?? null,
        status: 'active',
        total_value: 0,
      }));
      const { error: clientErr } = await supabase.from('clients').insert(rows);
      if (clientErr) console.warn('Client sync warning (non-fatal):', clientErr);
    }
  }
}
