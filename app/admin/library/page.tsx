import type { Metadata } from 'next';
import { AddForm, Area, Badge, Check, Dl, Empty, Field, Grid, Notice, PageHead, Pick, Section } from '@/components/ui';
import { Del, Edit } from '@/components/admin';
import { Uploader } from '@/components/Uploader';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { label, size } from '@/lib/format';
import { saveRow } from '@/app/actions';

export const metadata: Metadata = { title: 'The Library' };
const KINDS = ['guide', 'template', 'document', 'resource', 'training'];
const AUD: [string, string][] = [['all', 'Everyone in the Lounge'], ['restricted', 'Only the members or groups I choose']];

export default async function Library({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff(); const sb = await createClient(); const back = '/admin/library';
  const [{ data: res }, { data: access }, { data: members }, { data: groups }] = await Promise.all([
    sb.from('library_resources').select('*').order('category').order('title'), sb.from('library_access').select('*'),
    sb.from('members').select('id, name').order('name'), sb.from('member_groups').select('id, name').order('name'),
  ]);
  const meta = (<><Grid><Field name="title" label="Title" required /><Field name="category" label="Category" required defaultValue="Playbooks" /></Grid><Area name="description" label="Description" /><Grid><Pick name="kind" label="Type" options={KINDS} /><Pick name="audience" label="Who can see it" options={AUD} /></Grid></>);
  return (<>
    <Notice searchParams={searchParams} />
    <PageHead eyebrow="The Library" title={<>Stock the <span className="text-pink-ink">shelves.</span></>}>Files are stored privately and only ever served through links that expire in a minute. A restricted resource is invisible to everyone you have not chosen.</PageHead>
    <Section eyebrow="Add" title="New resource">
      <div className="grid gap-4 lg:grid-cols-2">
        <details className="border-2 border-ink" open={!(res ?? []).length}><summary className="cursor-pointer px-4 py-3 font-mono text-[.74rem] font-semibold uppercase tracking-[.12em] hover:bg-wash">+ Upload a file</summary><div className="border-t-2 border-ink p-4">
          <Uploader bucket="library" prefix="resources" action={saveRow} button="Upload to the Library" hidden={{ _table: 'library_resources', _back: back, _ok: 'Added to the Library.', published: 'true' }}>{meta}</Uploader></div></details>
        <AddForm title="Add a link (for example a published playbook)" action={saveRow} table="library_resources" back={back} hidden={{ published: 'true' }} submit="Add to the Library">{meta}<Field name="external_url" label="Link" required placeholder="https://..." /></AddForm>
      </div>
    </Section>
    <Section eyebrow="Manage" title={`Resources (${(res ?? []).length})`}>
      {(res ?? []).length ? <ul className="border-t-2 border-ink">{(res ?? []).map((r) => { const acc = (access ?? []).filter((a) => a.resource_id === r.id); return (
        <li key={r.id} className="border-b border-line py-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{r.title} <Badge status="x">{label(r.kind)}</Badge> {r.published ? null : <Badge status="void">Unpublished</Badge>} {r.audience === 'restricted' ? <Badge status="pending">Restricted</Badge> : null}</p><p className="text-[.86rem] text-muted">{r.category}{r.description ? ` · ${r.description}` : ''}</p></div>
            <span className="flex items-center gap-4">{r.storage_path ? <Dl href={`/api/download?kind=library&id=${r.id}`}>File · {size(r.size_bytes)}</Dl> : null}{r.external_url ? <Dl href={r.external_url}>Link</Dl> : null}<Del table="library_resources" id={r.id} back={back} /></span></div>
          {r.audience === 'restricted' ? <div className="mt-2 border border-line bg-wash/40 p-3 text-[.88rem]"><p className="label">Who can see this</p>
            {acc.length ? <ul className="mb-2 flex flex-wrap gap-2">{acc.map((a) => (<li key={a.id} className="flex items-center gap-2 border border-ink bg-paper px-2 py-1">{a.member_id ? (members ?? []).find((m) => m.id === a.member_id)?.name : `Group: ${(groups ?? []).find((g) => g.id === a.group_id)?.name}`}<Del table="library_access" id={a.id} back={back} what="×" /></li>))}</ul> : <p className="mb-2 font-semibold text-bad">Nobody yet. Choose who should see it.</p>}
            <div className="flex flex-wrap gap-3">
              <form action={saveRow} className="flex items-end gap-2"><input type="hidden" name="_table" value="library_access" /><input type="hidden" name="_back" value={back} /><input type="hidden" name="resource_id" value={r.id} /><select className="input !w-52" name="member_id" required aria-label="Member"><option value="">Add a member</option>{(members ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select><button className="btn-ghost btn btn-sm" type="submit">Add</button></form>
              {(groups ?? []).length ? <form action={saveRow} className="flex items-end gap-2"><input type="hidden" name="_table" value="library_access" /><input type="hidden" name="_back" value={back} /><input type="hidden" name="resource_id" value={r.id} /><select className="input !w-52" name="group_id" required aria-label="Group"><option value="">Add a group</option>{(groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select><button className="btn-ghost btn btn-sm" type="submit">Add</button></form> : null}
            </div></div> : null}
          <Edit table="library_resources" id={r.id} back={back}><Grid><Field name="title" label="Title" required defaultValue={r.title} /><Field name="category" label="Category" required defaultValue={r.category} /></Grid><Area name="description" label="Description" defaultValue={r.description} /><Grid><Pick name="kind" label="Type" options={KINDS} defaultValue={r.kind} /><Pick name="audience" label="Who can see it" options={AUD} defaultValue={r.audience} /></Grid><Check name="published" label="Published" defaultChecked={r.published} /></Edit>
        </li>); })}</ul> : <Empty>The Library is empty. Add the first resource above.</Empty>}
    </Section>
  </>);
}
