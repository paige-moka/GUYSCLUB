import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const KINDS: Record<string, { table: string; bucket: string }> = {
  document: { table: 'documents', bucket: 'member-files' },
  blueprint: { table: 'blueprint_versions', bucket: 'member-files' },
  library: { table: 'library_resources', bucket: 'library' },
  update: { table: 'campaign_updates', bucket: 'library' },
};

// Files are never public. The record is looked up AS THE SIGNED IN PERSON (so Row Level Security
// decides whether they may see it), then a link that expires in 60 seconds is issued.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = KINDS[searchParams.get('kind') ?? ''], id = searchParams.get('id') ?? '';
  if (!kind || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));
  const { data: row } = await sb.from(kind.table).select('storage_path, file_name').eq('id', id).maybeSingle();
  if (!row?.storage_path) return new NextResponse('Not found', { status: 404 });
  const { data, error } = await sb.storage.from(kind.bucket).createSignedUrl(row.storage_path, 60, { download: row.file_name || true });
  if (error || !data?.signedUrl) return new NextResponse('Not found', { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
