import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
// @ts-ignore
import { supabase } from "@/db/supabase";
import { getProfile } from "@/contexts/AuthContext";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const redirect = async (userId: string) => {
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
