import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Stripe calls this address after a payment. Nothing is recorded unless Stripe's signature on the
// message checks out, so a payment can never be invented by someone calling this URL.
// Add to the Payment Link in Stripe (optional): metadata kind = contribution | project_funding | fee,
// campaign_id, project_id. Links opened from the Lounge carry the member's ID by themselves.
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET, key = process.env.STRIPE_SECRET_KEY, db = createAdminClient();
  if (!secret || !key || !db) return NextResponse.json({ error: 'Stripe is not connected yet.' }, { status: 503 });
  const stripe = new Stripe(key); const body = await request.text(); let event: Stripe.Event;
  try { event = await stripe.webhooks.constructEventAsync(body, request.headers.get('stripe-signature') ?? '', secret); }
  catch { return NextResponse.json({ error: 'Signature check failed.' }, { status: 400 }); }

  // Each Stripe event is processed once, even if Stripe sends it again.
  const { error: dup } = await db.from('stripe_events').insert({ id: event.id, type: event.type, payload: event as unknown as Record<string, unknown> });
  if (dup) return NextResponse.json({ received: true, note: dup.code === '23505' ? 'already processed' : dup.message }, { status: dup.code === '23505' ? 200 : 500 });
  const finish = async (result: string) => { await db.from('stripe_events').update({ result }).eq('id', event.id); return NextResponse.json({ received: true, result }); };

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.payment_status !== 'paid' || !s.amount_total) return finish('ignored: not paid yet');
    const md = s.metadata ?? {}; const ref = s.client_reference_id ?? '';
    const exists = async (table: string, id: string | undefined) => (id && UUID.test(id) && (await db.from(table).select('id').eq('id', id).maybeSingle()).data ? id : null);
    const member_id = await exists('members', ref), campaign_id = await exists('fundraising_campaigns', md.campaign_id), project_id = await exists('projects', md.project_id);
    const kind = ['contribution', 'project_funding', 'fee'].includes(md.kind ?? '') ? md.kind : campaign_id ? 'contribution' : project_id ? 'project_funding' : 'fee';
    const reference = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id ?? s.id;
    const { error } = await db.from('financial_transactions').insert({
      member_id, campaign_id, project_id, kind, amount_cents: s.amount_total, currency: (s.currency ?? 'cad').toUpperCase(),
      status: 'confirmed', source: 'stripe', reference, stripe_event_id: event.id, confirmed_at: new Date().toISOString(),
      description: `Stripe payment${s.customer_details?.email ? ' from ' + s.customer_details.email : ''}`,
      occurred_on: new Date(event.created * 1000).toISOString().slice(0, 10),
    });
    if (error) { await db.from('stripe_events').delete().eq('id', event.id); return NextResponse.json({ error: error.message }, { status: 500 }); }
    return finish(member_id ? 'recorded' : 'recorded, needs matching to a member');
  }

  if (event.type === 'charge.refunded') {
    const ch = event.data.object as Stripe.Charge; const pi = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id;
    const { data: orig } = pi ? await db.from('financial_transactions').select('member_id, campaign_id, project_id, currency').eq('reference', pi).eq('source', 'stripe').neq('kind', 'refund').maybeSingle() : { data: null };
    const { data: prior } = pi ? await db.from('financial_transactions').select('amount_cents').eq('reference', pi).eq('kind', 'refund') : { data: [] };
    const already = (prior ?? []).reduce((a, r) => a + Number(r.amount_cents), 0), amount = (ch.amount_refunded ?? 0) - already;
    if (!pi || amount <= 0) return finish('ignored: nothing new to refund');
    const { error } = await db.from('financial_transactions').insert({
      member_id: orig?.member_id ?? null, campaign_id: orig?.campaign_id ?? null, project_id: orig?.project_id ?? null, kind: 'refund', amount_cents: amount,
      currency: (ch.currency ?? 'cad').toUpperCase(), status: 'confirmed', source: 'stripe', reference: pi, stripe_event_id: event.id,
      confirmed_at: new Date().toISOString(), description: 'Stripe refund', occurred_on: new Date(event.created * 1000).toISOString().slice(0, 10),
    });
    if (error) { await db.from('stripe_events').delete().eq('id', event.id); return NextResponse.json({ error: error.message }, { status: 500 }); }
    return finish('refund recorded');
  }
  return finish('ignored: event type not used');
}
