import { supabaseServer } from '@/lib/supabase/server';

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'payment-portal-files';

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  file: File,
  orderId: string,
  fileType: 'invoice' | 'artwork'
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${orderId}/${fileType}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await supabaseServer.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('File upload error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, path: filePath };
  } catch (error) {
    console.error('File upload exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate a signed URL for file download (valid for 1 hour)
 */
export async function getSignedUrl(
  storagePath: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { data, error } = await supabaseServer.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600); // 1 hour

    if (error) {
      console.error('Signed URL error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, url: data.signedUrl };
  } catch (error) {
    console.error('Signed URL exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseServer.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error('File delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('File delete exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate a secure random token for order URLs
 */
export function generateOrderToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
