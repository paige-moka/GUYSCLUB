'use client';
import { useRef, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Sends a file straight to private Supabase Storage as the signed in person (storage rules apply),
    then records it through a server action. Extra form fields go in as children. */
export function Uploader({ bucket, prefix, action, hidden, children, button = 'Upload', accept, maxMb = 50 }: {
  bucket: 'member-files' | 'library'; prefix: string; action: (fd: FormData) => Promise<void>;
  hidden: Record<string, string | null | undefined>; children?: ReactNode; button?: string; accept?: string; maxMb?: number;
}) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const form = useRef<HTMLFormElement>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr('');
    const fd = new FormData(e.currentTarget); const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) { setErr('Please choose a file.'); return; }
    if (file.size > maxMb * 1024 * 1024) { setErr(`That file is larger than ${maxMb} MB.`); return; }
    setBusy(true);
    const clean = file.name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '_').slice(-80) || 'file';
    const path = `${prefix}/${crypto.randomUUID()}_${clean}`;
    const { error } = await createClient().storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) { setBusy(false); setErr(/row-level security|not authorized|permission/i.test(error.message) ? 'You do not have permission to upload here.' : 'The upload did not go through. Please try again.'); return; }
    fd.delete('file');
    fd.set('storage_path', path); fd.set('file_name', file.name.slice(0, 200)); fd.set('size_bytes', String(file.size));
    if (hidden._table === 'documents') fd.set('mime', file.type || '');
    if ((hidden._table === 'documents' || fd.has('title')) && !String(fd.get('title') || '').trim()) fd.set('title', file.name.slice(0, 120));
    await action(fd);
  }
  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-4">
      {Object.entries(hidden).map(([k, v]) => (v != null ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {children}
      <label className="block"><span className="label">File</span><input className="input file:mr-3 file:border-0 file:bg-ink file:px-3 file:py-1.5 file:font-mono file:text-[.68rem] file:uppercase file:tracking-widest file:text-pink" type="file" name="file" accept={accept} required /></label>
      {err ? <p role="alert" className="text-[.9rem] font-semibold text-bad">{err}</p> : null}
      <div><button className="btn" type="submit" disabled={busy}>{busy ? 'Uploading…' : button}</button></div>
    </form>
  );
}
