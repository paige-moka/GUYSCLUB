import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notify } from '@/lib/notify';

/* Public website forms: Apply, I KNOW A GUY, Contact.
   Each one is saved to Supabase with the PUBLIC key (the database only lets the website add rows)
   and emailed to the GUYS&CO inbox. It counts as received when at least one of the two worked. */

export const dynamic = 'force-dynamic';

type Spec = { table: string; fields: Record<string, { required?: boolean; max: number; min?: number; email?: boolean; phone?: boolean; oneOf?: string[]; bool?: boolean }>; subject: (d: Record<string, unknown>) => string; replyTo: string; labels: Record<string, string> };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SPECS: Record<string, Spec> = {
  apply: {
    table: 'club_applications', replyTo: 'email',
    subject: (d) => `New GUYS Club application: ${d.name}`,
    fields: { name: { required: true, min: 2, max: 120 }, email: { required: true, max: 200, email: true }, phone: { max: 40, phone: true }, business_role: { required: true, min: 2, max: 200 }, industry: { required: true, max: 80 }, value_offered: { required: true, min: 10, max: 3000 }, looking_for: { max: 3000 }, sponsor: { max: 160 }, agreed_standards: { required: true, max: 3, bool: true } },
    labels: { name: 'Name', email: 'Email', phone: 'Phone', business_role: 'Business and role', industry: 'Industry', value_offered: 'Value they bring', looking_for: 'Looking for', sponsor: 'Sponsoring member', agreed_standards: 'Agreed to the standards' },
  },
  recommend: {
    table: 'club_recommendations', replyTo: 'recommender_email',
    subject: (d) => `I KNOW A GUY: ${d.recommender_name} recommends ${d.candidate_name}`,
    fields: { recommender_name: { required: true, min: 2, max: 120 }, recommender_email: { required: true, max: 200, email: true }, candidate_name: { required: true, min: 2, max: 200 }, candidate_contact: { max: 200 }, background: { required: true, min: 2, max: 3000 }, fit: { max: 3000 }, value_offered: { max: 3000 }, consent: { required: true, max: 10, oneOf: ['yes', 'not_yet'] } },
    labels: { recommender_name: 'Recommended by', recommender_email: 'Their email', candidate_name: 'Recommending', candidate_contact: 'How to reach them', background: 'Background', fit: 'Why a good fit', value_offered: 'Value they could contribute', consent: 'Agreed to be introduced' },
  },
  inquiry: {
    table: 'inquiries', replyTo: 'email',
    subject: (d) => `Website note: ${d.need} from ${d.name}`,
    fields: { name: { required: true, min: 2, max: 120 }, business: { max: 160 }, email: { required: true, max: 200, email: true }, phone: { max: 40, phone: true }, need: { required: true, max: 80 }, message: { required: true, min: 10, max: 4000 }, consent: { required: true, max: 3, bool: true } },
    labels: { name: 'Name', business: 'Business', email: 'Email', phone: 'Phone', need: 'About', message: 'Note', consent: 'Agreed to a reply' },
  },
};

// A light brake on repeat submissions from one address (per server instance).
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now(), list = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 8;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params; const spec = SPECS[kind];
  if (!spec) return NextResponse.json({ error: 'Unknown form.' }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 20_000) return NextResponse.json({ error: 'That is too long to send.' }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Sorry, that did not send.' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Sorry, that did not send.' }, { status: 400 });
  if (typeof body.company_site === 'string' && body.company_site) return NextResponse.json({ ok: true }); // spam trap: say thanks, keep nothing
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return NextResponse.json({ error: 'Too many messages from here. Please try again a little later.' }, { status: 429 });

  const row: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(spec.fields)) {
    const v = typeof body[k] === 'string' ? (body[k] as string).trim() : '';
    if (f.bool) { if (f.required && v !== 'yes') return NextResponse.json({ error: 'Please tick the box to continue.' }, { status: 400 }); row[k] = v === 'yes'; continue; }
    if (!v) { if (f.required) return NextResponse.json({ error: `Please fill in: ${spec.labels[k]}.` }, { status: 400 }); row[k] = null; continue; }
    if (v.length > f.max || (f.min && v.length < f.min)) return NextResponse.json({ error: `Please check the length of: ${spec.labels[k]}.` }, { status: 400 });
    if (f.email && !EMAIL.test(v)) return NextResponse.json({ error: 'That email address looks off.' }, { status: 400 });
    if (f.phone && !/^[0-9+().\s-]{7,}$/.test(v)) return NextResponse.json({ error: 'That phone number looks off.' }, { status: 400 });
    if (f.oneOf && !f.oneOf.includes(v)) return NextResponse.json({ error: `Please choose an answer for: ${spec.labels[k]}.` }, { status: 400 });
    row[k] = v;
  }

  let saved = false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await sb.from(spec.table).insert(row);
    if (error) console.error(`Form ${kind} not saved:`, error.message); else saved = true;
  }

  const fmt = (k: string, v: unknown) => `${spec.labels[k]}: ${v === true ? 'Yes' : v === null || v === '' ? 'Not given' : k === 'consent' && v === 'not_yet' ? 'Not yet' : v === 'yes' ? 'Yes' : String(v)}`;
  const text = Object.keys(spec.fields).map((k) => fmt(k, row[k])).join('\n\n') + `\n\n${saved ? 'Saved in Supabase.' : 'NOT saved in Supabase (check the database setup). This email is the only copy.'}\nSent from the GUYS Club website.`;
  const emailed = await notify(spec.subject(row), text, row[spec.replyTo] as string);

  if (!saved && !emailed) return NextResponse.json({ error: 'Sorry, that did not send. Please try again in a few minutes, or use the Book a Strategy Call button.' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
