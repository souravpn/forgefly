import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { setPromotionTargets, updatePromotionCaption } from "@/services/promotionService";
import type { Promotion, PromotionPlatform } from "@/types/types";
import { PlatformChecklist } from "./PlatformChecklist";

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

  const selectedPlatforms = promotion.targets.map((t) => t.platform);

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
        {promotion.image_url && (
          <img
            src={promotion.image_url}
            alt="Promotion graphic"
            className="w-full max-w-sm rounded-lg border mx-auto"
          />
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
