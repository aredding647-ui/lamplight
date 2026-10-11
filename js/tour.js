/* Lamplight prototype: a floating "Pages" button that lists every page, built or coming. */
(function () {
  /* remember lights off/on across pages */
  try { if (localStorage.getItem('lamplight:theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}
  new MutationObserver(function () { try { localStorage.setItem('lamplight:theme', document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'); } catch (e) {} }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  var sw = document.getElementById('lights');
  if (sw && sw.getAttribute('role') === 'switch' && document.documentElement.getAttribute('data-theme') === 'dark') { sw.setAttribute('aria-checked', 'true'); var lb = document.getElementById('lightsLbl'); if (lb) lb.textContent = 'Lights on'; }

  var PAGES = [
    { g: 'Built', items: [
      ['index.html', 'Home page', 'The front page'],
      ['signup.html', 'Sign up', 'Create an account in 4 steps'],
      ['recommendations.html', 'For you', 'Recommendations wall'],
      ['subject.html', 'Subject', 'Weeks, skills and uploads'],
      ['diagnostic.html', 'Diagnostic', 'Your levels for every week'],
      ['arena.html', 'Diagnostic Arena', 'The adaptive test'],
      ['analytics.html', 'Analytics', 'Summary report'],
      ['practice.html', 'Practice', 'Answer questions, SmartScore'],
      ['account.html', 'Account', 'Sign in and cloud saving']
    ] },
    { g: 'Coming next', items: [
      ['coming-soon.html#dashboard', 'Dashboard', 'Your home once signed in'],
      
      ['coming-soon.html#skill-plans', 'Skill plans', 'Plans for exams and assignments'],
      ['coming-soon.html#awards', 'Awards', 'Prize board and certificates']
    ] }
  ];
  var here = (location.pathname.split('/').pop() || 'index.html') + (location.pathname.indexOf('coming-soon') > -1 ? location.hash : '');

  var css = document.createElement('style');
  css.textContent =
    '.tour-btn{position:fixed;z-index:70;right:18px;bottom:calc(18px + env(safe-area-inset-bottom,0px));display:inline-flex;align-items:center;gap:8px;padding:11px 16px;border-radius:14px;border:2px solid var(--ink);background:var(--ink);color:var(--paper);font:700 14px var(--font-body);cursor:pointer;box-shadow:0 3px 0 var(--shadow)}' +
    '.tour-btn:hover{transform:translateY(-1px)}' +
    '@media (max-width:820px){body.app .tour-btn{bottom:calc(92px + env(safe-area-inset-bottom,0px))}}' +
    '.tour-panel{position:fixed;z-index:71;right:18px;bottom:calc(76px + env(safe-area-inset-bottom,0px));width:min(92vw,340px);max-height:70vh;overflow:auto;background:var(--card);color:var(--ink);border:2.5px solid var(--ink);border-radius:20px;box-shadow:0 8px 0 var(--shadow);padding:16px}' +
    '@media (max-width:820px){body.app .tour-panel{bottom:calc(150px + env(safe-area-inset-bottom,0px))}}' +
    '.tour-panel h6{margin:6px 4px 8px;font:700 12px var(--font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}' +
    '.tour-panel a{display:grid;grid-template-columns:1fr auto;gap:0 10px;padding:9px 10px;border-radius:12px;text-decoration:none;border:2px solid transparent}' +
    '.tour-panel a:hover{background:var(--paper-2)}' +
    '.tour-panel a b{font-size:15px}.tour-panel a small{grid-column:1;color:var(--muted);font-size:12.5px}' +
    '.tour-panel a[aria-current="page"]{border-color:var(--ink);background:var(--hl-yellow);color:#141414}' +
    '.tour-panel a[aria-current="page"] small{color:#3A3A37}' +
    '.tour-panel .tour-soon b{color:var(--ink-2)}' +
    '.tour-panel .dot{grid-row:span 2;align-self:center;width:9px;height:9px;border-radius:99px;background:var(--good)}' +
    '.tour-panel .tour-soon .dot{background:transparent;border:2px dashed var(--muted)}' +
    '.tour-panel .reset{margin:10px 4px 2px;padding:0;border:0;background:none;font:600 13px var(--font-body);color:var(--muted);text-decoration:underline;cursor:pointer}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'tour-btn'; btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Pages';
  var panel = document.createElement('nav');
  panel.className = 'tour-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'All prototype pages');
  var html = '';
  PAGES.forEach(function (grp) {
    html += '<h6>' + grp.g + '</h6>';
    grp.items.forEach(function (p) {
      var on = p[0] === here || (here === '' && p[0] === 'index.html');
      html += '<a href="' + p[0] + '"' + (on ? ' aria-current="page"' : '') + (grp.g !== 'Built' ? ' class="tour-soon"' : '') + '><b>' + p[1] + '</b><span class="dot"></span><small>' + p[2] + '</small></a>';
    });
  });
  html += '<button type="button" class="reset" id="tourReset">Reset to Anna\'s account</button>';
  panel.innerHTML = html;
  document.body.appendChild(panel); document.body.appendChild(btn);

  function mark() {
    var h = (location.pathname.split('/').pop() || 'index.html') + (location.pathname.indexOf('coming-soon') > -1 ? (location.hash || '#dashboard') : '');
    panel.querySelectorAll('a').forEach(function (a) { if (a.getAttribute('href') === h) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  mark(); window.addEventListener('hashchange', mark);
  btn.addEventListener('click', function () { mark(); panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', String(!panel.hidden)); });
  document.addEventListener('click', function (e) { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  panel.querySelector('#tourReset').addEventListener('click', function () {
    try { localStorage.removeItem('lamplight:subjects'); localStorage.removeItem('lamplight:files'); localStorage.removeItem('lamplight:account'); localStorage.removeItem('lamplight:account:t1'); localStorage.removeItem('lamplight:diag'); localStorage.removeItem('lamplight:progress'); } catch (e) {}
    location.reload();
  });
})();
