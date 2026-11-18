import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Act, Badge, Bar, DemoFlag, Empty, Notice, PageHead, Section, Stat } from '@/components/ui';
import { requireMe, seesMoney } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, isLate, money, pct, progressOf, sums } from '@/lib/format';
import { setTaskStatus } from '@/app/actions';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (me.role === 'specialist') redirect('/portal/projects');
  if (!me.member) {
    return (<>
      <Notice searchParams={searchParams} />
      <PageHead eyebrow="The Member Lounge" title={<>Your seat is being <span className="text-pink-ink">set up.</span></>}>
        You are signed in, and your account is not attached to a member business yet. The GUYS&amp;CO team will finish this shortly. Nothing is visible until then.
      </PageHead>
    </>);
  }
  const m = me.member.id; const sb = await createClient(); const showMoney = seesMoney(me);
  const [tasks, projects, items, miles, news, prog, tft, camp, ledger, funding] = await Promise.all([
    sb.from('tasks').select('id, title, due_date, status, project_id, owner_type').eq('member_id', m).neq('status', 'done').order('due_date', { nullsFirst: false }),
    sb.from('projects').select('id, name, status, due_date, progress_override').eq('member_id', m).in('status', ['planning', 'active', 'on_hold']).order('due_date', { nullsFirst: false }),
    sb.from('tasks').select('project_id, status').eq('member_id', m).not('project_id', 'is', null),
    sb.from('milestones').select('id, title, due_date, status, project_id').eq('member_id', m).neq('status', 'done').order('due_date', { nullsFirst: false }).limit(5),
    sb.from('announcements').select('id, title, body, created_at, author_name').order('created_at', { ascending: false }).limit(3),
    sb.from('tft_program').select('label, required_count, is_configured').eq('id', 1).maybeSingle(),
    sb.from('tft_records').select('status').eq('member_id', m),
    sb.from('fundraising_campaigns').select('id, name, goal_cents, is_demo').eq('kind', 'reconciliation').eq('status', 'active').order('created_at').limit(1).maybeSingle(),
    showMoney ? sb.from('financial_transactions').select('status, kind, amount_cents').eq('member_id', m) : Promise.resolve({ data: [] as { status: string; kind: string; amount_cents: number }[] }),
    showMoney ? sb.from('project_funding').select('goal_cents') : Promise.resolve({ data: [] as { goal_cents: number }[] }),
  ]);
  const allMiles = (await sb.from('milestones').select('project_id, status').eq('member_id', m).not('project_id', 'is', null)).data ?? [];
  const mine = (tasks.data ?? []).filter((t) => t.owner_type === 'member');
  const totals = camp.data ? (await sb.rpc('campaign_totals', { c: camp.data.id })).data?.[0] : null;
  const approved = (tft.data ?? []).filter((r) => r.status === 'approved').length;
  const s = sums(ledger.data ?? []); const goal = (funding.data ?? []).reduce((a, f) => a + Number(f.goal_cents), 0);
  const first = (me.full_name || '').split(' ')[0];

  return (<>
    <Notice searchParams={searchParams} />
    <DemoFlag show={me.member.is_demo} />
    <PageHead eyebrow={`${me.member.name}${me.member.serial ? ' · Serial ' + me.member.serial : ''}`} title={<>{first ? `${first}, here's` : "Here's"} what&apos;s <span className="text-pink-ink">next.</span></>} />

    <Section eyebrow="Needs your attention" title={mine.length ? `${mine.length} ${mine.length === 1 ? 'action is' : 'actions are'} waiting on you` : 'Nothing is waiting on you'}>
      {mine.length ? (
        <ul className="border-2 border-ink shadow-stamp">
          {mine.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 last:border-b-0">
              <div className="min-w-0">
                <p className="font-semibold">{t.title}</p>
                <p className={`font-mono text-[.68rem] uppercase tracking-[.1em] ${isLate(t.due_date, false) ? 'text-bad' : 'text-muted'}`}>{t.due_date ? `${isLate(t.due_date, false) ? 'Overdue · was due' : 'Due'} ${day(t.due_date)}` : 'No due date'}</p>
              </div>
              <Act action={setTaskStatus} fields={{ id: t.id, status: 'done', _back: '/portal' }} tone="pink">Mark done</Act>
            </li>
          ))}
        </ul>
      ) : <Empty>You&apos;re up to date. We&apos;ll list anything we need from you here.</Empty>}
    </Section>

    <Section eyebrow="Where things stand" title="Active projects" action={<Link className="link" href="/portal/projects">All projects</Link>}>
      {(projects.data ?? []).length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {(projects.data ?? []).map((p) => {
            const v = progressOf(p, [...(items.data ?? []), ...allMiles].filter((i) => i.project_id === p.id));
            return (
              <Link key={p.id} href={`/portal/projects/${p.id}`} className="card grid gap-3 no-underline transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start justify-between gap-3"><h3 className="text-[1.35rem]">{p.name}</h3><Badge status={p.status} /></div>
                <Bar value={v} labelText={`${p.name} progress`} />
                <p className="flex justify-between font-mono text-[.68rem] uppercase tracking-[.1em] text-muted"><span>{v}% complete</span><span>{p.due_date ? `Due ${day(p.due_date)}` : ''}</span></p>
              </Link>
            );
          })}
        </div>
      ) : <Empty>No active projects yet. When one starts, its progress shows here.</Empty>}
    </Section>

    <div className="grid gap-x-10 lg:grid-cols-2">
      <Section eyebrow="Coming up" title="Milestones" action={<Link className="link" href="/portal/blueprint#milestones">Blueprint</Link>}>
        {(miles.data ?? []).length ? (
          <ul className="grid gap-0 border-t-2 border-ink">
            {(miles.data ?? []).map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 border-b border-line py-3">
                <span>{x.title}</span>
                <span className="flex items-center gap-2 whitespace-nowrap font-mono text-[.68rem] uppercase tracking-[.1em] text-muted">{day(x.due_date)}<Badge status={isLate(x.due_date, false) ? 'missed' : x.status}>{isLate(x.due_date, false) ? 'Overdue' : undefined}</Badge></span>
              </li>
            ))}
          </ul>
        ) : <Empty>No open milestones.</Empty>}
      </Section>

      <Section eyebrow="From the team" title="Announcements">
        {(news.data ?? []).length ? (
          <ul className="grid gap-3">
            {(news.data ?? []).map((a) => (
              <li key={a.id} className="border-l-4 border-pink bg-wash p-4">
                <p className="font-semibold">{a.title}</p>
                {a.body ? <p className="mt-1 whitespace-pre-line text-[.94rem] text-muted">{a.body}</p> : null}
                <p className="mt-2 font-mono text-[.64rem] uppercase tracking-[.1em] text-muted">{day(a.created_at)}{a.author_name ? ` · ${a.author_name}` : ''}</p>
              </li>
            ))}
          </ul>
        ) : <Empty>No announcements right now.</Empty>}
      </Section>
    </div>

    <Section eyebrow="At a glance" title="Money and the Club">
      <div className="grid gap-[2px] border-2 border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
        {showMoney ? <>
          <Link href="/portal/ledger" className="no-underline"><Stat k="Confirmed received" v={money(s.confirmed)} note={goal ? `${pct(s.confirmed, goal)}% of ${money(goal)} project funding goal` : 'Your Ledger'} /></Link>
          <Link href="/portal/ledger" className="no-underline"><Stat k="Pledged, not received" v={money(s.pledged + s.pending)} note="Shown separately until verified" /></Link>
        </> : null}
        <Link href="/portal/reconciliation" className="no-underline">
          <Stat dark k="Reconciliation" v={camp.data && totals ? `${pct(Number(totals.confirmed_cents), Number(camp.data.goal_cents))}%` : 'Not set'} note={camp.data && totals ? `${money(Number(totals.confirmed_cents))} confirmed of ${money(Number(camp.data.goal_cents))}${camp.data.is_demo ? ' · demonstration' : ''}` : 'No active campaign yet'} />
        </Link>
        <Link href="/portal/three" className="no-underline">
          <Stat k={prog.data?.label ?? 'Three for Three'} v={prog.data?.is_configured ? `${Math.min(approved, prog.data.required_count)} of ${prog.data.required_count}` : 'Not set'} note={prog.data?.is_configured ? 'Approved so far' : 'Rules are being finalized'} />
        </Link>
      </div>
    </Section>
  </>);
}
