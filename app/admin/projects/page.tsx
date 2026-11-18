import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Bar, Empty, Notice, PageHead } from '@/components/ui';
import { Scroll } from '@/components/admin';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, progressOf } from '@/lib/format';

export const metadata: Metadata = { title: 'Projects' };

export default async function Projects({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff(); const sb = await createClient();
  const [{ data: projects }, { data: members }, { data: tasks }, { data: miles }] = await Promise.all([
    sb.from('projects').select('id, member_id, name, status, due_date, progress_override').order('status').order('due_date', { nullsFirst: false }),
    sb.from('members').select('id, name'), sb.from('tasks').select('project_id, status').not('project_id', 'is', null), sb.from('milestones').select('project_id, status').not('project_id', 'is', null),
  ]);
  return (<>
    <Notice searchParams={searchParams} />
    <PageHead eyebrow="Projects" title={<>Everything being <span className="text-pink-ink">built.</span></>}>Start a new project from the member&apos;s page.</PageHead>
    {(projects ?? []).length ? <Scroll><table className="tbl"><thead><tr><th>Project</th><th>Member</th><th>Status</th><th className="w-[26%]">Progress</th><th>Due</th><th></th></tr></thead><tbody>{(projects ?? []).map((p) => {
      const v = progressOf(p, [...(tasks ?? []), ...(miles ?? [])].filter((i) => i.project_id === p.id));
      return (<tr key={p.id}><td className="font-semibold">{p.name}</td><td><Link className="underline-offset-4 hover:underline" href={`/admin/members/${p.member_id}`}>{(members ?? []).find((m) => m.id === p.member_id)?.name}</Link></td><td><Badge status={p.status} /></td><td><div className="flex items-center gap-2"><Bar value={v} /><span className="num w-10 text-right text-[.8rem]">{v}%</span></div></td><td className="whitespace-nowrap">{day(p.due_date)}</td><td className="text-right"><Link className="link" href={`/admin/projects/${p.id}`}>Manage</Link></td></tr>);
    })}</tbody></table></Scroll> : <Empty>No projects yet. Open a member and choose &quot;Start a project&quot;.</Empty>}
  </>);
}
