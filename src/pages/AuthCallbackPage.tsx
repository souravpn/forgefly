import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
// @ts-ignore
import { supabase } from "@/db/supabase";
import { getProfile } from "@/contexts/AuthContext";

async function upsertBusiness(
  userId: string,
  extracted_data: Record<string, unknown>,
  prompt: string | null,
  confidence_map: Record<string, string> | null,
  completeness_score: number,
): Promise<boolean> {
  const identity = (extracted_data?.identity ?? {}) as Record<string, string>;
  const businessName = identity.businessName ?? identity.name ?? 'My Business';

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .upsert(
      {
        user_id: userId,
        name: businessName,
        extracted_data,
        status: 'active',
        confidence_map: confidence_map ?? null,
        completeness_score: completeness_score ?? 0,
      },
      { onConflict: 'user_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (bizError) {
    console.error('Failed to save business:', bizError);
    return false;
  }

  if (business?.id && prompt) {
    await supabase.from('prompt_sessions').insert({
      user_id: userId,
      business_id: business.id,
      prompt,
      prompt_type: 'seed',
      extracted_data_snapshot: extracted_data,
    });
  }

  return true;
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
        const ok = await upsertBusiness(
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
    const ok = await upsertBusiness(userId, extracted_data, prompt, confidence_map, completeness_score ?? 0);
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

  useEffect(() => {
    const redirect = async (userId: string) => {
      await savePendingPortal(userId);
      const profile = await getProfile(userId);
      navigate(profile ? "/dashboard" : "/onboarding", { replace: true });
    };

    // Listen for the SIGNED_IN event fired when Supabase processes OAuth tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: { user?: { id: string } } | null) => {
        if (event === "SIGNED_IN" && session?.user) {
          redirect(session.user.id);
        }
      },
    );

    // Also handle the case where session is already established (e.g. page refresh)
    supabase.auth.getSession().then(
      ({ data: { session } }: { data: { session: { user?: { id: string } } | null } }) => {
        if (session?.user) {
          redirect(session.user.id);
        }
      },
    );

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
