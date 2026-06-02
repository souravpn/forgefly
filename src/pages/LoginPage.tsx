import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

/* ── Inline SVG brand icons ─────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

/* ── OAuth divider ──────────────────────────────────────────────────────── */
function Divider() {
  return (
    <div className="relative flex items-center gap-3 py-1">
      <div
        className="flex-1 h-px"
        style={{ background: "rgba(255,255,255,0.08)" }}
      />
      <span
        className="text-xs shrink-0"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        or continue with email
      </span>
      <div
        className="flex-1 h-px"
        style={{ background: "rgba(255,255,255,0.08)" }}
      />
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(
    null,
  );
  const { signInWithEmail, signInWithOAuth } = useAuth();
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signInWithEmail(email, password);
    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success("Welcome back!");
      navigate("/dashboard");
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setOauthLoading(provider);
    const { error } = await signInWithOAuth(provider);
    if (error) {
      toast.error(error.message);
      setOauthLoading(null);
    }
    // On success, browser redirects to /auth/callback — no need to reset state
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "#020810" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600,
          height: 600,
          borderRadius: "50%",
          top: "-20%",
          left: "50%",
          transform: "translateX(-50%)",
          background:
            "radial-gradient(circle, rgba(0,240,200,0.07) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px] relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex items-center gap-3 mb-3"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <img
              src="/public/forgefly-icon.png"
              alt="Forgefly Logo"
              className="w-10 h-10 rounded-lg"
            />
            <span className="text-2xl font-black text-white tracking-tight">
              Forgefly
            </span>
          </motion.div>
          <p className="text-sm" style={{ color: "rgba(0,240,200,0.7)" }}>
            Welcome back
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7 space-y-5"
          style={{
            background: "rgba(4,12,30,0.8)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(0,240,200,0.15)",
            boxShadow:
              "0 8px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {/* Top glow bar */}
          <div
            className="absolute top-0 left-0 right-0 h-px rounded-t-2xl"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(0,240,200,0.6), transparent)",
            }}
          />

          <div>
            <h1 className="text-xl font-bold text-white mb-1">Sign in</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              to your business OS
            </p>
          </div>

          {/* OAuth buttons */}
          <div className="grid grid-cols-2 gap-3">
            {(["google", "apple"] as const).map((provider) => (
              <motion.button
                key={provider}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                disabled={!!oauthLoading || loading}
                onClick={() => handleOAuth(provider)}
                className="flex items-center justify-center gap-2.5 h-11 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "white",
                }}
              >
                {oauthLoading === provider ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    {provider === "google" ? <GoogleIcon /> : <AppleIcon />}
                    <span className="capitalize">{provider}</span>
                  </>
                )}
              </motion.button>
            ))}
          </div>

          <Divider />

          {/* Email/password form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl text-sm"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl text-sm pr-10"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "white",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                  tabIndex={-1}
                >
                  {showPwd ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Button
                type="submit"
                disabled={loading || !!oauthLoading}
                className="w-full h-11 rounded-xl text-sm font-bold"
                style={{
                  background: loading
                    ? "rgba(0,240,200,0.3)"
                    : "linear-gradient(135deg, #00f0c8, #00aeff)",
                  color: "#020810",
                  border: "none",
                  boxShadow: "0 0 24px rgba(0,240,200,0.25)",
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-[#020810]/30 border-t-[#020810] animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </motion.div>
          </form>

          <p
            className="text-center text-sm"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="font-semibold hover:underline"
              style={{ color: "#00f0c8" }}
            >
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
