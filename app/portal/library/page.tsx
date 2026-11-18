import type { Metadata } from 'next';
import { Badge, Dl, Empty, Notice, PageHead } from '@/components/ui';
import { requireMe } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { label, size } from '@/lib/format';

export const metadata: Metadata = { title: 'The Library' };
const KINDS = ['document', 'template', 'guide', 'resource', 'training'];

export default async function Library({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireMe(); const sp = await searchParams; const sb = await createClient();
  const q = (sp.q ?? '').trim().slice(0, 80), kind = KINDS.includes(sp.kind ?? '') ? sp.kind! : '', cat = (sp.cat ?? '').slice(0, 80);
  // Only resources this login may see come back: general ones, plus any restricted to this member or their group.
  let query = sb.from('library_resources').select('id, title, description, category, kind, storage_path, file_name, size_bytes, external_url, audience').order('category').order('title');
  if (kind) query = query.eq('kind', kind);
  if (cat) query = query.eq('category', cat);
  if (q) { const safe = q.replace(/[%_,()\\]/g, ' '); query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`); }
  const [{ data }, { data: allCats }] = await Promise.all([query, sb.from('library_resources').select('category')]);
  const cats = [...new Set((allCats ?? []).map((c) => c.category))].sort(); const rows = data ?? [];
  const groups = [...new Set(rows.map((r) => r.category))];

  return (<>
    <Notice searchParams={searchParams} />
    <PageHead eyebrow="The Library" title={<>Playbooks, templates and <span className="text-pink-ink">guides.</span></>}>Written for owners, not marketers. Search it, read it, use it.</PageHead>
    <form method="get" className="mb-8 grid gap-3 border-2 border-ink p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <label className="block"><span className="label">Search</span><input className="input" type="search" name="q" defaultValue={q} placeholder="Search the Library" /></label>
      <label className="block"><span className="label">Type</span><select className="input" name="kind" defaultValue={kind}><option value="">All types</option>{KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}</select></label>
      <label className="block"><span className="label">Category</span><select className="input" name="cat" defaultValue={cat}><option value="">All categories</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
      <button className="btn" type="submit">Search</button>
    </form>
    {rows.length ? groups.map((g) => (
      <section key={g} className="mb-8">
        <h2 className="mb-3 border-b-2 border-ink pb-2 text-[1.5rem]">{g}</h2>
        <ul className="grid gap-3 md:grid-cols-2">{rows.filter((r) => r.category === g).map((r) => (
          <li key={r.id} className="card-soft grid content-start gap-2">
            <p className="flex flex-wrap items-center gap-2"><Badge status="x">{label(r.kind)}</Badge>{r.audience === 'restricted' ? <Badge status="active">For you</Badge> : null}</p>
            <h3 className="text-[1.25rem]">{r.title}</h3>
            {r.description ? <p className="text-[.94rem] text-muted">{r.description}</p> : null}
            <p className="mt-1 flex flex-wrap gap-5">
              {r.storage_path ? <Dl href={`/api/download?kind=library&id=${r.id}`}>Download{r.size_bytes ? ` · ${size(r.size_bytes)}` : ''}</Dl> : null}
              {r.external_url ? <Dl href={r.external_url}>Open</Dl> : null}
            </p>
          </li>))}</ul>
      </section>
    )) : <Empty>{q || kind || cat ? 'Nothing matches that search.' : 'The Library is being stocked. Resources will appear here.'}</Empty>}
  </>);
}
