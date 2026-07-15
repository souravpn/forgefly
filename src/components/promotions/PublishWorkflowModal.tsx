import { Facebook, Instagram, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  approvePromotion,
  LIVE_PLATFORMS,
  publishFacebookTarget,
  publishInstagramTarget,
  updatePromotionCaption,
} from "@/services/promotionService";
import type { Promotion, PromotionPlatform } from "@/types/types";

const PLATFORM_CONFIG: Record<
  "instagram" | "facebook",
  { label: string; icon: typeof Instagram; publish: (postId: string, useVideo?: boolean) => Promise<{ platform_post_id: string }> }
> = {
  instagram: { label: "Instagram", icon: Instagram, publish: publishInstagramTarget },
  facebook: { label: "Facebook", icon: Facebook, publish: publishFacebookTarget },
};

export function PublishWorkflowModal({
  promotion,
  onOpenChange,
  onPublished,
}: {
  promotion: Promotion | null;
  onOpenChange: (open: boolean) => void;
  onPublished: (id: string, platformPostId: string) => void;
}) {
  const [caption, setCaption] = useState(promotion?.caption ?? "");
  const [publishing, setPublishing] = useState(false);
  const [publishStage, setPublishStage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (promotion) {
      setCaption(promotion.caption);
      setDone(false);
    }
  }, [promotion]);

  if (!promotion) return null;

  const selectedLivePlatforms = promotion.targets
    .map((t) => t.platform)
    .filter(
      (p): p is "instagram" | "facebook" =>
        (p === "instagram" || p === "facebook") &&
        LIVE_PLATFORMS.includes(p as PromotionPlatform),
    );

  const hasLiveStep = selectedLivePlatforms.length > 0;
  const hasReel = promotion.video_status === "ready" && !!promotion.video_url;

  // A ready Reel always gets published alongside the photo, one after the other, on every
  // selected live platform — two independent posts per platform from the same generated
  // promotion, not an either/or choice. Each platform/format leg fails independently so one
  // platform's error doesn't block the others.
  async function handleApproveAndPublish() {
    setPublishing(true);
    const errors: string[] = [];
    let firstPublishedId: string | null = null;
    try {
      if (caption !== promotion!.caption) {
        await updatePromotionCaption(promotion!.id, caption);
      }
      await approvePromotion(promotion!.id);

      for (const platform of selectedLivePlatforms) {
        const { label, publish } = PLATFORM_CONFIG[platform];

        setPublishStage(`${label} — photo…`);
        try {
          const result = await publish(promotion!.id, false);
          firstPublishedId ??= result.platform_post_id;
        } catch (err: unknown) {
          errors.push(`${label} photo: ${(err as Error).message || "unknown error"}`);
          continue;
        }

        if (hasReel) {
          setPublishStage(`${label} — Reel…`);
          try {
            await publish(promotion!.id, true);
          } catch (err: unknown) {
            errors.push(`${label} Reel: ${(err as Error).message || "unknown error"}`);
          }
        }
      }

      if (firstPublishedId) {
        onPublished(promotion!.id, firstPublishedId);
      }

      if (errors.length === 0) {
        toast.success(hasReel ? "Published photos and Reels" : "Published");
      } else if (firstPublishedId) {
        toast.error(`Published with some failures: ${errors.join("; ")}`);
      } else {
        toast.error(errors.join("; "));
      }
      setDone(true);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to publish");
    } finally {
      setPublishing(false);
      setPublishStage(null);
    }
  }

  return (
    <Dialog open={!!promotion} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish promotion</DialogTitle>
        </DialogHeader>

        {!hasLiveStep || done ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {done
                ? "Published."
                : "None of the selected platforms are supported yet — check Instagram or Facebook to publish now, or save this as a draft for when other platforms go live."}
            </p>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm font-medium">
              {selectedLivePlatforms.map((platform) => {
                const Icon = PLATFORM_CONFIG[platform].icon;
                return (
                  <span key={platform} className="flex items-center gap-1.5">
                    <Icon className="w-4 h-4" />
                    {PLATFORM_CONFIG[platform].label}
                  </span>
                );
              })}
            </div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className="text-sm"
            />
            {promotion.image_url && (
              <img
                src={promotion.image_url}
                alt="Promotion graphic"
                className="w-full max-w-xs rounded-lg border mx-auto"
              />
            )}
            {hasReel && (
              <p className="text-xs text-muted-foreground text-center">
                A Reel is also ready and will be published right after each photo.
              </p>
            )}
            <DialogFooter>
              <Button disabled={publishing} onClick={handleApproveAndPublish}>
                {publishing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {publishing
                  ? (publishStage ?? "Publishing…")
                  : "Approve and Publish"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
