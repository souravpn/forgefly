import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as {
      portal_token?: string;
      fileBase64?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    };

    if (!body.portal_token || !body.fileBase64 || !body.fileName) {
      return new Response(JSON.stringify({ error: 'portal_token, fileBase64, and fileName are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify portal token + load contact
    const { data: contact, error: contactErr } = await adminClient
      .from('contacts')
      .select('id, business_id, email')
      .eq('portal_token', body.portal_token)
      .maybeSingle();

    if (contactErr || !contact) {
      return new Response(JSON.stringify({ error: 'Invalid portal token' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decode base64 → Uint8Array
    const raw = atob(body.fileBase64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const safeName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${contact.id}/${Date.now()}_${safeName}`;

    const { error: uploadErr } = await adminClient.storage
      .from('portal-files')
      .upload(storagePath, bytes, {
        contentType: body.mimeType ?? 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadErr) throw uploadErr;

    const { data: { publicUrl } } = adminClient.storage
      .from('portal-files')
      .getPublicUrl(storagePath);

    const { data: fileRow, error: insertErr } = await adminClient
      .from('portal_files')
      .insert({
        business_id: contact.business_id,
        client_id: contact.id,
        uploaded_by: 'client',
        file_name: body.fileName,
        file_url: publicUrl,
        storage_path: storagePath,
        file_size: body.fileSize ?? null,
      })
      .select('id, file_name, file_url, file_size, storage_path, uploaded_by, created_at')
      .single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify(fileRow), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('upload-portal-file error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
