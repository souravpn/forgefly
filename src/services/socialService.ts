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

export async function publishSocialPost(id: string): Promise<{ published: boolean; platform_post_id: string }> {
  const { data, error } = await supabase.functions.invoke('social-publish-instagram', {
    body: { social_post_id: id },
  });
  if (error) throw error;
  return data;
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
