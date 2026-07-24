import { supabase } from '@/db/supabase';
import type { CompetitorProfile, CompetitorSiteIntel, SocialPost } from '@/types/types';

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

// ─── Social posts ───────────────────────────────────────────────────────────

export async function getSocialPosts(): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function generateSocialDrafts(): Promise<SocialPost[]> {
  const { data, error } = await supabase.functions.invoke('ai-gateway', {
    body: { mode: 'generate_social_content' },
  });
  if (error) throw error;
  return (data?.posts as SocialPost[]) ?? [];
}

export async function uploadSocialImage(postId: string, file: File): Promise<string> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);
  const ext = file.name.split('.').pop();
  const filename = `social/${businessId}/${postId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('work-samples')
    .upload(filename, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from('work-samples').getPublicUrl(filename);
  const imageUrl = publicUrlData.publicUrl;

  const { error } = await supabase
    .from('social_posts')
    .update({ image_url: imageUrl })
    .eq('id', postId);
  if (error) throw error;

  return imageUrl;
}

export async function approveSocialPost(id: string, imageUrl: string | null): Promise<SocialPost> {
  if (!imageUrl) throw new Error('Attach an image before approving — Instagram requires media on every post');

  const { data, error } = await supabase
    .from('social_posts')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function archiveSocialPost(id: string): Promise<void> {
  const { error } = await supabase
    .from('social_posts')
    .update({ status: 'archived' })
    .eq('id', id);

  if (error) throw error;
}

export async function publishSocialPost(
  id: string,
  useVideo?: boolean,
): Promise<{ published: boolean; platform_post_id: string }> {
  const { data, error } = await supabase.functions.invoke('social-publish-instagram', {
    body: { social_post_id: id, use_video: !!useVideo },
  });
  if (error) throw error;
  return data;
}

// ─── Connections (Instagram / WhatsApp OAuth) ──────────────────────────────

export interface SocialConnectionStatus {
  platform: 'instagram' | 'whatsapp' | 'facebook';
  status: 'connected' | 'disconnected' | 'pending_page_selection';
  external_id: string;
  extra: {
    username?: string;
    waba_id?: string;
    display_phone_number?: string;
    page_name?: string;
    pages?: { id: string; name: string }[];
  } | null;
}

const OAUTH_REDIRECT_PATH = '/dashboard/social';

export async function getSocialConnections(businessId: string): Promise<SocialConnectionStatus[]> {
  const { data, error } = await supabase.functions.invoke('get-social-status', {
    body: { business_id: businessId },
  });
  if (error) throw error;
  return data?.connections ?? [];
}

export function startInstagramConnect(businessId: string): void {
  const appId = import.meta.env.VITE_INSTAGRAM_APP_ID as string;
  const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'instagram_business_basic,instagram_business_content_publish',
    state: `instagram:${businessId}`,
  });
  window.location.href = `https://www.instagram.com/oauth/authorize?${params}`;
}

export function startWhatsappConnect(businessId: string): void {
  const appId = import.meta.env.VITE_META_APP_ID as string;
  const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'whatsapp_business_management,whatsapp_business_messaging',
    state: `whatsapp:${businessId}`,
  });
  window.location.href = `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

export function startFacebookConnect(businessId: string): void {
  const appId = import.meta.env.VITE_META_APP_ID as string;
  const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'pages_show_list,pages_manage_posts,pages_read_engagement',
    state: `facebook:${businessId}`,
  });
  window.location.href = `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

export async function completeSocialOauth(
  platform: 'instagram' | 'whatsapp' | 'facebook',
  code: string,
  businessId: string,
): Promise<{ connected: boolean; needsSelection?: boolean; pages?: { id: string; name: string }[]; extra: SocialConnectionStatus['extra'] }> {
  const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
  const { data, error } = await supabase.functions.invoke('social-oauth-callback', {
    body: { platform, code, business_id: businessId, redirect_uri: redirectUri },
  });
  if (error) throw error;
  return data;
}

/** Finalizes a pending multi-Page Facebook connection once the user picks which Page to use —
 * see social-facebook-select-page. Every subsequent publish then needs zero extra steps. */
export async function selectFacebookPage(
  businessId: string,
  pageId: string,
): Promise<{ connected: boolean; extra: SocialConnectionStatus['extra'] }> {
  const { data, error } = await supabase.functions.invoke('social-facebook-select-page', {
    body: { business_id: businessId, page_id: pageId },
  });
  if (error) throw error;
  return data;
}

export async function disconnectSocialPlatform(
  platform: 'instagram' | 'whatsapp' | 'facebook',
  businessId: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke('social-disconnect', {
    body: { platform, business_id: businessId },
  });
  if (error) throw error;
}

// ─── Platform requests ──────────────────────────────────────────────────────

export async function requestPlatform(homepageUrl: string): Promise<void> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  const { error } = await supabase
    .from('platform_requests')
    .insert({ business_id: businessId, homepage_url: homepageUrl });

  if (error) throw error;
}

// ─── Competitors ────────────────────────────────────────────────────────────

export async function getCompetitors(): Promise<CompetitorProfile[]> {
  const { data, error } = await supabase
    .from('competitor_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function suggestCompetitors(niche: string): Promise<{ handle: string; source_url: string }[]> {
  const { data, error } = await supabase.functions.invoke('research-competitor', {
    body: { action: 'discover_handles', niche },
  });
  if (error) throw error;
  return data?.candidates ?? [];
}

export async function addCompetitor(
  handle: string,
  source: 'ai_suggested' | 'manual',
  websiteUrl?: string,
): Promise<CompetitorProfile> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  const { data, error } = await supabase
    .from('competitor_profiles')
    .insert({
      business_id: businessId,
      handle,
      website_url: websiteUrl ?? null,
      source,
      status: 'tracking',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function dismissCompetitor(id: string): Promise<void> {
  const { error } = await supabase
    .from('competitor_profiles')
    .update({ status: 'dismissed' })
    .eq('id', id);

  if (error) throw error;
}

export async function getCompetitorIntel(competitorId: string): Promise<CompetitorSiteIntel | null> {
  const { data, error } = await supabase
    .from('competitor_site_intel')
    .select('*')
    .eq('competitor_id', competitorId)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchCompetitorIntel(
  competitorId: string,
  websiteUrl: string,
): Promise<CompetitorSiteIntel> {
  const { data: extracted, error: fnError } = await supabase.functions.invoke('research-competitor', {
    body: { action: 'site_intel', competitor_id: competitorId, website_url: websiteUrl },
  });
  if (fnError) throw fnError;

  const { data, error } = await supabase
    .from('competitor_site_intel')
    .insert({
      competitor_id: competitorId,
      pricing_notes: extracted.pricing_notes,
      turnaround_notes: extracted.turnaround_notes,
      review_summary: extracted.review_summary,
      raw_extract: extracted.raw_extract,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
