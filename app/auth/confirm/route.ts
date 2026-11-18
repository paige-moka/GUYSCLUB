import { type NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Invite and password reset emails land here. The one time code in the link is exchanged for a session,
// then the person chooses a password.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash'), type = searchParams.get('type') as EmailOtpType | null, code = searchParams.get('code');
  const nextRaw = searchParams.get('next') ?? '/auth/update-password';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/auth/update-password';
  const sb = await createClient();
  if (token_hash && type) {
    const { error } = await sb.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(origin + next);
  } else if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(origin + next);
  }
  return NextResponse.redirect(origin + '/login?error=' + encodeURIComponent('That link has expired or was already used. Ask us for a new one, or use "Forgot your password?".'));
}
