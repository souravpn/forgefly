# CLAUDE.md — src/components/promotions/

Guidance specific to this directory. Read the root `CLAUDE.md`'s "Social & Promotions" section first — this is the component layer behind it.

## Component map

| Component | Role |
|---|---|
| `PromotionCard.tsx` | Photo/Reel preview for the Featured tab, with render-status polling for in-progress Reels. |
| `PromotionList.tsx` | Read-only list rendering for the Published tab. |
| `DraftPromotionCard.tsx` | Draft-tab card — the only place with real action buttons (Send / Edit / Delete). This is where publishing actually gets triggered; the Draft tab used to render `PromotionList` (read-only) with no way to publish at all — that was a real shipped bug, not just a UI gap, so don't route Draft back through `PromotionList`. |
| `EditPromotionModal.tsx` | Caption + `PlatformChecklist` editor. "Save" persists only; "Approve and Publish" persists then hands off to `PublishWorkflowModal`. |
| `PublishWorkflowModal.tsx` | Loops over every platform in `LIVE_PLATFORMS` (`promotionService.ts`), publishing photo then Reel per platform. Each platform/format leg fails independently — one platform erroring must never block another. |
| `PlatformChecklist.tsx` | Shared per-platform checkbox UI used by both the edit modal and the publish modal. |
| `ManualPromotionForm.tsx` | Manual (non-AI) promotion creation, for when a business wants to post something Freeda didn't generate. |
| `OpenAIIcon.tsx` | Small brand-mark icon for the gpt-image-2 generation path — cosmetic only. |

## Things that aren't obvious from the files alone

- **Photo and Reel are two independent publish targets**, tracked as separate rows (`social_post_targets.platform` includes `instagram_reel` / `facebook_reel` alongside `instagram` / `facebook`) — not a single post with a video attached. Any UI that lists or counts targets needs to handle both rows per platform.
- **`LIVE_PLATFORMS` in `promotionService.ts`** (currently `['instagram', 'facebook']`) is the actual source of truth for which platforms `PublishWorkflowModal` loops over — adding a new platform means updating that array and adding its `publish*Target` function, not just adding UI here.
- **Reels are only generated for the `featured_openai` (gpt-image-2) generation path**, not the older resvg-template path — a promotion without a Reel isn't a bug, check `video_status` on the `social_posts` row before assuming something's broken.
- **Agency-tier gating is currently disabled repo-wide (temporary — "for now"; may come back).** `SocialPage.tsx` used to check `isAgency` before rendering any of this; that check (and the equivalent ones in `ClientsPage.tsx`'s team-member invite and `DashboardPage.tsx`'s promo-ready banner) has been removed so every feature is available to every user regardless of subscription tier. `isAgency` still exists in `AuthContext.tsx` (unused everywhere now) so re-gating later is a small diff, not a rebuild — don't delete it, and don't add a new gate here without checking whether gating is back on.
