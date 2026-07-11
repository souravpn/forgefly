import { Facebook, Home, Instagram, Linkedin, Twitter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LIVE_PLATFORMS } from "@/services/promotionService";
import type { PromotionPlatform } from "@/types/types";

const PLATFORM_META: Record<
  PromotionPlatform,
  { label: string; icon: typeof Instagram }
> = {
  instagram: { label: "Instagram", icon: Instagram },
  facebook: { label: "Facebook", icon: Facebook },
  nextdoor: { label: "Nextdoor", icon: Home },
  x: { label: "X", icon: Twitter },
  linkedin: { label: "LinkedIn", icon: Linkedin },
};

const ALL_PLATFORMS: PromotionPlatform[] = [
  "instagram",
  "facebook",
  "nextdoor",
  "x",
  "linkedin",
];

export function PlatformChecklist({
  selected,
  onChange,
}: {
  selected: PromotionPlatform[];
  onChange: (platforms: PromotionPlatform[]) => void;
}) {
  function toggle(platform: PromotionPlatform) {
    if (selected.includes(platform)) {
      onChange(selected.filter((p) => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  }

  return (
    <div className="flex flex-wrap gap-4">
      {ALL_PLATFORMS.map((platform) => {
        const { label, icon: Icon } = PLATFORM_META[platform];
        const isLive = LIVE_PLATFORMS.includes(platform);
        const checkbox = (
          <label
            key={platform}
            className={`flex items-center gap-2 text-sm ${
              isLive ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            }`}
          >
            <Checkbox
              checked={selected.includes(platform)}
              disabled={!isLive}
              onCheckedChange={() => toggle(platform)}
            />
            <Icon className="w-4 h-4" />
            {label}
          </label>
        );

        if (isLive) return checkbox;

        return (
          <Tooltip key={platform}>
            <TooltipTrigger asChild>{checkbox}</TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
