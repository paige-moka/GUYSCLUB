'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Invitation links from Supabase's standard email arrive with the session in the address fragment,
// which only the browser can read. This page stores the session, then moves on to choosing a password.
export default function Accept() {
  const [msg, setMsg] = useState('Opening your invitation…');
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const q = new URLSearchParams(window.location.search);
    const access_token = h.get('access_token'), refresh_token = h.get('refresh_token');
    const fail = () => setMsg(h.get('error_description') || 'That link has expired or was already used. Ask us for a new one.');
    (async () => {
      const sb = createClient();
      if (access_token && refresh_token) {
        const { error } = await sb.auth.setSession({ access_token, refresh_token });
        if (error) return fail();
      } else if (q.get('code')) {
        const { error } = await sb.auth.exchangeCodeForSession(q.get('code')!);
        if (error) return fail();
      } else return fail();
      window.location.replace('/auth/update-password');
    })();
  }, []);
  return (<main className="grid min-h-screen place-items-center bg-night p-6 text-white"><p className="font-mono text-sm uppercase tracking-widest">{msg}</p></main>);
}
