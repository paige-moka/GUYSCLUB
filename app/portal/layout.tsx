import { redirect } from 'next/navigation';
import { Shell, type NavItem } from '@/components/Shell';
import { isStaff, requireMe, seesMoney } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'; // never prerendered or cached: every request is checked
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  if (isStaff(me)) redirect('/admin');
  const sb = await createClient();
  const { data: prog } = await sb.from('tft_program').select('label').eq('id', 1).maybeSingle();
  const items: NavItem[] = me.role === 'specialist'
    ? [{ href: '/portal/projects', label: 'My Projects' }, { href: '/portal/library', label: 'The Library' }]
    : me.member ? [
        { href: '/portal', label: 'Dashboard', exact: true },
        { href: '/portal/blueprint', label: 'My Blueprint' },
        { href: '/portal/projects', label: 'My Projects' },
        ...(seesMoney(me) ? [{ href: '/portal/ledger', label: 'The Ledger' }] : []),
        { href: '/portal/reconciliation', label: 'Reconciliation' },
        { href: '/portal/three', label: prog?.label ?? 'Three for Three' },
        { href: '/portal/library', label: 'The Library' },
      ] : [{ href: '/portal', label: 'Welcome', exact: true }];
  return <Shell me={me} items={items} groupLabel={me.role === 'specialist' ? 'Specialist' : 'My Lounge'}>{children}</Shell>;
}
