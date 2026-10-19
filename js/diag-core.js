/* Lamplight diagnostic engine, shared by diagnostic.html (levels) and arena.html (the test).
   Adaptive: right answers step up a level, wrong or "don't know" step down straight away,
   with an easier question from the same week, going below level 1 if needed
   (fewer choices, then key terms, then earlier weeks or the T1 unit it builds on). */
(function () {
  const UNITS = window.LAMPLIGHT_UNITS || {};
  const DKEY = 'lamplight:diag';
  const getD = () => { try { const d = JSON.parse(localStorage.getItem(DKEY) || '{"units":{},"runs":[]}'); d.units = d.units || {}; d.runs = d.runs || []; return d; } catch (e) { return { units: {}, runs: [] }; } };
  const setD = d => { try { localStorage.setItem(DKEY, JSON.stringify(d)); } catch (e) {} };
  const norm = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rand = a => a[Math.floor(Math.random() * a.length)];
  const OK_TYPES = ['mc', 'case', 'analogy', 'fill_gap', 'type_answer'];
  const FLOOR = -2, TOP = 5;
  const PREREQ = { HPS121: 'HPS104', HPS105: 'HPS104', MMK266: 'MMK101' };

  /* difficulty 1 (recall) to 5 (create), from the skill's verb plus the question type */
  const VERB = { 1: 'identify define recognise recognize match select choose place map link position sequence describe list name', 2: 'explain distinguish classify differentiate contrast compare translate trace rank summarise', 3: 'apply calculate interpret use predict demonstrate respond align structure', 4: 'analyse analyze diagnose evaluate weigh judge', 5: 'critique design plan synthesise construct create' };
  const TYPE_ADD = { mc: -0.6, analogy: 0, fill_gap: 0, case: 0.5, type_answer: 0.5 };
  function diffOf(q, k) {
    if (q.lvl) return q.lvl; /* hand-rated difficulty, when the question has one */
    const v = (k.name.split(/\s+/)[0] || '').toLowerCase();
    let b = 2; for (const lv in VERB) if (VERB[lv].split(' ').includes(v)) b = +lv;
    return Math.max(1, Math.min(TOP, Math.round(b + (TYPE_ADD[q.type] || 0))));
  }

  function subjects() {
    const L = window.Lamplight;
    return (L && L.subjects ? L.subjects() : []).filter(s => UNITS[s.code || s.id]).map(s => Object.assign({}, s, { U: UNITS[s.code || s.id] }));
  }
  function subjectFor(code) { return subjects().find(s => s.U.code === code) || (UNITS[code] ? { U: UNITS[code], colour: '#D9D6CC', id: code } : null); }

  const weekPool = (s, wk) => wk.skills.flatMap(k => k.questions.filter(q => OK_TYPES.includes(q.type)).map(q => ({ q, k, s, w: wk, d: diffOf(q, k) })));
  const two = (right, wrongs) => { const w = wrongs.filter(x => norm(x) !== norm(right)); return w.length ? [right, rand(w)] : null; };
  const flip2 = (opts) => { const f = Math.random() < .5; return { options: f ? [opts[1], opts[0]] : opts, answer: f ? 1 : 0 }; };
  function termItems(s, wk, d) {
    const out = [];
    wk.skills.forEach(k => k.questions.filter(q => q.type === 'match').forEach(q => q.pairs.forEach(([a, b]) => {
      const opts = two(b, q.pairs.map(x => x[1])); if (!opts) return;
      out.push({ q: Object.assign({ type: 'mc', prompt: 'Which of these goes with "' + a + '"?', gen: true }, flip2(opts)), k, s, w: wk, d });
    })));
    return out;
  }
  function lowItems(s, wk, d) {
    if (d === 0) return weekPool(s, wk).filter(x => x.d <= 2 && x.q.options).map(x => {
      const opts = two(x.q.options[x.q.answer], x.q.options); if (!opts) return null;
      return Object.assign({}, x, { d: 0, q: Object.assign({}, x.q, flip2(opts), { gen: true }) });
    }).filter(Boolean);
    if (d === -1) return termItems(s, wk, -1);
    const U = s.U, earlier = U.weekList.filter(x => x.week < wk.week).reverse();
    let src = earlier.map(w2 => termItems(s, w2, -2)).find(a => a.length);
    if (!src && PREREQ[U.code] && UNITS[PREREQ[U.code]]) {
      const ps = subjectFor(PREREQ[U.code]);
      src = shuffle(ps.U.weekList).map(w2 => termItems(ps, w2, -2)).find(a => a.length);
    }
    return src || [];
  }

  /* scoring */
  const ev = x => x.d < 1 ? (x.r === 1 ? 20 + (x.d + 2) * 8 : 2) : x.r === 1 ? Math.min(98, 45 + x.d * 11) : Math.max(x.r === 0 ? 5 : 3, x.d * 11 - (x.r === 0 ? 10 : 20));
  const ablLevel = a => a >= 1 ? 10 + (a - 1) * 20 : Math.max(2, 6 + a * 2);
  function estimate(resp) {
    if (!resp.length) return null;
    const n = {}, c = {};
    resp.forEach(x => { n[x.d] = (n[x.d] || 0) + 1; if (x.r === 1) c[x.d] = (c[x.d] || 0) + 1; });
    let best = FLOOR; for (let d = FLOOR; d <= TOP; d++) if (n[d] && (c[d] || 0) / n[d] >= 0.5) best = d;
    return best + (best < TOP && n[best + 1] ? (c[best + 1] || 0) / n[best + 1] * 0.9 : 0);
  }
  /* rebuild a unit's week levels from its answer log */
  function recompute(u) {
    const resp = u.resp || [];
    const a = estimate(resp.slice(-40));
    if (a != null) u.ability = Math.round(a * 10) / 10;
    const byW = {};
    resp.forEach(x => (byW[x.w] = byW[x.w] || []).push(x));
    Object.keys(byW).forEach(w => {
      const xs = byW[w].slice(-6), m = xs.reduce((t, x) => t + ev(x), 0) / xs.length;
      u.weeks[w] = { level: Math.round(m * 0.5 + ablLevel(u.ability != null ? u.ability : 1) * 0.5), n: byW[w].length, t: xs[xs.length - 1].t };
    });
  }

  /* level for a week: diagnostic blended with practice SmartScores */
  function weekLevel(code, w) {
    const D = getD(), PR = (window.Lamplight && window.Lamplight.progress) ? window.Lamplight.progress() : {};
    const d = D.units[code] && D.units[code].weeks && D.units[code].weeks[w];
    const wk = UNITS[code].weekList.find(x => x.week === w);
    const scores = wk ? wk.skills.map(k => PR[k.id] && PR[k.id].answered ? PR[k.id].score : null).filter(v => v != null) : [];
    const prac = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const n = d ? (d.n || 2) : 0;
    if (d && prac != null) return { v: Math.round(d.level * 0.6 + prac * 0.4), n: n + 2 };
    if (d) return { v: Math.round(d.level), n };
    if (prac != null) return { v: prac, n: 2 };
    return { v: null, n: 0 };
  }
  function recSkills(code, w, max) {
    const PR = (window.Lamplight && window.Lamplight.progress) ? window.Lamplight.progress() : {};
    const wk = UNITS[code].weekList.find(x => x.week === w);
    return wk.skills.map(k => ({ k, sc: (PR[k.id] || {}).score || 0 })).filter(x => x.sc < 100).sort((a, b) => a.sc - b.sc).slice(0, max || 2);
  }

  /* ---------- a live arena session ---------- */
  function Session(scopeCodes) {
    const D = getD();
    this.codes = scopeCodes;
    this.a = {}; this.turn = 0; this.queue = []; this.recent = [];
    scopeCodes.forEach(c => { const prev = D.units[c] && D.units[c].ability; this.a[c] = prev != null ? Math.max(1, Math.floor(prev) - 1) : 1; });
    this.used = new Set();
  }
  Session.prototype.next = function () {
    let slot = this.queue.shift();
    if (!slot) {
      const code = this.codes[this.turn++ % this.codes.length], s = subjectFor(code), D = getD(), u = D.units[code] || { weeks: {} };
      /* least-known week first, avoiding the last few asked */
      const weeks = shuffle(s.U.weekList).filter(w => !this.recent.includes(code + w.week));
      const pickFrom = weeks.length ? weeks : s.U.weekList;
      pickFrom.sort((x, y) => ((u.weeks[x.week] || {}).n || 0) - ((u.weeks[y.week] || {}).n || 0));
      slot = { s, w: pickFrom[0], depth: 0 };
    }
    let target = Math.round(this.a[slot.s.U.code]);
    if (slot.below != null) target = Math.min(target, slot.below - 1);
    target = Math.max(FLOOR, Math.min(TOP, target));
    let item = null;
    for (let d = target; d <= 0 && !item; d++) { const low = lowItems(slot.s, slot.w, d).filter(x => !this.used.has(x.q.prompt)); if (low.length) item = rand(low); }
    if (!item) {
      let pool = weekPool(slot.s, slot.w).filter(x => !this.used.has(x.q.prompt));
      if (!pool.length) pool = weekPool(slot.s, slot.w);
      /* after a miss, only something genuinely easier will do; if this week has nothing easier, use the easier steps */
      if (slot.below != null) {
        const easier = pool.filter(x => x.d < slot.below);
        if (easier.length) pool = easier;
        else for (let d = 0; d >= FLOOR && !item; d--) { const low = lowItems(slot.s, slot.w, d).filter(x => !this.used.has(x.q.prompt)); if (low.length) item = rand(low); }
      }
    }
    if (!item) {
      let pool = weekPool(slot.s, slot.w).filter(x => !this.used.has(x.q.prompt));
      if (!pool.length) pool = weekPool(slot.s, slot.w);
      if (slot.below != null && pool.some(x => x.d < slot.below)) pool = pool.filter(x => x.d < slot.below);
      const best = Math.min(...pool.map(x => Math.abs(x.d - Math.max(1, target))));
      item = rand(pool.filter(x => Math.abs(x.d - Math.max(1, target)) === best));
    }
    this.used.add(item.q.prompt);
    this.recent = this.recent.concat(slot.s.U.code + slot.w.week).slice(-4);
    this.cur = { item, slot };
    return item;
  };
  /* r: 1 right, 0 wrong, -1 don't know */
  Session.prototype.answer = function (r) {
    const { item, slot } = this.cur, code = slot.s.U.code;
    if (r === 1) this.a[code] = Math.min(TOP, item.d + 1);
    else this.a[code] = Math.max(FLOOR, item.d - 1);
    if (r !== 1 && item.d > FLOOR && slot.depth < 7) this.queue.unshift({ s: slot.s, w: slot.w, below: item.d, depth: slot.depth + 1 });
    const D = getD(), t = Date.now();
    const u = D.units[code] = D.units[code] || { weeks: {} };
    u.weeks = u.weeks || {};
    u.resp = (u.resp || []).concat({ w: slot.w.week, d: item.d, r, t }).slice(-300);
    recompute(u);
    const last = D.runs[D.runs.length - 1];
    if (last && t - last.t < 30 * 60 * 1000) { last.t = t; last.n++; if (r === 1) last.correct++; }
    else D.runs.push({ t, n: 1, correct: r === 1 ? 1 : 0 });
    setD(D);
  };

  window.LamplightDiag = { UNITS, getD, setD, norm, shuffle, subjects, subjectFor, weekLevel, recSkills, Session };
})();
