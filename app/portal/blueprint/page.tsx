import type { Metadata } from 'next';
import { Act, Badge, DemoFlag, Dl, Empty, Field, Notice, PageHead, Section } from '@/components/ui';
import { Uploader } from '@/components/Uploader';
import { requireMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, isLate, size } from '@/lib/format';
import { saveRow, setTaskStatus } from '@/app/actions';

export const metadata: Metadata = { title: 'My Blueprint' };

export default async function Blueprint({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMember(); const m = me.member.id; const sb = await createClient();
  const [bp, versions, objectives, recs, miles, tasks, docs] = await Promise.all([
    sb.from('blueprints').select('title, summary, updated_at').eq('member_id', m).maybeSingle(),
    sb.from('blueprint_versions').select('id, version_label, notes, file_name, size_bytes, uploaded_by_name, created_at').eq('member_id', m).order('created_at', { ascending: false }),
    sb.from('objectives').select('id, title, detail, status, goal_date').eq('member_id', m).order('sort').order('created_at'),
    sb.from('recommendations').select('id, title, detail, built_stage, status').eq('member_id', m).order('sort').order('created_at'),
    sb.from('milestones').select('id, title, detail, due_date, status').eq('member_id', m).is('project_id', null).order('due_date', { nullsFirst: false }),
    sb.from('tasks').select('id, title, detail, due_date, status, owner_type').eq('member_id', m).is('project_id', null).order('status').order('due_date', { nullsFirst: false }),
    sb.from('documents').select('id, title, file_name, size_bytes, uploaded_by_name, created_at').eq('member_id', m).is('project_id', null).order('created_at', { ascending: false }),
  ]);
  const v = versions.data ?? [], current = v[0]; const t = tasks.data ?? [];
  const open = t.filter((x) => x.status !== 'done'), closed = t.filter((x) => x.status === 'done');
  const stages = ['Blueprint', 'Uptime', 'Ignition', 'Leverage', 'Traction'];

  return (<>
    <Notice searchParams={searchParams} />
    <DemoFlag show={me.member.is_demo} />
    <PageHead eyebrow="My Blueprint" title={bp.data?.title ?? 'Business Blueprint'}
      action={current ? <a className="btn" href={`/api/download?kind=blueprint&id=${current.id}`} target="_blank" rel="noopener">Open current Blueprint →</a> : undefined}>
      {bp.data?.summary ?? 'Your Blueprint is the reference point for everything we build together. The plan, your objectives and what happens next all live here.'}
      {current ? <span className="mt-2 block font-mono text-[.68rem] uppercase tracking-[.1em]">Current version: {current.version_label} · {day(current.created_at)}</span> : null}
    </PageHead>

    <Section eyebrow="Where you're going" title="Current objectives">
      {(objectives.data ?? []).length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {(objectives.data ?? []).map((o) => (
            <article key={o.id} className="card-soft grid content-start gap-2 border-t-4 border-t-pink">
              <div className="flex items-start justify-between gap-3"><h3 className="text-[1.25rem]">{o.title}</h3><Badge status={o.status} /></div>
              {o.detail ? <p className="whitespace-pre-line text-[.94rem] text-muted">{o.detail}</p> : null}
              {o.goal_date ? <p className="font-mono text-[.66rem] uppercase tracking-[.1em] text-muted">Aim: {day(o.goal_date)}</p> : null}
            </article>
          ))}
        </div>
      ) : <Empty>Your objectives will be listed here after your Blueprint session.</Empty>}
    </Section>

    <Section eyebrow="What we recommend" title="Strategic recommendations">
      {(recs.data ?? []).length ? (
        <div className="grid gap-6">
          {[...stages, null].map((st) => {
            const list = (recs.data ?? []).filter((r) => (r.built_stage ?? null) === st);
            if (!list.length) return null;
            return (
              <div key={st ?? 'x'} className="grid gap-3 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                <div>{st ? <span className="inline-block bg-pink px-3 pb-0 pt-2 font-display text-[3rem] leading-[.8]">{st[0]}</span> : null}<p className="mt-1 font-mono text-[.64rem] uppercase tracking-[.1em] text-muted">{st ?? 'General'}</p></div>
                <ul className="border-t-2 border-ink">
                  {list.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 border-b border-line py-3">
                      <div><p className="font-semibold">{r.title}</p>{r.detail ? <p className="whitespace-pre-line text-[.94rem] text-muted">{r.detail}</p> : null}</div>
                      <Badge status={r.status} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : <Empty>Recommendations from your strategy work will be listed here.</Empty>}
    </Section>

    <Section id="milestones" eyebrow="The road" title="Milestones">
      {(miles.data ?? []).length ? (
        <ol className="grid gap-0">
          {(miles.data ?? []).map((x, i, a) => {
            const done = x.status === 'done', late = isLate(x.due_date, done);
            return (
              <li key={x.id} className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-4 pb-5">
                {i < a.length - 1 ? <span className="absolute bottom-0 left-[15px] top-8 w-0.5 bg-line" /> : null}
                <span className={`grid h-8 w-8 place-items-center rounded-full border-2 font-display text-sm ${done ? 'border-good bg-good text-white' : 'border-ink bg-pink'}`}>{done ? '✓' : i + 1}</span>
                <div><p className="font-semibold">{x.title} <span className="ml-2 align-middle"><Badge status={late ? 'missed' : x.status}>{late ? 'Overdue' : undefined}</Badge></span></p>
                  {x.detail ? <p className="text-[.94rem] text-muted">{x.detail}</p> : null}
                  {x.due_date ? <p className="font-mono text-[.66rem] uppercase tracking-[.1em] text-muted">{day(x.due_date)}</p> : null}</div>
              </li>
            );
          })}
        </ol>
      ) : <Empty>Milestones from your Blueprint will be tracked here.</Empty>}
    </Section>

    <Section eyebrow="Getting it done" title="Actions">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="label">Outstanding ({open.length})</p>
          {open.length ? <ul className="border-t-2 border-ink">{open.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
              <div className="min-w-0"><p className="font-semibold">{x.title}</p>
                <p className={`font-mono text-[.66rem] uppercase tracking-[.1em] ${isLate(x.due_date, false) ? 'text-bad' : 'text-muted'}`}>{x.owner_type === 'member' ? 'Yours' : 'GUYS&CO'}{x.due_date ? ` · due ${day(x.due_date)}` : ''}</p></div>
              {x.owner_type === 'member' ? <Act action={setTaskStatus} fields={{ id: x.id, status: 'done', _back: '/portal/blueprint' }} tone="pink">Mark done</Act> : <Badge status={x.status} />}
            </li>))}</ul> : <Empty>Nothing outstanding.</Empty>}
        </div>
        <div>
          <p className="label">Completed ({closed.length})</p>
          {closed.length ? <ul className="border-t-2 border-ink">{closed.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 border-b border-line py-3 text-muted"><span>{x.title}</span><Badge status="done" /></li>))}</ul> : <Empty>Completed actions will collect here.</Empty>}
        </div>
      </div>
    </Section>

    <Section eyebrow="Every version, kept" title="Blueprint versions">
      {v.length ? (
        <div className="overflow-x-auto"><table className="tbl">
          <thead><tr><th>Version</th><th>Notes</th><th>Added</th><th>By</th><th></th></tr></thead>
          <tbody>{v.map((x, i) => (
            <tr key={x.id}><td className="font-semibold">{x.version_label} {i === 0 ? <Badge status="active">Current</Badge> : null}</td><td className="text-muted">{x.notes}</td><td className="whitespace-nowrap">{day(x.created_at)}</td><td>{x.uploaded_by_name}</td>
              <td className="text-right"><Dl href={`/api/download?kind=blueprint&id=${x.id}`}>Download{x.size_bytes ? ` · ${size(x.size_bytes)}` : ''}</Dl></td></tr>))}</tbody>
        </table></div>
      ) : <Empty>No Blueprint file yet. Upload yours below, or we will add it after your session.</Empty>}
      <details className="mt-4 border-2 border-ink">
        <summary className="cursor-pointer px-4 py-3 font-mono text-[.74rem] font-semibold uppercase tracking-[.12em] hover:bg-wash">+ Upload a Blueprint version</summary>
        <div className="border-t-2 border-ink p-4">
          <Uploader bucket="member-files" prefix={`${m}/blueprint`} action={saveRow} button="Upload Blueprint" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg"
            hidden={{ _table: 'blueprint_versions', _back: '/portal/blueprint', _ok: 'Blueprint uploaded.', member_id: m }}>
            <div className="grid gap-4 sm:grid-cols-2"><Field name="version_label" label="Version name" required placeholder="For example: November 2026 draft" /><Field name="notes" label="What changed" /></div>
          </Uploader>
        </div>
      </details>
    </Section>

    <Section eyebrow="Supporting files" title="Documents">
      {(docs.data ?? []).length ? (
        <div className="overflow-x-auto"><table className="tbl">
          <thead><tr><th>Document</th><th>Added</th><th>By</th><th></th></tr></thead>
          <tbody>{(docs.data ?? []).map((d) => (
            <tr key={d.id}><td className="font-semibold">{d.title}</td><td className="whitespace-nowrap">{day(d.created_at)}</td><td>{d.uploaded_by_name}</td>
              <td className="text-right"><Dl href={`/api/download?kind=document&id=${d.id}`}>Download{d.size_bytes ? ` · ${size(d.size_bytes)}` : ''}</Dl></td></tr>))}</tbody>
        </table></div>
      ) : <Empty>No supporting documents yet.</Empty>}
      <details className="mt-4 border-2 border-ink">
        <summary className="cursor-pointer px-4 py-3 font-mono text-[.74rem] font-semibold uppercase tracking-[.12em] hover:bg-wash">+ Upload a document</summary>
        <div className="border-t-2 border-ink p-4">
          <Uploader bucket="member-files" prefix={`${m}/documents`} action={saveRow} button="Upload document"
            hidden={{ _table: 'documents', _back: '/portal/blueprint', _ok: 'Document uploaded.', member_id: m }}>
            <Field name="title" label="Title" placeholder="Leave empty to use the file name" />
          </Uploader>
        </div>
      </details>
    </Section>
  </>);
}
