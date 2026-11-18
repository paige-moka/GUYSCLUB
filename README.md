# GUYS&CO Platform

The GUYS Club website, its working forms, and the private Member Lounge, in one project.

* **Public website**: the GUYS Club site (`/`), plus `/contact.html`, `/privacy.html` and `/thanks.html`. Source in `site/`.
* **Forms**: Apply, I KNOW A GUY and Contact. Each one is saved in Supabase AND emailed to info@theguysandco.com.
* **Back office** (`/admin`): Club applications and recommendations, members, invitations, projects, the Ledger, Reconciliation, Three for Three, the Library.
* **Member Lounge** (`/portal`): built and tested, switched OFF on the public site until you are ready (see "Turning on the Member Lounge").

Stack: GitHub (code), Vercel (hosting), Supabase (database, logins, private files), Resend (form emails), Stripe Payment Links.

## Launch tonight: the short version

1. **GitHub**: create an empty private repository and upload the contents of this folder (unzip first; upload the files, not the zip).
2. **Supabase**: SQL Editor, run the three files in `supabase/migrations/` in order: `0001`, `0002`, `0003`.
3. **Resend** (form emails): sign up at resend.com, add the domain `theguysandco.com` under Domains, add the DNS records it shows at your domain registrar, then create an API key.
4. **Vercel**: Add New, Project, import the GitHub repository. Before pressing Deploy, open Environment Variables and add:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page, the anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page, the service role / secret key. **Secret.** |
| `NEXT_PUBLIC_SITE_URL` | `https://theguysandco.com` |
| `RESEND_API_KEY` | Your Resend API key. **Secret.** |
| `FORMS_FROM_EMAIL` | `GUYS Club <forms@theguysandco.com>` (any address on the domain you verified in Resend) |
| `FORMS_NOTIFY_TO` | `info@theguysandco.com` (the default; add more with commas) |

   Press **Deploy**. Vercel gives you a `vercel.app` address. Open it and send yourself one test application.
5. **Domain**: Vercel, Project, Settings, Domains, add `theguysandco.com` and `www.theguysandco.com`. Add the DNS records Vercel shows at your registrar. Keep your MX (email) records as they are.

How the forms behave:
* Saved in Supabase (table `club_applications`, `club_recommendations` or `inquiries`) and emailed to the inbox. The email's Reply goes straight to the person who filled in the form.
* If email is not set up yet, submissions are still saved in Supabase. If Supabase is not set up yet, the email still arrives. The visitor only sees "did not send" when both fail.
* Until Resend's domain check is complete, Resend's test sender only delivers to the email address you signed up to Resend with.
* Website visitors can add a row and nothing else. Only administrators and team members can read submissions.

## Turning on the Member Lounge

When your first members are approved:

1. Follow steps 2 to 4 under "Setup, in order" below (login settings, your own email sender, your administrator login).
2. In `site/config.js` set `memberLogin: true` and commit. The "Member login" link appears in the menu and footer.
3. Approve an application in **Back office > Club applications**, then press **Invite to the Lounge**. The invitation form opens with their name and email filled in.

Your back office works at `theguysandco.com/login` from day one, even while the public link is off.

## Growth Plan prices and Stripe

The homepage shows The Growth Plan at $5,000 once (save $700), 3 x $1,800 a month, or 6 x $950 a month, plus GST.
To add pay buttons, create three Stripe Payment Links and paste them into `site/config.js` under `stripe` (`payInFull`, `threePay`, `sixPay`).
For the 3 and 6 payment options, create the link as a recurring monthly price and set it to end after 3 or 6 payments (Stripe calls this a subscription schedule or "cancel after"; if your Stripe account cannot do that on a Payment Link, send those buyers an invoice instead and leave the link empty).
A tile shows a "Pay with Stripe" button only when its link is filled in.

## How it is protected

Permissions live in the database, not in the screens. Every table has Row Level Security switched on, so a member's
login can only ever read rows that belong to their own business, whatever address they type. Files sit in private
storage and are served only through links that expire in 60 seconds. Hiding a menu item is never the security.

