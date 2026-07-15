import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Promotion } from "@/types/types";

export function PromotionList({
  promotions,
  emptyLabel,
}: {
  promotions: Promotion[];
  emptyLabel: string;
}) {
  if (promotions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {promotions.map((promotion) => (
        <Card key={promotion.id}>
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
                {promotion.targets.map((t) => (
                  <Badge
                    key={t.id}
                    variant="outline"
                    className="text-xs capitalize"
                  >
                    {t.platform === "instagram_reel"
                      ? "Instagram Reel"
                      : t.platform === "facebook_reel"
                        ? "Facebook Reel"
                        : t.platform}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
