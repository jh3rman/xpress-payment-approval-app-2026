import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'payment-portal-files';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // Get signed URL
    const { data, error } = await supabaseServer.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 3600); // 1 hour

    if (error || !data) {
      console.error('Download error:', error);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Fetch the file from the signed URL
    const fileResponse = await fetch(data.signedUrl);
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