| Role | Can see and do |
| --- | --- |
| Administrator | Everything, including money, roles and invitations |
| GUYS&CO team member | All members and projects. Money only if "can view financials" is ticked |
| Specialist | Only the projects they are assigned to. Never money, never Blueprints |
| Member | Only their own business. Money only if "can view financials" is ticked for that login |

Money rules built into the database: new entries start as **pledged** or **pending**; an entry becomes **confirmed** only
with a reference (Stripe ID, e-transfer or cheque number) and records who confirmed it; nothing is deleted, only voided
with a reason; every change is written to an audit table. Pledged money is always shown apart from confirmed money.

## Setup, in order

### 1. Supabase: database (already done if you followed "Launch tonight")

In your Supabase project open **SQL Editor** and run these two files, one after the other:

1. `supabase/migrations/0001_inquiries.sql` (contact form)
2. `supabase/migrations/0002_portal.sql` (the Lounge: tables, roles, security rules, private storage)
3. `supabase/migrations/0003_club.sql` (Apply and I KNOW A GUY)

All three are safe to run again.

### 2. Supabase: login settings

Under **Authentication**:

1. **Sign In / Providers → Email**: keep Email on. Turn **"Allow new users to sign up" OFF**. Members join by invitation only.
   (Even if someone did sign up, they would land in an empty account with access to nothing.)
2. **URL Configuration**: Site URL = `https://theguysandco.com`. Add these Redirect URLs:
   `https://theguysandco.com/auth/accept`, `https://theguysandco.com/auth/confirm`, and the same two on your `vercel.app` address while testing.
3. **Emails**: Supabase's built in email sender is limited to a few messages an hour and is meant for testing.
   Before inviting real members, connect your own sender under **Authentication → Emails → SMTP Settings**
   (Resend works: the same account as the form emails, under Resend > SMTP).

### 3. Vercel: environment settings

**Project → Settings → Environment Variables** (names are in `.env.example`):

| Name | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page, the anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page, the service role / secret key. **Secret. Never share it or put it in a file.** |
| `NEXT_PUBLIC_SITE_URL` | `https://theguysandco.com` |
| `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY` | Optional, see step 7 |

Then push to GitHub (or press **Redeploy**). Vercel detects Next.js by itself. The website forms use these same settings.

If the settings are missing, the public website still works and the login page says the Lounge is not connected yet.

### 4. Make yourself the administrator

1. Supabase → **Authentication → Users → Add user → Create new user**. Enter your email and a password, tick "Auto Confirm User".
2. SQL Editor, with your own email in place of the example:

```sql
update public.profiles set role = 'admin', can_view_financials = true where email = 'you@example.com';
```

3. Go to `https://theguysandco.com/login` and sign in. You land in the back office.

From then on, invite everyone else from **Members and people → Invite a person**. Only an administrator can invite people or change roles.

### 5. Try it with demonstration data (optional)

On your own computer, with the values from step 3 in a file called `.env.local`:

```
npm install
node --env-file=.env.local scripts/seed-demo.mjs            # adds two demo members and logins, all labelled Demo
node --env-file=.env.local scripts/seed-demo.mjs --remove   # takes all of it out again
```

Every demo record is flagged and shows a "Demonstration data" banner. Remove it before real members arrive.

### 6. Set up the program rules

* **Three for Three**: the rules are deliberately empty. In **Back office → Three for Three** set the name, how many are
  required, the description and the list of qualifying actions. Until you tick "rules are set", members see that the
  program is being finalised. Members report what they completed; nothing counts until a team member approves it.
* **Reconciliation**: create the campaign and its goal in **Back office → Reconciliation**, add milestones and updates.
  Totals come only from Ledger entries, never from a typed in number.

### 7. Stripe (optional, for automatic payment records)

Your public Payment Links keep working exactly as before (`site/config.js`). To have paid checkouts appear in the Ledger by themselves:

