/* Lamplight: the profile menu (tap the avatar, top right) and lights going down at bedtime.
   Load in <head> after js/sync.js on every page with an avatar. */
(function () {
  function read(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var profile = function () { return read('lamplight:profile', {}) || {}; };

  /* ---------- lights down at bedtime ---------- */
  (function bedtime() {
    var p = profile(); if (!p.autoDark || !p.lightsAt) return;
    var t = p.lightsAt.split(':').map(Number), n = new Date(), mins = n.getHours() * 60 + n.getMinutes(), bed = t[0] * 60 + (t[1] || 0);
    var night = mins >= bed || mins < 6 * 60, root = document.documentElement;
    var autoSet = read('lamplight:theme-auto', null);
    if (night && !root.hasAttribute('data-theme')) { var skip = read('lamplight:theme-manual', null); if (!skip || skip.day !== n.toDateString()) { root.setAttribute('data-theme', 'dark'); try { localStorage.setItem('lamplight:theme-auto', '1'); } catch (e) {} } }
    if (!night && autoSet) { try { localStorage.removeItem('lamplight:theme-auto'); } catch (e) {} if (localStorage.getItem('lamplight:theme') === 'dark') { root.removeAttribute('data-theme'); try { localStorage.setItem('lamplight:theme', 'light'); } catch (e) {} } }
  })();

  var css = document.createElement('style');
  css.textContent =
    '.pmenu{position:fixed;z-index:90;width:min(92vw,320px);background:var(--card);color:var(--ink);border:2.5px solid var(--ink);border-radius:20px;box-shadow:0 8px 0 var(--shadow);padding:10px;animation:pmIn .14s ease-out}' +
    '@keyframes pmIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}' +
    '.pmenu .who{display:flex;gap:12px;align-items:center;padding:10px 10px 14px;border-bottom:2px solid var(--paper-2);margin-bottom:6px}' +
    '.pmenu .big{flex:none;width:48px;height:48px;border-radius:14px;border:2px solid var(--ink);background:var(--hl-pink);color:#141414;display:grid;place-items:center;font:800 22px var(--font-display)}' +
    '.pmenu .who b{display:block;font-size:16px;line-height:1.2}.pmenu .who small{display:block;color:var(--muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:210px}' +
    '.pmenu .st{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--ink-2);margin-top:3px}.pmenu .st i{width:9px;height:9px;border-radius:99px;background:var(--good)}' +
    '.pmenu .st.off i{background:var(--line)}.pmenu .st.err i{background:var(--bad)}.pmenu .st.sync i{background:var(--hl-yellow)}' +
    '.pmenu a,.pmenu button.row{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:12px;padding:10px 10px;border-radius:12px;font-weight:600;font-size:15px;cursor:pointer;color:var(--ink)}' +
    '.pmenu a:hover,.pmenu button.row:hover,.pmenu a:focus-visible,.pmenu button.row:focus-visible{background:var(--paper-2)}' +
    '.pmenu a small{margin-left:auto;color:var(--muted);font-weight:500;font-size:12.5px}' +
    '.pmenu svg{flex:none;color:var(--muted)}' +
    '.pmenu hr{border:0;border-top:2px solid var(--paper-2);margin:6px 0}' +
    '.pmenu .sw{margin-left:auto;width:38px;height:22px;border-radius:99px;background:var(--line);position:relative;transition:background .15s}.pmenu .sw::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:var(--card);transition:left .15s}' +
    '.pmenu .sw.on{background:var(--ink)}.pmenu .sw.on::after{left:19px}' +
    '.pmenu .signin{all:unset;box-sizing:border-box;display:block;text-align:center;width:100%;margin-top:6px;padding:12px;border-radius:12px;border:2.5px solid var(--ink);background:var(--hl-yellow);color:#141414;font-weight:700;cursor:pointer;box-shadow:0 3px 0 var(--shadow)}' +
    '.pmenu .out{color:var(--bad)}.pmenu .out svg{color:var(--bad)}';
  (document.head || document.documentElement).appendChild(css);

  var I = {
    home: '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19V5"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>'
  };
  var ic = function (k) { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[k] + '</svg>'; };

  var menu = null, owner = null;
  function close() { if (menu) { menu.remove(); menu = null; if (owner) owner.setAttribute('aria-expanded', 'false'); } }
  function open(av) {
    close(); owner = av;
    var p = profile(), S = window.LamplightSync, info = S ? S.info() : { signedIn: false };
    var name = String(p.name || '').trim(), initial = (name || 'L')[0].toUpperCase();
    var st = !info.ready ? ['off', 'Saving on this device only'] : !info.signedIn ? ['off', 'Not signed in'] : info.status === 'error' ? ['err', 'Couldn’t save just now'] : info.status === 'syncing' ? ['sync', 'Saving'] : ['', 'Saved to the cloud'];
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    menu = document.createElement('div'); menu.className = 'pmenu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Your account');
    menu.innerHTML = '<div class="who"><span class="big">' + esc(initial) + '</span><div><b>' + esc(name || 'Your Lamplight') + '</b><small>' + esc(info.signedIn ? info.email : (p.course || 'Not signed in')) + '</small><span class="st ' + st[0] + '"><i></i>' + st[1] + '</span></div></div>' +
      '<a role="menuitem" href="dashboard.html">' + ic('home') + 'Dashboard</a>' +
      '<a role="menuitem" href="account.html#profile">' + ic('user') + 'Profile<small>name, uni, course</small></a>' +
      '<a role="menuitem" href="account.html#study">' + ic('moon') + 'Study and bedtime<small>goal, lights off</small></a>' +
      '<a role="menuitem" href="account.html#subjects">' + ic('book') + 'My subjects</a>' +
      '<a role="menuitem" href="awards.html">' + ic('award') + 'Awards</a>' +
      '<a role="menuitem" href="account.html#account">' + ic('gear') + 'Account and settings</a>' +
      '<button type="button" class="row" role="menuitemcheckbox" aria-checked="' + dark + '" data-lights>' + ic('moon') + 'Lights off<span class="sw' + (dark ? ' on' : '') + '"></span></button>' +
      '<hr>' + (info.signedIn ? '<button type="button" class="row out" role="menuitem" data-out>' + ic('out') + 'Sign out</button>' : '<a class="signin" href="account.html#account">Sign in</a>');
    document.body.appendChild(menu);
    var r = av.getBoundingClientRect(), w = menu.offsetWidth;
    menu.style.top = Math.round(r.bottom + 10) + 'px';
    menu.style.left = Math.round(Math.max(12, Math.min(window.innerWidth - w - 12, r.right - w))) + 'px';
    av.setAttribute('aria-expanded', 'true');
    var first = menu.querySelector('a,button'); if (first) first.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    var av = e.target.closest && e.target.closest('a.avatar');
    if (av) { e.preventDefault(); if (menu && owner === av) close(); else open(av); return; }
    if (!menu) return;
    if (e.target.closest('[data-lights]')) {
      var root = document.documentElement, dark = root.getAttribute('data-theme') === 'dark';
      if (dark) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('lamplight:theme-manual', JSON.stringify({ day: new Date().toDateString() })); localStorage.removeItem('lamplight:theme-auto'); } catch (err) {}
      var b = e.target.closest('[data-lights]'); b.setAttribute('aria-checked', String(!dark)); b.querySelector('.sw').classList.toggle('on', !dark);
      return;
    }
    if (e.target.closest('[data-out]')) { var S = window.LamplightSync; if (S) S.signOut().then(function () { location.href = 'account.html#account'; }); return; }
    if (!menu.contains(e.target)) close();
  });
  document.addEventListener('keydown', function (e) {
    if (!menu) return;
    if (e.key === 'Escape') { var o = owner; close(); if (o) o.focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var items = [].slice.call(menu.querySelectorAll('a,button')), i = items.indexOf(document.activeElement); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
  });
  window.addEventListener('resize', close);
  /* the lights button in the top bar counts as choosing for yourself tonight */
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#lights,#navLights')) { try { localStorage.setItem('lamplight:theme-manual', JSON.stringify({ day: new Date().toDateString() })); localStorage.removeItem('lamplight:theme-auto'); } catch (err) {} } }, true);
  function paint() {
    var name = String(profile().name || '').trim();
    document.querySelectorAll('a.avatar').forEach(function (a) { if (name) a.textContent = name[0].toUpperCase(); a.setAttribute('aria-haspopup', 'menu'); a.setAttribute('aria-expanded', 'false'); a.setAttribute('aria-label', 'Your account menu'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();
})();
