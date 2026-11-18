import { Shell, type NavItem } from '@/components/Shell';
import { requireStaff, seesMoney } from '@/lib/auth';

export const dynamic = 'force-dynamic'; // never prerendered or cached: every request is checked
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  const items: NavItem[] = [
    { href: '/admin', label: 'Overview', exact: true },
    { href: '/admin/club', label: 'Club applications' },
    { href: '/admin/members', label: 'Members and people' },
    { href: '/admin/projects', label: 'Projects' },
    ...(seesMoney(me) ? [{ href: '/admin/ledger', label: 'The Ledger' }, { href: '/admin/reconciliation', label: 'Reconciliation' }] : []),
    { href: '/admin/three', label: 'Three for Three' },
    { href: '/admin/library', label: 'The Library' },
    { href: '/admin/announcements', label: 'Announcements' },
    { href: '/admin/activity', label: 'Activity' },
  ];
  return <Shell me={me} items={items} groupLabel="GUYS&CO back office">{children}</Shell>;
}
