import type { Metadata } from 'next';
import { AuthFrame } from '@/components/AuthFrame';
import { Notice } from '@/components/ui';
import { requireMe } from '@/lib/auth';
import { setPassword } from '@/app/login/actions';

export const dynamic = 'force-dynamic'; // never prerendered or cached: every request is checked
export const metadata: Metadata = { title: 'Choose a password' };

export default async function UpdatePassword({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  return (
    <AuthFrame eyebrow="Welcome to the Club" title={<>Choose a <span className="text-pink">password.</span></>}>
      <Notice searchParams={searchParams} />
      <h2 className="mb-2 text-[2rem]">Set your password</h2>
      <p className="mb-6 text-[.92rem] text-muted">Signed in as {me.email}. At least 10 characters.</p>
      <form action={setPassword} className="grid gap-4">
        <label className="block"><span className="label">New password</span><input className="input" name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
        <label className="block"><span className="label">Type it again</span><input className="input" name="again" type="password" autoComplete="new-password" minLength={10} required /></label>
        <button className="btn" type="submit">Save and enter the Lounge →</button>
      </form>
    </AuthFrame>
  );
}
