import type { Metadata } from 'next';
import { AddForm, Area, Badge, Empty, Field, Notice, PageHead, Pick } from '@/components/ui';
import { Del } from '@/components/admin';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day } from '@/lib/format';
import { saveRow } from '@/app/actions';

export const metadata: Metadata = { title: 'Announcements' };

export default async function Announcements({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff(); const sb = await createClient(); const back = '/admin/announcements';
  const [{ data: list }, { data: members }] = await Promise.all([sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(100), sb.from('members').select('id, name').order('name')]);
  return (<>
    <Notice searchParams={searchParams} />
    <PageHead eyebrow="Announcements" title={<>Tell the <span className="text-pink-ink">Club.</span></>}>Announcements appear on each member&apos;s dashboard.</PageHead>
    <AddForm title="Post an announcement" action={saveRow} table="announcements" back={back} hidden={{ published: 'true' }} submit="Post" open={!(list ?? []).length}>
      <Field name="title" label="Title" required /><Area name="body" label="Message" rows={4} />
      <Pick name="member_id" label="Who sees it" options={(members ?? []).map((m) => [m.id, `Only ${m.name}`] as [string, string])} blank="Everyone in the Lounge" required={false} />
    </AddForm>
    {(list ?? []).length ? <ul className="grid gap-3">{(list ?? []).map((a) => (<li key={a.id} className="border-l-4 border-pink bg-wash p-4"><p className="font-semibold">{a.title} <Badge status="x">{a.member_id ? `Only ${(members ?? []).find((m) => m.id === a.member_id)?.name}` : 'Everyone'}</Badge></p>{a.body ? <p className="mt-1 whitespace-pre-line text-[.94rem] text-muted">{a.body}</p> : null}<div className="mt-2 flex items-center gap-4 font-mono text-[.64rem] uppercase tracking-[.1em] text-muted">{day(a.created_at)} · {a.author_name}<Del table="announcements" id={a.id} back={back} /></div></li>))}</ul> : <Empty>No announcements yet.</Empty>}
  </>);
}
