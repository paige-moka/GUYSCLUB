export const money = (cents: number | null | undefined, currency = 'CAD') =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency, maximumFractionDigits: (cents ?? 0) % 100 === 0 ? 0 : 2 }).format((cents ?? 0) / 100);
export const day = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: d.length <= 10 ? 'UTC' : 'America/Edmonton' }).format(new Date(d)) : '';
export const pct = (part: number, whole: number) => (whole > 0 ? Math.max(0, Math.min(100, Math.round((part / whole) * 100))) : 0);
export const isLate = (due: string | null | undefined, done: boolean) => !!due && !done && due < new Date().toISOString().slice(0, 10);
export const size = (b: number | null | undefined) => !b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
const LABELS: Record<string, string> = {
  todo: 'To do', in_progress: 'In progress', done: 'Done', upcoming: 'Upcoming', missed: 'Missed', planning: 'Planning', active: 'Active',
  on_hold: 'On hold', complete: 'Complete', cancelled: 'Cancelled', pledged: 'Pledged', pending: 'Pending', confirmed: 'Confirmed', void: 'Void',
  outstanding: 'Outstanding', submitted: 'Submitted', approved: 'Approved', declined: 'Declined', open: 'Open', achieved: 'Achieved', parked: 'Parked',
  new: 'New', closer_look: 'Closer look', invited: 'Invited', applied: 'Applied', yes: 'Agreed', not_yet: 'Not yet asked',
  draft: 'Draft', closed: 'Closed', paused: 'Paused', alumni: 'Alumni', contribution: 'Contribution', project_funding: 'Project funding', fee: 'Fee',
  refund: 'Refund', member: 'Member', guysco: 'GUYS&CO', specialist: 'Specialist', admin: 'Administrator', team: 'Team member',
  document: 'Document', template: 'Template', guide: 'Guide', resource: 'Resource', training: 'Training', manual: 'Entered by team', stripe: 'Stripe (verified)',
};
export const label = (s: string | null | undefined) => (s ? LABELS[s] ?? s : '');
/** Progress of a project: a manual figure if the team set one, otherwise finished tasks and milestones over all of them. */
export function progressOf(p: { progress_override: number | null; status: string }, items: { status: string }[]) {
  if (p.status === 'complete') return 100;
  if (p.progress_override != null) return p.progress_override;
  return pct(items.filter((i) => i.status === 'done').length, items.length);
}
/** Confirmed money only. Refunds reduce it. Pledged and pending are reported separately and never added in. */
export function sums(rows: { status: string; kind: string; amount_cents: number }[]) {
  let confirmed = 0, pledged = 0, pending = 0;
  for (const r of rows) {
    if (r.status === 'confirmed') confirmed += r.kind === 'refund' ? -r.amount_cents : r.amount_cents;
    else if (r.kind !== 'refund' && r.status === 'pledged') pledged += r.amount_cents;
    else if (r.kind !== 'refund' && r.status === 'pending') pending += r.amount_cents;
  }
  return { confirmed, pledged, pending };
}
