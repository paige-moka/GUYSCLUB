// Loads clearly labelled DEMONSTRATION data so you can click through the Lounge before real members exist.
//   node --env-file=.env.local scripts/seed-demo.mjs            add the demo data
//   node --env-file=.env.local scripts/seed-demo.mjs --remove   take all of it out again
// Every demo record is flagged or named "Demo". No real money, members or documents are created.
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Set DEMO_PASSWORD to choose the demo logins' password.
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first (see .env.example).'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const password = process.env.DEMO_PASSWORD || crypto.randomBytes(9).toString('base64url');
const withAdmin = process.argv.includes('--with-admin');
const must = async (p, what) => { const { data, error } = await p; if (error) { console.error(`Failed: ${what}: ${error.message}`); process.exit(1); } return data; };
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const PEOPLE = [
  ...(withAdmin ? [{ email: 'demo.admin@example.com', name: 'Demo Administrator', role: 'admin', money: true }] : []),
  { email: 'demo.team@example.com', name: 'Demo Team Member', role: 'team', money: false },
  { email: 'demo.specialist@example.com', name: 'Demo Specialist', role: 'specialist', money: false },
  { email: 'demo.owner.a@example.com', name: 'Alex Demo', role: 'member', money: true, member: 'A' },
  { email: 'demo.staff.a@example.com', name: 'Sam Demo', role: 'member', money: false, member: 'A' },
  { email: 'demo.owner.b@example.com', name: 'Blair Demo', role: 'member', money: true, member: 'B' },
];

async function remove() {
  const members = await must(db.from('members').select('id').eq('is_demo', true), 'find demo members');
  const ids = members.map((m) => m.id);
  const camps = (await must(db.from('fundraising_campaigns').select('id').eq('is_demo', true), 'find demo campaigns')).map((c) => c.id);
  if (ids.length) await must(db.from('financial_transactions').delete().in('member_id', ids), 'remove demo ledger entries');
  if (camps.length) await must(db.from('financial_transactions').delete().in('campaign_id', camps), 'remove demo campaign entries');
  if (camps.length) await must(db.from('fundraising_campaigns').delete().in('id', camps), 'remove demo campaigns');
  const res = await must(db.from('library_resources').select('id, storage_path').like('title', 'Demo:%'), 'find demo library items');
  const paths = res.map((r) => r.storage_path).filter(Boolean); if (paths.length) await db.storage.from('library').remove(paths);
  if (res.length) await must(db.from('library_resources').delete().in('id', res.map((r) => r.id)), 'remove demo library items');
  for (const id of ids) { const { data: files } = await db.storage.from('member-files').list(`${id}/documents`); if (files?.length) await db.storage.from('member-files').remove(files.map((f) => `${id}/documents/${f.name}`)); }
  await must(db.from('member_groups').delete().like('name', 'Demo %'), 'remove demo groups');
  await must(db.from('announcements').delete().like('title', 'Demo:%'), 'remove demo announcements');
  await must(db.from('tft_criteria').delete().like('title', 'Demo %'), 'remove demo criteria');
  await must(db.from('tft_program').update({ is_configured: false, description: null, period_note: null }).eq('id', 1).like('description', 'Demonstration%'), 'reset demo program rules');
  if (ids.length) await must(db.from('members').delete().in('id', ids), 'remove demo members');
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users ?? []) if (/^demo\.[a-z.]+@example\.com$/.test(u.email ?? '')) await db.auth.admin.deleteUser(u.id);
  console.log('Demonstration data removed.');
}

