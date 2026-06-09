import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

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
        or sign up with email
      </span>
      <div
        className="flex-1 h-px"
        style={{ background: "rgba(255,255,255,0.08)" }}
      />
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Number or symbol", ok: /[0-9!@#$%^&*]/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="space-y-1 pt-1">
      {checks.map((c) => (
        <div key={c.label} className="flex items-center gap-1.5 text-xs">
          <CheckCircle2
            className="w-3.5 h-3.5"
            style={{ color: c.ok ? "#10b981" : "rgba(255,255,255,0.2)" }}
          />
          <span style={{ color: c.ok ? "#10b981" : "rgba(255,255,255,0.3)" }}>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(
    null,
  );
  const { signUpWithEmail, signInWithEmail, signInWithOAuth } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreedToTerms) {
      toast.error("Please agree to the terms and privacy policy");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const { error, isNew } = await signUpWithEmail(email, password);

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (isNew) {
      // Supabase sent a confirmation email — prompt user
      toast.success("Check your email to confirm your account, then sign in.");
      navigate("/login");
      return;
    }

    // Confirmation not required (e.g. disabled in Supabase dashboard) → auto-login
    const { error: loginError } = await signInWithEmail(email, password);
    if (loginError) {
      toast.error(loginError.message);
      setLoading(false);
    } else {
      toast.success("Account created! Let's get started.");
      navigate("/onboarding");
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setOauthLoading(provider);
    const { error } = await signInWithOAuth(provider);
    if (error) {
      toast.error(error.message);
      setOauthLoading(null);
    }
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
            "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)",
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
              src="/forgefly-icon.png"
              alt="Forgefly Logo"
              className="w-10 h-10 rounded-lg"
            />
            <span className="text-2xl font-black text-white tracking-tight">
              Forgefly
            </span>
          </motion.div>
          <p className="text-sm" style={{ color: "rgba(139,92,246,0.9)" }}>
            Create your account
          </p>
        </div>

        {/* Card */}
        <div
          className="relative rounded-2xl p-7 space-y-5"
          style={{
            background: "rgba(4,12,30,0.8)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(139,92,246,0.2)",
            boxShadow:
              "0 8px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-px rounded-t-2xl"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(139,92,246,0.7), rgba(0,200,255,0.4), transparent)",
            }}
          />

          <div>
            <h1 className="text-xl font-bold text-white mb-1">
              Create account
            </h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Start building your business OS
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
          <form onSubmit={handleSignup} className="space-y-4">
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
              <PasswordStrength password={password} />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="confirmPassword"
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl text-sm pr-10"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border:
                      confirmPassword && confirmPassword !== password
                        ? "1px solid rgba(239,68,68,0.5)"
                        : confirmPassword && confirmPassword === password
                          ? "1px solid rgba(16,185,129,0.5)"
                          : "1px solid rgba(255,255,255,0.1)",
                    color: "white",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) =>
                  setAgreedToTerms(checked as boolean)
                }
                className="mt-0.5"
              />
              <label
                htmlFor="terms"
                className="text-xs leading-relaxed cursor-pointer"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                I agree to the{" "}
                <span
                  className="underline"
                  style={{ color: "rgba(0,240,200,0.7)" }}
                >
                  Terms of Service
                </span>{" "}
                and{" "}
                <span
                  className="underline"
                  style={{ color: "rgba(0,240,200,0.7)" }}
                >
                  Privacy Policy
                </span>
              </label>
            </div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Button
                type="submit"
                disabled={
                  loading ||
                  !!oauthLoading ||
                  !agreedToTerms ||
                  !email.trim() ||
                  password.length < 8 ||
                  !/[A-Z]/.test(password) ||
                  !/[0-9!@#$%^&*]/.test(password) ||
                  password !== confirmPassword
                }
                className="w-full h-11 rounded-xl text-sm font-bold"
                style={{
                  background: loading
                    ? "rgba(139,92,246,0.4)"
                    : "linear-gradient(135deg, #7c3aed, #00aeff)",
                  color: "white",
                  border: "none",
                  boxShadow: "0 0 24px rgba(139,92,246,0.25)",
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Create Account <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </motion.div>
          </form>

          <p
            className="text-center text-sm"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold hover:underline"
              style={{ color: "#00f0c8" }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
