'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { NavItem } from './Shell';

export function NavLinks({ groupLabel, items, secondary }: { groupLabel: string; items: NavItem[]; secondary?: { label: string; items: NavItem[] } }) {
  const path = usePathname(); const [open, setOpen] = useState(false);
  const list = (label: string, its: NavItem[]) => (
    <div className="mb-4">
      <p className="px-5 pb-1 font-mono text-[.6rem] uppercase tracking-[.16em] text-night-muted">{label}</p>
      <ul>
        {its.map((i) => {
          const on = i.exact ? path === i.href : path === i.href || path.startsWith(i.href + '/');
          return (
            <li key={i.href}>
              <Link href={i.href} onClick={() => setOpen(false)} aria-current={on ? 'page' : undefined}
                className={`block border-l-4 px-5 py-2.5 text-[.95rem] no-underline ${on ? 'border-pink bg-[#151012] font-semibold text-white' : 'border-transparent text-night-muted hover:text-white'}`}>{i.label}</Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
  return (
    <nav aria-label="Lounge">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mx-5 mb-3 border-2 border-night-line px-3 py-2 font-mono text-[.7rem] font-semibold uppercase tracking-[.12em] text-white lg:hidden">{open ? 'Close menu' : 'Menu'}</button>
      <div className={`${open ? 'block' : 'hidden'} lg:block`}>
        {list(groupLabel, items)}
        {secondary ? list(secondary.label, secondary.items) : null}
      </div>
    </nav>
  );
}
