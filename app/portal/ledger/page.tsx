import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Badge, DemoFlag, Empty, GoalMeter, Notice, PageHead, Section, Stat } from '@/components/ui';
import { requireMember, seesMoney } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, label, money, sums } from '@/lib/format';

export const metadata: Metadata = { title: 'The Ledger' };

export default async function Ledger({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMember();
  if (!seesMoney(me)) redirect('/portal?error=' + encodeURIComponent('Your login does not include financial records. Ask your account lead if you need access.'));
  const m = me.member.id; const sb = await createClient();
  const [{ data: tx }, { data: projects }, { data: funding }, { data: links }, { data: camps }] = await Promise.all([
    sb.from('financial_transactions').select('id, project_id, campaign_id, kind, amount_cents, currency, status, source, reference, description, occurred_on, confirmed_at, void_reason').eq('member_id', m).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }),
    sb.from('projects').select('id, name').eq('member_id', m),
    sb.from('project_funding').select('project_id, goal_cents, note'),
    sb.from('payment_links').select('id, label, url').eq('placement', 'ledger').eq('active', true),
    sb.from('fundraising_campaigns').select('id, name'),
  ]);
  const rows = tx ?? []; const live = rows.filter((r) => r.status !== 'void'); const s = sums(live);
  const contrib = sums(live.filter((r) => r.kind === 'contribution' || (r.kind === 'refund' && r.campaign_id)));
  const pname = (id: string | null) => (projects ?? []).find((p) => p.id === id)?.name;
  const funded = (funding ?? []).filter((f) => (projects ?? []).some((p) => p.id === f.project_id));

  return (<>
    <Notice searchParams={searchParams} />
    <DemoFlag show={me.member.is_demo} />
    <PageHead eyebrow="The Ledger" title={<>Where the money <span className="text-pink-ink">stands.</span></>}>
      Every entry here was recorded by the GUYS&amp;CO team or verified by Stripe. Only confirmed entries count as received. Pledges are always shown separately.
    </PageHead>

    <div className="mb-10 grid gap-[2px] border-2 border-ink bg-ink sm:grid-cols-3">
      <Stat dark k="Confirmed received" v={money(s.confirmed)} note="Verified funds, net of refunds" />
      <Stat k="Pledged, not received" v={money(s.pledged)} note="Promised, no funds yet" />
      <Stat k="Pending verification" v={money(s.pending)} note="Payment started, not yet verified" />
    </div>

    <Section eyebrow="Project commitments" title="Project funding">
      {funded.length ? <div className="grid gap-4">{funded.map((f) => {
        const ps = sums(live.filter((r) => r.project_id === f.project_id));
        return (<div key={f.project_id} className="card"><h3 className="mb-4 text-[1.4rem]">{pname(f.project_id)}</h3><GoalMeter goal={Number(f.goal_cents)} confirmed={ps.confirmed} pledged={ps.pledged} pending={ps.pending} />{f.note ? <p className="mt-3 text-[.9rem] text-muted">{f.note}</p> : null}</div>);
      })}</div> : <Empty>No project funding goals have been set.</Empty>}
    </Section>

    <Section eyebrow="Giving back" title="Your contributions">
      <p className="mb-3 max-w-[60ch] text-muted">Your contributions to Club campaigns: <b className="num text-ink">{money(contrib.confirmed)}</b> confirmed{contrib.pledged + contrib.pending ? <>, <b className="num text-ink">{money(contrib.pledged + contrib.pending)}</b> pledged or pending</> : null}. See the Reconciliation page for the full campaign.</p>
      {(links ?? []).length ? <div className="flex flex-wrap gap-3">{(links ?? []).map((l) => <a key={l.id} className="btn" target="_blank" rel="noopener" href={`${l.url}${l.url.includes('?') ? '&' : '?'}client_reference_id=${m}`}>{l.label} →</a>)}</div> : null}
      {(links ?? []).length ? <p className="mt-2 text-[.8rem] text-muted">Payments happen on Stripe&apos;s secure page. They appear here once Stripe confirms them.</p> : null}
    </Section>

    <Section eyebrow="Every entry" title="Transaction history">
      {rows.length ? <div className="overflow-x-auto"><table className="tbl">
        <thead><tr><th>Date</th><th>Entry</th><th>For</th><th>Status</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className={r.status === 'void' ? 'text-muted' : ''}>
            <td className="whitespace-nowrap font-mono text-[.78rem]">{day(r.occurred_on)}</td>
            <td><b>{label(r.kind)}</b>{r.description ? <span className="block text-[.88rem] text-muted">{r.description}</span> : null}{r.status === 'void' ? <span className="block text-[.82rem]">Voided: {r.void_reason}</span> : null}</td>
            <td className="text-[.88rem]">{pname(r.project_id) ?? (camps ?? []).find((c) => c.id === r.campaign_id)?.name ?? 'Membership and services'}</td>
            <td><Badge status={r.status} />{r.status === 'confirmed' ? <span className="mt-1 block font-mono text-[.62rem] uppercase tracking-[.08em] text-muted">{label(r.source)}</span> : null}</td>
            <td className="font-mono text-[.76rem]">{r.reference}</td>
            <td className={`num whitespace-nowrap text-right font-semibold ${r.status === 'void' ? 'line-through' : ''}`}>{r.kind === 'refund' ? '−' : ''}{money(r.amount_cents, r.currency)}</td>
          </tr>))}</tbody>
      </table></div> : <Empty>No financial entries yet. When a contribution or payment is recorded, it appears here.</Empty>}
    </Section>
  </>);
}
