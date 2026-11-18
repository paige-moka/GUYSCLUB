import type { Metadata } from 'next';
import Link from 'next/link';
import { Act, Badge, Empty, Notice, PageHead, Section } from '@/components/ui';
import { Edit } from '@/components/admin';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day } from '@/lib/format';
import { saveRow } from '@/app/actions';

export const metadata: Metadata = { title: 'Club applications' };

const APP_ORDER = ['new', 'closer_look', 'approved', 'invited', 'declined'];
const REC_ORDER = ['new', 'invited', 'on_hold', 'applied', 'closed'];
type App = { id: number; created_at: string; name: string; email: string; phone: string | null; business_role: string; industry: string; value_offered: string; looking_for: string | null; sponsor: string | null; status: string; notes: string | null };
type Rec = { id: number; created_at: string; recommender_name: string; recommender_email: string; candidate_name: string; candidate_contact: string | null; background: string; fit: string | null; value_offered: string | null; consent: string; status: string; notes: string | null };

export default async function ClubPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff(); const sb = await createClient(); const back = '/admin/club';
  const sp = await searchParams; const showAll = sp.show === 'all';
  const [apps, recs] = await Promise.all([
    sb.from('club_applications').select('*').order('created_at', { ascending: false }).limit(300),
    sb.from('club_recommendations').select('*').order('created_at', { ascending: false }).limit(300),
  ]);
  const A = ((apps.data ?? []) as App[]).sort((a, b) => APP_ORDER.indexOf(a.status) - APP_ORDER.indexOf(b.status));
  const R = ((recs.data ?? []) as Rec[]).sort((a, b) => REC_ORDER.indexOf(a.status) - REC_ORDER.indexOf(b.status));
  const openA = A.filter((a) => ['new', 'closer_look', 'approved'].includes(a.status)), openR = R.filter((r) => ['new', 'on_hold', 'invited'].includes(r.status));
  const listA = showAll ? A : openA, listR = showAll ? R : openR;
  const set = (table: string, id: number, status: string, ok: string) => ({ _table: table, _id: String(id), _back: back + (showAll ? '?show=all' : ''), status, _ok: ok });
  const notConnected = apps.error && /does not exist|schema cache/i.test(apps.error.message);
  return (<>
    <Notice searchParams={searchParams} />
    <PageHead eyebrow="GUYS Club" title={<>Who wants <span className="text-pink-ink">in.</span></>} action={<Link className="link" href={showAll ? back : back + '?show=all'}>{showAll ? 'Show open only' : 'Show all, including closed'}</Link>}>
      Applications and I KNOW A GUY recommendations from the website. Every one is also emailed to the GUYS&amp;CO inbox.
    </PageHead>
    {notConnected ? <p className="mb-8 border-2 border-bad p-4 font-semibold">The Club tables are not set up yet. Run supabase/migrations/0003_club.sql in the Supabase SQL Editor.</p> : null}

    <Section eyebrow={`${openA.length} open`} title="Membership applications">
      {listA.length ? <ul className="grid gap-4">{listA.map((a) => (
        <li key={a.id} className="card-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-semibold">{a.name} <Badge status={a.status} /></p><p className="text-[.9rem] text-muted">{a.business_role} · {a.industry} · {day(a.created_at)}</p><p className="text-[.9rem]"><a className="underline" href={`mailto:${a.email}`}>{a.email}</a>{a.phone ? ` · ${a.phone}` : ''}{a.sponsor ? ` · Sponsor: ${a.sponsor}` : ''}</p></div>
            <div className="flex flex-wrap gap-2">
              {a.status !== 'approved' && a.status !== 'invited' ? <Act action={saveRow} tone="pink" fields={set('club_applications', a.id, 'approved', 'Approved. Next: invite them.')}>Approve</Act> : null}
              {a.status === 'approved' && me.role === 'admin' ? <Link className="btn-ghost btn-sm" href={`/admin/members?invite_name=${encodeURIComponent(a.name)}&invite_email=${encodeURIComponent(a.email)}#invite`}>Invite to the Lounge</Link> : null}
              {a.status === 'approved' ? <Act action={saveRow} fields={set('club_applications', a.id, 'invited', 'Marked as invited.')}>Mark invited</Act> : null}
              {a.status === 'new' ? <Act action={saveRow} fields={set('club_applications', a.id, 'closer_look', 'Flagged for a closer look.')}>Closer look</Act> : null}
              {a.status !== 'declined' && a.status !== 'invited' ? <Act action={saveRow} fields={set('club_applications', a.id, 'declined', 'Declined.')}>Decline</Act> : null}
            </div>
          </div>
          <p className="mt-3 font-semibold">What they bring</p><p className="whitespace-pre-line text-[.94rem]">{a.value_offered}</p>
          {a.looking_for ? <><p className="mt-2 font-semibold">Looking for</p><p className="whitespace-pre-line text-[.94rem]">{a.looking_for}</p></> : null}
          {a.notes ? <p className="mt-2 text-[.9rem] text-muted">Notes: {a.notes}</p> : null}
          <div className="mt-2"><Edit table="club_applications" id={String(a.id)} back={back} title="Notes"><textarea name="notes" defaultValue={a.notes ?? ''} rows={3} className="w-full border-2 border-ink p-2" aria-label="Notes" /></Edit></div>
        </li>))}</ul>
        : <Empty>{showAll ? 'No applications yet.' : 'No open applications.'}</Empty>}
    </Section>

    <Section eyebrow={`${openR.length} open`} title="I KNOW A GUY recommendations">
      {listR.length ? <ul className="grid gap-4">{listR.map((r) => (
        <li key={r.id} className="card-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-semibold">{r.candidate_name} <Badge status={r.status} /> <Badge status={r.consent === 'yes' ? 'approved' : 'closer_look'}>{r.consent === 'yes' ? 'Agreed to be introduced' : 'Not yet asked'}</Badge></p>
              <p className="text-[.9rem] text-muted">Recommended by {r.recommender_name} (<a className="underline" href={`mailto:${r.recommender_email}`}>{r.recommender_email}</a>) · {day(r.created_at)}</p>
              {r.candidate_contact ? <p className="text-[.9rem]">Reach them: {r.candidate_contact}</p> : null}</div>
            <div className="flex flex-wrap gap-2">
              {r.status !== 'invited' && r.status !== 'applied' ? <Act action={saveRow} tone="pink" fields={set('club_recommendations', r.id, 'invited', 'Marked as invited to apply.')}>Invited to apply</Act> : null}
              {r.status !== 'applied' ? <Act action={saveRow} fields={set('club_recommendations', r.id, 'applied', 'Marked as applied.')}>They applied</Act> : null}
              {r.status !== 'on_hold' && r.status !== 'applied' ? <Act action={saveRow} fields={set('club_recommendations', r.id, 'on_hold', 'On hold.')}>On hold</Act> : null}
              {r.status !== 'closed' ? <Act action={saveRow} fields={set('club_recommendations', r.id, 'closed', 'Closed.')}>Close</Act> : null}
            </div>
          </div>
          <p className="mt-3 font-semibold">Background</p><p className="whitespace-pre-line text-[.94rem]">{r.background}</p>
          {r.fit ? <><p className="mt-2 font-semibold">Why a good fit</p><p className="whitespace-pre-line text-[.94rem]">{r.fit}</p></> : null}
          {r.value_offered ? <><p className="mt-2 font-semibold">Value they could contribute</p><p className="whitespace-pre-line text-[.94rem]">{r.value_offered}</p></> : null}
          {r.notes ? <p className="mt-2 text-[.9rem] text-muted">Notes: {r.notes}</p> : null}
          <div className="mt-2"><Edit table="club_recommendations" id={String(r.id)} back={back} title="Notes"><textarea name="notes" defaultValue={r.notes ?? ''} rows={3} className="w-full border-2 border-ink p-2" aria-label="Notes" /></Edit></div>
        </li>))}</ul>
        : <Empty>{showAll ? 'No recommendations yet.' : 'No open recommendations.'}</Empty>}
    </Section>
  </>);
}
