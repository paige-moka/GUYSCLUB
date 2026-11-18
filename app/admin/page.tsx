import type { Metadata } from 'next';
import Link from 'next/link';
import { Act, Badge, Empty, Notice, PageHead, Section, Stat } from '@/components/ui';
import { Scroll } from '@/components/admin';
import { requireStaff, seesMoney } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, isLate, money } from '@/lib/format';
import { saveRow } from '@/app/actions';

export const metadata: Metadata = { title: 'Back office' };

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff(); const sb = await createClient(); const fin = seesMoney(me);
  const [members, projects, waiting, tft, pend, inq, act] = await Promise.all([
    sb.from('members').select('id, name, status'),
    sb.from('projects').select('id, status'),
    sb.from('tasks').select('id, title, due_date, member_id, project_id, owner_type').neq('status', 'done').order('due_date', { nullsFirst: false }),
    sb.from('tft_records').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    fin ? sb.from('financial_transactions').select('amount_cents, status, member_id').in('status', ['pledged', 'pending']) : Promise.resolve({ data: [] as { amount_cents: number; status: string; member_id: string | null }[] }),
    sb.from('inquiries').select('id, created_at, name, business, email, phone, need, message').eq('handled', false).order('created_at', { ascending: false }).limit(20),
    sb.from('activity_log').select('id, at, actor_name, action, entity, summary, member_id').order('at', { ascending: false }).limit(12),
  ]);
  const mem = members.data ?? []; const name = (id: string | null) => mem.find((m) => m.id === id)?.name ?? '';
  const memberTasks = (waiting.data ?? []).filter((t) => t.owner_type === 'member'), ours = (waiting.data ?? []).filter((t) => t.owner_type !== 'member');
  const overdue = (waiting.data ?? []).filter((t) => isLate(t.due_date, false)).length;
  return (<>
    <Notice searchParams={searchParams} />
    <PageHead eyebrow="GUYS&CO back office" title={<>Run the <span className="text-pink-ink">Lounge.</span></>} />
    <div className="mb-10 grid gap-[2px] border-2 border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
      <Link className="no-underline" href="/admin/members"><Stat dark k="Active members" v={mem.filter((m) => m.status === 'active').length} note={`${mem.length} in total`} /></Link>
      <Link className="no-underline" href="/admin/projects"><Stat k="Active projects" v={(projects.data ?? []).filter((p) => p.status === 'active').length} note={`${(projects.data ?? []).length} in total`} /></Link>
      <Stat k="Open actions" v={(waiting.data ?? []).length} note={`${overdue} overdue · ${memberTasks.length} waiting on members`} />
      <Link className="no-underline" href="/admin/three"><Stat k="Three for Three" v={tft.count ?? 0} note="Submissions to review" /></Link>
    </div>
    {fin && (pend.data ?? []).length ? <p className="mb-10 border-2 border-hold p-4 text-[.95rem]"><b>{(pend.data ?? []).length} ledger {(pend.data ?? []).length === 1 ? 'entry is' : 'entries are'} not yet confirmed</b> ({money((pend.data ?? []).reduce((a, r) => a + Number(r.amount_cents), 0))} pledged or pending). <Link className="link ml-2" href="/admin/ledger">Open the Ledger</Link></p> : null}

    <Section eyebrow="Accountability" title="Waiting on members">
      {memberTasks.length ? <Scroll><table className="tbl"><thead><tr><th>Member</th><th>Action</th><th>Due</th></tr></thead><tbody>{memberTasks.map((t) => (
        <tr key={t.id}><td><Link className="font-semibold underline-offset-4 hover:underline" href={`/admin/members/${t.member_id}`}>{name(t.member_id)}</Link></td><td>{t.title}</td><td className={`whitespace-nowrap ${isLate(t.due_date, false) ? 'font-semibold text-bad' : ''}`}>{day(t.due_date) || 'No date'}{isLate(t.due_date, false) ? ' · overdue' : ''}</td></tr>))}</tbody></table></Scroll>
        : <Empty>No member actions are outstanding.</Empty>}
    </Section>
    <Section eyebrow="Our side" title="Waiting on GUYS&CO and specialists">
      {ours.length ? <Scroll><table className="tbl"><thead><tr><th>Member</th><th>Action</th><th>Owner</th><th>Due</th></tr></thead><tbody>{ours.slice(0, 25).map((t) => (
        <tr key={t.id}><td><Link className="font-semibold underline-offset-4 hover:underline" href={t.project_id ? `/admin/projects/${t.project_id}` : `/admin/members/${t.member_id}`}>{name(t.member_id)}</Link></td><td>{t.title}</td><td><Badge status="x">{t.owner_type === 'guysco' ? 'GUYS&CO' : 'Specialist'}</Badge></td><td className={`whitespace-nowrap ${isLate(t.due_date, false) ? 'font-semibold text-bad' : ''}`}>{day(t.due_date) || 'No date'}</td></tr>))}</tbody></table></Scroll>
        : <Empty>Nothing open on our side.</Empty>}
    </Section>
    <Section eyebrow="From the website" title="New inquiries">
      {(inq.data ?? []).length ? <ul className="grid gap-3">{(inq.data ?? []).map((i) => (
        <li key={i.id} className="card-soft"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{i.name}{i.business ? ` · ${i.business}` : ''}</p><p className="text-[.9rem] text-muted">{i.email}{i.phone ? ` · ${i.phone}` : ''} · {i.need} · {day(i.created_at)}</p></div>
          <Act action={saveRow} fields={{ _table: 'inquiries', _id: String(i.id), _back: '/admin', handled: 'true', _ok: 'Marked as handled.' }}>Mark handled</Act></div><p className="mt-2 whitespace-pre-line text-[.94rem]">{i.message}</p></li>))}</ul>
        : <Empty>No new inquiries.</Empty>}
    </Section>
    <Section eyebrow="Latest" title="Recent activity" action={<Link className="link" href="/admin/activity">All activity</Link>}>
      {(act.data ?? []).length ? <ul className="border-t-2 border-ink">{(act.data ?? []).map((a) => (
        <li key={a.id} className="flex flex-wrap justify-between gap-3 border-b border-line py-2 text-[.9rem]"><span><b>{a.actor_name ?? 'System'}</b> {a.action === 'insert' ? 'added' : a.action === 'update' ? 'updated' : 'removed'} {a.entity.replace(/_/g, ' ')}{a.summary ? `: ${a.summary}` : ''}{a.member_id ? ` (${name(a.member_id)})` : ''}</span><span className="font-mono text-[.64rem] uppercase tracking-[.1em] text-muted">{day(a.at)}</span></li>))}</ul>
        : <Empty>No activity yet.</Empty>}
    </Section>
  </>);
}
