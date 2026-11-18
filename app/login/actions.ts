'use server';
import { redirect } from 'next/navigation';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';

const safeNext = (n: unknown) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/portal');

export async function signIn(fd: FormData) {
  const next = safeNext(fd.get('next'));
  const fail = (m: string) => redirect(`/login?error=${encodeURIComponent(m)}${next !== '/portal' ? `&next=${encodeURIComponent(next)}` : ''}`);
  if (!supabaseConfigured()) fail('The Member Lounge is not connected yet.');
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email: String(fd.get('email') || '').trim(), password: String(fd.get('password') || '') });
  if (error) fail('That email and password did not match. Please try again.');
  redirect(next);
}

export async function sendReset(fd: FormData) {
  if (!supabaseConfigured()) redirect('/login?mode=reset&error=' + encodeURIComponent('The Member Lounge is not connected yet.'));
  const sb = await createClient(); const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  await sb.auth.resetPasswordForEmail(String(fd.get('email') || '').trim(), { redirectTo: `${site}/auth/confirm?next=/auth/update-password` });
  // Same message whether or not the address exists, so nobody can test who is a member.
  redirect('/login?ok=' + encodeURIComponent('If that address has an account, a reset link is on its way.'));
}

export async function setPassword(fd: FormData) {
  const pw = String(fd.get('password') || ''), again = String(fd.get('again') || '');
  const fail = (m: string) => redirect('/auth/update-password?error=' + encodeURIComponent(m));
  if (pw.length < 10) fail('Please use at least 10 characters.');
  if (pw !== again) fail('The two passwords do not match.');
  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) fail(error.message);
  redirect('/portal?ok=' + encodeURIComponent('Password saved. Welcome to the Lounge.'));
}
