import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
// @ts-ignore
import { supabase } from "@/db/supabase";
import { getProfile } from "@/contexts/AuthContext";

async function saveBusiness(
  userId: string,
  extracted_data: Record<string, unknown>,
  prompt: string | null,
  confidence_map: Record<string, string> | null,
  completeness_score: number,
): Promise<boolean> {
  const identity = (extracted_data?.identity ?? {}) as Record<string, string>;
  const businessName = identity.businessName ?? identity.name ?? 'My Business';

  // Check for existing active business (avoid upsert constraint issues)
  const { data: existing } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  // Build payload — try with optional columns, fall back without them
  const fullPayload = {
    name: businessName,
    extracted_data,
    status: 'active' as const,
    confidence_map: confidence_map ?? null,
    completeness_score: completeness_score ?? 0,
  };
  const basePayload = { name: businessName, extracted_data, status: 'active' as const };

  let bizId: string | null = null;

  if (existing?.id) {
    const { error } = await supabase.from('businesses').update(fullPayload).eq('id', existing.id);
    if (error?.code === '42703') {
      await supabase.from('businesses').update(basePayload).eq('id', existing.id);
    } else if (error) {
      console.error('Failed to update business:', error);
      return false;
    }
    bizId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from('businesses')
      .insert({ user_id: userId, ...fullPayload })
      .select('id')
      .single();
    if (error?.code === '42703') {
      const { data: retried, error: retryErr } = await supabase
        .from('businesses')
        .insert({ user_id: userId, ...basePayload })
        .select('id')
        .single();
      if (retryErr) { console.error('Failed to insert business:', retryErr); return false; }
      bizId = retried?.id ?? null;
    } else if (error) {
      console.error('Failed to insert business:', error);
      return false;
    } else {
      bizId = inserted?.id ?? null;
    }
  }

  if (bizId && prompt) {
    await supabase.from('prompt_sessions').insert({
      user_id: userId,
      business_id: bizId,
      prompt,
      prompt_type: 'seed',
      extracted_data_snapshot: extracted_data,
    }).then(() => {});
  }

  return !!bizId;
}

async function savePendingPortal(userId: string): Promise<boolean> {
  // Primary path: token embedded in the email verification URL (works cross-device)
  const searchParams = new URLSearchParams(window.location.search);
  const pendingToken = searchParams.get('pending_token');

  if (pendingToken) {
    try {
      const { data: row } = await supabase
        .from('pending_businesses')
        .select('extracted_data, prompt, confidence_map, completeness_score')
        .eq('token', pendingToken)
        .single();

      if (row) {
        const ok = await saveBusiness(
          userId,
          row.extracted_data,
          row.prompt,
          row.confidence_map,
          row.completeness_score ?? 0,
        );
        if (ok) {
          // Clean up
          await supabase.from('pending_businesses').delete().eq('token', pendingToken);
          localStorage.removeItem('pending_portal');
          localStorage.removeItem('pending_portal_token');
          return true;
        }
      }
    } catch (err) {
      console.error('Token-based save error:', err);
    }
  }

  // Fallback: same-device localStorage (token missing or expired)
  const raw = localStorage.getItem('pending_portal');
  if (!raw) return false;
  try {
    const { extracted_data, prompt, confidence_map, completeness_score } = JSON.parse(raw);
    const ok = await saveBusiness(userId, extracted_data, prompt, confidence_map, completeness_score ?? 0);
    if (ok) {
      localStorage.removeItem('pending_portal');
      localStorage.removeItem('pending_portal_token');
    }
    return ok;
  } catch (err) {
    console.error('savePendingPortal error:', err);
    return false;
  }
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    const redirect = async (userId: string) => {
      // Guard against double-execution from onAuthStateChange + getSession firing together
      if (handled.current) return;
      handled.current = true;
      await savePendingPortal(userId);
      const profile = await getProfile(userId);
      navigate(profile ? "/dashboard" : "/onboarding", { replace: true });
    };

    // Primary: listen for SIGNED_IN (fires when Supabase processes hash tokens)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: { user?: { id: string } } | null) => {
        if (event === "SIGNED_IN" && session?.user) {
          redirect(session.user.id);
        }
      },
    );

    // Fallback: session already established before this effect ran
    // Only use it if there are no hash tokens (those are handled by SIGNED_IN above)
    const hasHashTokens = window.location.hash.includes('access_token');
    if (!hasHashTokens) {
      supabase.auth.getSession().then(
        ({ data: { session } }: { data: { session: { user?: { id: string } } | null } }) => {
          if (session?.user) {
            redirect(session.user.id);
          }
        },
      );
    }

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: "#020810" }}
    >
      <div
        className="w-12 h-12 rounded-full border-2 animate-spin"
        style={{ borderColor: "#00f0c8", borderTopColor: "transparent" }}
      />
      <p className="text-sm" style={{ color: "rgba(0,240,200,0.7)" }}>
        Completing sign-in…
      </p>
    </div>
  );
}
