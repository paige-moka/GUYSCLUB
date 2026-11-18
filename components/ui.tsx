import type { ReactNode } from 'react';
import Link from 'next/link';
import { label, money, pct } from '@/lib/format';

export function PageHead({ eyebrow, title, children, action }: { eyebrow: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-6">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-[clamp(2.2rem,5vw,3.6rem)]">{title}</h1>
        {children ? <div className="mt-3 max-w-[62ch] text-muted">{children}</div> : null}
      </div>
      {action}
    </header>
  );
}

export function Section({ title, eyebrow, children, action, id }: { title: string; eyebrow?: string; children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <section id={id} className="mb-10 scroll-mt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>{eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}<h2 className="text-[1.7rem]">{title}</h2></div>
        {action}
      </div>
      {children}
    </section>
  );
}

const TONE: Record<string, string> = {
  done: 'bg-good text-white border-good', complete: 'bg-good text-white border-good', confirmed: 'bg-good text-white border-good', approved: 'bg-good text-white border-good', achieved: 'bg-good text-white border-good',
  active: 'bg-pink text-ink border-pink', in_progress: 'bg-pink text-ink border-pink', submitted: 'bg-pink text-ink border-pink', new: 'bg-pink text-ink border-pink', invited: 'bg-good text-white border-good', applied: 'bg-good text-white border-good', closer_look: 'bg-paper text-hold border-hold border-dashed', open: 'bg-pink text-ink border-pink',
  pledged: 'bg-paper text-hold border-hold border-dashed', pending: 'bg-paper text-hold border-hold', on_hold: 'bg-paper text-hold border-hold', outstanding: 'bg-paper text-hold border-hold', paused: 'bg-paper text-hold border-hold',
  missed: 'bg-bad text-white border-bad', declined: 'bg-paper text-bad border-bad', void: 'bg-paper text-muted border-line line-through', cancelled: 'bg-paper text-muted border-line',
};
export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap border px-2 py-0.5 font-mono text-[.64rem] font-semibold uppercase tracking-[.1em] ${TONE[status] ?? 'bg-paper text-ink border-ink'}`}>{children ?? label(status)}</span>;
}

export function Bar({ value, tone = 'pink', labelText }: { value: number; tone?: 'pink' | 'good'; labelText?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={labelText ?? 'Progress'} className="h-3 w-full border border-ink bg-paper">
      <div className={`h-full ${tone === 'good' ? 'bg-good' : 'bg-pink'}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Stat({ k, v, note, dark }: { k: string; v: ReactNode; note?: ReactNode; dark?: boolean }) {
  return (
    <div className={`grid content-start gap-1 p-4 ${dark ? 'bg-ink text-white' : 'bg-wash'}`}>
      <span className={`font-mono text-[.64rem] uppercase tracking-[.12em] ${dark ? 'text-pink' : 'text-muted'}`}>{k}</span>
      <b className="num font-display text-[2rem] font-normal leading-none">{v}</b>
      {note ? <span className={`text-[.82rem] ${dark ? 'text-night-muted' : 'text-muted'}`}>{note}</span> : null}
    </div>
  );
}

/** Goal progress that never blends promised money with money received. */
export function GoalMeter({ goal, confirmed, pledged = 0, pending = 0 }: { goal: number; confirmed: number; pledged?: number; pending?: number }) {
  const c = pct(confirmed, goal), pl = Math.min(100 - c, pct(pledged + pending, goal));
  const remaining = Math.max(0, goal - confirmed);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="num font-display text-[clamp(2.6rem,7vw,4rem)] leading-none text-pink-ink">{money(confirmed)}</p>
        <p className="text-right text-[.95rem] text-muted"><b className="num text-ink">{c}%</b> of the {money(goal)} goal<br />confirmed as received</p>
      </div>
      <div className="flex h-5 w-full border-2 border-ink bg-paper" role="img" aria-label={`${c} percent confirmed. ${money(pledged + pending)} pledged or pending, not yet received. ${money(remaining)} remaining.`}>
        <div className="h-full bg-pink" style={{ width: `${c}%` }} />
        <div className="h-full" style={{ width: `${pl}%`, backgroundImage: 'repeating-linear-gradient(135deg,#D77FA6 0 6px,transparent 6px 12px)' }} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[.86rem]">
        <span><i className="mr-2 inline-block h-3 w-3 bg-pink align-middle" />Confirmed received <b className="num">{money(confirmed)}</b></span>
        <span><i className="mr-2 inline-block h-3 w-3 border border-pink-mid align-middle" style={{ backgroundImage: 'repeating-linear-gradient(135deg,#D77FA6 0 3px,transparent 3px 6px)' }} />Pledged or pending, not received <b className="num">{money(pledged + pending)}</b></span>
        <span><i className="mr-2 inline-block h-3 w-3 border border-ink align-middle" />Remaining <b className="num">{money(remaining)}</b></span>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-line bg-wash/50 p-5 text-[.95rem] text-muted">{children}</p>;
}

