import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  checkVideoRenderStatus,
  setPromotionTargets,
  updatePromotionCaption,
} from "@/services/promotionService";
import type { Promotion, PromotionPlatform } from "@/types/types";
import { PlatformChecklist } from "./PlatformChecklist";

const VIDEO_POLL_INTERVAL_MS = 4000;

export function PromotionCard({
  promotion,
  onChange,
  onPublish,
  onDelete,
  onDraft,
}: {
  promotion: Promotion;
  onChange: (updated: Promotion) => void;
  onPublish: (promotion: Promotion) => void;
  onDelete: (id: string) => void;
  onDraft: (id: string) => void;
}) {
  const [caption, setCaption] = useState(promotion.caption);
  const [savingCaption, setSavingCaption] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draftingLoading, setDraftingLoading] = useState(false);
  const [format, setFormat] = useState<"photo" | "reel">("photo");

  // 'instagram_reel' targets track the Reel publish internally — not a selectable
  // "Promote on" checklist item, so exclude it here.
  const selectedPlatforms = promotion.targets
    .map((t) => t.platform)
    .filter((p): p is PromotionPlatform => p !== "instagram_reel");

  // Poll the Shotstack render status while a Reel is still processing — same shape as
  // the container-status polling already used server-side in social-publish-instagram.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (promotion.video_status !== "rendering") return;
    const postId = promotion.id;
    const interval = setInterval(async () => {
      try {
        const result = await checkVideoRenderStatus(postId);
        if (result.video_status !== "rendering") {
          onChangeRef.current({
            ...promotion,
            video_status: result.video_status,
            video_url: result.video_url,
          });
        }
      } catch {
        // Transient poll failure — try again on the next tick.
      }
    }, VIDEO_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promotion.id, promotion.video_status]);

  async function handleCaptionBlur() {
    if (caption === promotion.caption) return;
    setSavingCaption(true);
    try {
      const updated = await updatePromotionCaption(promotion.id, caption);
      onChange({ ...promotion, ...updated });
    } finally {
      setSavingCaption(false);
    }
  }

  async function handlePlatformsChange(platforms: PromotionPlatform[]) {
    const targets = await setPromotionTargets(promotion.id, platforms);
    onChange({ ...promotion, targets });
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      onDelete(promotion.id);
    } finally {
      setDeleting(false);
    }
  }

  async function handleDraft() {
    setDraftingLoading(true);
    try {
      onDraft(promotion.id);
    } finally {
      setDraftingLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {promotion.video_status && (
          <div className="flex justify-center gap-1">
            <Button
              size="sm"
              variant={format === "photo" ? "default" : "outline"}
              onClick={() => setFormat("photo")}
              className="h-7 px-3 text-xs"
            >
              Photo
            </Button>
            <Button
              size="sm"
              variant={format === "reel" ? "default" : "outline"}
              onClick={() => setFormat("reel")}
              disabled={promotion.video_status !== "ready"}
              className="h-7 px-3 text-xs"
            >
              {promotion.video_status === "rendering" && (
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              )}
              Reel
            </Button>
          </div>
        )}

        {format === "reel" && promotion.video_status === "ready" && promotion.video_url ? (
          <video
            src={promotion.video_url}
            controls
            loop
            className="w-full max-w-sm rounded-lg border mx-auto"
          />
        ) : (
          promotion.image_url && (
            <img
              src={promotion.image_url}
              alt="Promotion graphic"
              className="w-full max-w-sm rounded-lg border mx-auto"
            />
          )
        )}

        {promotion.video_status === "rendering" && (
          <p className="text-xs text-muted-foreground text-center">
            Rendering your reel…
          </p>
        )}
        {promotion.video_status === "failed" && (
          <p className="text-xs text-destructive text-center">
            Reel video failed to render — the photo is still available.
          </p>
        )}

        <div className="space-y-1.5">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={handleCaptionBlur}
            rows={4}
            className="text-sm"
          />
          {savingCaption && (
            <p className="text-xs text-muted-foreground">Saving…</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Promote on
          </p>
          <PlatformChecklist
            selected={selectedPlatforms}
            onChange={handlePlatformsChange}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => onPublish(promotion)}>
            Publish
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={draftingLoading}
            onClick={handleDraft}
          >
            {draftingLoading && (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            )}
            Draft
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting && (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            )}
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
