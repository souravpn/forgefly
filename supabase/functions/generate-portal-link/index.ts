import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function randomHex(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('').slice(0, len);
}

function generateHumanToken(contactName: string, company: string | null): string {
  const firstName = slugify((contactName || 'client').split(' ')[0]) || 'client';
  const hex = randomHex(4);

  if (company && company.trim()) {
    const companySlug = slugify(company);
    return `${companySlug}-${firstName}-${hex}`;
  }

  const parts = (contactName || '').trim().split(' ');
  const lastInitial = parts.length > 1 ? slugify(parts[parts.length - 1].charAt(0)) : 'x';
  return `${firstName}-${lastInitial}-${hex}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { engagementId, clientEmail: clientEmailOverride } = body as {
      engagementId?: string;
      clientEmail?: string;
    };

    if (!engagementId) {
      return new Response(
        JSON.stringify({ error: 'engagementId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify engagement belongs to this user's business
    const { data: engagement, error: engError } = await authClient
      .from('engagements')
      .select('*, businesses!inner(id, user_id), contacts(id, name, company, email, portal_token)')
      .eq('id', engagementId)
      .eq('businesses.user_id', user.id)
      .single();

    if (engError || !engagement) {
      return new Response(
        JSON.stringify({ error: 'Engagement not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://www.forgefly.io';
    const contact = engagement.contacts as {
      id: string; name: string; company: string | null;
      email: string | null; portal_token: string | null;
    } | null;

    // ── Contact-based path (new hub architecture) ─────────────────────────────
    if (contact) {
      let contactToken = contact.portal_token;

      // Generate token for contact if missing
      if (!contactToken) {
        contactToken = generateHumanToken(contact.name, contact.company);
        const { error: contactUpdateErr } = await adminClient
          .from('contacts')
          .update({ portal_token: contactToken })
          .eq('id', contact.id);

        if (contactUpdateErr) {
          console.error('Failed to set contact portal_token:', contactUpdateErr);
          contactToken = null; // fall through to engagement token path
        }
      }

      if (contactToken) {
        // Also ensure engagement has a token + engagement_access row for legacy portal backward compat
        const clientEmail = contact.email ?? clientEmailOverride ?? null;
        if (!engagement.portal_token) {
          const engToken = randomHex(16);
          await adminClient.from('engagements').update({ portal_token: engToken }).eq('id', engagementId);
          if (clientEmail) {
            await adminClient.from('engagement_access').upsert(
              { engagement_id: engagementId, client_email: clientEmail },
              { onConflict: 'engagement_id,client_email', ignoreDuplicates: true }
            );
          }
        } else if (clientEmail) {
          await adminClient.from('engagement_access').upsert(
            { engagement_id: engagementId, client_email: clientEmail },
            { onConflict: 'engagement_id,client_email', ignoreDuplicates: true }
          );
        }

        const portalUrl = `${siteUrl}/portal/${contactToken}`;
        console.log(`Portal token (contact): ${contactToken} for engagement ${engagementId}`);
        return new Response(
          JSON.stringify({ token: contactToken, portalUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Engagement-based fallback (no contact, or contact token failed) ────────
    if (engagement.portal_token) {
      const portalUrl = `${siteUrl}/portal/${engagement.portal_token}`;
      return new Response(
        JSON.stringify({ token: engagement.portal_token, portalUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contactName = contact?.name ?? 'client';
    const company = contact?.company ?? null;
    const clientEmail = contact?.email ?? clientEmailOverride ?? null;

    const token = generateHumanToken(contactName, company);

    const { error: updateError } = await adminClient
      .from('engagements')
      .update({ portal_token: token })
      .eq('id', engagementId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to set portal token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (clientEmail) {
      await adminClient.from('engagement_access').upsert(
        { engagement_id: engagementId, client_email: clientEmail },
        { onConflict: 'engagement_id,client_email', ignoreDuplicates: true }
      );
    }

    const portalUrl = `${siteUrl}/portal/${token}`;
    console.log(`Portal token (engagement): ${token} for engagement ${engagementId}`);
    return new Response(
      JSON.stringify({ token, portalUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-portal-link:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
