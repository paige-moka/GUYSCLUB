import type { ReactNode } from 'react';
import { deleteRow, saveRow } from '@/app/actions';
import { label } from '@/lib/format';

/** Change one field of one row from a list (status pickers and the like). */
export function Quick({ table, id, back, name, options, value }: { table: string; id: string; back: string; name: string; options: (string | [string, string])[]; value: string | null }) {
  return (
    <form action={saveRow} className="inline-flex items-center gap-1">
      <input type="hidden" name="_table" value={table} /><input type="hidden" name="_id" value={id} /><input type="hidden" name="_back" value={back} />
      <select name={name} defaultValue={value ?? ''} aria-label={name} className="border border-ink bg-paper px-1.5 py-1 text-[.8rem]">
        {options.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, label(o)]; return <option key={v} value={v}>{t}</option>; })}
      </select>
      <button className="border border-ink px-2 py-1 font-mono text-[.62rem] font-semibold uppercase tracking-[.08em] hover:bg-pink" type="submit">Set</button>
    </form>
  );
}
export function Del({ table, id, back, what = 'Remove' }: { table: string; id: string; back: string; what?: string }) {
  return (
    <form action={deleteRow} className="inline">
      <input type="hidden" name="_table" value={table} /><input type="hidden" name="_id" value={id} /><input type="hidden" name="_back" value={back} />
      <button className="font-mono text-[.62rem] font-semibold uppercase tracking-[.08em] text-bad underline-offset-4 hover:underline" type="submit">{what}</button>
    </form>
  );
}
/** Fold out editor for an existing row. */
export function Edit({ table, id, back, children, title = 'Edit' }: { table: string; id: string; back: string; children: ReactNode; title?: string }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer font-mono text-[.62rem] font-semibold uppercase tracking-[.08em] text-pink-ink">{title}</summary>
      <form action={saveRow} className="mt-2 grid gap-3 border border-line bg-wash/40 p-3">
        <input type="hidden" name="_table" value={table} /><input type="hidden" name="_id" value={id} /><input type="hidden" name="_back" value={back} />
        {children}
        <div><button className="btn btn-sm" type="submit">Save changes</button></div>
      </form>
    </details>
  );
}
export const Scroll = ({ children }: { children: ReactNode }) => <div className="overflow-x-auto">{children}</div>;
