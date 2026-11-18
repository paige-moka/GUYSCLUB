import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Act, AddForm, Area, Back, Badge, Bar, DemoFlag, Dl, Empty, Field, GoalMeter, Notice, PageHead, Section } from '@/components/ui';
import { Uploader } from '@/components/Uploader';
import { requireMe, seesMoney } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, isLate, progressOf, size, sums } from '@/lib/format';
import { saveRow, setMilestoneStatus, setTaskStatus } from '@/app/actions';

export const metadata: Metadata = { title: 'Project' };

export default async function Project({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params; const me = await requireMe(); const sb = await createClient();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // If this project is not yours (or not assigned to you), the database returns nothing and you get "not found".
  const { data: p } = await sb.from('projects').select('*').eq('id', id).maybeSingle();
  if (!p) notFound();
  const spec = me.role === 'specialist', back = `/portal/projects/${id}`, mineType = spec ? 'specialist' : 'member';
  const [team, miles, tasks, updates, docs, fund, tx] = await Promise.all([
    sb.from('project_assignments').select('id, display_name, role_label').eq('project_id', id).order('created_at'),
    sb.from('milestones').select('id, title, detail, due_date, status').eq('project_id', id).order('due_date', { nullsFirst: false }),
    sb.from('tasks').select('id, title, detail, due_date, status, owner_type').eq('project_id', id).order('due_date', { nullsFirst: false }),
    sb.from('project_updates').select('id, body, author_name, created_at').eq('project_id', id).order('created_at', { ascending: false }),
    sb.from('documents').select('id, title, size_bytes, uploaded_by_name, created_at').eq('project_id', id).order('created_at', { ascending: false }),
    seesMoney(me) ? sb.from('project_funding').select('goal_cents, note').eq('project_id', id).maybeSingle() : Promise.resolve({ data: null }),
    seesMoney(me) ? sb.from('financial_transactions').select('status, kind, amount_cents').eq('project_id', id) : Promise.resolve({ data: [] as { status: string; kind: string; amount_cents: number }[] }),
  ]);
  const t = tasks.data ?? [], ms = miles.data ?? [];
  const v = progressOf(p, [...t, ...ms]);
  const yours = t.filter((x) => x.status !== 'done' && x.owner_type === mineType);
  const outstanding = t.filter((x) => x.status !== 'done' && x.owner_type !== mineType), completed = t.filter((x) => x.status === 'done');
  const s = sums(tx.data ?? []);

  return (<>
    <Back href="/portal/projects">All projects</Back>
    <Notice searchParams={searchParams} />
    <DemoFlag show={!!me.member?.is_demo} />
    <PageHead eyebrow="Project" title={p.name} action={<Badge status={p.status} />}>{p.description}</PageHead>

    <div className="mb-10 grid gap-6 border-2 border-ink p-5 shadow-stamp md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-3">
        <p className="eyebrow">Progress</p>
        <p className="num font-display text-[4rem] leading-none">{v}%</p>
        <Bar value={v} labelText="Project progress" />
        <p className="font-mono text-[.66rem] uppercase tracking-[.1em] text-muted">{completed.length} of {t.length} tasks done · {ms.filter((x) => x.status === 'done').length} of {ms.length} milestones reached</p>
      </div>
      <dl className="grid content-start gap-3 text-[.95rem]">
        <div><dt className="label !mb-0">Timeline</dt><dd>{p.start_date ? day(p.start_date) : 'Start to be set'} → {p.due_date ? day(p.due_date) : 'End to be set'}</dd></div>
        <div><dt className="label !mb-0">Your team</dt><dd>{(team.data ?? []).length ? (team.data ?? []).map((a) => `${a.display_name} (${a.role_label})`).join(', ') : 'To be assigned'}</dd></div>
      </dl>
    </div>

    {p.objectives ? <Section eyebrow="Why we're doing this" title="Objectives"><p className="max-w-[70ch] whitespace-pre-line">{p.objectives}</p></Section> : null}

    <Section eyebrow="Needs your attention" title={yours.length ? 'Waiting on you' : 'Nothing is waiting on you'}>
      {yours.length ? <ul className="border-2 border-ink">{yours.map((x) => (
        <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 last:border-b-0">
          <div className="min-w-0"><p className="font-semibold">{x.title}</p>{x.detail ? <p className="text-[.92rem] text-muted">{x.detail}</p> : null}
            <p className={`font-mono text-[.66rem] uppercase tracking-[.1em] ${isLate(x.due_date, false) ? 'text-bad' : 'text-muted'}`}>{x.due_date ? `${isLate(x.due_date, false) ? 'Overdue · was due' : 'Due'} ${day(x.due_date)}` : 'No due date'}</p></div>
          <Act action={setTaskStatus} fields={{ id: x.id, status: 'done', _back: back }} tone="pink">Mark done</Act>
        </li>))}</ul> : <Empty>You&apos;re up to date on this project.</Empty>}
    </Section>

    <Section eyebrow="The road" title="Milestones">
      {ms.length ? <ul className="border-t-2 border-ink">{ms.map((x) => { const done = x.status === 'done', late = isLate(x.due_date, done); return (
        <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
          <div><p className={`font-semibold ${done ? 'text-muted line-through' : ''}`}>{x.title}</p>{x.detail ? <p className="text-[.92rem] text-muted">{x.detail}</p> : null}</div>
          <span className="flex items-center gap-2 font-mono text-[.66rem] uppercase tracking-[.1em] text-muted">{day(x.due_date)}<Badge status={late ? 'missed' : x.status}>{late ? 'Overdue' : undefined}</Badge>
            {spec && !done ? <Act action={setMilestoneStatus} fields={{ id: x.id, status: 'done', _back: back }}>Reached</Act> : null}</span>
        </li>); })}</ul> : <Empty>Milestones will be listed here.</Empty>}
    </Section>

    <Section eyebrow="Latest" title="Progress updates">
      {spec ? <AddForm title="Post an update" action={saveRow} table="project_updates" back={back} hidden={{ project_id: id, member_id: p.member_id }} submit="Post update"><Area name="body" label="Update" required rows={4} /></AddForm> : null}
      {(updates.data ?? []).length ? <ul className="grid gap-3">{(updates.data ?? []).map((u) => (
        <li key={u.id} className="border-l-4 border-pink bg-wash p-4"><p className="whitespace-pre-line">{u.body}</p><p className="mt-2 font-mono text-[.64rem] uppercase tracking-[.1em] text-muted">{day(u.created_at)}{u.author_name ? ` · ${u.author_name}` : ''}</p></li>))}</ul> : <Empty>No updates posted yet.</Empty>}
    </Section>

    <div className="grid gap-x-10 lg:grid-cols-2">
      <Section eyebrow="In motion" title="Outstanding deliverables">
        {outstanding.length ? <ul className="border-t-2 border-ink">{outstanding.map((x) => (
          <li key={x.id} className="flex items-center justify-between gap-3 border-b border-line py-3"><div><p className="font-semibold">{x.title}</p><p className="font-mono text-[.66rem] uppercase tracking-[.1em] text-muted">{x.owner_type === 'guysco' ? 'GUYS&CO' : x.owner_type === 'specialist' ? 'Specialist' : 'Member'}{x.due_date ? ` · due ${day(x.due_date)}` : ''}</p></div><Badge status={isLate(x.due_date, false) ? 'missed' : x.status}>{isLate(x.due_date, false) ? 'Overdue' : undefined}</Badge></li>))}</ul> : <Empty>Nothing outstanding from the team.</Empty>}
      </Section>
      <Section eyebrow="Done" title="Completed work">
        {completed.length ? <ul className="border-t-2 border-ink">{completed.map((x) => (
          <li key={x.id} className="flex items-center justify-between gap-3 border-b border-line py-3 text-muted"><span>{x.title}</span><Badge status="done" /></li>))}</ul> : <Empty>Completed work will collect here.</Empty>}
      </Section>
    </div>

    {seesMoney(me) && fund.data ? (
      <Section eyebrow="The Ledger" title="Project funding">
        <div className="card"><GoalMeter goal={Number(fund.data.goal_cents)} confirmed={s.confirmed} pledged={s.pledged} pending={s.pending} />{fund.data.note ? <p className="mt-3 text-[.9rem] text-muted">{fund.data.note}</p> : null}</div>
      </Section>
    ) : null}

    <Section eyebrow="Files" title="Project documents">
      {(docs.data ?? []).length ? <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Document</th><th>Added</th><th>By</th><th></th></tr></thead>
        <tbody>{(docs.data ?? []).map((d) => (<tr key={d.id}><td className="font-semibold">{d.title}</td><td className="whitespace-nowrap">{day(d.created_at)}</td><td>{d.uploaded_by_name}</td><td className="text-right"><Dl href={`/api/download?kind=document&id=${d.id}`}>Download{d.size_bytes ? ` · ${size(d.size_bytes)}` : ''}</Dl></td></tr>))}</tbody></table></div> : <Empty>No documents on this project yet.</Empty>}
      <details className="mt-4 border-2 border-ink">
        <summary className="cursor-pointer px-4 py-3 font-mono text-[.74rem] font-semibold uppercase tracking-[.12em] hover:bg-wash">+ Upload a document</summary>
        <div className="border-t-2 border-ink p-4">
          <Uploader bucket="member-files" prefix={`${p.member_id}/projects/${id}`} action={saveRow} button="Upload document"
            hidden={{ _table: 'documents', _back: back, _ok: 'Document uploaded.', member_id: p.member_id, project_id: id }}>
            <Field name="title" label="Title" placeholder="Leave empty to use the file name" />
          </Uploader>
        </div>
      </details>
    </Section>
  </>);
}
