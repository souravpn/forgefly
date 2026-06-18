import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const TOGGL_BASE = 'https://api.track.toggl.com/api/v9';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Business {
  id: string;
  user_id: string;
  extracted_data: Record<string, unknown>;
}

interface TogglEntry {
  id: number;
  project_id: number | null;
  description: string | null;
  start: string;
  stop: string | null;
  duration: number; // seconds; negative = still running
}

interface TogglProject {
  id: number;
  name: string;
}

interface ProjectMapRow {
  toggl_project_name: string;
  forgefly_project_id: string | null;
}

interface ForgeflyProject {
  id: string;
  client_id: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function togglAuth(token: string): string {
  return 'Basic ' + btoa(`${token}:api_token`);
}

// ─── Core sync for one business ───────────────────────────────────────────────

async function syncBusiness(supabase: SupabaseClient, biz: Business): Promise<{
  synced: number;
  skipped: number;
  unmapped: string[];
  error?: string;
}> {
  const token = biz.extracted_data.toggl_token as string | undefined;
  const workspaceId = biz.extracted_data.toggl_workspace_id as number | undefined;

  if (!token || !workspaceId) {
    return { synced: 0, skipped: 0, unmapped: [], error: 'No Toggl token or workspace' };
  }

  const auth = togglAuth(token);

  // Pull last 7 days (covers missed nightly runs)
  const now = new Date();
  const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString().replace(/\.\d{3}Z$/, '+00:00');
  const endDate = now.toISOString().replace(/\.\d{3}Z$/, '+00:00');

  // Fetch time entries from Toggl
  const entriesRes = await fetch(
    `${TOGGL_BASE}/me/time_entries?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
    { headers: { Authorization: auth } },
  );

  if (entriesRes.status === 403 || entriesRes.status === 401) {
    // Token revoked — clear it from extracted_data
    const { toggl_token: _t, toggl_workspace_id: _w, toggl_workspace_name: _n, toggl_connected_at: _c, ...rest } =
      biz.extracted_data;
    await supabase.from('businesses').update({ extracted_data: rest }).eq('id', biz.id);
    return { synced: 0, skipped: 0, unmapped: [], error: 'Token revoked — Toggl disconnected' };
  }

  if (!entriesRes.ok) {
    return { synced: 0, skipped: 0, unmapped: [], error: `Toggl entries fetch failed: ${entriesRes.status}` };
  }

  const entries: TogglEntry[] = (await entriesRes.json()) ?? [];

  if (entries.length === 0) {
    await persistSyncMeta(supabase, biz, [], now);
    return { synced: 0, skipped: 0, unmapped: [] };
  }

  // Fetch projects to resolve project_id → name
  const projRes = await fetch(
    `${TOGGL_BASE}/workspaces/${workspaceId}/projects?active=true`,
    { headers: { Authorization: auth } },
  );
  const rawProjects: TogglProject[] = projRes.ok ? ((await projRes.json()) ?? []) : [];
  const togglProjectNames = new Map<number, string>(
    Array.isArray(rawProjects) ? rawProjects.map((p) => [p.id, p.name]) : [],
  );

  // Load project mappings from DB
  const { data: dbMap } = await supabase
    .from('toggl_project_map')
    .select('toggl_project_name, forgefly_project_id')
    .eq('business_id', biz.id);

  const nameToForgeflyId = new Map<string, string | null>(
    (dbMap ?? []).map((r: ProjectMapRow) => [r.toggl_project_name, r.forgefly_project_id]),
  );

  // Prefetch client_ids for mapped Forgefly projects
  const mappedIds = [...nameToForgeflyId.values()].filter(Boolean) as string[];
  const { data: ffProjects } = mappedIds.length > 0
    ? await supabase.from('projects').select('id, client_id').in('id', mappedIds)
    : { data: [] };

  const projectClientId = new Map<string, string | null>(
    (ffProjects ?? []).map((p: ForgeflyProject) => [p.id, p.client_id]),
  );

  // Build upsert rows
  const unmappedProjects = new Set<string>();
  const toUpsert: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const entry of entries) {
    // Skip running (negative duration) or zero/sub-60s entries
    if (entry.duration <= 0) { skipped++; continue; }
    if (entry.duration < 60) { skipped++; continue; }

    const hours = Math.round((entry.duration / 3600) * 100) / 100; // 2dp
    if (hours <= 0) { skipped++; continue; }

    const date = entry.start.split('T')[0];

    // Resolve Toggl project → Forgefly project
    const togglProjectName =
      entry.project_id != null ? (togglProjectNames.get(entry.project_id) ?? null) : null;

    if (!togglProjectName) {
      // Entry has no project in Toggl — skip silently
      skipped++;
      continue;
    }

    if (!nameToForgeflyId.has(togglProjectName)) {
      unmappedProjects.add(togglProjectName);
      continue;
    }

    const forgeflyProjectId = nameToForgeflyId.get(togglProjectName);
    if (!forgeflyProjectId) {
      // Explicitly marked "don't import"
      skipped++;
      continue;
    }

    toUpsert.push({
      business_id: biz.id,
      user_id: biz.user_id,
      project_id: forgeflyProjectId,
      client_id: projectClientId.get(forgeflyProjectId) ?? null,
      date,
      hours,
      note: entry.description?.trim() || null,
      source: 'toggl',
      external_id: String(entry.id),
      synced_at: now.toISOString(),
    });
  }

  if (toUpsert.length > 0) {
    const { error: upsertErr } = await supabase
      .from('time_entries')
      .upsert(toUpsert, { onConflict: 'business_id,external_id' });
    if (upsertErr) throw upsertErr;
  }

  await persistSyncMeta(supabase, biz, Array.from(unmappedProjects), now);

  return { synced: toUpsert.length, skipped, unmapped: Array.from(unmappedProjects) };
}

async function persistSyncMeta(
  supabase: SupabaseClient,
  biz: Business,
  unmappedProjects: string[],
  now: Date,
) {
  await supabase
    .from('businesses')
    .update({
      extracted_data: {
        ...biz.extracted_data,
        toggl_unmapped_projects: unmappedProjects,
        toggl_last_synced_at: now.toISOString(),
      },
    })
    .eq('id', biz.id);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Determine scope: user JWT → single business; service role / no JWT → all connected
    const authHeader = req.headers.get('Authorization') ?? '';
    const isServiceRole =
      authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` ||
      authHeader === '';

    let businesses: Business[] = [];

    if (!isServiceRole) {
      // Manual sync — authenticate the caller and sync only their business
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: biz } = await supabaseAdmin
        .from('businesses')
        .select('id, user_id, extracted_data')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (biz) businesses = [biz as Business];
    } else {
      // Cron / server-side — sync all businesses with Toggl connected
      const { data: allBiz } = await supabaseAdmin
        .from('businesses')
        .select('id, user_id, extracted_data')
        .eq('status', 'active');

      businesses = ((allBiz ?? []) as Business[]).filter(
        (b) => !!(b.extracted_data as Record<string, unknown>)?.toggl_token,
      );
    }

    if (businesses.length === 0) {
      return new Response(JSON.stringify({ message: 'No Toggl-connected businesses', results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = await Promise.all(
      businesses.map(async (biz) => {
        try {
          const result = await syncBusiness(supabaseAdmin, biz);
          return { business_id: biz.id, ...result };
        } catch (err) {
          console.error(`sync failed for business ${biz.id}:`, err);
          return { business_id: biz.id, synced: 0, skipped: 0, unmapped: [], error: String(err) };
        }
      }),
    );

    const totalSynced = results.reduce((s, r) => s + r.synced, 0);
    const totalUnmapped = [...new Set(results.flatMap((r) => r.unmapped))];

    return new Response(
      JSON.stringify({ synced: totalSynced, unmapped: totalUnmapped, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('sync-toggl-entries error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
