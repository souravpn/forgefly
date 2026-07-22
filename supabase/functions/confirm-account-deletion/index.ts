import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { code } = await req.json();
    if (!code?.trim()) {
      return new Response(JSON.stringify({ error: 'Confirmation code is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify OTP
    const MAX_ATTEMPTS = 5;
    const { data: otpRow } = await adminClient
      .from('deletion_otps')
      .select('code, expires_at, attempts')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!otpRow) {
      return new Response(JSON.stringify({ error: 'No confirmation code found. Please request a new one.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (new Date(otpRow.expires_at) < new Date()) {
      await adminClient.from('deletion_otps').delete().eq('user_id', user.id);
      return new Response(JSON.stringify({ error: 'Code has expired. Please request a new one.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (otpRow.attempts >= MAX_ATTEMPTS) {
      await adminClient.from('deletion_otps').delete().eq('user_id', user.id);
      return new Response(JSON.stringify({ error: 'Too many incorrect attempts. Please request a new code.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (otpRow.code !== code.trim()) {
      await adminClient.from('deletion_otps').update({ attempts: otpRow.attempts + 1 }).eq('user_id', user.id);
      return new Response(JSON.stringify({ error: 'Incorrect code. Please try again.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean up OTP first
    await adminClient.from('deletion_otps').delete().eq('user_id', user.id);

    // Delete user data in dependency order
    // Engagements + messages cascade from businesses; delete businesses first
    await adminClient.from('businesses').delete().eq('user_id', user.id);
    await adminClient.from('clients').delete().eq('user_id', user.id);
    await adminClient.from('proposals').delete().eq('user_id', user.id);
    await adminClient.from('invoices').delete().eq('user_id', user.id);
    await adminClient.from('prompt_sessions').delete().eq('user_id', user.id);
    await adminClient.from('profiles').delete().eq('id', user.id);

    // Finally remove the auth user (service role required)
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteErr) {
      console.error('Auth user delete error:', deleteErr);
      return new Response(JSON.stringify({ error: 'Failed to delete account. Please contact support.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('confirm-account-deletion error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
