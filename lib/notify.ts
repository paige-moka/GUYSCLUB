import 'server-only';

/** Emails a form submission to the GUYS&CO inbox through Resend (https://resend.com).
 *  Returns false, and sends nothing, until RESEND_API_KEY is set in Vercel. */
export async function notify(subject: string, text: string, replyTo?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const to = (process.env.FORMS_NOTIFY_TO || 'info@theguysandco.com').split(',').map((s) => s.trim()).filter(Boolean);
  const from = process.env.FORMS_FROM_EMAIL || 'GUYS Club website <onboarding@resend.dev>';
  try {
    const res = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error('Form email not sent:', res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error('Form email not sent:', (e as Error).message);
    return false;
  }
}
