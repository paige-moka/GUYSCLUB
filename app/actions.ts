'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, requireMe } from '@/lib/auth';

/* Every write below runs as the signed in person, so the database's Row Level Security
   makes the final call. The lists here only limit which columns a form may set. */
type Kind = 'text' | 'int' | 'cents' | 'date' | 'bool' | 'uuid';
const T: Record<string, { pk?: string; cols: Record<string, Kind> }> = {
  members: { cols: { name: 'text', serial: 'text', status: 'text', joined_on: 'date', is_demo: 'bool' } },
  profiles: { cols: { full_name: 'text', role: 'text', member_id: 'uuid', can_view_financials: 'bool' } },
  blueprints: { cols: { member_id: 'uuid', title: 'text', summary: 'text' } },
  objectives: { cols: { member_id: 'uuid', title: 'text', detail: 'text', status: 'text', goal_date: 'date', sort: 'int' } },
  recommendations: { cols: { member_id: 'uuid', title: 'text', detail: 'text', built_stage: 'text', status: 'text', sort: 'int' } },
  projects: { cols: { member_id: 'uuid', name: 'text', description: 'text', objectives: 'text', status: 'text', start_date: 'date', due_date: 'date', progress_override: 'int' } },
  project_assignments: { cols: { project_id: 'uuid', profile_id: 'uuid', role_label: 'text' } },
  milestones: { cols: { member_id: 'uuid', project_id: 'uuid', title: 'text', detail: 'text', due_date: 'date', status: 'text', sort: 'int' } },
  tasks: { cols: { member_id: 'uuid', project_id: 'uuid', title: 'text', detail: 'text', owner_type: 'text', due_date: 'date', status: 'text' } },
  project_updates: { cols: { project_id: 'uuid', member_id: 'uuid', body: 'text' } },
  documents: { cols: { member_id: 'uuid', project_id: 'uuid', title: 'text', storage_path: 'text', file_name: 'text', mime: 'text', size_bytes: 'int' } },
  blueprint_versions: { cols: { member_id: 'uuid', version_label: 'text', notes: 'text', storage_path: 'text', file_name: 'text', size_bytes: 'int' } },
  library_resources: { cols: { title: 'text', description: 'text', category: 'text', kind: 'text', storage_path: 'text', file_name: 'text', size_bytes: 'int', external_url: 'text', audience: 'text', published: 'bool' } },
  library_access: { cols: { resource_id: 'uuid', member_id: 'uuid', group_id: 'uuid' } },
  member_groups: { cols: { name: 'text' } },
  fundraising_campaigns: { cols: { name: 'text', description: 'text', kind: 'text', goal_cents: 'cents', starts_on: 'date', ends_on: 'date', status: 'text', is_demo: 'bool' } },
  campaign_milestones: { cols: { campaign_id: 'uuid', title: 'text', amount_cents: 'cents', note: 'text' } },
  campaign_updates: { cols: { campaign_id: 'uuid', title: 'text', body: 'text', storage_path: 'text', file_name: 'text' } },
  project_funding: { pk: 'project_id', cols: { project_id: 'uuid', goal_cents: 'cents', note: 'text' } },
  financial_transactions: { cols: { member_id: 'uuid', project_id: 'uuid', campaign_id: 'uuid', kind: 'text', amount_cents: 'cents', status: 'text', reference: 'text', description: 'text', occurred_on: 'date' } },
  payment_links: { cols: { label: 'text', url: 'text', placement: 'text', active: 'bool' } },
  tft_program: { cols: { label: 'text', description: 'text', required_count: 'int', period_note: 'text', is_configured: 'bool' } },
  tft_criteria: { cols: { title: 'text', description: 'text', active: 'bool', sort: 'int' } },
  tft_records: { cols: { member_id: 'uuid', criterion_id: 'uuid', title: 'text', detail: 'text', status: 'text', due_date: 'date', decision_note: 'text' } },
  announcements: { cols: { title: 'text', body: 'text', member_id: 'uuid', published: 'bool' } },
  inquiries: { cols: { handled: 'bool' } },
  club_applications: { cols: { status: 'text', notes: 'text' } },
  club_recommendations: { cols: { status: 'text', notes: 'text' } },
};

