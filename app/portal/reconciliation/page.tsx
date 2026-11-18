import type { Metadata } from 'next';
import { Badge, DemoFlag, Dl, Empty, GoalMeter, Notice, PageHead, Section, Stat } from '@/components/ui';
import { requireMember, seesMoney } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, label, money, pct } from '@/lib/format';

export const metadata: Metadata = { title: 'Reconciliation' };

export default async function Reconciliation({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMember(); const m = me.member.id; const sb = await createClient();
  const { data: camps } = await sb.from('fundraising_campaigns').select('*').eq('kind', 'reconciliation').neq('status', 'draft').order('status').order('created_at', { ascending: false });
  const list = camps ?? []; const sp = await searchParams;
  const c = list.find((x) => x.id === sp.c) ?? list.find((x) => x.status === 'active') ?? list[0];
  if (!c) return (<>
    <PageHead eyebrow="Reconciliation" title={<>Growth that <span className="text-pink-ink">gives back.</span></>}>Economic reconciliation is the end goal of GUYS&amp;CO.</PageHead>
    <Empty>No reconciliation campaign has been opened yet. When one is, its goal and verified progress will be tracked here.</Empty>
  </>);
  const [{ data: t }, { data: miles }, { data: updates }, { data: mine }, { data: links }] = await Promise.all([
    sb.rpc('campaign_totals', { c: c.id }),
    sb.from('campaign_milestones').select('id, title, amount_cents, note').eq('campaign_id', c.id).order('amount_cents'),
    sb.from('campaign_updates').select('id, title, body, storage_path, file_name, created_at').eq('campaign_id', c.id).order('created_at', { ascending: false }),
    seesMoney(me) ? sb.from('financial_transactions').select('id, kind, amount_cents, currency, status, occurred_on, reference').eq('campaign_id', c.id).eq('member_id', m).order('occurred_on', { ascending: false }) : Promise.resolve({ data: null }),
    sb.from('payment_links').select('id, label, url').eq('placement', 'reconciliation').eq('active', true),
  ]);
  const tot = t?.[0] ?? { confirmed_cents: 0, pledged_cents: 0, pending_cents: 0, confirmed_count: 0 };
  const goal = Number(c.goal_cents), confirmed = Number(tot.confirmed_cents), pledged = Number(tot.pledged_cents), pending = Number(tot.pending_cents);

  return (<>
    <Notice searchParams={searchParams} />
    <DemoFlag show={c.is_demo || me.member.is_demo} />
    <PageHead eyebrow="Reconciliation" title={c.name} action={<Badge status={c.status} />}>{c.description}</PageHead>
    {list.length > 1 ? <p className="mb-6 flex flex-wrap gap-3">{list.map((x) => <a key={x.id} href={`/portal/reconciliation?c=${x.id}`} className={`border-2 px-3 py-1.5 font-mono text-[.68rem] uppercase tracking-[.1em] no-underline ${x.id === c.id ? 'border-ink bg-ink text-pink' : 'border-line'}`}>{x.name}</a>)}</p> : null}

    <div className="mb-6 border-2 border-ink p-5 shadow-stamp"><GoalMeter goal={goal} confirmed={confirmed} pledged={pledged} pending={pending} /></div>
    <div className="mb-10 grid gap-[2px] border-2 border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
      <Stat dark k="Goal" v={money(goal)} note={c.ends_on ? `By ${day(c.ends_on)}` : undefined} />
      <Stat k="Confirmed raised" v={money(confirmed)} note={`${tot.confirmed_count} verified ${Number(tot.confirmed_count) === 1 ? 'contribution' : 'contributions'}`} />
      <Stat k="Remaining" v={money(Math.max(0, goal - confirmed))} note="Goal less confirmed funds" />
      <Stat k="Goal reached" v={`${pct(confirmed, goal)}%`} note={pledged + pending ? `${money(pledged + pending)} more pledged, not counted` : 'Pledges are never counted'} />
    </div>

    <Section eyebrow="Markers along the way" title="Fundraising milestones">
      {(miles ?? []).length ? <ul className="border-t-2 border-ink">{(miles ?? []).map((x) => { const hit = confirmed >= Number(x.amount_cents); return (
        <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
          <div><p className="font-semibold">{x.title}</p>{x.note ? <p className="text-[.92rem] text-muted">{x.note}</p> : null}</div>
          <span className="flex items-center gap-3"><b className="num">{money(Number(x.amount_cents))}</b><Badge status={hit ? 'done' : 'upcoming'}>{hit ? 'Reached' : `${pct(confirmed, Number(x.amount_cents))}%`}</Badge></span>
        </li>); })}</ul> : <Empty>No milestones have been set for this campaign.</Empty>}
    </Section>

    {(links ?? []).length ? <Section eyebrow="Take part" title="Contribute">
      <div className="flex flex-wrap gap-3">{(links ?? []).map((l) => <a key={l.id} className="btn" target="_blank" rel="noopener" href={`${l.url}${l.url.includes('?') ? '&' : '?'}client_reference_id=${m}`}>{l.label} →</a>)}</div>
      <p className="mt-2 text-[.8rem] text-muted">Payments happen on Stripe&apos;s secure page and are counted here only after Stripe confirms them.</p>
    </Section> : null}

    {mine ? <Section eyebrow="Your part" title="Your contribution history">
      {mine.length ? <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Date</th><th>Entry</th><th>Status</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
        <tbody>{mine.map((r) => (<tr key={r.id}><td className="whitespace-nowrap font-mono text-[.78rem]">{day(r.occurred_on)}</td><td>{label(r.kind)}</td><td><Badge status={r.status} /></td><td className="font-mono text-[.76rem]">{r.reference}</td><td className="num text-right font-semibold">{r.kind === 'refund' ? '−' : ''}{money(r.amount_cents, r.currency)}</td></tr>))}</tbody></table></div>
        : <Empty>You have no contributions recorded on this campaign.</Empty>}
    </Section> : null}

    <Section eyebrow="On the record" title="Updates and documents">
      {(updates ?? []).length ? <ul className="grid gap-3">{(updates ?? []).map((u) => (
        <li key={u.id} className="border-l-4 border-pink bg-wash p-4"><p className="font-semibold">{u.title}</p>{u.body ? <p className="mt-1 whitespace-pre-line text-[.94rem] text-muted">{u.body}</p> : null}
          <p className="mt-2 flex flex-wrap items-center gap-4 font-mono text-[.64rem] uppercase tracking-[.1em] text-muted">{day(u.created_at)}{u.storage_path ? <Dl href={`/api/download?kind=update&id=${u.id}`}>{u.file_name ?? 'Download'}</Dl> : null}</p></li>))}</ul>
        : <Empty>Updates and supporting documents will be posted here.</Empty>}
    </Section>
  </>);
}
