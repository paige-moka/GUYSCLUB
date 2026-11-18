import type { Metadata } from 'next';
import Link from 'next/link';
import { AddForm, Area, Badge, Check, Empty, Field, Grid, Notice, PageHead, Section } from '@/components/ui';
import { Del, Edit, Scroll } from '@/components/admin';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day } from '@/lib/format';
import { saveRow } from '@/app/actions';

export const metadata: Metadata = { title: 'Three for Three' };

export default async function Three({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff(); const sb = await createClient(); const back = '/admin/three', admin = me.role === 'admin';
  const [{ data: prog }, { data: criteria }, { data: records }, { data: members }] = await Promise.all([
    sb.from('tft_program').select('*').eq('id', 1).maybeSingle(), sb.from('tft_criteria').select('*').order('sort').order('title'),
    sb.from('tft_records').select('*').order('submitted_at', { ascending: false }), sb.from('members').select('id, name, status').order('name'),
  ]);
  const r = records ?? [], need = prog?.required_count ?? 3, queue = r.filter((x) => x.status === 'submitted');
  const mname = (id: string) => (members ?? []).find((m) => m.id === id)?.name;
  return (<>
    <Notice searchParams={searchParams} />
    <PageHead eyebrow="Club status" title={prog?.label ?? 'Three for Three'}>You define what it means. Nothing is assumed: members see no status until you publish the rules below.</PageHead>

    <Section eyebrow="Step 1" title="Program rules">
      {admin ? <form action={saveRow} className="grid gap-4 border-2 border-ink p-4">
        <input type="hidden" name="_table" value="tft_program" /><input type="hidden" name="_back" value={back} />
        <Grid><Field name="label" label="Name members see" required defaultValue={prog?.label ?? 'Three for Three'} /><Field name="required_count" label="How many approved actions complete it" type="number" min="1" required defaultValue={need} /></Grid>
        <Area name="description" label="What it is, in your words (shown to members)" defaultValue={prog?.description} rows={3} />
        <Field name="period_note" label="Timing or deadline rule (shown to members)" defaultValue={prog?.period_note} placeholder="For example: within your first 12 months" />
        <Check name="is_configured" label="Publish: the rules are final and members can see their status" defaultChecked={prog?.is_configured} />
        <div><button className="btn" type="submit">Save rules</button></div>
      </form> : <p className="text-muted">Only an administrator can change the program rules.</p>}
    </Section>

    <Section eyebrow="Step 2" title="What qualifies">
      {admin ? <AddForm title="Add a qualifying action" action={saveRow} table="tft_criteria" back={back} hidden={{ active: 'true' }}><Grid><Field name="title" label="Qualifying action" required /><Field name="sort" label="Order" type="number" defaultValue={0} /></Grid><Area name="description" label="Description" /></AddForm> : null}
      {(criteria ?? []).length ? <ul className="border-t-2 border-ink">{(criteria ?? []).map((c) => (<li key={c.id} className="border-b border-line py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{c.title} {c.active ? null : <Badge status="void">Hidden</Badge>}</p>{c.description ? <p className="text-[.9rem] text-muted">{c.description}</p> : null}</div>{admin ? <Del table="tft_criteria" id={c.id} back={back} /> : null}</div>
        {admin ? <Edit table="tft_criteria" id={c.id} back={back}><Grid><Field name="title" label="Qualifying action" required defaultValue={c.title} /><Field name="sort" label="Order" type="number" defaultValue={c.sort} /></Grid><Area name="description" label="Description" defaultValue={c.description} /><Check name="active" label="Visible to members" defaultChecked={c.active} /></Edit> : null}</li>))}</ul> : <Empty>No qualifying actions defined yet.</Empty>}
    </Section>

    <Section eyebrow="Review" title={`Submitted by members (${queue.length})`}>
      {queue.length ? <ul className="grid gap-3">{queue.map((x) => (<li key={x.id} className="card-soft"><p className="font-semibold">{x.title} · <Link className="underline-offset-4 hover:underline" href={`/admin/members/${x.member_id}`}>{mname(x.member_id)}</Link></p>{x.detail ? <p className="text-[.92rem] text-muted">{x.detail}</p> : null}<p className="font-mono text-[.64rem] uppercase tracking-[.1em] text-muted">Submitted {day(x.submitted_at)}</p>
        <div className="mt-3 flex flex-wrap gap-3">{(['approved', 'declined'] as const).map((st) => (<form key={st} action={saveRow} className="flex items-end gap-2"><input type="hidden" name="_table" value="tft_records" /><input type="hidden" name="_id" value={x.id} /><input type="hidden" name="_back" value={back} /><input type="hidden" name="status" value={st} /><input className="input !w-56" name="decision_note" placeholder="Note to the member (optional)" aria-label="Note to the member" /><button className={st === 'approved' ? 'btn btn-sm' : 'btn-ghost btn btn-sm'} type="submit">{st === 'approved' ? 'Approve' : 'Decline'}</button></form>))}</div></li>))}</ul> : <Empty>Nothing is waiting for review.</Empty>}
    </Section>

    <Section eyebrow="Everyone" title="Member progress">
      {(members ?? []).length ? <Scroll><table className="tbl"><thead><tr><th>Member</th><th>Approved</th><th>In review</th><th>Outstanding</th><th>Status</th><th></th></tr></thead><tbody>{(members ?? []).filter((m) => m.status === 'active').map((m) => { const mine = r.filter((x) => x.member_id === m.id), a = mine.filter((x) => x.status === 'approved').length; return (
        <tr key={m.id}><td className="font-semibold">{m.name}</td><td className="num">{a} of {need}</td><td className="num">{mine.filter((x) => x.status === 'submitted').length}</td><td className="num">{mine.filter((x) => x.status === 'outstanding').length}</td><td><Badge status={a >= need ? 'done' : mine.length ? 'in_progress' : 'upcoming'}>{a >= need ? 'Complete' : mine.length ? 'In progress' : 'Not started'}</Badge></td><td className="text-right"><Link className="link" href={`/admin/members/${m.id}`}>Manage</Link></td></tr>); })}</tbody></table></Scroll> : <Empty>No members yet.</Empty>}
    </Section>
  </>);
}
