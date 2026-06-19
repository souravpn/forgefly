import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/db/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TokenPayload {
  review_request_id: string;
  business_id: string;
  client_id: string;
  client_name: string;
  exp: number;
}

interface BusinessBrand {
  name: string;
  primaryColor: string;
}

type PageState = "loading" | "form" | "submitting" | "success" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): TokenPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as TokenPayload;
    // Client-side expiry check only — server validates signature
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Star rating ───────────────────────────────────────────────────────────────

function StarPicker({
  value,
  onChange,
  color,
}: {
  value: number;
  onChange: (n: number) => void;
  color: string;
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-110 active:scale-95"
          aria-label={`${n} star${n !== 1 ? "s" : ""}`}
        >
          <svg
            className="w-10 h-10"
            viewBox="0 0 20 20"
            fill={n <= active ? color : "none"}
            stroke={n <= active ? color : "#d1d5db"}
            strokeWidth="1.2"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

const RATING_LABELS: Record<number, string> = {
  1: "Not great",
  2: "Could be better",
  3: "It was okay",
  4: "Pretty good",
  5: "Excellent!",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReviewSubmitPage() {
  const { token } = useParams<{ token: string }>();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [payload, setPayload] = useState<TokenPayload | null>(null);
  const [brand, setBrand] = useState<BusinessBrand>({
    name: "",
    primaryColor: "#10B981",
  });

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [clientName, setClientName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setErrorMsg("Invalid review link.");
      setPageState("error");
      return;
    }

    const decoded = decodeJwtPayload(token);
    if (!decoded) {
      setErrorMsg("This review link has expired or is invalid.");
      setPageState("error");
      return;
    }

    setPayload(decoded);
    setClientName(decoded.client_name ?? "");

    // Fetch business brand (public read)
    supabase
      .from("businesses")
      .select("name, extracted_data")
      .eq("id", decoded.business_id)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBrand({
            name: data.name,
            primaryColor:
              (data.extracted_data as { brand?: { primaryColor?: string } })
                ?.brand?.primaryColor ?? "#10B981",
          });
        }
        setPageState("form");
      });
  }, [token]);

  async function handleSubmit() {
    if (!payload || rating === 0) return;
    setPageState("submitting");

    try {
      const { data, error } = await supabase.functions.invoke("submit-review", {
        body: {
          token,
          rating,
          comment: comment.trim() || null,
          client_name: clientName.trim() || undefined,
        },
      });

      if (error || !data?.ok) {
        const msg =
          error?.message ??
          data?.error ??
          "Something went wrong. Please try again.";
        setErrorMsg(msg);
        setPageState(msg.includes("already") ? "success" : "form");
        return;
      }

      setPageState("success");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setPageState("form");
    }
  }

  const { primaryColor, name: bizName } = brand;
  const initials = bizName.slice(0, 2).toUpperCase() || "??";

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">
          Loading…
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (pageState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <div className="text-4xl">⏱</div>
          <h1 className="text-xl font-semibold">Link unavailable</h1>
          <p className="text-muted-foreground text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (pageState === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-white font-bold text-2xl"
            style={{ backgroundColor: primaryColor }}
          >
            ✓
          </div>
          <h1 className="text-2xl font-bold">Thank you!</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your review has been submitted.
            {bizName && (
              <> {bizName} will see it shortly.</>
            )}
          </p>
          <p className="text-xs text-muted-foreground pt-2">
            Powered by{" "}
            <a
              href="https://forgefly.io"
              className="underline"
              style={{ color: primaryColor }}
            >
              Forgefly
            </a>
          </p>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Business header */}
        <div className="text-center space-y-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-white font-bold text-2xl"
            style={{ backgroundColor: primaryColor }}
          >
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold">
              How was your experience with {bizName || "us"}?
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your honest feedback means a lot.
            </p>
          </div>
        </div>

        {/* Star picker */}
        <div className="space-y-2">
          <StarPicker value={rating} onChange={setRating} color={primaryColor} />
          <p
            className="text-center text-sm font-medium h-5 transition-opacity"
            style={{ color: primaryColor, opacity: rating ? 1 : 0 }}
          >
            {RATING_LABELS[rating] ?? ""}
          </p>
        </div>

        {/* Comment */}
        <div className="space-y-1.5">
          <Label htmlFor="comment" className="text-sm text-muted-foreground">
            Tell them more{" "}
            <span className="font-normal">(optional)</span>
          </Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What stood out? What could be better?"
            rows={4}
            className="resize-none"
          />
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm text-muted-foreground">
            Your name
          </Label>
          <Input
            id="name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="How should your name appear?"
          />
        </div>

        {/* Error message */}
        {errorMsg && pageState === "form" && (
          <p className="text-sm text-destructive text-center">{errorMsg}</p>
        )}

        {/* Submit */}
        <Button
          className="w-full"
          style={{ backgroundColor: primaryColor }}
          disabled={rating === 0 || pageState === "submitting"}
          onClick={handleSubmit}
        >
          {pageState === "submitting" ? "Submitting…" : "Submit review"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a
            href="https://forgefly.io"
            className="underline"
            style={{ color: primaryColor }}
          >
            Forgefly
          </a>
        </p>
      </div>
    </div>
  );
}
