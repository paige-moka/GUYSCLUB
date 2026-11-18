import type { Metadata } from 'next';
import { AddForm, Badge, Empty, Field, Grid, Notice, PageHead, Pick, Section, Stat } from '@/components/ui';
import { Del, Scroll } from '@/components/admin';
import { requireStaff, seesMoney } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, label, money, sums } from '@/lib/format';
import { assignPayment, confirmTransaction, saveRow, voidTransaction } from '@/app/actions';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'The Ledger' };

export default async function Ledger({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff(); if (!seesMoney(me)) redirect('/admin?error=' + encodeURIComponent('Your login does not include financial records.'));
  const sp = await searchParams; const sb = await createClient(); const filter = /^[0-9a-f-]{36}$/i.test(sp.member ?? '') ? sp.member! : '';
  const back = filter ? `/admin/ledger?member=${filter}` : '/admin/ledger';
  let q = sb.from('financial_transactions').select('*').order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).limit(300);
  if (filter) q = q.eq('member_id', filter);
  const [{ data: tx }, { data: members }, { data: projects }, { data: camps }, { data: links }, { data: audit }] = await Promise.all([
    q, sb.from('members').select('id, name').order('name'), sb.from('projects').select('id, name, member_id').order('name'),
    sb.from('fundraising_campaigns').select('id, name').order('name'), sb.from('payment_links').select('*').order('created_at'),
    sb.from('financial_audit').select('id, transaction_id, action, actor_id, at, before, after').order('at', { ascending: false }).limit(15),
  ]);
  const rows = tx ?? [], live = rows.filter((r) => r.status !== 'void'), s = sums(live);
  const mname = (id: string | null) => (members ?? []).find((m) => m.id === id)?.name; const open = rows.filter((r) => r.status === 'pledged' || r.status === 'pending');
  const unmatched = rows.filter((r) => !r.member_id && r.source === 'stripe' && r.status !== 'void');
  const mopts = (members ?? []).map((m) => [m.id, m.name] as [string, string]);
  const forWhat = (r: { project_id: string | null; campaign_id: string | null }) => (projects ?? []).find((p) => p.id === r.project_id)?.name ?? (camps ?? []).find((c) => c.id === r.campaign_id)?.name ?? '';

  return (<>
    <Notice searchParams={searchParams} />
    <PageHead eyebrow="The Ledger" title={<>Every dollar, <span className="text-pink-ink">traceable.</span></>}>
      Entries start as pledged or pending. They count as received only after you confirm them with a reference, or Stripe verifies them. Nothing is ever deleted: mistakes are voided with a reason, and every change is kept in the audit trail.
    </PageHead>
    <form method="get" className="mb-6 flex flex-wrap items-end gap-3"><label className="block"><span className="label">Show</span><select className="input" name="member" defaultValue={filter}><option value="">All members</option>{mopts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label><button className="btn-ghost btn" type="submit">Filter</button></form>
    <div className="mb-10 grid gap-[2px] border-2 border-ink bg-ink sm:grid-cols-3">
      <Stat dark k="Confirmed received" v={money(s.confirmed)} note="Verified, net of refunds" /><Stat k="Pledged, not received" v={money(s.pledged)} /><Stat k="Pending verification" v={money(s.pending)} />
    </div>

    <Section eyebrow="Record" title="New entry">
      <AddForm title="Enter a pledge, payment or refund" action={saveRow} table="financial_transactions" back={back} submit="Record entry" open={!rows.length}>
        <Grid cols={3}><Pick name="kind" label="Type" options={['contribution', 'project_funding', 'fee', 'refund']} /><Field name="amount_cents" label="Amount ($)" required placeholder="2500.00" /><Field name="occurred_on" label="Date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Grid>
        <Grid cols={3}><Pick name="member_id" label="Member" options={mopts} blank="No member" required={false} defaultValue={filter} /><Pick name="project_id" label="Project (project funding)" options={(projects ?? []).map((p) => [p.id, `${p.name} · ${mname(p.member_id) ?? ''}`] as [string, string])} blank="None" required={false} /><Pick name="campaign_id" label="Campaign (contributions)" options={(camps ?? []).map((c) => [c.id, c.name] as [string, string])} blank="None" required={false} /></Grid>
        <Grid><Pick name="status" label="Starts as" options={[['pledged', 'Pledged: promised, no funds yet'], ['pending', 'Pending: payment started, not verified']]} defaultValue="pledged" /><Field name="description" label="Description" /></Grid>
        <p className="text-[.84rem] text-muted">To mark funds as received, record the entry first, then confirm it below with the reference that proves it arrived.</p>
      </AddForm>
    </Section>

    {unmatched.length ? <Section eyebrow="Stripe" title="Verified payments to match">
      <ul className="grid gap-3">{unmatched.map((r) => (<li key={r.id} className="card-soft flex flex-wrap items-end justify-between gap-3"><div><p className="font-semibold">{money(r.amount_cents, r.currency)} · {day(r.occurred_on)}</p><p className="text-[.86rem] text-muted">{r.description} · {r.reference}</p></div>
        <form action={assignPayment} className="flex items-end gap-2"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="_back" value={back} /><select className="input" name="member_id" required aria-label="Member"><option value="">Choose member</option>{mopts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select><button className="btn btn-sm" type="submit">Match</button></form></li>))}</ul>
    </Section> : null}

    <Section eyebrow="Needs a decision" title="Not yet confirmed">
      {open.length ? <ul className="grid gap-3">{open.map((r) => (
        <li key={r.id} className="card-soft"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{money(r.amount_cents, r.currency)} · {label(r.kind)} · {mname(r.member_id) ?? 'No member'}</p><p className="text-[.86rem] text-muted">{day(r.occurred_on)}{forWhat(r) ? ` · ${forWhat(r)}` : ''}{r.description ? ` · ${r.description}` : ''}</p></div><Badge status={r.status} /></div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <form action={confirmTransaction} className="flex items-end gap-2"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="_back" value={back} /><label className="block min-w-0 flex-1"><span className="label">Proof of receipt</span><input className="input" name="reference" required placeholder="E-transfer, cheque or Stripe reference" defaultValue={r.reference ?? ''} /></label><button className="btn btn-sm" type="submit">Confirm received</button></form>
            <form action={voidTransaction} className="flex items-end gap-2"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="_back" value={back} /><label className="block min-w-0 flex-1"><span className="label">Reason to void</span><input className="input" name="void_reason" required /></label><button className="btn-ghost btn btn-sm" type="submit">Void</button></form>
          </div></li>))}</ul> : <Empty>Every entry is either confirmed or voided.</Empty>}
    </Section>

    <Section eyebrow="The record" title="All entries">
      {rows.length ? <Scroll><table className="tbl"><thead><tr><th>Date</th><th>Member</th><th>Entry</th><th>Status</th><th>Reference</th><th className="text-right">Amount</th><th></th></tr></thead><tbody>{rows.map((r) => (
        <tr key={r.id} className={r.status === 'void' ? 'text-muted' : ''}><td className="whitespace-nowrap font-mono text-[.78rem]">{day(r.occurred_on)}</td><td>{mname(r.member_id) ?? <span className="text-bad">Unmatched</span>}</td>
          <td><b>{label(r.kind)}</b><span className="block text-[.84rem] text-muted">{[forWhat(r), r.description].filter(Boolean).join(' · ')}</span>{r.status === 'void' ? <span className="block text-[.8rem]">Voided: {r.void_reason}</span> : null}</td>
          <td><Badge status={r.status} /><span className="mt-1 block font-mono text-[.6rem] uppercase tracking-[.08em] text-muted">{label(r.source)}</span></td><td className="font-mono text-[.74rem]">{r.reference}</td>
          <td className={`num whitespace-nowrap text-right font-semibold ${r.status === 'void' ? 'line-through' : ''}`}>{r.kind === 'refund' ? '−' : ''}{money(r.amount_cents, r.currency)}</td>
          <td>{r.status === 'confirmed' ? <details><summary className="cursor-pointer font-mono text-[.6rem] font-semibold uppercase tracking-[.08em] text-bad">Void</summary><form action={voidTransaction} className="mt-2 grid gap-2"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="_back" value={back} /><input className="input" name="void_reason" required placeholder="Reason" aria-label="Reason to void" /><button className="btn-ghost btn btn-sm" type="submit">Void entry</button></form></details> : null}</td></tr>))}</tbody></table></Scroll>
        : <Empty>No entries yet. The Ledger starts empty: nothing is shown until you record it or Stripe verifies it.</Empty>}
    </Section>

    {me.role === 'admin' ? <Section eyebrow="Stripe" title="Payment links shown to members">
      <AddForm title="Add a Stripe Payment Link" action={saveRow} table="payment_links" back={back}><Grid cols={3}><Field name="label" label="Button text" required placeholder="Contribute to the Club Dividend" /><Field name="url" label="Stripe Payment Link" required placeholder="https://buy.stripe.com/..." /><Pick name="placement" label="Show on" options={[['reconciliation', 'Reconciliation page'], ['ledger', 'Ledger page']]} /></Grid>
        <p className="text-[.84rem] text-muted">The member&apos;s ID is attached when they press the button, so a verified payment lands on the right Ledger by itself. In Stripe, add metadata to the link (kind = contribution, campaign_id = the campaign) to file it under a campaign.</p></AddForm>
      {(links ?? []).length ? <ul className="border-t-2 border-ink">{(links ?? []).map((l) => (<li key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3"><span><b>{l.label}</b> <span className="text-[.84rem] text-muted">· {l.placement} · {l.url}</span></span><Del table="payment_links" id={l.id} back={back} /></li>))}</ul> : <Empty>No payment links added.</Empty>}
    </Section> : null}

    <Section eyebrow="Traceability" title="Audit trail (latest changes)">
      {(audit ?? []).length ? <ul className="border-t-2 border-ink">{(audit ?? []).map((a) => { const af = a.after as Record<string, unknown>, bf = a.before as Record<string, unknown> | null; return (
        <li key={a.id} className="flex flex-wrap justify-between gap-3 border-b border-line py-2 text-[.88rem]"><span>{a.action === 'insert' ? 'Recorded' : 'Changed'} {money(Number(af.amount_cents))} {label(String(af.kind)).toLowerCase()}{bf && bf.status !== af.status ? `: ${label(String(bf.status)).toLowerCase()} → ${label(String(af.status)).toLowerCase()}` : ` as ${label(String(af.status)).toLowerCase()}`}{mname(af.member_id as string) ? ` · ${mname(af.member_id as string)}` : ''}</span><span className="font-mono text-[.64rem] uppercase tracking-[.1em] text-muted">{day(a.at)}{a.actor_id ? '' : ' · Stripe webhook'}</span></li>); })}</ul> : <Empty>No changes recorded yet.</Empty>}
      <p className="mt-2 text-[.82rem] text-muted">The full trail, with before and after values and who made each change, is in the <code>financial_audit</code> table.</p>
    </Section>
  </>);
}