function parse(kind: Kind, raw: FormDataEntryValue | null): unknown {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (kind === 'bool') return s === 'true' || s === 'on';
  if (s === '') return null;
  if (kind === 'int') { const n = Number(s); if (!Number.isInteger(n)) throw new Error('Please enter a whole number.'); return n; }
  if (kind === 'cents') {
    const n = Number(s.replace(/[$,\s]/g, ''));
    if (!Number.isFinite(n) || n <= 0) throw new Error('Please enter an amount above zero, for example 2500 or 2500.00');
    return Math.round(n * 100);
  }
  if (kind === 'uuid' && !/^[0-9a-f-]{36}$/i.test(s)) throw new Error('That selection is not valid.');
  if (kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Please use a valid date.');
  return s;
}
const safeBack = (fd: FormData, fallback = '/portal') => { const b = String(fd.get('_back') || fallback); return b.startsWith('/') && !b.startsWith('//') ? b : fallback; };
function done(back: string, msg: { ok?: string; error?: string }): never {
  const [path, hash] = back.split('#'); const u = new URL(path, 'http://x');
  u.searchParams.delete('ok'); u.searchParams.delete('error');
  if (msg.error) u.searchParams.set('error', msg.error); else u.searchParams.set('ok', msg.ok ?? 'Saved.');
  revalidatePath(u.pathname);
  redirect(u.pathname + u.search + (hash ? '#' + hash : ''));
}
const friendly = (m: string) =>
  /row-level security|permission denied/i.test(m) ? 'You do not have permission to do that.'
  : /duplicate key/i.test(m) ? 'That already exists.'
  : /violates foreign key/i.test(m) ? 'That is still linked to other records, so it was left in place.'
  : /confirmed_needs_proof/i.test(m) ? 'A confirmed entry needs a reference (Stripe ID, e-transfer or cheque number).'
  : /violates check constraint/i.test(m) ? 'One of the values is not allowed. Please check the form.'
  : m;

/** Create or update one row. Hidden fields: _table, _back and, when editing, _id. */
export async function saveRow(fd: FormData) {
  await requireMe();
  const back = safeBack(fd, '/admin'); const table = String(fd.get('_table')); const spec = T[table];
  if (!spec) done(back, { error: 'Unknown form.' });
  const id = fd.get('_id') ? String(fd.get('_id')) : null; const pk = spec.pk ?? 'id';
  const row: Record<string, unknown> = {};
  try {
    for (const [col, kind] of Object.entries(spec.cols)) {
      if (!fd.has(col)) continue;
      const all = fd.getAll(col); row[col] = parse(kind, all[all.length - 1]);
    }
  } catch (e) { done(back, { error: (e as Error).message }); }
  if (table === 'financial_transactions' && row.status && !['pledged', 'pending'].includes(String(row.status))) done(back, { error: 'New entries start as pledged or pending. Confirm them once the funds are verified.' });
  const sb = await createClient();
  const q = table === 'tft_program' ? sb.from(table).update(row).eq('id', 1).select(pk)
    : spec.pk && !id ? sb.from(table).upsert(row).select(pk)
    : id ? sb.from(table).update(row).eq(pk, id).select(pk)
    : sb.from(table).insert(row).select(pk);
  const { data, error } = await q;
  if (error) done(back, { error: friendly(error.message) });
  if (!data || data.length === 0) done(back, { error: 'Nothing was changed. You may not have permission for that record.' });
  done(back, { ok: String(fd.get('_ok') || 'Saved.') });
}

export async function deleteRow(fd: FormData) {
  await requireMe();
  const back = safeBack(fd, '/admin'); const table = String(fd.get('_table')); const spec = T[table];
  if (!spec || ['financial_transactions', 'profiles', 'tft_program', 'inquiries', 'club_applications', 'club_recommendations'].includes(table)) done(back, { error: 'That cannot be deleted.' });
  const sb = await createClient(); const id = String(fd.get('_id'));
  // remove the stored file with the record
  if (['documents', 'blueprint_versions', 'library_resources', 'campaign_updates'].includes(table)) {
    const { data: r } = await sb.from(table).select('storage_path').eq('id', id).maybeSingle();
    if (r?.storage_path) await sb.storage.from(table === 'documents' || table === 'blueprint_versions' ? 'member-files' : 'library').remove([r.storage_path]);
  }
  const { data, error } = await sb.from(table).delete().eq(spec.pk ?? 'id', id).select(spec.pk ?? 'id');
  if (error) done(back, { error: friendly(error.message) });
  if (!data?.length) done(back, { error: 'Nothing was removed. You may not have permission for that record.' });
  done(back, { ok: 'Removed.' });
}

/* ---------------- members: the few things a member can change ---------------- */
export async function setTaskStatus(fd: FormData) {
  await requireMe(); const back = safeBack(fd);
  const status = String(fd.get('status')); if (!['todo', 'in_progress', 'done'].includes(status)) done(back, { error: 'Unknown status.' });
  const sb = await createClient();
  const { data, error } = await sb.from('tasks').update({ status }).eq('id', String(fd.get('id'))).select('id');
  if (error || !data?.length) done(back, { error: error ? friendly(error.message) : 'That action belongs to someone else.' });
  done(back, { ok: status === 'done' ? 'Marked as done. Thank you.' : 'Updated.' });
}
export async function setMilestoneStatus(fd: FormData) {
  await requireMe(); const back = safeBack(fd);
  const status = String(fd.get('status')); if (!['upcoming', 'in_progress', 'done', 'missed'].includes(status)) done(back, { error: 'Unknown status.' });
  const sb = await createClient();
  const { data, error } = await sb.from('milestones').update({ status }).eq('id', String(fd.get('id'))).select('id');
  if (error || !data?.length) done(back, { error: error ? friendly(error.message) : 'You do not have permission to do that.' });
  done(back, { ok: 'Updated.' });
}
/** Member hands in a Three for Three item: either an outstanding one, or a new one for review. */
export async function submitTft(fd: FormData) {
  const me = await requireMe(); const back = safeBack(fd, '/portal/three'); const sb = await createClient();
  const detail = String(fd.get('detail') || '').trim() || null;
  if (fd.get('id')) {
    const { data, error } = await sb.from('tft_records').update({ status: 'submitted', detail }).eq('id', String(fd.get('id'))).select('id');
    if (error || !data?.length) done(back, { error: error ? friendly(error.message) : 'That item could not be submitted.' });
  } else {
    const title = String(fd.get('title') || '').trim(); if (!title || !me.member_id) done(back, { error: 'Please describe what you completed.' });
    const criterion = String(fd.get('criterion_id') || '') || null;
    const { error } = await sb.from('tft_records').insert({ member_id: me.member_id, criterion_id: criterion, title, detail, status: 'submitted', created_by: me.id });
    if (error) done(back, { error: friendly(error.message) });
  }
  done(back, { ok: 'Submitted for review.' });
}
export async function updateMyName(fd: FormData) {
  const me = await requireMe(); const sb = await createClient();
  const { error } = await sb.from('profiles').update({ full_name: String(fd.get('full_name') || '').trim().slice(0, 120) }).eq('id', me.id);
  done(safeBack(fd), error ? { error: friendly(error.message) } : { ok: 'Saved.' });
}

/* ---------------- finance: confirm and void, never edit or delete ---------------- */
export async function confirmTransaction(fd: FormData) {
  await requireMe(); const back = safeBack(fd, '/admin/ledger'); const reference = String(fd.get('reference') || '').trim();
  if (!reference) done(back, { error: 'Add the reference that proves the funds arrived (Stripe ID, e-transfer or cheque number).' });
  const sb = await createClient();
  const { data, error } = await sb.from('financial_transactions').update({ status: 'confirmed', reference }).eq('id', String(fd.get('id'))).in('status', ['pledged', 'pending']).select('id');
  if (error || !data?.length) done(back, { error: error ? friendly(error.message) : 'That entry could not be confirmed.' });
  done(back, { ok: 'Confirmed as received.' });
}
export async function voidTransaction(fd: FormData) {
  await requireMe(); const back = safeBack(fd, '/admin/ledger'); const reason = String(fd.get('void_reason') || '').trim();
  if (!reason) done(back, { error: 'Please give a reason for voiding this entry.' });
  const sb = await createClient();
  const { data, error } = await sb.from('financial_transactions').update({ status: 'void', void_reason: reason }).eq('id', String(fd.get('id'))).select('id');
  if (error || !data?.length) done(back, { error: error ? friendly(error.message) : 'That entry could not be voided.' });
  done(back, { ok: 'Entry voided. It stays in the record.' });
}
export async function assignPayment(fd: FormData) {
  await requireMe(); const back = safeBack(fd, '/admin/ledger'); const sb = await createClient();
  const member_id = String(fd.get('member_id') || '') || null;
  const { data, error } = await sb.from('financial_transactions').update({ member_id }).eq('id', String(fd.get('id'))).is('member_id', null).select('id');
  if (error || !data?.length) done(back, { error: error ? friendly(error.message) : 'That payment could not be assigned.' });
  done(back, { ok: 'Payment matched to the member.' });
}

/* ---------------- administrators: invite a person ---------------- */
export async function inviteUser(fd: FormData) {
  await requireAdmin(); const back = safeBack(fd, '/admin/members');
  const email = String(fd.get('email') || '').trim().toLowerCase(), full_name = String(fd.get('full_name') || '').trim();
  const role = String(fd.get('role') || 'member'), member_id = String(fd.get('member_id') || '') || null;
  const money = fd.getAll('can_view_financials').pop() === 'true';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) done(back, { error: 'Please enter a valid email address.' });
  if (!['admin', 'team', 'specialist', 'member'].includes(role)) done(back, { error: 'Unknown role.' });
  if (role === 'member' && !member_id) done(back, { error: 'Choose which member business this person belongs to.' });
  const admin = createAdminClient();
  if (!admin) done(back, { error: 'Invites are not connected yet. Add SUPABASE_SERVICE_ROLE_KEY in Vercel (see README).' });
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name }, redirectTo: `${site}/auth/accept` });
  if (error || !data.user) done(back, { error: error?.message ?? 'The invitation could not be sent.' });
  const { error: e2 } = await admin.from('profiles').update({
    full_name, role, member_id: role === 'member' ? member_id : null,
    can_view_financials: role === 'admin' ? true : role === 'specialist' ? false : money,
  }).eq('id', data.user.id);
  if (e2) done(back, { error: 'Invitation sent, but the role could not be set: ' + e2.message });
  done(back, { ok: `Invitation sent to ${email}.` });
}

export async function setGroup(fd: FormData) {
  await requireMe(); const back = safeBack(fd, '/admin/members'); const sb = await createClient();
  const row = { group_id: String(fd.get('group_id')), member_id: String(fd.get('member_id')) };
  const { error } = fd.get('remove') ? await sb.from('member_group_members').delete().match(row) : await sb.from('member_group_members').upsert(row);
  done(back, error ? { error: friendly(error.message) } : { ok: 'Saved.' });
}