async function seed() {
  if ((await must(db.from('members').select('id').eq('is_demo', true), 'check')).length) { console.error('Demo data is already loaded. Run with --remove first.'); process.exit(1); }
  const [A, B] = await must(db.from('members').insert([
    { name: 'Demo Member A: Northline Fabrication', serial: 'DEMO 001', joined_on: day(-120), is_demo: true },
    { name: 'Demo Member B: Prairie Supply Co.', serial: 'DEMO 002', joined_on: day(-60), is_demo: true },
  ], { defaultToNull: false }).select('id').order('serial'), 'members');
  const who = {};
  for (const p of PEOPLE) {
    const u = await must(db.auth.admin.createUser({ email: p.email, password, email_confirm: true, user_metadata: { full_name: p.name } }), `login ${p.email}`);
    await must(db.from('profiles').update({ full_name: p.name, role: p.role, can_view_financials: p.money, member_id: p.member === 'A' ? A.id : p.member === 'B' ? B.id : null }).eq('id', u.user.id), `profile ${p.email}`);
    who[p.email] = u.user.id;
  }
  await must(db.from('blueprints').insert([{ member_id: A.id, title: 'Demo Blueprint: Northline Fabrication', summary: 'Demonstration summary. Win three anchor accounts in energy services and build the engine that supports them.' }, { member_id: B.id, title: 'Demo Blueprint: Prairie Supply Co.', summary: 'Demonstration summary for Member B.' }], { defaultToNull: false }), 'blueprints');
  await must(db.from('objectives').insert([
    { member_id: A.id, title: 'Demo: three anchor accounts signed', detail: 'Demonstration objective.', goal_date: day(120), sort: 1 },
    { member_id: A.id, title: 'Demo: one page capability statement', status: 'achieved', sort: 2 },
    { member_id: B.id, title: 'Demo: Member B private objective', detail: 'Only Member B should ever see this.', sort: 1 },
  ], { defaultToNull: false }), 'objectives');
  await must(db.from('recommendations').insert([
    { member_id: A.id, title: 'Demo: rebuild the website around procurement buyers', built_stage: 'Blueprint', status: 'in_progress' },
    { member_id: A.id, title: 'Demo: set up call tracking before any ads run', built_stage: 'Uptime' },
    { member_id: A.id, title: 'Demo: quarterly Club introductions', built_stage: 'Leverage' },
    { member_id: B.id, title: 'Demo: Member B private recommendation', built_stage: 'Blueprint' },
  ], { defaultToNull: false }), 'recommendations');
  const [PA, PA2, PB] = await must(db.from('projects').insert([
    { member_id: A.id, name: 'Demo: Website and Digital', description: 'Demonstration project. A site that books calls, with the systems behind it.', objectives: 'Launch the new site. Book ten qualified calls in the first 60 days.', status: 'active', start_date: day(-30), due_date: day(45) },
    { member_id: A.id, name: 'Demo: Market Intelligence', description: 'Demonstration project, still in planning.', status: 'planning', due_date: day(90) },
    { member_id: B.id, name: 'Demo: Member B Brand and Positioning', description: 'Only Member B should ever see this project.', status: 'active', start_date: day(-10), due_date: day(60) },
  ], { defaultToNull: false }).select('id, name'), 'projects').then((r) => ['Website', 'Market', 'Member B'].map((k) => r.find((x) => x.name.includes(k))));
  await must(db.from('project_assignments').insert([{ project_id: PA.id, profile_id: who['demo.specialist@example.com'], role_label: 'Web specialist' }, { project_id: PA.id, profile_id: who['demo.team@example.com'], role_label: 'Account Lead' }], { defaultToNull: false }), 'assignments');
  await must(db.from('milestones').insert([
    { member_id: A.id, title: 'Demo: Blueprint signed off', status: 'done', due_date: day(-40) },
    { member_id: A.id, title: 'Demo: 90 day review', due_date: day(50) },
    { member_id: A.id, project_id: PA.id, title: 'Demo: sitemap and copy approved', status: 'done', due_date: day(-14) },
    { member_id: A.id, project_id: PA.id, title: 'Demo: design approved', status: 'in_progress', due_date: day(7) },
    { member_id: A.id, project_id: PA.id, title: 'Demo: site live', due_date: day(40) },
    { member_id: B.id, project_id: PB.id, title: 'Demo: Member B private milestone', due_date: day(20) },
  ], { defaultToNull: false }), 'milestones');
  await must(db.from('tasks').insert([
    { member_id: A.id, title: 'Demo: send your last 12 months of sales by service line', owner_type: 'member', due_date: day(-2) },
    { member_id: A.id, title: 'Demo: draft the 90 day plan', owner_type: 'guysco', status: 'done' },
    { member_id: A.id, project_id: PA.id, title: 'Demo: approve the homepage design', owner_type: 'member', due_date: day(5) },
    { member_id: A.id, project_id: PA.id, title: 'Demo: build the staging site', owner_type: 'specialist', status: 'in_progress', due_date: day(10) },
    { member_id: A.id, project_id: PA.id, title: 'Demo: write service pages', owner_type: 'guysco', status: 'done' },
    { member_id: A.id, project_id: PA.id, title: 'Demo: connect call tracking', owner_type: 'guysco', due_date: day(20) },
    { member_id: B.id, project_id: PB.id, title: 'Demo: Member B private task', owner_type: 'member', due_date: day(3) },
  ], { defaultToNull: false }), 'tasks');
  await must(db.from('project_updates').insert([{ project_id: PA.id, member_id: A.id, body: 'Demo update: copy is approved and design is with you for review.', author_name: 'Demo Team Member' }, { project_id: PB.id, member_id: B.id, body: 'Demo update for Member B only.', author_name: 'Demo Team Member' }], { defaultToNull: false }), 'updates');

  const [camp] = await must(db.from('fundraising_campaigns').insert({ name: 'Demo Campaign: Club Dividend', description: 'Demonstration campaign. These are not real funds.', goal_cents: 2500000, status: 'active', starts_on: day(-90), ends_on: day(270), is_demo: true }).select('id'), 'campaign');
  await must(db.from('campaign_milestones').insert([{ campaign_id: camp.id, title: 'Demo: first Business Seat funded', amount_cents: 200000 }, { campaign_id: camp.id, title: 'Demo: halfway', amount_cents: 1250000 }, { campaign_id: camp.id, title: 'Demo: goal reached', amount_cents: 2500000 }], { defaultToNull: false }), 'campaign milestones');
  await must(db.from('campaign_updates').insert({ campaign_id: camp.id, title: 'Demo: campaign opened', body: 'Demonstration update.' }), 'campaign update');
  await must(db.from('project_funding').insert({ project_id: PA.id, goal_cents: 1500000, note: 'Demonstration funding goal.' }), 'project funding');
  const now = new Date().toISOString();
  await must(db.from('financial_transactions').insert([
    { member_id: A.id, campaign_id: camp.id, kind: 'contribution', amount_cents: 50000, status: 'confirmed', reference: 'DEMO-ETRANSFER-001', confirmed_at: now, description: 'Demo contribution', occurred_on: day(-20) },
    { member_id: A.id, campaign_id: camp.id, kind: 'contribution', amount_cents: 100000, status: 'pledged', description: 'Demo pledge, not received', occurred_on: day(-5) },
    { member_id: B.id, campaign_id: camp.id, kind: 'contribution', amount_cents: 200000, status: 'confirmed', reference: 'DEMO-CHEQUE-0042', confirmed_at: now, description: 'Demo contribution', occurred_on: day(-15) },
    { member_id: B.id, campaign_id: camp.id, kind: 'contribution', amount_cents: 500000, status: 'pledged', description: 'Demo pledge, not received', occurred_on: day(-3) },
    { member_id: A.id, project_id: PA.id, kind: 'project_funding', amount_cents: 600000, status: 'confirmed', reference: 'DEMO-ETRANSFER-002', confirmed_at: now, description: 'Demo deposit', occurred_on: day(-28) },
    { member_id: A.id, project_id: PA.id, kind: 'project_funding', amount_cents: 300000, status: 'pending', description: 'Demo second payment, not yet verified', occurred_on: day(-1) },
    { member_id: B.id, kind: 'fee', amount_cents: 46800, status: 'confirmed', reference: 'DEMO-ETRANSFER-003', confirmed_at: now, description: 'Demo membership fee', occurred_on: day(-58) },
  ], { defaultToNull: false }), 'ledger');

  await must(db.from('tft_program').update({ description: 'Demonstration rules only. Replace these with your real Three for Three rules.', required_count: 3, period_note: 'Demonstration timing note.', is_configured: true }).eq('id', 1), 'program');
  const crit = await must(db.from('tft_criteria').insert([{ title: 'Demo qualifying action one', sort: 1 }, { title: 'Demo qualifying action two', sort: 2 }, { title: 'Demo qualifying action three', sort: 3 }], { defaultToNull: false }).select('id').order('sort'), 'criteria');
  await must(db.from('tft_records').insert([
    { member_id: A.id, criterion_id: crit[0].id, title: 'Demo item one', status: 'approved' },
    { member_id: A.id, criterion_id: crit[1].id, title: 'Demo item two', status: 'outstanding', due_date: day(30) },
    { member_id: B.id, criterion_id: crit[0].id, title: 'Demo item for Member B', status: 'submitted' },
  ], { defaultToNull: false }), 'three for three');

  const [grp] = await must(db.from('member_groups').insert({ name: 'Demo Group' }).select('id'), 'group');
  await must(db.from('member_group_members').insert({ group_id: grp.id, member_id: B.id }), 'group member');
  const file = 'resources/demo-welcome-guide.txt';
  await must(db.storage.from('library').upload(file, new Blob(['Demonstration file. Welcome to the Club.\n'], { type: 'text/plain' }), { upsert: true }), 'library file');
  const lib = await must(db.from('library_resources').insert([
    { title: 'Demo: Welcome to the Club', description: 'Demonstration guide with a downloadable file.', category: 'Start here', kind: 'guide', storage_path: file, file_name: 'demo-welcome-guide.txt', size_bytes: 41 },
    { title: 'Demo: Google Ads Playbook', description: 'Demonstration link.', category: 'Playbooks', kind: 'guide', external_url: 'https://example.com/demo-playbook' },
    { title: 'Demo: Member A pricing template', description: 'Restricted to Member A.', category: 'Templates', kind: 'template', external_url: 'https://example.com/demo-a', audience: 'restricted' },
    { title: 'Demo: Group only training', description: 'Restricted to the Demo Group (Member B).', category: 'Training', kind: 'training', external_url: 'https://example.com/demo-group', audience: 'restricted' },
    { title: 'Demo: Unpublished draft', category: 'Playbooks', kind: 'guide', external_url: 'https://example.com/demo-draft', published: false },
  ], { defaultToNull: false }).select('id, title'), 'library');
  const idOf = (t) => lib.find((l) => l.title.includes(t)).id;
  await must(db.from('library_access').insert([{ resource_id: idOf('Member A pricing'), member_id: A.id }, { resource_id: idOf('Group only'), group_id: grp.id }], { defaultToNull: false }), 'library access');
  const docPath = `${B.id}/documents/demo-private-b.txt`;
  await must(db.storage.from('member-files').upload(docPath, new Blob(['Demonstration private file for Member B.\n'], { type: 'text/plain' }), { upsert: true }), 'member file');
  await must(db.from('documents').insert({ member_id: B.id, title: 'Demo: Member B private document', storage_path: docPath, file_name: 'demo-private-b.txt', size_bytes: 41, uploaded_by_name: 'Demo Team Member' }), 'document');
  await must(db.from('announcements').insert([
    { title: 'Demo: Welcome to the Member Lounge', body: 'Demonstration announcement for everyone.', author_name: 'Demo Team Member' },
    { title: 'Demo: note for Member A', body: 'Only Member A sees this.', member_id: A.id, author_name: 'Demo Team Member' },
    { title: 'Demo: note for Member B', body: 'Only Member B sees this.', member_id: B.id, author_name: 'Demo Team Member' },
  ], { defaultToNull: false }), 'announcements');

  console.log('Demonstration data loaded.\nDemo logins (password: ' + password + ')');
  for (const p of PEOPLE) console.log(`  ${p.email.padEnd(30)} ${p.role}${p.member ? ' · Member ' + p.member : ''}${p.role === 'member' && !p.money ? ' · no financials' : ''}`);
  console.log('Remove it all with:  node --env-file=.env.local scripts/seed-demo.mjs --remove');
}

await (process.argv.includes('--remove') ? remove() : seed());
