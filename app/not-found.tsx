import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-night px-6 text-white">
      <div className="max-w-xl">
        <p className="eyebrow !text-pink">Error 404</p>
        <h1 className="my-4 text-[clamp(3rem,9vw,6rem)] leading-[.9]">We don&apos;t know that <span className="text-pink">guy.</span></h1>
        <p className="mb-8 text-night-muted">That page isn&apos;t here. The homepage is, and so are we.</p>
        <div className="flex flex-wrap items-center gap-6"><Link className="btn" href="/">Back to the homepage →</Link><Link className="link text-white" href="/contact.html">Send an inquiry</Link></div>
      </div>
    </main>
  );
}
