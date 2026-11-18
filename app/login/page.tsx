import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthFrame } from '@/components/AuthFrame';
import { Notice } from '@/components/ui';
import { getMe } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase/server';
import { signIn, sendReset } from './actions';

export const dynamic = 'force-dynamic'; // never prerendered or cached: every request is checked
export const metadata: Metadata = { title: 'Member login' };

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams; const reset = sp.mode === 'reset';
  if (await getMe()) redirect('/portal');
  return (
    <AuthFrame eyebrow="The Member Lounge" title={<>Member <span className="text-pink">login.</span></>}>
      <Notice searchParams={searchParams} />
      {!supabaseConfigured() ? <p className="mb-6 border-2 border-dashed border-hold p-3 text-[.92rem] text-hold">The Lounge is not connected to its database yet. See the README, section &quot;Connect Supabase&quot;.</p> : null}
      <h2 className="mb-6 text-[2rem]">{reset ? 'Reset your password' : 'Sign in'}</h2>
      {reset ? (
        <form action={sendReset} className="grid gap-4">
          <label className="block"><span className="label">Email</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
          <button className="btn" type="submit">Send reset link →</button>
          <Link className="link justify-self-start" href="/login">Back to sign in</Link>
        </form>
      ) : (
        <form action={signIn} className="grid gap-4">
          {sp.next ? <input type="hidden" name="next" value={sp.next} /> : null}
          <label className="block"><span className="label">Email</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
          <label className="block"><span className="label">Password</span><input className="input" name="password" type="password" autoComplete="current-password" required /></label>
          <button className="btn" type="submit">Sign in →</button>
          <Link className="link justify-self-start" href="/login?mode=reset">Forgot your password?</Link>
        </form>
      )}
      <p className="mt-8 border-t border-line pt-5 text-[.9rem] text-muted">Membership is by invitation. Not a member yet? <a className="font-semibold text-pink-ink" href="/contact.html">Tell us what you need.</a></p>
    </AuthFrame>
  );
}
