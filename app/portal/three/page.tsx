import type { Metadata } from 'next';
import { Act, AddForm, Area, Badge, DemoFlag, Empty, Field, Notice, PageHead, Pick, Section } from '@/components/ui';
import { requireMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, isLate, label } from '@/lib/format';
import { submitTft } from '@/app/actions';

export const metadata: Metadata = { title: 'Three for Three' };

export default async function Three({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMember(); const m = me.member.id; const sb = await createClient();
  const [{ data: prog }, { data: criteria }, { data: records }, { data: history }] = await Promise.all([
    sb.from('tft_program').select('*').eq('id', 1).maybeSingle(),
    sb.from('tft_criteria').select('id, title, description').eq('active', true).order('sort'),
    sb.from('tft_records').select('*').eq('member_id', m).order('created_at'),
    sb.from('tft_history').select('id, record_id, from_status, to_status, actor_name, at').eq('member_id', m).order('at', { ascending: false }).limit(30),
  ]);
  const name = prog?.label ?? 'Three for Three', need = prog?.required_count ?? 3, r = records ?? [];
  const approved = r.filter((x) => x.status === 'approved'), open = r.filter((x) => x.status === 'outstanding'), review = r.filter((x) => x.status === 'submitted'), declined = r.filter((x) => x.status === 'declined');
  const got = Math.min(approved.length, need), complete = approved.length >= need;
  const title = (id: string) => r.find((x) => x.id === id)?.title ?? 'Item';

  return (<>
    <Notice searchParams={searchParams} />
    <DemoFlag show={me.member.is_demo} />
    <PageHead eyebrow="Club status" title={name}>{prog?.description}</PageHead>
    {!prog?.is_configured ? <Empty>The rules for {name} are being finalized by the GUYS&amp;CO team. Your status will be tracked here as soon as they are published.</Empty> : <>
      <div className="mb-10 grid gap-5 border-2 border-ink p-5 shadow-stamp md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <p className="num font-display text-[5rem] leading-none">{got}<span className="text-pink-ink"> / {need}</span></p>
        <div className="grid gap-3">
          <div className="flex gap-2" role="img" aria-label={`${got} of ${need} approved`}>{Array.from({ length: need }).map((_, i) => <span key={i} className={`h-5 flex-1 border-2 border-ink ${i < got ? 'bg-pink' : i < got + review.length ? 'bg-wash' : 'bg-paper'}`} />)}</div>
          <p className="flex flex-wrap items-center gap-3"><Badge status={complete ? 'done' : 'in_progress'}>{complete ? 'Complete' : 'In progress'}</Badge><span className="text-[.95rem] text-muted">{approved.length} approved · {review.length} in review · {open.length} outstanding</span></p>
          {prog.period_note ? <p className="text-[.9rem] text-muted">{prog.period_note}</p> : null}
        </div>
      </div>

      <Section eyebrow="The rules" title="What counts">
        {(criteria ?? []).length ? <ul className="grid gap-3 md:grid-cols-2">{(criteria ?? []).map((c) => (<li key={c.id} className="card-soft border-t-4 border-t-pink"><p className="font-semibold">{c.title}</p>{c.description ? <p className="mt-1 text-[.94rem] text-muted">{c.description}</p> : null}</li>))}</ul> : <Empty>The qualifying actions have not been published yet.</Empty>}
      </Section>

      <Section eyebrow="Needs your attention" title="Outstanding">
        {open.length ? <ul className="grid gap-3">{open.map((x) => (
          <li key={x.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{x.title}</p>{x.due_date ? <p className={`font-mono text-[.66rem] uppercase tracking-[.1em] ${isLate(x.due_date, false) ? 'text-bad' : 'text-muted'}`}>{isLate(x.due_date, false) ? 'Overdue · was due' : 'Due'} {day(x.due_date)}</p> : null}</div><Badge status="outstanding" /></div>
            <form action={submitTft} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <input type="hidden" name="id" value={x.id} /><input type="hidden" name="_back" value="/portal/three" />
              <label className="block"><span className="label">Note for the team <span className="font-normal normal-case tracking-normal text-muted">(optional)</span></span><input className="input" name="detail" defaultValue={x.detail ?? ''} /></label>
              <button className="btn" type="submit">Submit as done</button>
            </form>
          </li>))}</ul> : <Empty>Nothing outstanding.</Empty>}
        <div className="mt-4"><AddForm title="Report something you completed" action={submitTft} back="/portal/three" submit="Submit for review">
          <Field name="title" label="What did you complete?" required />
          {(criteria ?? []).length ? <Pick name="criterion_id" label="Which rule does it count toward?" required={false} blank="Not sure" options={(criteria ?? []).map((c) => [c.id, c.title] as [string, string])} /> : null}
          <Area name="detail" label="Details" />
        </AddForm></div>
      </Section>

      <Section eyebrow="Your record" title="Submitted and decided">
        {[...review, ...approved, ...declined].length ? <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Action</th><th>Status</th><th>Submitted</th><th>Decided</th><th>Note from the team</th></tr></thead>
          <tbody>{[...review, ...approved, ...declined].map((x) => (<tr key={x.id}><td className="font-semibold">{x.title}{x.detail ? <span className="block text-[.86rem] font-normal text-muted">{x.detail}</span> : null}</td><td><Badge status={x.status} /></td><td className="whitespace-nowrap">{day(x.submitted_at)}</td><td className="whitespace-nowrap">{day(x.decided_at)}</td><td className="text-muted">{x.decision_note}</td></tr>))}</tbody></table></div>
          : <Empty>Nothing submitted yet.</Empty>}
      </Section>

      <Section eyebrow="Every change, kept" title="Progress history">
        {(history ?? []).length ? <ul className="border-t-2 border-ink">{(history ?? []).map((h) => (
          <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2.5 text-[.92rem]"><span><b>{title(h.record_id)}</b> {h.from_status ? <>moved from {label(h.from_status).toLowerCase()} to {label(h.to_status).toLowerCase()}</> : <>added as {label(h.to_status).toLowerCase()}</>}</span><span className="font-mono text-[.64rem] uppercase tracking-[.1em] text-muted">{day(h.at)}{h.actor_name ? ` · ${h.actor_name}` : ''}</span></li>))}</ul>
          : <Empty>No history yet.</Empty>}
      </Section>
    </>}
  </>);
}
