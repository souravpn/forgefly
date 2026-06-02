import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthCallbackPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    // New OAuth user has no profile yet → onboarding
    if (!profile) {
      navigate("/onboarding", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }, [user, profile, loading, navigate]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: "#020810" }}
    >
      <div
        className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "#00f0c8", borderTopColor: "transparent" }}
      />
      <p className="text-sm" style={{ color: "rgba(0,240,200,0.7)" }}>
        Completing sign-in…
      </p>
    </div>
  );
}
