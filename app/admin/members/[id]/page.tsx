import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Act, AddForm, Area, Back, Badge, Check, DemoFlag, Dl, Empty, Field, Grid, Notice, PageHead, Pick, Section } from '@/components/ui';
import { Del, Edit, Quick, Scroll } from '@/components/admin';
import { Uploader } from '@/components/Uploader';
import { requireStaff, seesMoney } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, label, money, size, sums } from '@/lib/format';
import { saveRow, setGroup } from '@/app/actions';

export const metadata: Metadata = { title: 'Member' };
const STAGES = ['Blueprint', 'Uptime', 'Ignition', 'Leverage', 'Traction'];

export default async function Member({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params; const me = await requireStaff(); const sb = await createClient();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: m } = await sb.from('members').select('*').eq('id', id).maybeSingle();
  if (!m) notFound();
  const back = `/admin/members/${id}`, H = { member_id: id };
  const [people, bp, versions, objectives, recs, miles, tasks, docs, projects, tft, criteria, groups, gm, tx] = await Promise.all([
    sb.from('profiles').select('id, full_name, email, can_view_financials').eq('member_id', id),
    sb.from('blueprints').select('*').eq('member_id', id).maybeSingle(),
    sb.from('blueprint_versions').select('*').eq('member_id', id).order('created_at', { ascending: false }),
    sb.from('objectives').select('*').eq('member_id', id).order('sort').order('created_at'),
    sb.from('recommendations').select('*').eq('member_id', id).order('sort').order('created_at'),
    sb.from('milestones').select('*').eq('member_id', id).is('project_id', null).order('due_date', { nullsFirst: false }),
    sb.from('tasks').select('*').eq('member_id', id).is('project_id', null).order('status').order('due_date', { nullsFirst: false }),
    sb.from('documents').select('*').eq('member_id', id).is('project_id', null).order('created_at', { ascending: false }),
    sb.from('projects').select('id, name, status, due_date').eq('member_id', id).order('created_at', { ascending: false }),
    sb.from('tft_records').select('*').eq('member_id', id).order('created_at', { ascending: false }),
    sb.from('tft_criteria').select('id, title').eq('active', true).order('sort'),
    sb.from('member_groups').select('id, name').order('name'),
    sb.from('member_group_members').select('group_id').eq('member_id', id),
    seesMoney(me) ? sb.from('financial_transactions').select('status, kind, amount_cents').eq('member_id', id) : Promise.resolve({ data: null }),
  ]);
  const s = tx.data ? sums(tx.data.filter((r) => r.status !== 'void')) : null; const inGroups = (gm.data ?? []).map((g) => g.group_id);

  return (<>
    <Back href="/admin/members">All members</Back>
    <Notice searchParams={searchParams} />
    <DemoFlag show={m.is_demo} />
    <PageHead eyebrow={`Member${m.serial ? ' · Serial ' + m.serial : ''}`} title={m.name} action={<Badge status={m.status} />}>
      {(people.data ?? []).length ? <>Logins: {(people.data ?? []).map((p) => `${p.full_name || p.email}${p.can_view_financials ? '' : ' (no financials)'}`).join(', ')}</> : <span className="font-semibold text-bad">No login is attached yet. Invite one from Members and people.</span>}
      {s ? <span className="mt-1 block">Ledger: <b>{money(s.confirmed)}</b> confirmed, {money(s.pledged + s.pending)} pledged or pending. <Link className="link ml-1" href={`/admin/ledger?member=${id}`}>Open Ledger</Link></span> : null}
    </PageHead>
    <Edit table="members" id={id} back={back} title="Edit member details">
      <Grid cols={3}><Field name="name" label="Business name" required defaultValue={m.name} /><Field name="serial" label="Member serial" defaultValue={m.serial} /><Field name="joined_on" label="Member since" type="date" defaultValue={m.joined_on} /></Grid>
      <Grid><Pick name="status" label="Status" options={['active', 'paused', 'alumni']} defaultValue={m.status} /><div className="self-end"><Check name="is_demo" label="Demonstration record" defaultChecked={m.is_demo} /></div></Grid>
    </Edit>
    <div className="mb-10 mt-4 flex flex-wrap items-center gap-2 text-[.88rem]"><span className="label !mb-0 mr-2">Groups</span>
      {(groups.data ?? []).length ? (groups.data ?? []).map((g) => inGroups.includes(g.id)
        ? <Act key={g.id} action={setGroup} fields={{ group_id: g.id, member_id: id, remove: '1', _back: back }} tone="pink">{g.name} ✓</Act>
        : <Act key={g.id} action={setGroup} fields={{ group_id: g.id, member_id: id, _back: back }}>{g.name} +</Act>) : <span className="text-muted">No groups created yet.</span>}</div>

    <Section eyebrow="Blueprint" title="Blueprint summary">
      <form action={saveRow} className="grid gap-4 border-2 border-ink p-4">
        <input type="hidden" name="_table" value="blueprints" /><input type="hidden" name="_back" value={back} />{bp.data ? <input type="hidden" name="_id" value={bp.data.id} /> : <input type="hidden" name="member_id" value={id} />}
        <Field name="title" label="Blueprint title" required defaultValue={bp.data?.title ?? 'Business Blueprint'} />
        <Area name="summary" label="Summary the member sees at the top of My Blueprint" defaultValue={bp.data?.summary} rows={3} />
        <div><button className="btn" type="submit">Save Blueprint summary</button></div>
      </form>
    </Section>

    <Section eyebrow="Blueprint" title="Blueprint versions">
      <div className="mb-4 border-2 border-ink p-4"><Uploader bucket="member-files" prefix={`${id}/blueprint`} action={saveRow} button="Upload Blueprint"
        hidden={{ _table: 'blueprint_versions', _back: back, _ok: 'Blueprint uploaded.', ...H }}>
        <Grid><Field name="version_label" label="Version name" required placeholder="For example: Version 2, November 2026" /><Field name="notes" label="What changed" /></Grid></Uploader></div>
      {(versions.data ?? []).length ? <Scroll><table className="tbl"><thead><tr><th>Version</th><th>Notes</th><th>Added</th><th>By</th><th></th></tr></thead><tbody>{(versions.data ?? []).map((v, i) => (
        <tr key={v.id}><td className="font-semibold">{v.version_label} {i === 0 ? <Badge status="active">Current</Badge> : null}</td><td>{v.notes}</td><td className="whitespace-nowrap">{day(v.created_at)}</td><td>{v.uploaded_by_name}</td><td className="whitespace-nowrap text-right"><Dl href={`/api/download?kind=blueprint&id=${v.id}`}>Download · {size(v.size_bytes)}</Dl> <span className="ml-3"><Del table="blueprint_versions" id={v.id} back={back} /></span></td></tr>))}</tbody></table></Scroll> : <Empty>No Blueprint file uploaded yet.</Empty>}
    </Section>

    <Section eyebrow="Blueprint" title="Objectives">
      <AddForm title="Add an objective" action={saveRow} table="objectives" back={back} hidden={H}><Grid><Field name="title" label="Objective" required /><Field name="goal_date" label="Aim date" type="date" /></Grid><Area name="detail" label="Detail" /></AddForm>
      {(objectives.data ?? []).length ? <ul className="border-t-2 border-ink">{(objectives.data ?? []).map((o) => (
        <li key={o.id} className="border-b border-line py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{o.title}</p>{o.detail ? <p className="text-[.9rem] text-muted">{o.detail}</p> : null}</div><span className="flex items-center gap-3"><Quick table="objectives" id={o.id} back={back} name="status" options={['active', 'achieved', 'parked']} value={o.status} /><Del table="objectives" id={o.id} back={back} /></span></div>
          <Edit table="objectives" id={o.id} back={back}><Grid><Field name="title" label="Objective" required defaultValue={o.title} /><Field name="goal_date" label="Aim date" type="date" defaultValue={o.goal_date} /></Grid><Area name="detail" label="Detail" defaultValue={o.detail} /></Edit></li>))}</ul> : <Empty>No objectives yet.</Empty>}
    </Section>

    <Section eyebrow="Blueprint" title="Strategic recommendations">
      <AddForm title="Add a recommendation" action={saveRow} table="recommendations" back={back} hidden={H}><Grid><Field name="title" label="Recommendation" required /><Pick name="built_stage" label="BUILT stage" options={STAGES.map((x) => [x, x] as [string, string])} blank="General" required={false} /></Grid><Area name="detail" label="Detail" /></AddForm>
      {(recs.data ?? []).length ? <ul className="border-t-2 border-ink">{(recs.data ?? []).map((r) => (
        <li key={r.id} className="border-b border-line py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{r.title} {r.built_stage ? <Badge status="x">{r.built_stage}</Badge> : null}</p>{r.detail ? <p className="text-[.9rem] text-muted">{r.detail}</p> : null}</div><span className="flex items-center gap-3"><Quick table="recommendations" id={r.id} back={back} name="status" options={['open', 'in_progress', 'done', 'declined']} value={r.status} /><Del table="recommendations" id={r.id} back={back} /></span></div>
          <Edit table="recommendations" id={r.id} back={back}><Grid><Field name="title" label="Recommendation" required defaultValue={r.title} /><Pick name="built_stage" label="BUILT stage" options={STAGES.map((x) => [x, x] as [string, string])} blank="General" required={false} defaultValue={r.built_stage} /></Grid><Area name="detail" label="Detail" defaultValue={r.detail} /></Edit></li>))}</ul> : <Empty>No recommendations yet.</Empty>}
    </Section>

    <Section eyebrow="Blueprint" title="Milestones">
      <AddForm title="Add a Blueprint milestone" action={saveRow} table="milestones" back={back} hidden={H}><Grid><Field name="title" label="Milestone" required /><Field name="due_date" label="Date" type="date" /></Grid><Area name="detail" label="Detail" /></AddForm>
      {(miles.data ?? []).length ? <ul className="border-t-2 border-ink">{(miles.data ?? []).map((x) => (
        <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3"><div><p className="font-semibold">{x.title}</p><p className="text-[.84rem] text-muted">{day(x.due_date)}</p></div><span className="flex items-center gap-3"><Quick table="milestones" id={x.id} back={back} name="status" options={['upcoming', 'in_progress', 'done', 'missed']} value={x.status} /><Del table="milestones" id={x.id} back={back} /></span></li>))}</ul> : <Empty>No Blueprint milestones yet. Project milestones live on each project.</Empty>}
    </Section>

    <Section eyebrow="Blueprint" title="Actions">
      <AddForm title="Add an action" action={saveRow} table="tasks" back={back} hidden={H}><Grid cols={3}><Field name="title" label="Action" required /><Pick name="owner_type" label="Who does it" options={[['member', 'The member'], ['guysco', 'GUYS&CO']]} defaultValue="member" /><Field name="due_date" label="Due" type="date" /></Grid><Area name="detail" label="Detail" /></AddForm>
      {(tasks.data ?? []).length ? <ul className="border-t-2 border-ink">{(tasks.data ?? []).map((x) => (
        <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3"><div><p className="font-semibold">{x.title}</p><p className="text-[.84rem] text-muted">{x.owner_type === 'member' ? 'Member' : 'GUYS&CO'}{x.due_date ? ` · due ${day(x.due_date)}` : ''}</p></div><span className="flex items-center gap-3"><Quick table="tasks" id={x.id} back={back} name="status" options={['todo', 'in_progress', 'done']} value={x.status} /><Del table="tasks" id={x.id} back={back} /></span></li>))}</ul> : <Empty>No Blueprint actions yet.</Empty>}
    </Section>

    <Section eyebrow="Files" title="Supporting documents">
      <div className="mb-4 border-2 border-ink p-4"><Uploader bucket="member-files" prefix={`${id}/documents`} action={saveRow} button="Upload document" hidden={{ _table: 'documents', _back: back, _ok: 'Document uploaded.', ...H }}><Field name="title" label="Title" placeholder="Leave empty to use the file name" /></Uploader></div>
      {(docs.data ?? []).length ? <Scroll><table className="tbl"><thead><tr><th>Document</th><th>Added</th><th>By</th><th></th></tr></thead><tbody>{(docs.data ?? []).map((d) => (
        <tr key={d.id}><td className="font-semibold">{d.title}</td><td className="whitespace-nowrap">{day(d.created_at)}</td><td>{d.uploaded_by_name}</td><td className="whitespace-nowrap text-right"><Dl href={`/api/download?kind=document&id=${d.id}`}>Download · {size(d.size_bytes)}</Dl> <span className="ml-3"><Del table="documents" id={d.id} back={back} /></span></td></tr>))}</tbody></table></Scroll> : <Empty>No documents yet.</Empty>}
    </Section>

    <Section eyebrow="Delivery" title="Projects">
      <AddForm title="Start a project" action={saveRow} table="projects" back={back} hidden={H} submit="Create project"><Grid><Field name="name" label="Project name" required /><Pick name="status" label="Status" options={['planning', 'active', 'on_hold']} defaultValue="planning" /></Grid><Area name="description" label="Description" /><Area name="objectives" label="Objectives" /><Grid><Field name="start_date" label="Start" type="date" /><Field name="due_date" label="Due" type="date" /></Grid></AddForm>
      {(projects.data ?? []).length ? <ul className="border-t-2 border-ink">{(projects.data ?? []).map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3"><span className="font-semibold">{p.name}</span><span className="flex items-center gap-3"><Badge status={p.status} /><span className="text-[.84rem] text-muted">{p.due_date ? `Due ${day(p.due_date)}` : ''}</span><Link className="link" href={`/admin/projects/${p.id}`}>Manage</Link></span></li>))}</ul> : <Empty>No projects yet.</Empty>}
    </Section>

    <Section eyebrow="Club status" title="Three for Three">
      <AddForm title="Add an item for this member" action={saveRow} table="tft_records" back={back} hidden={H}><Grid cols={3}><Field name="title" label="Item" required /><Pick name="criterion_id" label="Counts toward" options={(criteria.data ?? []).map((c) => [c.id, c.title] as [string, string])} blank="Not linked" required={false} /><Field name="due_date" label="Deadline" type="date" /></Grid><Pick name="status" label="Starting status" options={['outstanding', 'approved']} defaultValue="outstanding" /></AddForm>
      {(tft.data ?? []).length ? <ul className="border-t-2 border-ink">{(tft.data ?? []).map((x) => (
        <li key={x.id} className="border-b border-line py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{x.title}</p>{x.detail ? <p className="text-[.9rem] text-muted">{x.detail}</p> : null}<p className="text-[.8rem] text-muted">{x.due_date ? `Deadline ${day(x.due_date)}` : ''}{x.decision_note ? ` · Note: ${x.decision_note}` : ''}</p></div><span className="flex items-center gap-3"><Badge status={x.status} /><Del table="tft_records" id={x.id} back={back} /></span></div>
          <Edit table="tft_records" id={x.id} back={back} title="Review or edit"><Grid><Pick name="status" label="Status" options={['outstanding', 'submitted', 'approved', 'declined']} defaultValue={x.status} /><Field name="due_date" label="Deadline" type="date" defaultValue={x.due_date} /></Grid><Field name="decision_note" label="Note the member sees" defaultValue={x.decision_note} /></Edit></li>))}</ul> : <Empty>Nothing tracked for this member yet.</Empty>}
      <p className="mt-3 text-[.84rem] text-muted">Program rules and the review queue are on the <Link className="font-semibold text-pink-ink" href="/admin/three">Three for Three</Link> page. Status: {label('outstanding').toLowerCase()} → submitted → approved or declined.</p>
    </Section>

    <Section eyebrow="Talk to them" title="Message this member">
      <AddForm title="Post an announcement only this member sees" action={saveRow} table="announcements" back={back} hidden={{ ...H, published: 'true' }} submit="Post"><Field name="title" label="Title" required /><Area name="body" label="Message" rows={4} /></AddForm>
    </Section>
  </>);
}
