import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Bar, DemoFlag, Empty, Notice, PageHead } from '@/components/ui';
import { requireMe } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, progressOf } from '@/lib/format';

export const metadata: Metadata = { title: 'My Projects' };

export default async function Projects({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe(); const sb = await createClient();
  // Row Level Security returns only this member's projects (or, for a specialist, only assigned ones).
  const [{ data: projects }, { data: tasks }, { data: miles }, { data: members }] = await Promise.all([
    sb.from('projects').select('id, member_id, name, description, status, start_date, due_date, progress_override').order('status').order('due_date', { nullsFirst: false }),
    sb.from('tasks').select('project_id, status, owner_type').not('project_id', 'is', null),
    sb.from('milestones').select('project_id, status, title, due_date').not('project_id', 'is', null).order('due_date', { nullsFirst: false }),
    me.role === 'specialist' ? sb.from('members').select('id, name') : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const order = ['active', 'planning', 'on_hold', 'complete', 'cancelled'];
  const list = [...(projects ?? [])].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (<>
    <Notice searchParams={searchParams} />
    <DemoFlag show={!!me.member?.is_demo} />
    <PageHead eyebrow={me.role === 'specialist' ? 'Projects you are assigned to' : 'My Projects'} title={<>Where every project <span className="text-pink-ink">stands.</span></>} />
    {list.length ? (
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((p) => {
          const items = [...(tasks ?? []), ...(miles ?? [])].filter((i) => i.project_id === p.id);
          const v = progressOf(p, items);
          const yours = (tasks ?? []).filter((t) => t.project_id === p.id && t.status !== 'done' && t.owner_type === (me.role === 'specialist' ? 'specialist' : 'member')).length;
          const next = (miles ?? []).find((x) => x.project_id === p.id && x.status !== 'done');
          return (
            <Link key={p.id} href={`/portal/projects/${p.id}`} className="card grid content-start gap-3 no-underline transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-start justify-between gap-3"><h2 className="text-[1.5rem]">{p.name}</h2><Badge status={p.status} /></div>
              {me.role === 'specialist' ? <p className="font-mono text-[.66rem] uppercase tracking-[.1em] text-pink-ink">{(members ?? []).find((x) => x.id === p.member_id)?.name}</p> : null}
              {p.description ? <p className="line-clamp-2 text-[.94rem] text-muted">{p.description}</p> : null}
              <Bar value={v} labelText={`${p.name} progress`} />
              <p className="flex flex-wrap justify-between gap-2 font-mono text-[.66rem] uppercase tracking-[.1em] text-muted"><span>{v}% complete</span><span>{p.due_date ? `Due ${day(p.due_date)}` : ''}</span></p>
              <p className="text-[.9rem]">{next ? <>Next milestone: <b>{next.title}</b>{next.due_date ? `, ${day(next.due_date)}` : ''}</> : <span className="text-muted">No open milestones</span>}</p>
              {yours ? <p className="justify-self-start bg-pink px-2 py-1 font-mono text-[.66rem] font-semibold uppercase tracking-[.1em]">{yours} waiting on you</p> : null}
            </Link>
          );
        })}
      </div>
    ) : <Empty>{me.role === 'specialist' ? 'You have not been assigned to a project yet.' : 'No projects yet. When one starts, you can follow it here.'}</Empty>}
  </>);
}
