import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddForm, Area, Back, Badge, Dl, Empty, Field, GoalMeter, Grid, Notice, PageHead, Pick, Section } from '@/components/ui';
import { Del, Edit, Quick, Scroll } from '@/components/admin';
import { Uploader } from '@/components/Uploader';
import { requireStaff, seesMoney } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, label, progressOf, size, sums } from '@/lib/format';
import { saveRow } from '@/app/actions';

export const metadata: Metadata = { title: 'Manage project' };

export default async function Project({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params; const me = await requireStaff(); const sb = await createClient();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: p } = await sb.from('projects').select('*').eq('id', id).maybeSingle();
  if (!p) notFound();
  const back = `/admin/projects/${id}`, H = { project_id: id, member_id: p.member_id }, fin = seesMoney(me);
  const [member, team, people, miles, tasks, updates, docs, fund, tx] = await Promise.all([
    sb.from('members').select('name').eq('id', p.member_id).maybeSingle(),
    sb.from('project_assignments').select('*').eq('project_id', id).order('created_at'),
    sb.from('profiles').select('id, full_name, email, role').in('role', ['specialist', 'team', 'admin']).order('full_name'),
    sb.from('milestones').select('*').eq('project_id', id).order('due_date', { nullsFirst: false }),
    sb.from('tasks').select('*').eq('project_id', id).order('status').order('due_date', { nullsFirst: false }),
    sb.from('project_updates').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    sb.from('documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    fin ? sb.from('project_funding').select('*').eq('project_id', id).maybeSingle() : Promise.resolve({ data: null }),
    fin ? sb.from('financial_transactions').select('status, kind, amount_cents').eq('project_id', id) : Promise.resolve({ data: [] as { status: string; kind: string; amount_cents: number }[] }),
  ]);
  const v = progressOf(p, [...(tasks.data ?? []), ...(miles.data ?? [])]); const s = sums((tx.data ?? []).filter((r) => r.status !== 'void'));
  return (<>
    <Back href={`/admin/members/${p.member_id}`}>{member.data?.name ?? 'Member'}</Back>
    <Notice searchParams={searchParams} />
    <PageHead eyebrow={`Project · ${member.data?.name ?? ''}`} title={p.name} action={<Badge status={p.status} />}>{v}% complete{p.progress_override != null ? ' (set by hand)' : ', worked out from finished tasks and milestones'}.</PageHead>

    <Section eyebrow="Details" title="Project">
      <form action={saveRow} className="grid gap-4 border-2 border-ink p-4">
        <input type="hidden" name="_table" value="projects" /><input type="hidden" name="_id" value={id} /><input type="hidden" name="_back" value={back} />
        <Grid><Field name="name" label="Project name" required defaultValue={p.name} /><Pick name="status" label="Status" options={['planning', 'active', 'on_hold', 'complete', 'cancelled']} defaultValue={p.status} /></Grid>
        <Area name="description" label="Description" defaultValue={p.description} /><Area name="objectives" label="Objectives" defaultValue={p.objectives} />
        <Grid cols={3}><Field name="start_date" label="Start" type="date" defaultValue={p.start_date} /><Field name="due_date" label="Due" type="date" defaultValue={p.due_date} /><Field name="progress_override" label="Progress % by hand" type="number" min="0" defaultValue={p.progress_override} help="Leave empty to work it out from tasks and milestones" /></Grid>
        <div><button className="btn" type="submit">Save project</button></div>
      </form>
    </Section>

    <Section eyebrow="People" title="Assigned specialists and team">
      <AddForm title="Assign a person" action={saveRow} table="project_assignments" back={back} hidden={{ project_id: id }} submit="Assign">
        <Grid><Pick name="profile_id" label="Person" options={(people.data ?? []).map((x) => [x.id, `${x.full_name || x.email} (${label(x.role)})`] as [string, string])} blank="Choose" /><Field name="role_label" label="Role on this project" required defaultValue="Specialist" /></Grid>
        <p className="text-[.84rem] text-muted">A specialist sees only the projects they are assigned to: tasks, milestones, updates and project documents. Never the Ledger.</p>
      </AddForm>
      {(team.data ?? []).length ? <ul className="border-t-2 border-ink">{(team.data ?? []).map((a) => (<li key={a.id} className="flex items-center justify-between gap-3 border-b border-line py-3"><span><b>{a.display_name}</b> · {a.role_label}</span><Del table="project_assignments" id={a.id} back={back} what="Unassign" /></li>))}</ul> : <Empty>Nobody is assigned yet.</Empty>}
    </Section>

    <Section eyebrow="The road" title="Milestones">
      <AddForm title="Add a milestone" action={saveRow} table="milestones" back={back} hidden={H}><Grid><Field name="title" label="Milestone" required /><Field name="due_date" label="Date" type="date" /></Grid><Area name="detail" label="Detail" /></AddForm>
      {(miles.data ?? []).length ? <ul className="border-t-2 border-ink">{(miles.data ?? []).map((x) => (<li key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3"><div><p className="font-semibold">{x.title}</p><p className="text-[.84rem] text-muted">{day(x.due_date)}</p></div><span className="flex items-center gap-3"><Quick table="milestones" id={x.id} back={back} name="status" options={['upcoming', 'in_progress', 'done', 'missed']} value={x.status} /><Del table="milestones" id={x.id} back={back} /></span></li>))}</ul> : <Empty>No milestones yet.</Empty>}
    </Section>

    <Section eyebrow="The work" title="Tasks and deliverables">
      <AddForm title="Add a task" action={saveRow} table="tasks" back={back} hidden={H}><Grid cols={3}><Field name="title" label="Task" required /><Pick name="owner_type" label="Who does it" options={[['guysco', 'GUYS&CO'], ['specialist', 'Specialist'], ['member', 'The member']]} defaultValue="guysco" /><Field name="due_date" label="Due" type="date" /></Grid><Area name="detail" label="Detail" /></AddForm>
      {(tasks.data ?? []).length ? <ul className="border-t-2 border-ink">{(tasks.data ?? []).map((x) => (<li key={x.id} className="border-b border-line py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{x.title}</p><p className="text-[.84rem] text-muted">{label(x.owner_type)}{x.due_date ? ` · due ${day(x.due_date)}` : ''}</p></div><span className="flex items-center gap-3"><Quick table="tasks" id={x.id} back={back} name="status" options={['todo', 'in_progress', 'done']} value={x.status} /><Del table="tasks" id={x.id} back={back} /></span></div>
        <Edit table="tasks" id={x.id} back={back}><Grid cols={3}><Field name="title" label="Task" required defaultValue={x.title} /><Pick name="owner_type" label="Who does it" options={[['guysco', 'GUYS&CO'], ['specialist', 'Specialist'], ['member', 'The member']]} defaultValue={x.owner_type} /><Field name="due_date" label="Due" type="date" defaultValue={x.due_date} /></Grid><Area name="detail" label="Detail" defaultValue={x.detail} /></Edit></li>))}</ul> : <Empty>No tasks yet.</Empty>}
    </Section>

    <Section eyebrow="Keep them informed" title="Progress updates">
      <AddForm title="Post an update" action={saveRow} table="project_updates" back={back} hidden={H} submit="Post update"><Area name="body" label="Update the member will read" required rows={4} /></AddForm>
      {(updates.data ?? []).length ? <ul className="grid gap-3">{(updates.data ?? []).map((u) => (<li key={u.id} className="border-l-4 border-pink bg-wash p-4"><p className="whitespace-pre-line">{u.body}</p><div className="mt-2 flex items-center gap-4 font-mono text-[.64rem] uppercase tracking-[.1em] text-muted">{day(u.created_at)} · {u.author_name}<Del table="project_updates" id={u.id} back={back} /></div></li>))}</ul> : <Empty>No updates posted yet.</Empty>}
    </Section>

    {fin ? <Section eyebrow="The Ledger" title="Project funding goal">
      <form action={saveRow} className="mb-4 grid gap-4 border-2 border-ink p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
        <input type="hidden" name="_table" value="project_funding" /><input type="hidden" name="_back" value={back} /><input type="hidden" name="project_id" value={id} />
        <Field name="goal_cents" label="Funding goal ($)" required defaultValue={fund.data ? Number(fund.data.goal_cents) / 100 : ''} /><Field name="note" label="Note the member sees" defaultValue={fund.data?.note} />
        <button className="btn" type="submit">Save goal</button>
      </form>
      {fund.data ? <div className="card"><GoalMeter goal={Number(fund.data.goal_cents)} confirmed={s.confirmed} pledged={s.pledged} pending={s.pending} /></div> : <Empty>No funding goal set for this project.</Empty>}
      <p className="mt-3 text-[.86rem] text-muted">Record money against this project in <Link className="font-semibold text-pink-ink" href={`/admin/ledger?member=${p.member_id}`}>the Ledger</Link>.</p>
    </Section> : null}

    <Section eyebrow="Files" title="Project documents">
      <div className="mb-4 border-2 border-ink p-4"><Uploader bucket="member-files" prefix={`${p.member_id}/projects/${id}`} action={saveRow} button="Upload document" hidden={{ _table: 'documents', _back: back, _ok: 'Document uploaded.', ...H }}><Field name="title" label="Title" placeholder="Leave empty to use the file name" /></Uploader></div>
      {(docs.data ?? []).length ? <Scroll><table className="tbl"><thead><tr><th>Document</th><th>Added</th><th>By</th><th></th></tr></thead><tbody>{(docs.data ?? []).map((d) => (<tr key={d.id}><td className="font-semibold">{d.title}</td><td className="whitespace-nowrap">{day(d.created_at)}</td><td>{d.uploaded_by_name}</td><td className="whitespace-nowrap text-right"><Dl href={`/api/download?kind=document&id=${d.id}`}>Download · {size(d.size_bytes)}</Dl> <span className="ml-3"><Del table="documents" id={d.id} back={back} /></span></td></tr>))}</tbody></table></Scroll> : <Empty>No documents yet.</Empty>}
    </Section>
    <div className="border-t border-line pt-4"><Del table="projects" id={id} back={`/admin/members/${p.member_id}`} what="Delete this project and everything in it" /></div>
  </>);
}
