import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const TOGGL_BASE = 'https://api.track.toggl.com/api/v9';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function togglAuth(token: string): string {
  return 'Basic ' + btoa(`${token}:api_token`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: bizData, error: bizError } = await supabaseAdmin
      .from('businesses')
      .select('id, extracted_data')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (bizError || !bizData) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'connect') {
      const token = body.token as string | undefined;
      if (!token) {
        return new Response(JSON.stringify({ error: 'token is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify token + fetch user info from Toggl
      const meRes = await fetch(`${TOGGL_BASE}/me`, {
        headers: { Authorization: togglAuth(token) },
      });

      if (!meRes.ok) {
        return new Response(JSON.stringify({ error: 'Invalid Toggl API token. Check your token in Toggl Profile → API Token.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const me = await meRes.json();
      const workspaceId: number = me.default_workspace_id;

      // Fetch workspace details
      const wsRes = await fetch(`${TOGGL_BASE}/workspaces/${workspaceId}`, {
        headers: { Authorization: togglAuth(token) },
      });
      const workspace = wsRes.ok ? await wsRes.json() : { name: 'My Workspace' };

      // Fetch active projects from workspace
      const projRes = await fetch(`${TOGGL_BASE}/workspaces/${workspaceId}/projects?active=true`, {
        headers: { Authorization: togglAuth(token) },
      });
      const rawProjects = projRes.ok ? (await projRes.json() ?? []) : [];
      const togglProjects = Array.isArray(rawProjects)
        ? rawProjects.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name }))
        : [];

      // Store encrypted-at-rest in extracted_data
      const existing = (bizData.extracted_data ?? {}) as Record<string, unknown>;
      await supabaseAdmin
        .from('businesses')
        .update({
          extracted_data: {
            ...existing,
            toggl_token: token,
            toggl_workspace_id: workspaceId,
            toggl_workspace_name: workspace.name,
            toggl_connected_at: new Date().toISOString(),
          },
        })
        .eq('id', bizData.id);

      return new Response(JSON.stringify({
        workspace_id: workspaceId,
        workspace_name: workspace.name,
        toggl_projects: togglProjects,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'disconnect') {
      const existing = (bizData.extracted_data ?? {}) as Record<string, unknown>;
      // Remove all toggl_* keys
      const cleaned = Object.fromEntries(
        Object.entries(existing).filter(([k]) => !k.startsWith('toggl_'))
      );
      await supabaseAdmin
        .from('businesses')
        .update({ extracted_data: cleaned })
        .eq('id', bizData.id);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'fetch_projects') {
      const existing = (bizData.extracted_data ?? {}) as Record<string, unknown>;
      const storedToken = existing.toggl_token as string | undefined;
      if (!storedToken) {
        return new Response(JSON.stringify({ error: 'Toggl not connected' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const workspaceId = existing.toggl_workspace_id as number;
      const projRes = await fetch(`${TOGGL_BASE}/workspaces/${workspaceId}/projects?active=true`, {
        headers: { Authorization: togglAuth(storedToken) },
      });
      const rawProjects = projRes.ok ? (await projRes.json() ?? []) : [];
      const togglProjects = Array.isArray(rawProjects)
        ? rawProjects.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name }))
        : [];

      return new Response(JSON.stringify({ toggl_projects: togglProjects }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('connect-toggl error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
