import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Me } from '@/lib/auth';
import { label } from '@/lib/format';
import { NavLinks } from './NavLinks';

export type NavItem = { href: string; label: string; exact?: boolean };

/** The Lounge frame: black rail in the site's own look, white working area. */
export function Shell({ me, items, groupLabel, secondary, children }: { me: Me; items: NavItem[]; groupLabel: string; secondary?: { label: string; items: NavItem[] }; children: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a href="#main" className="absolute left-[-9999px] top-0 z-50 bg-pink px-3 py-2 font-mono text-xs uppercase focus:left-4 focus:top-4">Skip to content</a>
      <aside className="bg-night text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 border-b border-night-line px-5 py-4">
          <Link href="/" className="flex items-center gap-3 no-underline" aria-label="GUYS&CO website">
            <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-full border-2 border-white bg-pink text-center font-display text-[.72rem] leading-none text-ink" style={{ boxShadow: '0 0 0 3px #FFA3CB' }}>G&amp;<br />CO</span>
            <span className="font-display text-[1.3rem] tracking-wide">GUYS<i className="not-italic text-pink">&amp;</i>CO</span>
          </Link>
        </div>
        <div className="px-5 py-4">
          <p className="font-mono text-[.62rem] uppercase tracking-[.16em] text-pink">The Member Lounge</p>
          <p className="mt-1 truncate font-semibold">{me.member?.name ?? (me.full_name || me.email)}</p>
          <p className="font-mono text-[.66rem] uppercase tracking-[.12em] text-night-muted">{me.member?.serial ? `Serial ${me.member.serial}` : label(me.role)}</p>
        </div>
        <NavLinks groupLabel={groupLabel} items={items} secondary={secondary} />
        <div className="border-t border-night-line px-5 py-4 text-[.86rem] text-night-muted">
          <p className="truncate">{me.full_name || me.email}</p>
          <form action="/auth/signout" method="post"><button className="mt-2 font-mono text-[.68rem] uppercase tracking-[.12em] text-pink underline-offset-4 hover:underline" type="submit">Sign out</button></form>
        </div>
      </aside>
      <main id="main" className="min-w-0 px-[clamp(16px,4vw,48px)] py-[clamp(24px,4vw,48px)]">
        <div className="mx-auto max-w-[1080px]">{children}</div>
      </main>
    </div>
  );
}
