// Builds the public marketing site from /site into /public (Next.js serves /public as is). No dependencies: run `node build.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, 'site'), dist = path.join(root, 'public');
const read = (p) => fs.readFileSync(p, 'utf8');

// settings
const sandbox = { window: {} };
vm.runInNewContext(read(path.join(src, 'config.js')), sandbox);
const cfg = sandbox.window.GUYSCO_CONFIG;
if (!cfg) throw new Error('config.js did not define window.GUYSCO_CONFIG');
const siteUrl = String(cfg.siteUrl || '').replace(/\/+$/, '');
if (!/^https:\/\/[^\s/]+$/.test(siteUrl)) throw new Error('config.js: siteUrl must look like https://example.com');
if (!/^https:\/\/\S+$/.test(cfg.strategyCallUrl || '')) throw new Error('config.js: strategyCallUrl must start with https://');
const email = String(cfg.contactEmail || '').trim();
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('config.js: contactEmail does not look like an email address');
for (const [k, v] of Object.entries(cfg.stripe || {})) {
  if (v && !/^https:\/\//.test(v)) throw new Error(`config.js: stripe.${k} must start with https://`);
  if (v && !/stripe\.com\//.test(v)) console.warn(`Note: stripe.${k} is not a stripe.com address. Check it is your Payment Link.`);
}

const partial = (n) => read(path.join(src, 'partials', n + '.html'));
const head = partial('head'), nav = partial('nav'), footer = partial('footer');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const org = {
  '@context': 'https://schema.org', '@type': 'ProfessionalService',
  name: 'GUYS&CO', legalName: 'GUYS&CO MKTG Inc.', url: siteUrl + '/',
  logo: siteUrl + '/assets/img/icon-512.png', image: siteUrl + '/assets/img/og.png',
  slogan: 'You don\'t have to know everybody. Just the right people.',
  description: 'GUYS Club, a business community built on access, introductions and opportunities, and The BUILT Method Growth Plan.',
  address: { '@type': 'PostalAddress', addressRegion: 'AB', addressCountry: 'CA' },
  areaServed: [{ '@type': 'AdministrativeArea', name: 'Alberta' }, { '@type': 'Country', name: 'Canada' }]
};
if (email) org.email = email;
const jsonld = `<script type="application/ld+json">${JSON.stringify(org).replace(/</g, '\\u003c')}</script>`;

// With no contact email set, anything marked data-email-wrap or data-email is left out of the page.
const dropEmail = (html) => html
  .replace(/<(\w+) data-email-wrap[^>]*>[\s\S]*?<\/\1>/g, '')
  .replace(/\s*<a [^>]*data-email[^>]*>[\s\S]*?<\/a>/g, '');

fs.rmSync(dist, { recursive: true, force: true });
const pages = [];
const copy = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.name === 'partials' || e.name === '.DS_Store') continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copy(a, b);
    else if (e.name.endsWith('.html')) {
      let body = read(a);
      const m = body.match(/^<!--page (.*?)-->\n?/);
      if (!m) throw new Error(e.name + ' is missing its <!--page ...--> line');
      const meta = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
      body = body.slice(m[0].length);
      let html = head + nav + body + footer;
      if (!email) html = dropEmail(html);
      if (cfg.memberLogin !== true) html = html.replace(/\s*<li[^>]*data-login[^>]*>[\s\S]*?<\/li>/g, '').replace(/\s*<a [^>]*data-login[^>]*>[\s\S]*?<\/a>/g, '');
      if (meta.base) html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<base href="${meta.base}">`);
      const map = {
        TITLE: meta.title, DESC: meta.description, PATH: meta.path, HOME: meta.home || '',
        ROBOTS: meta.robots || 'index,follow', SITE_URL: siteUrl, EMAIL: esc(email),
        STRATEGY_URL: esc(cfg.strategyCallUrl), YEAR: String(new Date().getFullYear()),
        JSONLD: meta.path === '/' ? jsonld : ''
      };
      html = html.replace(/\{\{(\w+)\}\}/g, (all, k) => { if (!(k in map)) throw new Error(`Unknown token ${all} in ${e.name}`); return map[k]; });
      fs.writeFileSync(b, html);
      if (!meta.robots) pages.push(meta.path);
    } else fs.copyFileSync(a, b);
  }
};
copy(src, dist);

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.sort().map((p) => `  <url><loc>${siteUrl}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /portal\nDisallow: /admin\nDisallow: /login\nDisallow: /auth\nDisallow: /api\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
console.log(`Built ${fs.readdirSync(dist).filter((f) => f.endsWith('.html')).length} pages into public/ for ${siteUrl}` + (email ? '' : ' (no contact email set)'));
