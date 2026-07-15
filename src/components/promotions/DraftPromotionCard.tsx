import { Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Promotion } from "@/types/types";

export function DraftPromotionCard({
  promotion,
  onPublish,
  onEdit,
  onDelete,
}: {
  promotion: Promotion;
  onPublish: (promotion: Promotion) => void;
  onEdit: (promotion: Promotion) => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      onDelete(promotion.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 flex gap-4">
        {promotion.image_url && (
          <img
            src={promotion.image_url}
            alt="Promotion graphic"
            className="w-20 h-20 rounded-lg border object-cover shrink-0"
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm line-clamp-2">{promotion.caption}</p>
          <div className="flex flex-wrap gap-1.5">
            {promotion.targets
              .filter((t) => t.platform !== "instagram_reel" && t.platform !== "facebook_reel")
              .map((t) => (
                <Badge key={t.id} variant="outline" className="text-xs capitalize">
                  {t.platform}
                </Badge>
              ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            title="Approve and publish"
            onClick={() => onPublish(promotion)}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            title="Edit"
            onClick={() => onEdit(promotion)}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            title="Delete"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
