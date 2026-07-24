import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/db/supabase';
import type {
  Promotion,
  PromotionPlatform,
  SocialPost,
  SocialPostStatus,
  SocialPostTarget,
} from '@/types/types';

const ALL_PLATFORMS: PromotionPlatform[] = ['instagram', 'facebook', 'nextdoor', 'x', 'linkedin', 'pinterest'];
export const LIVE_PLATFORMS: PromotionPlatform[] = ['instagram', 'facebook'];

/** supabase-js collapses every non-2xx edge function response into the same generic
 * "Edge Function returned a non-2xx status code" message, hiding the actual error our
 * functions put in the JSON body (e.g. "Reel video is not ready yet"). Unwrap it so
 * callers/toasts show something actionable. */
async function unwrapFunctionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return new Error(body.error);
    } catch {
      // Response body wasn't JSON — fall through to the generic message below.
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}

async function currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

async function resolveBusinessId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No active business found');
  return data.id;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function attachTargets(posts: SocialPost[]): Promise<Promotion[]> {
  if (posts.length === 0) return [];
  const { data: targets, error } = await supabase
    .from('social_post_targets')
    .select('*')
    .in('post_id', posts.map((p) => p.id));
  if (error) throw error;

  const byPost = new Map<string, SocialPostTarget[]>();
  for (const t of targets ?? []) {
    const list = byPost.get(t.post_id) ?? [];
    list.push(t);
    byPost.set(t.post_id, list);
  }
  return posts.map((p) => ({ ...p, targets: byPost.get(p.id) ?? [] }));
}

// ─── Featured ───────────────────────────────────────────────────────────────

/** Today's active Featured promo — still a draft awaiting action. Null once published or moved to Draft. */
export async function getFeaturedPromotion(businessId: string): Promise<Promotion | null> {
  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_featured', true)
    .eq('featured_date', todayISO())
    .eq('status', 'draft')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [withTargets] = await attachTargets([data]);
  return withTargets;
}

export async function generateFeaturedPromotion(): Promise<Promotion> {
  const { data, error } = await supabase.functions.invoke('generate-promotion', {
    body: { mode: 'featured' },
  });
  if (error) throw await unwrapFunctionError(error);
  if (data?.error) throw new Error(data.error);
  const [withTargets] = await attachTargets([data.post as SocialPost]);
  return withTargets;
}

/** Same caption/headline generation, but the graphic is a true AI diffusion image
 * (OpenAI gpt-image-2) instead of the templated SVG render — costs real money per call. */
export async function generateFeaturedPromotionOpenAI(): Promise<Promotion> {
  const { data, error } = await supabase.functions.invoke('generate-promotion', {
    body: { mode: 'featured_openai' },
  });
  if (error) throw await unwrapFunctionError(error);
  if (data?.error) throw new Error(data.error);
  const [withTargets] = await attachTargets([data.post as SocialPost]);
  return withTargets;
}

// ─── Manual creation (Create tab) ──────────────────────────────────────────

export async function createManualPromotion(
  caption: string,
  imageFile: File,
  platforms: PromotionPlatform[],
): Promise<Promotion> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  const { data: post, error: insertError } = await supabase
    .from('social_posts')
    .insert({
      business_id: businessId,
      platform: 'instagram',
      caption,
      status: 'draft',
      source: 'manual',
      is_featured: false,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  const ext = imageFile.name.split('.').pop();
  const filename = `promotions/${businessId}/${post.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('work-samples')
    .upload(filename, imageFile, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from('work-samples').getPublicUrl(filename);
  const { data: updated, error: updateError } = await supabase
    .from('social_posts')
    .update({ image_url: publicUrlData.publicUrl })
    .eq('id', post.id)
    .select()
    .single();
  if (updateError) throw updateError;

  const targets = await setPromotionTargets(post.id, platforms);
  return { ...updated, targets };
}

// ─── Targets / platforms ───────────────────────────────────────────────────

export async function setPromotionTargets(
  postId: string,
  platforms: PromotionPlatform[],
): Promise<SocialPostTarget[]> {
  await supabase.from('social_post_targets').delete().eq('post_id', postId);
  const selected = platforms.length > 0 ? platforms : ALL_PLATFORMS;
  const { data, error } = await supabase
    .from('social_post_targets')
    .insert(selected.map((platform) => ({ post_id: postId, platform, status: 'pending' })))
    .select();
  if (error) throw error;
  return data ?? [];
}

// ─── Editing / status transitions ──────────────────────────────────────────

export async function updatePromotionCaption(id: string, caption: string): Promise<SocialPost> {
  const { data, error } = await supabase
    .from('social_posts')
    .update({ caption })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function draftPromotion(id: string): Promise<void> {
  const { error } = await supabase
    .from('social_posts')
    .update({ status: 'draft' })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePromotion(id: string): Promise<void> {
  const { error } = await supabase.from('social_posts').delete().eq('id', id);
  if (error) throw error;
}

/** Marks the post 'approved' (required by the Instagram publish function) before publishing. */
export async function approvePromotion(id: string): Promise<void> {
  const { error } = await supabase
    .from('social_posts')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function publishInstagramTarget(
  postId: string,
  useVideo?: boolean,
): Promise<{ published: boolean; platform_post_id: string }> {
  const { data, error } = await supabase.functions.invoke('social-publish-instagram', {
    body: { social_post_id: postId, use_video: !!useVideo },
  });
  if (error) throw await unwrapFunctionError(error);
  return data;
}

export async function publishFacebookTarget(
  postId: string,
  useVideo?: boolean,
): Promise<{ published: boolean; platform_post_id: string }> {
  const { data, error } = await supabase.functions.invoke('social-publish-facebook', {
    body: { social_post_id: postId, use_video: !!useVideo },
  });
  if (error) throw await unwrapFunctionError(error);
  return data;
}

/** Polls the Shotstack render status for a promotion's Reel video, resolving the
 * `video_status`/`video_url` set by generate-promotion once the render finishes. */
export async function checkVideoRenderStatus(
  postId: string,
): Promise<{ video_status: SocialPost['video_status']; video_url: string | null }> {
  const { data, error } = await supabase.functions.invoke('check-video-render', {
    body: { social_post_id: postId },
  });
  if (error) throw await unwrapFunctionError(error);
  return data;
}

// ─── Lists ──────────────────────────────────────────────────────────────────

export async function getPromotionsByStatus(
  businessId: string,
  status: SocialPostStatus,
  limit = 5,
): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return attachTargets(data ?? []);
}
