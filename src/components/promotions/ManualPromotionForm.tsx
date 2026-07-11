import { ImagePlus, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createManualPromotion } from "@/services/promotionService";
import type { Promotion, PromotionPlatform } from "@/types/types";
import { PlatformChecklist } from "./PlatformChecklist";

export function ManualPromotionForm({
  onCreated,
}: {
  onCreated: (promotion: Promotion) => void;
}) {
  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<PromotionPlatform[]>([
    "instagram",
  ]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleCreate() {
    if (!caption.trim()) {
      toast.error("Write a caption first");
      return;
    }
    if (!imageFile) {
      toast.error("Attach an image first");
      return;
    }
    setCreating(true);
    try {
      const promotion = await createManualPromotion(
        caption.trim(),
        imageFile,
        platforms,
      );
      onCreated(promotion);
      setCaption("");
      setImageFile(null);
      setImagePreview(null);
    } catch {
      toast.error("Failed to create promotion");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <Textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write your caption…"
          rows={4}
          className="text-sm"
        />

        {imagePreview && (
          <img
            src={imagePreview}
            alt="Selected"
            className="w-full max-w-sm rounded-lg border mx-auto"
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
          {imageFile ? "Replace image" : "Add image"}
        </Button>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Promote on
          </p>
          <PlatformChecklist selected={platforms} onChange={setPlatforms} />
        </div>

        <Button disabled={creating} onClick={handleCreate}>
          {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {creating ? "Creating…" : "Create promotion"}
        </Button>
      </CardContent>
    </Card>
  );
}
