import { Instagram, Loader2, Sparkles } from "lucide-react";
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
  publishInstagramTarget,
  updatePromotionCaption,
} from "@/services/promotionService";
import type { Promotion, PromotionPlatform } from "@/types/types";

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
  const [publishStage, setPublishStage] = useState<"photo" | "reel" | null>(null);
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
    .filter((p): p is PromotionPlatform => p !== "instagram_reel" && LIVE_PLATFORMS.includes(p));

  const hasInstagramStep = selectedLivePlatforms.includes("instagram");
  const hasReel = promotion.video_status === "ready" && !!promotion.video_url;

  // A ready Reel always gets published alongside the photo, one after the other — two
  // independent Instagram posts from the same generated promotion, not an either/or choice.
  async function handleApproveAndPublish() {
    setPublishing(true);
    try {
      if (caption !== promotion!.caption) {
        await updatePromotionCaption(promotion!.id, caption);
      }
      await approvePromotion(promotion!.id);

      setPublishStage("photo");
      const result = await publishInstagramTarget(promotion!.id, false);
      onPublished(promotion!.id, result.platform_post_id);

      if (hasReel) {
        setPublishStage("reel");
        try {
          await publishInstagramTarget(promotion!.id, true);
          toast.success("Published photo and Reel to Instagram");
        } catch (reelErr: unknown) {
          toast.error(
            `Photo published, but the Reel failed: ${(reelErr as Error).message || "unknown error"}`,
          );
        }
      } else {
        toast.success("Published to Instagram");
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

        {!hasInstagramStep || done ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {done
                ? "Published to Instagram."
                : "None of the selected platforms are supported yet — check Instagram to publish now, or save this as a draft for when other platforms go live."}
            </p>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Instagram className="w-4 h-4" />
              Instagram
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
                A Reel is also ready and will be published right after the photo.
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
                  ? publishStage === "reel"
                    ? "Publishing Reel…"
                    : "Publishing…"
                  : "Approve and Publish"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
