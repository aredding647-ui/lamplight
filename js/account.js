/* Lamplight: Anna's example account. Seeds her profile and T2 units into this browser once. */
(function () {
  var FLAG = 'lamplight:account', FLAG2 = 'lamplight:account:t1', SUBS = 'lamplight:subjects', PROF = 'lamplight:profile';
  var PROFILE = { name: 'Anna Redding', uni: 'Deakin University', course: 'Bachelor of Marketing (Psychology)', year: '1st year', period: 'Trimester', goal: 20, lightsAt: '21:00', remind: true };
  var UNITS = [
    { id: 'HPS121', name: 'Introduction to Psychology', code: 'HPS121', weeks: 11, colour: 'var(--hl-blue)', term: 'T2 2026' },
    { id: 'HPS105', name: 'Foundations of Psychological Practice', code: 'HPS105', weeks: 11, colour: 'var(--hl-green)', term: 'T2 2026' },
    { id: 'MMK266', name: 'Consumer Behaviour', code: 'MMK266', weeks: 10, colour: 'var(--hl-orange)', term: 'T2 2026' }
  ];
  var COMPLETED = [
    { id: 'MMK101', name: 'Marketing Fundamentals', code: 'MMK101', weeks: 11, colour: 'var(--hl-pink)', term: 'T1 2026', done: true },
    { id: 'HPS104', name: 'Foundations of Psychological Science', code: 'HPS104', weeks: 10, colour: 'var(--hl-yellow)', term: 'T1 2026', done: true }
  ];
  function get(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  if (!get(FLAG, null)) {
    var mine = get(SUBS, []).filter(function (s) { return !UNITS.some(function (u) { return u.id === s.id; }); });
    set(SUBS, UNITS.concat(mine));
    set(PROF, Object.assign({}, get(PROF, {}), PROFILE));
    set(FLAG, { seeded: Date.now() });
  }
  if (!get(FLAG2, null)) {
    var list = get(SUBS, []);
    COMPLETED.forEach(function (c) { if (!list.some(function (s) { return s.id === c.id; })) list.push(c); });
    set(SUBS, list); set(FLAG2, { seeded: Date.now() });
  }
  window.Lamplight = window.Lamplight || {};
  window.Lamplight.profile = function () { return get(PROF, PROFILE); };
  window.Lamplight.completed = COMPLETED;
  window.Lamplight.progress = function () { return get('lamplight:progress', {}); };
  window.Lamplight.saveProgress = function (p) { set('lamplight:progress', p); };
  function paint() {
    var p = window.Lamplight.profile(), first = (p.name || '').trim().split(/\s+/)[0];
    document.querySelectorAll('.avatar').forEach(function (a) { if (first) { a.textContent = first[0].toUpperCase(); a.setAttribute('aria-label', 'Your account: ' + p.name); a.title = p.name; } });
    document.querySelectorAll('[data-first-name]').forEach(function (el) { if (first) el.textContent = first; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();
})();
