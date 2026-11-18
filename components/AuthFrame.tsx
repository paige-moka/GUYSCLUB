import type { ReactNode } from 'react';
import Link from 'next/link';
export function AuthFrame({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <main className="grid min-h-screen bg-night text-white lg:grid-cols-2">
      <div className="flex flex-col justify-between gap-10 p-[clamp(20px,5vw,56px)]">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-full border-2 border-white bg-pink text-center font-display text-[.78rem] leading-none text-ink" style={{ boxShadow: '0 0 0 3px #FFA3CB' }}>G&amp;<br />CO</span>
          <span className="font-display text-[1.45rem] tracking-wide">GUYS<i className="not-italic text-pink">&amp;</i>CO</span>
        </Link>
        <div>
          <p className="eyebrow !text-pink">{eyebrow}</p>
          <h1 className="mt-3 text-[clamp(3rem,8vw,6rem)] leading-[.88]">{title}</h1>
          <p className="mt-5 max-w-[44ch] text-night-muted">Your Blueprint, your projects, the Ledger and the Library. Private to each member. What you tell us stays with us.</p>
        </div>
        <p className="font-mono text-[.66rem] uppercase tracking-[.14em] text-night-muted">Members are vetted, not collected</p>
      </div>
      <div className="grid place-items-center bg-paper p-[clamp(20px,5vw,56px)] text-ink">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </main>
  );
}
