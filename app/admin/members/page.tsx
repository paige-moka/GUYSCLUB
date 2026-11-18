import type { Metadata } from 'next';
import Link from 'next/link';
import { AddForm, Badge, Check, Empty, Field, Grid, Notice, PageHead, Pick, Section } from '@/components/ui';
import { Edit, Scroll } from '@/components/admin';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { day, label } from '@/lib/format';
import { inviteUser, saveRow } from '@/app/actions';

export const metadata: Metadata = { title: 'Members and people' };
const ROLES: [string, string][] = [['member', 'Member (client)'], ['specialist', 'Specialist or collaborator'], ['team', 'GUYS&CO team member'], ['admin', 'Administrator']];

export default async function Members({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff(); const sb = await createClient(); const admin = me.role === 'admin'; const back = '/admin/members'; const sp = await searchParams;
  const [{ data: members }, { data: people }, { data: groups }, { data: gm }] = await Promise.all([
    sb.from('members').select('*').order('name'),
    sb.from('profiles').select('*').order('role').order('full_name'),
    sb.from('member_groups').select('id, name').order('name'),
    sb.from('member_group_members').select('group_id, member_id'),
  ]);
  const mem = members ?? []; const opts = mem.map((m) => [m.id, m.name] as [string, string]);
  return (<>
    <Notice searchParams={searchParams} />
    <PageHead eyebrow="Members and people" title={<>Who is in the <span className="text-pink-ink">Club.</span></>}>A member is the client business. People are the logins. Each person has one role, and member logins belong to one business.</PageHead>

    <Section eyebrow="Client businesses" title="Members">
      <AddForm title="Add a member business" action={saveRow} table="members" back={back} submit="Add member">
        <Grid cols={3}><Field name="name" label="Business name" required /><Field name="serial" label="Member serial" placeholder="GC 2026 001" /><Field name="joined_on" label="Member since" type="date" /></Grid>
        <Check name="is_demo" label="This is a demonstration record (clearly labelled as such everywhere)" />
      </AddForm>
      {mem.length ? <Scroll><table className="tbl"><thead><tr><th>Member</th><th>Serial</th><th>Status</th><th>Since</th><th>Logins</th><th></th></tr></thead><tbody>{mem.map((m) => (
        <tr key={m.id}><td className="font-semibold">{m.name} {m.is_demo ? <Badge status="pending">Demo</Badge> : null}</td><td className="font-mono text-[.8rem]">{m.serial}</td><td><Badge status={m.status} /></td><td className="whitespace-nowrap">{day(m.joined_on)}</td><td>{(people ?? []).filter((p) => p.member_id === m.id).length}</td><td className="text-right"><Link className="link" href={`/admin/members/${m.id}`}>Open</Link></td></tr>))}</tbody></table></Scroll>
        : <Empty>No members yet. Add the first one above.</Empty>}
    </Section>

    <Section eyebrow="Logins and permissions" title="People">
      {admin ? <AddForm title="Invite a person" action={inviteUser} back={back} submit="Send invitation" open={!!sp.invite_email}>
        <Grid><Field name="full_name" label="Full name" required defaultValue={sp.invite_name} /><Field name="email" label="Email" type="email" required defaultValue={sp.invite_email} /></Grid>
        <Grid><Pick name="role" label="Role" options={ROLES} defaultValue="member" /><Pick name="member_id" label="Member business (for member logins)" options={opts} blank="None" required={false} /></Grid>
        <Check name="can_view_financials" label="May see financial records (members: their own Ledger. Team: all financial records. Specialists never do.)" defaultChecked />
        <p className="text-[.84rem] text-muted">They receive an email with a link to choose their own password. You never see or set it.</p>
      </AddForm> : <p className="mb-4 text-[.9rem] text-muted">Only an administrator can invite people or change roles.</p>}
      <Scroll><table className="tbl"><thead><tr><th>Person</th><th>Role</th><th>Member business</th><th>Financials</th><th></th></tr></thead><tbody>{(people ?? []).map((p) => (
        <tr key={p.id}><td><b>{p.full_name || 'No name yet'}</b><span className="block text-[.84rem] text-muted">{p.email}</span></td><td><Badge status={p.role === 'admin' ? 'active' : 'x'}>{label(p.role)}</Badge></td>
          <td>{mem.find((m) => m.id === p.member_id)?.name ?? (p.role === 'member' ? <span className="font-semibold text-bad">Not attached: sees nothing</span> : '')}</td>
          <td>{p.role === 'admin' ? 'All' : p.role === 'specialist' ? 'Never' : p.can_view_financials ? (p.role === 'team' ? 'All' : 'Own Ledger') : 'No'}</td>
          <td>{admin && p.id !== me.id ? <Edit table="profiles" id={p.id} back={back} title="Change access">
            <Grid><Field name="full_name" label="Full name" defaultValue={p.full_name} /><Pick name="role" label="Role" options={ROLES} defaultValue={p.role} /></Grid>
            <Pick name="member_id" label="Member business" options={opts} blank="None" required={false} defaultValue={p.member_id} />
            <Check name="can_view_financials" label="May see financial records" defaultChecked={p.can_view_financials} />
          </Edit> : p.id === me.id ? <span className="text-[.8rem] text-muted">You</span> : null}</td></tr>))}</tbody></table></Scroll>
    </Section>

    <Section eyebrow="For restricted Library resources" title="Membership groups">
      <AddForm title="Add a group" action={saveRow} table="member_groups" back={back} submit="Add group"><Field name="name" label="Group name" required /></AddForm>
      {(groups ?? []).length ? <ul className="grid gap-3 md:grid-cols-2">{(groups ?? []).map((g) => { const ids = (gm ?? []).filter((x) => x.group_id === g.id).map((x) => x.member_id); return (
        <li key={g.id} className="card-soft"><p className="font-semibold">{g.name}</p><p className="text-[.9rem] text-muted">{ids.length ? ids.map((i) => mem.find((m) => m.id === i)?.name).join(', ') : 'No members in this group yet'}</p><p className="mt-1 text-[.8rem] text-muted">Add members to a group from the member&apos;s own page.</p></li>); })}</ul>
        : <Empty>No groups yet. Groups let you share a Library resource with several members at once.</Empty>}
    </Section>
  </>);
}
