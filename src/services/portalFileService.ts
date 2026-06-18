import { supabase } from '@/db/supabase';

export interface PortalFileItem {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  storage_path: string;
  uploaded_by: 'freelancer' | 'client';
  created_at: string;
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

// Look up a contact's ID by email (needed to bridge clients ↔ contacts tables)
export async function getContactIdByEmail(email: string): Promise<string | null> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  const { data } = await supabase
    .from('contacts')
    .select('id')
    .eq('business_id', businessId)
    .ilike('email', email)
    .maybeSingle();

  return data?.id ?? null;
}

export async function getPortalFiles(contactId: string): Promise<PortalFileItem[]> {
  const { data, error } = await supabase
    .from('portal_files')
    .select('id, file_name, file_url, file_size, storage_path, uploaded_by, created_at')
    .eq('client_id', contactId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function uploadPortalFile(
  contactId: string,
  file: File,
): Promise<PortalFileItem> {
  const user = await currentUser();
  const businessId = await resolveBusinessId(user.id);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${contactId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('portal-files')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('portal-files')
    .getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from('portal_files')
    .insert({
      business_id: businessId,
      client_id: contactId,
      uploaded_by: 'freelancer',
      file_name: file.name,
      file_url: publicUrl,
      storage_path: storagePath,
      file_size: file.size,
    })
    .select('id, file_name, file_url, file_size, storage_path, uploaded_by, created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function deletePortalFile(id: string, storagePath: string): Promise<void> {
  await supabase.storage.from('portal-files').remove([storagePath]);
  const { error } = await supabase.from('portal_files').delete().eq('id', id);
  if (error) throw error;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
