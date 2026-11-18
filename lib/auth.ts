import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient, supabaseConfigured } from './supabase/server';

export type Role = 'admin' | 'team' | 'specialist' | 'member';
export type Me = {
  id: string; email: string; full_name: string; role: Role; member_id: string | null; can_view_financials: boolean;
  member: { id: string; name: string; serial: string | null; is_demo: boolean; status: string } | null;
};

/** The signed in person, verified with Supabase on every request, plus their profile. */
export const getMe = cache(async (): Promise<Me | null> => {
  if (!supabaseConfigured()) return null;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: p } = await sb.from('profiles').select('id, email, full_name, role, member_id, can_view_financials').eq('id', user.id).maybeSingle();
  if (!p) return null;
  let member: Me['member'] = null;
  if (p.member_id && p.role === 'member') {
    const { data: m } = await sb.from('members').select('id, name, serial, is_demo, status').eq('id', p.member_id).maybeSingle();
    member = m ?? null;
  }
  return { ...p, email: p.email ?? user.email ?? '', full_name: p.full_name ?? '', member } as Me;
});

export async function requireMe() { const me = await getMe(); if (!me) redirect('/login'); return me; }
export const isStaff = (me: Me) => me.role === 'admin' || me.role === 'team';
export const seesMoney = (me: Me) => me.role === 'admin' || ((me.role === 'team' || me.role === 'member') && me.can_view_financials);
export async function requireStaff() { const me = await requireMe(); if (!isStaff(me)) redirect('/portal'); return me; }
export async function requireAdmin() { const me = await requireMe(); if (me.role !== 'admin') redirect(isStaff(me) ? '/admin?error=Only an administrator can open that page.' : '/portal'); return me; }
/** Member pages: a member login with a member business attached. Staff are sent to the admin side. */
export async function requireMember() {
  const me = await requireMe();
  if (isStaff(me)) redirect('/admin');
  if (me.role === 'specialist') redirect('/portal/projects');
  if (!me.member) redirect('/portal');
  return me as Me & { member: NonNullable<Me['member']>; member_id: string };
}
