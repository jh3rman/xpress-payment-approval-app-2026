import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'payment-portal-files';

/**
 * Simple in-memory cache for signed URLs
 * Stores { path: { url: string, expiresAt: number } }
 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Get or create cached signed URL
 */
async function getCachedSignedUrl(path: string): Promise<string | null> {
  const now = Date.now();

  // Check cache
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  // Create new signed URL
  const { data, error } = await supabaseServer.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 3600); // 1 hour

  if (error || !data) {
    console.error('Signed URL error:', error);
    return null;
  }

  // Cache it (expires 50 minutes from now to be safe)
  const expiresAt = now + 50 * 60 * 1000; // 50 minutes
  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt,
  });

  // Clean up expired entries periodically
  if (signedUrlCache.size > 100) {
    for (const [key, value] of signedUrlCache.entries()) {
      if (value.expiresAt <= now) {
        signedUrlCache.delete(key);
      }
    }
  }

  return data.signedUrl;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // Get cached or create new signed URL
    const signedUrl = await getCachedSignedUrl(path);

    if (!signedUrl) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Fetch the file from the signed URL
    const fileResponse = await fetch(signedUrl);
    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
    }

    // Get the file blob
    const blob = await fileResponse.blob();

    // Return the file
    return new NextResponse(blob, {
      headers: {
        'Content-Type': fileResponse.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${path.split('/').pop()}"`,
      },
    });
  } catch (error) {
    console.error('Download exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
