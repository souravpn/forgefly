import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_MILESTONES = [
  'business_created',
  'services_reviewed',
  'portfolio_shared',
  'prospect_added',
  'proposal_sent',
  'social_connected',
] as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user JWT
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { milestone, skipped = false } = await req.json();

    if (!VALID_MILESTONES.includes(milestone)) {
      return new Response(JSON.stringify({ error: 'Invalid milestone' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the user's active business
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select('id, onboarding_milestones')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (bizErr || !business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record the event (completion or skip)
    await supabase.from('onboarding_events').insert({
      business_id: business.id,
      milestone,
      skipped,
    });

    let updatedMilestones = business.onboarding_milestones ?? {};

    if (!skipped) {
      // Mark the milestone complete in the businesses row
      updatedMilestones = { ...updatedMilestones, [milestone]: true };
      await supabase
        .from('businesses')
        .update({ onboarding_milestones: updatedMilestones })
        .eq('id', business.id);
    }

    return new Response(JSON.stringify({ ok: true, milestones: updatedMilestones }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('mark-milestone error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
