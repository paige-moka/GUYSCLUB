import { NextResponse, type NextRequest } from 'next/server';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
export async function POST(request: NextRequest) {
  if (supabaseConfigured()) { const sb = await createClient(); await sb.auth.signOut(); }
  return NextResponse.redirect(new URL('/login?ok=' + encodeURIComponent('You are signed out.'), request.url), { status: 303 });
}
