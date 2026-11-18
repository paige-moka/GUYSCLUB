/* GUYS Club website behaviour. Settings live in /config.js. */
(function () {
  'use strict';
  var C = window.GUYSCO_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var isHttps = function (u) { return typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u.trim()); };
  var track = function (name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
    if (typeof window.plausible === 'function') window.plausible(name, { props: params || {} });
  };

  /* ---- settings applied to the page ---- */
  if (isHttps(C.strategyCallUrl)) $$('[data-cta="strategy"]').forEach(function (a) { a.href = C.strategyCallUrl.trim(); });
  $$('[data-cta="strategy"]').forEach(function (a) { a.addEventListener('click', function () { track('strategy_call_click'); }); });

  /* ---- Stripe Payment Links: a price tile gets a button only when its link is set ---- */
  var stripe = C.stripe || {}, anyPay = false;
  $$('[data-pay]').forEach(function (tile) {
    var url = stripe[tile.getAttribute('data-pay')];
    if (!isHttps(url)) return;
    var a = document.createElement('a');
    a.className = 'link'; a.href = url.trim(); a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'Pay with Stripe';
    a.setAttribute('aria-label', $('.k', tile).textContent + ': pay with Stripe');
    a.addEventListener('click', function () { track('payment_link_click', { option: tile.getAttribute('data-pay') }); });
    tile.appendChild(a); anyPay = true;
  });
  var note = $('#pay-note'); if (note && anyPay) note.hidden = false;

  /* ---- mobile menu ---- */
  var nav = $('.nav'), mb = $('.menu-btn');
  if (nav && mb) {
    var setOpen = function (o) { nav.classList.toggle('open', o); mb.setAttribute('aria-expanded', o ? 'true' : 'false'); };
    mb.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
    $$('#menu a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); mb.focus(); } });
    document.addEventListener('click', function (e) { if (nav.classList.contains('open') && !nav.contains(e.target)) setOpen(false); });
  }

  /* ---- I KNOW A GUY dialog (other pages link to index.html#know-a-guy) ---- */
  var dlg = document.getElementById('know-a-guy');
  var openGuy = function () {
    if (!dlg) return false;
    if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
    var f = $('input:not([type=hidden]):not([tabindex="-1"])', dlg); if (f) f.focus();
    return true;
  };
  $$('[data-open="guy"]').forEach(function (b) {
    b.addEventListener('click', function (e) { if (openGuy()) e.preventDefault(); });
  });
  if (dlg) {
    $('[data-close]', dlg).addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    if (location.hash === '#know-a-guy') openGuy();
  }

  /* ---- forms: Apply, I know a guy, Contact. Sent to /api/forms/<kind> ---- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var msgFor = function (el) { return el.getAttribute('data-msg') || 'Please fill this in.'; };
  var errSpan = function (el) {
    var host = el.closest('fieldset') || el.closest('label') || el.parentNode, s = $('.err', host);
    if (!s) { s = document.createElement('span'); s.className = 'err'; s.id = 'err-' + (el.name || el.id); host.appendChild(s); }
    return s;
  };
  var problem = function (el, form) {
    var v = (el.value || '').trim();
    if (el.type === 'radio') return $$('input[name="' + el.name + '"]', form).some(function (r) { return r.checked; }) ? '' : msgFor(el);
    if (el.type === 'checkbox') return el.checked ? '' : msgFor(el);
    if (el.required && !v) return msgFor(el);
    if (v && el.type === 'email' && !EMAIL_RE.test(v)) return 'That email address looks off.';
    if (v && el.type === 'tel' && !/^[0-9+().\s-]{7,}$/.test(v)) return 'That phone number looks off. You can also leave it empty.';
    var min = +el.getAttribute('minlength') || 0; if (v && v.length < min) return msgFor(el);
    return '';
  };
  var check = function (el, form) {
    var m = problem(el, form), s = errSpan(el);
    s.textContent = m; s.hidden = !m;
    var targets = el.type === 'radio' ? $$('input[name="' + el.name + '"]', form) : [el];
    targets.forEach(function (t) { if (m) { t.setAttribute('aria-invalid', 'true'); t.setAttribute('aria-describedby', s.id); } else t.removeAttribute('aria-invalid'); });
    return !m;
  };
  $$('form[data-form]').forEach(function (form) {
    var kind = form.getAttribute('data-form'), status = $('.form-status', form), done = $('.done', form), send = $('button[type=submit]', form);
    var fields = $$('input:not([type=hidden]):not([name=company_site]),select,textarea', form);
    fields.forEach(function (el) {
      var re = function () { if (el.getAttribute('aria-invalid') === 'true' || (el.type === 'radio' && $$('input[name="' + el.name + '"][aria-invalid]', form).length)) check(el, form); };
      el.addEventListener('input', re); el.addEventListener('change', re);
    });
    var say = function (text) { status.className = 'form-status bad'; status.textContent = text; status.hidden = false; };
    form.addEventListener('submit', function (e) {
      e.preventDefault(); status.hidden = true;
      var seen = {}, bad = [];
      fields.forEach(function (el) {
        if (el.type === 'radio') { if (seen[el.name]) return; seen[el.name] = 1; if (!el.required && !$$('input[name="' + el.name + '"][required]', form).length) return; }
        if (!el.required && !el.value) { var s0 = $('.err', el.closest('label') || el.parentNode); if (s0) s0.hidden = true; el.removeAttribute('aria-invalid'); return; }
        if (!check(el, form)) bad.push(el);
      });
      if (bad.length) { bad[0].focus(); return; }
      var data = {};
      fields.forEach(function (el) {
        if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
        else if (el.type === 'checkbox') data[el.name] = el.checked ? 'yes' : '';
        else data[el.name] = el.value.trim();
      });
      data.company_site = (form.elements.company_site || {}).value || '';
      if (window.GUYSCO_PREVIEW) { say('This is a preview. On theguysandco.com this goes straight to the GUYS Club inbox.'); return; }
      var label = send.innerHTML; send.disabled = true; send.textContent = 'Sending…';
      fetch('/api/forms/' + kind, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { if (!res.ok) throw new Error(j.error || 'status ' + res.status); return j; }); })
        .then(function () {
          form.reset(); fields.forEach(function (el) { el.removeAttribute('aria-invalid'); });
          $$('.err', form).forEach(function (s) { s.hidden = true; });
          $$('.q,.check,.pair,fieldset,button[type=submit]', form).forEach(function (n) { n.hidden = true; });
          if (done) { done.hidden = false; done.setAttribute('tabindex', '-1'); done.focus(); }
          track(kind === 'apply' ? 'application_sent' : kind === 'recommend' ? 'recommendation_sent' : 'inquiry_sent');
        })
        .catch(function (err) {
          say((err && err.message && !/^status|Failed to fetch|NetworkError|Load failed/i.test(err.message)) ? err.message : 'Sorry, that did not send. Please try again in a few minutes, or use the Book a Strategy Call button.');
        })
        .then(function () { send.disabled = false; send.innerHTML = label; });
    });
  });

  /* ---- analytics: loads only when an ID is set in config.js ---- */
  var A = C.analytics || {};
  if (/^G-[A-Z0-9]+$/i.test(A.ga4Id || '')) {
    var g = document.createElement('script'); g.async = true; g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(A.ga4Id); document.head.appendChild(g);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date()); window.gtag('config', A.ga4Id);
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(A.plausibleDomain || '')) {
    var p = document.createElement('script'); p.defer = true; p.setAttribute('data-domain', A.plausibleDomain); p.src = 'https://plausible.io/js/script.js'; document.head.appendChild(p);
  }
})();