1. Stripe → **Developers → Webhooks → Add endpoint**: `https://theguysandco.com/api/stripe/webhook`,
   events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`.
2. Copy the endpoint's **Signing secret** into `STRIPE_WEBHOOK_SECRET` and your Stripe secret key into `STRIPE_SECRET_KEY` in Vercel. Redeploy.
3. Optional metadata on a Payment Link: `kind` (contribution, project_funding or fee), `campaign_id`, `project_id`.

Only messages carrying Stripe's valid signature are recorded, each one once. A payment that cannot be matched to a
member waits in the Ledger for you to assign it. Card details never touch this site.

## Day to day

* **New member**: Members and people → Add a member business → Invite a person (choose the business). They get an email, choose a password, and land in their Lounge.
* **Blueprint**: on the member's page, write the summary, upload versions, add objectives, recommendations, milestones and actions.
* **Projects**: start a project on the member's page, then manage tasks, milestones, updates, files, specialists and the funding goal on the project page.
* **Money**: The Ledger → enter a pledge or payment → Confirm received (needs a reference) or Void (needs a reason).
* **Library**: upload files or add links; choose everyone or only chosen members and groups.

## What was tested

Run here against a real Postgres 16 database, the real Supabase login service and the real PostgREST data service,
with a small test stand-in for Supabase Storage that applies the project's real storage rules:

* **Club site and forms (Nov 17)**: 150 browser checks: every public page at desktop, tablet and phone width with no errors or sideways scrolling; the headline, both buttons and the industries fit above the fold on 1280x720, 1366x768, 1440x900 and 1920x1080; Apply, I KNOW A GUY and Contact catch empty and invalid entries, save to Supabase, email the inbox with Reply going to the sender, and ignore spam bots; visitors cannot set a status, read submissions, or reach the Club review page; members and specialists cannot see submissions; administrators and team members can approve, and Invite opens prefilled.
* **144 database security checks** (`tests/security.test.mjs`), signing in as a visitor, two members, a member login
  without financials, a specialist, a team member and an administrator, using only the public key as a browser would.
* **Browser tests** of every Lounge and back office page on desktop and phone widths: no errors, no sideways scrolling,
  visitors sent to login from every private address, Member A unable to open Member B's project or files by URL.
* **Flows**: invitation link → choose password → Lounge; password reset; member marks an action done, uploads and
  downloads files, reports a Three for Three item; administrator approves it, creates a member, enters and confirms
  money, uploads to the Library, posts an announcement; Stripe webhook refuses unsigned and wrongly signed messages
  and records a verified payment exactly once.

To rerun the security checks against your own project (with demo data loaded using `--with-admin`):
`DEMO_PASSWORD=... node --env-file=.env.local tests/security.test.mjs`

**Not tested here, please check after setup**: your live Supabase project (run step 5 and click through), real
invitation and reset emails arriving, file upload and download on real Supabase Storage, the Vercel deploy, and a
real Stripe test payment reaching the Ledger.

## Still needs you

1. GitHub repository, then import it in Vercel ("Launch tonight", steps 1 and 4)
2. Run the three SQL files in Supabase (step 2)
3. Resend account, domain DNS records and API key, so form emails reach info@theguysandco.com (step 3)
4. Seven environment settings in Vercel, then one test application from the live site
5. Domain DNS at your registrar (step 5)
6. Stripe Payment Links for the Growth Plan, if you want pay buttons on the site
7. Later, for the Member Lounge: login settings, your administrator login, Three for Three rules, the Reconciliation goal, and a lawyer or accountant look at how money is described

## Project map

| Path | What it is |
| --- | --- |
| `site/` | Public website source (HTML, CSS, fonts, `config.js`). `node build.mjs` builds it into `public/` |
| `app/api/forms/` | Receives Apply, I KNOW A GUY and Contact; saves to Supabase and emails the inbox |
| `app/admin/club/` | Back office page for Club applications and recommendations |
| `app/portal/` | Member Lounge pages |
| `app/admin/` | Back office pages |
| `app/login/`, `app/auth/` | Login, invitation, password pages |
| `app/api/download/` | Issues 60 second file links after a permission check |
| `app/api/stripe/webhook/` | Verified Stripe payment records |
| `app/actions.ts` | All save, delete, invite and money actions (each one runs as the signed in person) |
| `supabase/migrations/` | Database, roles, Row Level Security, storage rules |
| `scripts/seed-demo.mjs` | Demonstration data, add and remove |
| `tests/security.test.mjs` | Database security checks |

Local work: `npm install`, then `npm run dev` and open http://localhost:3000
