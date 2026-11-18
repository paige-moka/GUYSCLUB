import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AddForm, Area, Badge, Check, Dl, Empty, Field, GoalMeter, Grid, Notice, PageHead, Pick, Section } from '@/components/ui';
import { Del, Edit, Scroll } from '@/components/admin';
import { Uploader } from '@/components/Uploader';
import { requireStaff, seesMoney } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, label, money, sums } from '@/lib/format';
import { saveRow } from '@/app/actions';

export const metadata: Metadata = { title: 'Reconciliation' };

export default async function Recon({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff(); if (!seesMoney(me)) redirect('/admin?error=' + encodeURIComponent('Your login does not include financial records.'));
  const sp = await searchParams; const sb = await createClient();
  const { data: camps } = await sb.from('fundraising_campaigns').select('*').order('created_at', { ascending: false });
  const list = camps ?? []; const c = list.find((x) => x.id === sp.c) ?? list[0]; const back = c ? `/admin/reconciliation?c=${c.id}` : '/admin/reconciliation';
  const [miles, updates, tx, members] = c ? await Promise.all([
    sb.from('campaign_milestones').select('*').eq('campaign_id', c.id).order('amount_cents'),
    sb.from('campaign_updates').select('*').eq('campaign_id', c.id).order('created_at', { ascending: false }),
    sb.from('financial_transactions').select('*').eq('campaign_id', c.id).order('occurred_on', { ascending: false }),
    sb.from('members').select('id, name').order('name'),
  ]) : [null, null, null, null];
  const s = sums((tx?.data ?? []).filter((r) => r.status !== 'void'));
  return (<>
    <Notice searchParams={searchParams} />
    <PageHead eyebrow="Reconciliation" title={<>Growth that <span className="text-pink-ink">gives back.</span></>}>Set the goal, record contributions in the Ledger, and members see verified progress. Totals are worked out from Ledger entries, never typed in, so they cannot drift from the record.</PageHead>
    <AddForm title="Open a new campaign" action={saveRow} table="fundraising_campaigns" back="/admin/reconciliation" submit="Create campaign" open={!list.length}>
      <Grid><Field name="name" label="Campaign name" required placeholder="Club Dividend 2027" /><Field name="goal_cents" label="Fundraising goal ($)" required /></Grid>
      <Area name="description" label="What it is for" />
      <Grid cols={3}><Field name="starts_on" label="Starts" type="date" /><Field name="ends_on" label="Ends" type="date" /><Pick name="status" label="Status" options={[['draft', 'Draft: hidden from members'], ['active', 'Active: visible to members'], ['closed', 'Closed']]} defaultValue="draft" /></Grid>
      <input type="hidden" name="kind" value="reconciliation" /><Check name="is_demo" label="Demonstration campaign (labelled as such)" />
    </AddForm>
    {list.length > 1 ? <p className="mb-6 flex flex-wrap gap-3">{list.map((x) => <Link key={x.id} href={`/admin/reconciliation?c=${x.id}`} className={`border-2 px-3 py-1.5 font-mono text-[.68rem] uppercase tracking-[.1em] no-underline ${x.id === c?.id ? 'border-ink bg-ink text-pink' : 'border-line'}`}>{x.name}</Link>)}</p> : null}
    {!c ? <Empty>No campaign yet. Open one above. Members see nothing until a campaign is set to active.</Empty> : <>
      <Section eyebrow={c.is_demo ? 'Demonstration campaign' : 'Campaign'} title={c.name} action={<Badge status={c.status} />}>
        <div className="card mb-4"><GoalMeter goal={Number(c.goal_cents)} confirmed={s.confirmed} pledged={s.pledged} pending={s.pending} /></div>
        <Edit table="fundraising_campaigns" id={c.id} back={back} title="Edit campaign, goal and status">
          <Grid><Field name="name" label="Campaign name" required defaultValue={c.name} /><Field name="goal_cents" label="Fundraising goal ($)" required defaultValue={Number(c.goal_cents) / 100} /></Grid>
          <Area name="description" label="What it is for" defaultValue={c.description} />
          <Grid cols={3}><Field name="starts_on" label="Starts" type="date" defaultValue={c.starts_on} /><Field name="ends_on" label="Ends" type="date" defaultValue={c.ends_on} /><Pick name="status" label="Status" options={['draft', 'active', 'closed']} defaultValue={c.status} /></Grid>
          <Check name="is_demo" label="Demonstration campaign" defaultChecked={c.is_demo} />
        </Edit>
      </Section>
      <Section eyebrow="Markers" title="Fundraising milestones">
        <AddForm title="Add a milestone" action={saveRow} table="campaign_milestones" back={back} hidden={{ campaign_id: c.id }}><Grid><Field name="title" label="Milestone" required placeholder="First Business Seat funded" /><Field name="amount_cents" label="Reached at ($)" required /></Grid><Field name="note" label="Note" /></AddForm>
        {(miles?.data ?? []).length ? <ul className="border-t-2 border-ink">{(miles?.data ?? []).map((x) => (<li key={x.id} className="flex items-center justify-between gap-3 border-b border-line py-3"><span><b>{x.title}</b> · {money(Number(x.amount_cents))}</span><span className="flex items-center gap-3"><Badge status={s.confirmed >= Number(x.amount_cents) ? 'done' : 'upcoming'}>{s.confirmed >= Number(x.amount_cents) ? 'Reached' : 'Not yet'}</Badge><Del table="campaign_milestones" id={x.id} back={back} /></span></li>))}</ul> : <Empty>No milestones yet.</Empty>}
      </Section>
      <Section eyebrow="Contributions" title="Pledges and funds received">
        <AddForm title="Record a pledge or contribution" action={saveRow} table="financial_transactions" back={back} hidden={{ campaign_id: c.id, kind: 'contribution' }} submit="Record">
          <Grid cols={3}><Pick name="member_id" label="From member" options={(members?.data ?? []).map((m) => [m.id, m.name] as [string, string])} blank="No member (outside donor)" required={false} /><Field name="amount_cents" label="Amount ($)" required /><Field name="occurred_on" label="Date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Grid>
          <Grid><Pick name="status" label="Starts as" options={[['pledged', 'Pledged: promised, no funds yet'], ['pending', 'Pending: payment started']]} /><Field name="description" label="Description" /></Grid>
        </AddForm>
        {(tx?.data ?? []).length ? <Scroll><table className="tbl"><thead><tr><th>Date</th><th>From</th><th>Status</th><th>Reference</th><th className="text-right">Amount</th></tr></thead><tbody>{(tx?.data ?? []).map((r) => (<tr key={r.id} className={r.status === 'void' ? 'text-muted line-through' : ''}><td className="whitespace-nowrap font-mono text-[.78rem]">{day(r.occurred_on)}</td><td>{(members?.data ?? []).find((m) => m.id === r.member_id)?.name ?? 'Outside donor'}<span className="block text-[.82rem] text-muted">{r.description}</span></td><td><Badge status={r.status} /></td><td className="font-mono text-[.74rem]">{r.reference}</td><td className="num text-right font-semibold">{r.kind === 'refund' ? '−' : ''}{money(r.amount_cents, r.currency)}</td></tr>))}</tbody></table></Scroll> : <Empty>No contributions recorded.</Empty>}
        <p className="mt-3 text-[.86rem] text-muted">Confirm or void entries in <Link className="font-semibold text-pink-ink" href="/admin/ledger">the Ledger</Link>. Only confirmed entries move the progress bar. {label('pledged')} amounts are shown to members as a separate, clearly marked figure.</p>
      </Section>
      <Section eyebrow="On the record" title="Updates and supporting documents">
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <AddForm title="Post a written update" action={saveRow} table="campaign_updates" back={back} hidden={{ campaign_id: c.id }} submit="Post"><Field name="title" label="Title" required /><Area name="body" label="Update" rows={4} /></AddForm>
          <details className="mb-4 border-2 border-ink"><summary className="cursor-pointer px-4 py-3 font-mono text-[.74rem] font-semibold uppercase tracking-[.12em] hover:bg-wash">+ Post an update with a document</summary><div className="border-t-2 border-ink p-4">
            <Uploader bucket="library" prefix={`campaigns/${c.id}`} action={saveRow} button="Upload and post" hidden={{ _table: 'campaign_updates', _back: back, campaign_id: c.id }}><Field name="title" label="Title" required /><Area name="body" label="Update" /></Uploader></div></details>
        </div>
        {(updates?.data ?? []).length ? <ul className="grid gap-3">{(updates?.data ?? []).map((u) => (<li key={u.id} className="border-l-4 border-pink bg-wash p-4"><p className="font-semibold">{u.title}</p>{u.body ? <p className="whitespace-pre-line text-[.94rem] text-muted">{u.body}</p> : null}<div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-[.64rem] uppercase tracking-[.1em] text-muted">{day(u.created_at)}{u.storage_path ? <Dl href={`/api/download?kind=update&id=${u.id}`}>{u.file_name ?? 'Document'}</Dl> : null}<Del table="campaign_updates" id={u.id} back={back} /></div></li>))}</ul> : <Empty>No updates yet.</Empty>}
      </Section>
    </>}
  </>);
}