export async function Notice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const ok = sp.ok, err = sp.error;
  if (!ok && !err) return null;
  return <p role="status" className={`mb-6 border-2 p-3 text-[.95rem] font-semibold ${err ? 'border-bad text-bad' : 'border-good text-good'}`}>{String(err ?? ok)}</p>;
}

export function DemoFlag({ show }: { show: boolean }) {
  return show ? <p className="mb-6 border-2 border-dashed border-hold bg-paper p-3 font-mono text-[.72rem] uppercase tracking-[.12em] text-hold">Demonstration data. Nothing on this page is a real record.</p> : null;
}

/* ---------- forms (plain HTML forms posting to server actions) ---------- */
type F = { name: string; label: string; required?: boolean; defaultValue?: string | number | null; placeholder?: string; help?: string };
export function Field({ name, label: l, required, defaultValue, placeholder, help, type = 'text', step, min }: F & { type?: string; step?: string; min?: string }) {
  return (
    <label className="block min-w-0">
      <span className="label">{l}{required ? '' : <span className="font-normal normal-case tracking-normal text-muted"> (optional)</span>}</span>
      <input className="input" name={name} type={type} required={required} defaultValue={defaultValue ?? ''} placeholder={placeholder} step={step} min={min} />
      {help ? <span className="mt-1 block text-[.78rem] text-muted">{help}</span> : null}
    </label>
  );
}
export function Area({ name, label: l, required, defaultValue, placeholder, rows = 3 }: F & { rows?: number }) {
  return (
    <label className="block min-w-0">
      <span className="label">{l}{required ? '' : <span className="font-normal normal-case tracking-normal text-muted"> (optional)</span>}</span>
      <textarea className="input" name={name} rows={rows} required={required} defaultValue={defaultValue ?? ''} placeholder={placeholder} />
    </label>
  );
}
export function Pick({ name, label: l, options, defaultValue, required = true, blank }: { name: string; label: string; options: (string | [string, string])[]; defaultValue?: string | null; required?: boolean; blank?: string }) {
  return (
    <label className="block min-w-0">
      <span className="label">{l}</span>
      <select className="input" name={name} defaultValue={defaultValue ?? ''} required={required}>
        {blank !== undefined ? <option value="">{blank}</option> : null}
        {options.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, label(o)]; return <option key={v} value={v}>{t}</option>; })}
      </select>
    </label>
  );
}
export function Check({ name, label: l, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-2 text-[.92rem]">
      <input type="hidden" name={name} value="false" />
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="mt-1 h-4 w-4 accent-pink-ink" />
      <span>{l}</span>
    </label>
  );
}
/** A fold out form, so admin pages stay calm until you need to add something. */
export function AddForm({ title, action, children, table, back, hidden = {}, submit = 'Save', open }: { title: string; action: (fd: FormData) => Promise<void>; children: ReactNode; table?: string; back: string; hidden?: Record<string, string | null | undefined>; submit?: string; open?: boolean }) {
  return (
    <details className="mb-4 border-2 border-ink bg-paper" open={open}>
      <summary className="cursor-pointer select-none px-4 py-3 font-mono text-[.74rem] font-semibold uppercase tracking-[.12em] hover:bg-wash">+ {title}</summary>
      <form action={action} className="grid gap-4 border-t-2 border-ink p-4">
        {table ? <input type="hidden" name="_table" value={table} /> : null}
        <input type="hidden" name="_back" value={back} />
        {Object.entries(hidden).map(([k, v]) => (v != null ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        {children}
        <div><button className="btn" type="submit">{submit}</button></div>
      </form>
    </details>
  );
}
/** One small button that posts a few hidden values (status changes, deletes). */
export function Act({ action, fields, children, tone = 'ghost', confirmNote }: { action: (fd: FormData) => Promise<void>; fields: Record<string, string>; children: ReactNode; tone?: 'ghost' | 'pink' | 'dark'; confirmNote?: string }) {
  return (
    <form action={action} className="inline">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" title={confirmNote} className={`${tone === 'pink' ? 'btn' : tone === 'dark' ? 'btn-dark' : 'btn-ghost'} btn-sm`}>{children}</button>
    </form>
  );
}
export const Grid = ({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) =>
  <div className={`grid gap-4 ${cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>{children}</div>;
export const Back = ({ href, children }: { href: string; children: ReactNode }) =>
  <Link href={href} className="link mb-5 inline-block">← {children}</Link>;
export const Dl = ({ href, children }: { href: string; children: ReactNode }) =>
  <a href={href} className="link whitespace-nowrap" target="_blank" rel="noopener">{children}</a>;
