import { Loader2, Sparkles } from "lucide-react";
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
  setPromotionTargets,
  updatePromotionCaption,
} from "@/services/promotionService";
import type { Promotion, PromotionPlatform } from "@/types/types";
import { PlatformChecklist } from "./PlatformChecklist";

export function EditPromotionModal({
  promotion,
  onOpenChange,
  onChange,
  onApproveAndPublish,
}: {
  promotion: Promotion | null;
  onOpenChange: (open: boolean) => void;
  onChange: (updated: Promotion) => void;
  onApproveAndPublish: (updated: Promotion) => void;
}) {
  const [caption, setCaption] = useState(promotion?.caption ?? "");
  const [platforms, setPlatforms] = useState<PromotionPlatform[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (promotion) {
      setCaption(promotion.caption);
      setPlatforms(
        promotion.targets
          .map((t) => t.platform)
          .filter(
            (p): p is PromotionPlatform =>
              p !== "instagram_reel" && p !== "facebook_reel",
          ),
      );
    }
  }, [promotion]);

  if (!promotion) return null;

  async function persist(): Promise<Promotion> {
    let updated = promotion!;
    if (caption !== promotion!.caption) {
      const post = await updatePromotionCaption(promotion!.id, caption);
      updated = { ...updated, ...post };
    }
    const targets = await setPromotionTargets(promotion!.id, platforms);
    updated = { ...updated, targets };
    return updated;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await persist();
      onChange(updated);
      toast.success("Saved");
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveAndPublish() {
    setSaving(true);
    try {
      const updated = await persist();
      onChange(updated);
      onApproveAndPublish(updated);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!promotion} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit promotion</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Promote on
            </p>
            <PlatformChecklist selected={platforms} onChange={setPlatforms} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
          <Button disabled={saving} onClick={handleApproveAndPublish}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Approve and Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
