import type { Metadata } from 'next';
import { Empty, PageHead } from '@/components/ui';
import { Scroll } from '@/components/admin';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Activity' };
const when = (d: string) => new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Edmonton' }).format(new Date(d));

export default async function Activity({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff(); const sp = await searchParams; const sb = await createClient(); const filter = /^[0-9a-f-]{36}$/i.test(sp.member ?? '') ? sp.member! : '';
  let q = sb.from('activity_log').select('*').order('at', { ascending: false }).limit(200); if (filter) q = q.eq('member_id', filter);
  const [{ data: rows }, { data: members }] = await Promise.all([q, sb.from('members').select('id, name').order('name')]);
  const mname = (id: string | null) => (members ?? []).find((m) => m.id === id)?.name ?? '';
  return (<>
    <PageHead eyebrow="Activity" title={<>Who did <span className="text-pink-ink">what.</span></>}>Written by the database itself whenever a record changes, so it cannot be skipped or edited from the app.</PageHead>
    <form method="get" className="mb-6 flex flex-wrap items-end gap-3"><label className="block"><span className="label">Show</span><select className="input" name="member" defaultValue={filter}><option value="">All members</option>{(members ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><button className="btn-ghost btn" type="submit">Filter</button></form>
    {(rows ?? []).length ? <Scroll><table className="tbl"><thead><tr><th>When</th><th>Who</th><th>Did</th><th>What</th><th>Member</th></tr></thead><tbody>{(rows ?? []).map((a) => (
      <tr key={a.id}><td className="whitespace-nowrap font-mono text-[.76rem]">{when(a.at)}</td><td>{a.actor_name ?? 'System'}</td><td>{a.action === 'insert' ? 'Added' : a.action === 'update' ? 'Updated' : 'Removed'}</td><td><b>{a.entity.replace(/_/g, ' ')}</b>{a.summary ? `: ${a.summary}` : ''}</td><td>{mname(a.member_id)}</td></tr>))}</tbody></table></Scroll> : <Empty>No activity recorded yet.</Empty>}
  </>);
}
