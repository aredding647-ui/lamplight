/* Lamplight: turns a week's notes into skills and questions, right in the browser. No AI, no cost.
   1. extract(): reads PDF, PowerPoint (.pptx), Word (.docx), text and Markdown into sections of lines.
   2. build(): finds definitions, key terms and fact sentences, then writes questions in the same
      format as the hand-built banks (multiple choice, true or false, fill the gap, type the answer,
      match, put in order, fix the error). */
(function () {
  var CDN = {
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
  };
  var loaded = {};
  function load(src) {
    if (!loaded[src]) loaded[src] = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Could not load a reader. Check your internet connection.')); }; document.head.appendChild(s); });
    return loaded[src];
  }
  var ext = function (n) { return (n.split('.').pop() || '').toLowerCase(); };
  var READABLE = ['pdf', 'pptx', 'docx', 'txt', 'md', 'markdown'];
  function canRead(name) { return READABLE.indexOf(ext(name)) > -1; }

  /* ---------- reading files ---------- */
  function readText(f) { return f.text ? f.text() : new Promise(function (r) { var fr = new FileReader(); fr.onload = function () { r(fr.result); }; fr.readAsText(f); }); }
  function readBuf(f) { return f.arrayBuffer ? f.arrayBuffer() : new Promise(function (r) { var fr = new FileReader(); fr.onload = function () { r(fr.result); }; fr.readAsArrayBuffer(f); }); }

  async function fromPDF(f) {
    await load(CDN.pdf);
    var lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
    var doc = await lib.getDocument({ data: await readBuf(f) }).promise, out = [];
    for (var p = 1; p <= doc.numPages; p++) {
      var tc = await (await doc.getPage(p)).getTextContent(), rows = [], last = null;
      tc.items.forEach(function (it) {
        if (!it.str) return;
        var y = Math.round(it.transform[5]);
        if (last && Math.abs(last.y - y) < 3) last.t += (last.t && !/\s$/.test(last.t) && !/^\s/.test(it.str) ? ' ' : '') + it.str;
        else { last = { y: y, t: it.str, h: Math.abs(it.transform[3]) }; rows.push(last); }
      });
      var lines = rows.map(function (r) { return r.t.trim(); }).filter(Boolean);
      if (!lines.length) continue;
      var big = rows.slice().sort(function (a, b) { return b.h - a.h; })[0];
      var title = big && big.t.trim().length < 90 && big.h > (rows[Math.floor(rows.length / 2)] || big).h ? big.t.trim() : (lines[0].length < 90 ? lines[0] : '');
      out.push({ title: title, lines: lines.filter(function (l) { return l !== title; }) });
    }
    return out;
  }
  function xmlParas(xml, pTag, tTag) {
    var d = new DOMParser().parseFromString(xml, 'application/xml');
    return Array.prototype.map.call(d.getElementsByTagName(pTag), function (p) { return { t: Array.prototype.map.call(p.getElementsByTagName(tTag), function (t) { return t.textContent; }).join('').trim(), el: p }; }).filter(function (x) { return x.t; });
  }
  async function fromPPTX(f) {
    await load(CDN.zip);
    var z = await window.JSZip.loadAsync(await readBuf(f)), out = [];
    var slides = Object.keys(z.files).filter(function (n) { return /^ppt\/slides\/slide\d+\.xml$/.test(n); }).sort(function (a, b) { return +a.match(/\d+/)[0] - +b.match(/\d+/)[0]; });
    for (var i = 0; i < slides.length; i++) {
      var ps = xmlParas(await z.file(slides[i]).async('string'), 'a:p', 'a:t').map(function (x) { return x.t; });
      var num = slides[i].match(/\d+/)[0], nf = z.file('ppt/notesSlides/notesSlide' + num + '.xml');
      if (nf) { var notes = xmlParas(await nf.async('string'), 'a:p', 'a:t').map(function (x) { return x.t; }).filter(function (t) { return !/^\d+$/.test(t); }); ps = ps.concat(notes); }
      if (ps.length) out.push({ title: ps[0].length < 90 ? ps[0] : '', lines: ps[0].length < 90 ? ps.slice(1) : ps });
    }
    return out;
  }
  async function fromDOCX(f) {
    await load(CDN.zip);
    var z = await window.JSZip.loadAsync(await readBuf(f)), file = z.file('word/document.xml');
    if (!file) return [];
    var ps = xmlParas(await file.async('string'), 'w:p', 'w:t'), out = [], cur = { title: '', lines: [] };
    ps.forEach(function (p) {
      var st = p.el.getElementsByTagName('w:pStyle')[0], sv = st ? (st.getAttribute('w:val') || '') : '';
      if (/heading|title/i.test(sv) && p.t.length < 120) { if (cur.lines.length || cur.title) out.push(cur); cur = { title: p.t, lines: [] }; }
      else cur.lines.push(p.t);
    });
    if (cur.lines.length || cur.title) out.push(cur);
    return out;
  }
  async function fromText(f) {
    var t = await readText(f), out = [], cur = { title: '', lines: [] };
    t.split(/\r?\n/).forEach(function (l) {
      var m = l.match(/^\s{0,3}#{1,4}\s+(.+)/);
      if (m) { if (cur.lines.length || cur.title) out.push(cur); cur = { title: m[1].trim(), lines: [] }; }
      else if (l.trim()) cur.lines.push(l.trim());
    });
    if (cur.lines.length || cur.title) out.push(cur);
    return out;
  }
  async function extract(files, onStep) {
    var docs = [], skipped = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i], e = ext(f.name);
      if (!canRead(f.name)) { skipped.push(f.name); continue; }
      if (onStep) onStep('Reading ' + f.name);
      try {
        var secs = e === 'pdf' ? await fromPDF(f) : e === 'pptx' ? await fromPPTX(f) : e === 'docx' ? await fromDOCX(f) : await fromText(f);
        docs.push({ name: f.name, sections: secs });
      } catch (err) { skipped.push(f.name); }
    }
    return { docs: docs, skipped: skipped };
  }

  /* ---------- understanding the text ---------- */
  var STOP = ('a an the and or but if of to in on at by for with from as is are was were be been being this that these those it its they them their there here we you he she his her our your i me my not no so than then too very can could should would will may might must do does did done have has had which who whom whose what when where why how all any each few more most other some such only own same just also into over under about after before between through during up down out off again further once both either neither nor per via vs etc e.g i.e week lecture slide topic chapter').split(' ');
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });
  var BORING = /^(week\s*\d+|lecture\s*\d*|topic\s*\d*|module\s*\d*|outline|overview|agenda|contents|learning (outcomes|objectives)|objectives|references?|reading(s)?|questions\??|any questions\??|summary|recap|review|thank you|acknowledg|copyright|today|introduction|intro|welcome|key (terms|concepts)|discussion|activity|break)\b/i;
  var GENERIC = {}; ('information process processes people person between different important example examples research however because behaviour behavior individual individuals change changes social within without through another something someone things others another related include includes including several general overall particular specific various called example using based factors factor approach approaches system systems theory theories model models memory learning development understanding experience experiences').split(' ').forEach(function (w) { GENERIC[w] = 1; });
  var PRON = /^(this|it|they|these|those|there|he|she|we|you|that|which|such|here|i|one|another|some|many|most|all|each|both|our|their|its)\b/i;
  var clean = function (s) { return String(s || '').replace(/ /g, ' ').replace(/[•▪●◦‣⁃∙]/g, ' ').replace(/\s+/g, ' ').trim(); };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var words = function (s) { return s.split(/\s+/).filter(Boolean); };
  var trimTo = function (s, n) { if (s.length <= n) return s; var c = s.slice(0, n); c = c.slice(0, c.lastIndexOf(' ')); return c.replace(/[,;:(]+$/, '') + '…'; };
  var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  var shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

  function tidyLines(lines) {
    var out = [];
    lines.map(clean).forEach(function (l) {
      if (!l || l.length < 3 || /^\d+(\s*\/\s*\d+)?$/.test(l) || /^(https?:|www\.)/i.test(l) || /^©|copyright|all rights reserved/i.test(l)) return;
      var prev = out[out.length - 1];
      if (prev && !/[.!?:;]$/.test(prev) && /^[a-z(]/.test(l) && !/^\d+[.)]/.test(l)) out[out.length - 1] = prev + ' ' + l;
      else out.push(l);
    });
    return out;
  }
  function sentencesOf(lines) {
    var out = [];
    lines.forEach(function (l) { l.replace(/^[-*–]\s*/, '').split(/(?<=[.!?])\s+(?=[A-Z"“(])/).forEach(function (s) { s = s.trim(); if (s) out.push(s); }); });
    return out;
  }
  function goodTerm(t) {
    t = t.replace(/^["“'‘(]+|["”'’),.:;]+$/g, '').replace(/^(the|a|an)\s+/i, '').trim();
    var w = words(t);
    if (!t || t.length < 3 || t.length > 48 || w.length > 5) return null;
    if (PRON.test(t) || /\d{3,}/.test(t) || /[.!?]/.test(t)) return null;
    if (w.every(function (x) { return STOPSET[x.toLowerCase()]; })) return null;
    if (STOPSET[w[w.length - 1].toLowerCase()]) return null;
    return t;
  }
  function findDefs(sentences, lines) {
    var defs = [], seen = {};
    function add(term, def, src) {
      term = goodTerm(term || ''); if (!term) return;
      def = clean(def).replace(/^(is|are|means|refers to|:|-|–)\s*/i, '').replace(/[;,:]$/, '');
      if (words(def).length < 4 || def.length > 320) return;
      if (new RegExp('\\b' + esc(term) + '\\b', 'i').test(def)) return;
      var k = term.toLowerCase(); if (seen[k]) return; seen[k] = 1;
      defs.push({ term: term, def: cap(def.replace(/\.$/, '')), src: src });
    }
    lines.forEach(function (l) {
      var m = l.match(/^[-*–]?\s*([A-Z][^:–—]{1,48}?)\s*(?::|\s[–—-]\s)\s*(.{12,})$/);
      if (m) add(m[1], m[2], l);
    });
    sentences.forEach(function (s) {
      var m = s.match(/^(?:the |a |an )?([A-Za-z][\w'’ -]{1,48}?)\s+(?:is|are)\s+(?:defined as|known as|described as|called)?\s*((?:a|an|the|when|how|where|any|one|our|people's|someone's)\b.{12,})$/i)
        || s.match(/^(?:the |a |an )?([A-Za-z][\w'’ -]{1,48}?)\s+(?:refers to|is defined as|are defined as|means|describes|involves|occurs when|happens when)\s+(.{12,})$/i);
      if (m) add(m[1], m[2], s);
      var n = s.match(/^(.{15,}?)\s+(?:is|are)\s+(?:called|known as|termed|referred to as)\s+["“']?([A-Za-z][\w'’ -]{2,40}?)["”']?\.?$/i);
      if (n) add(n[2], n[1], s);
    });
    return defs;
  }
  function keyTerms(sentences, defs) {
    var count = {};
    sentences.forEach(function (s) {
      words(s.replace(/[^A-Za-z'’\- ]/g, ' ')).forEach(function (w) { var k = w.toLowerCase(); if (k.length >= 6 && !STOPSET[k]) count[k] = (count[k] || 0) + 1; });
    });
    var list = Object.keys(count).filter(function (k) { return count[k] >= 3 && !GENERIC[k]; }).sort(function (a, b) { return count[b] - count[a]; }).slice(0, 40);
    defs.forEach(function (d) { if (list.indexOf(d.term.toLowerCase()) < 0) list.unshift(d.term.toLowerCase()); });
    return list;
  }

  /* ---------- writing questions ---------- */
  function mcq(prompt, right, wrongs, expl) {
    var opts = shuffle([right].concat(wrongs.slice(0, 3)));
    return { type: 'mc', prompt: prompt, options: opts, answer: opts.indexOf(right), explanation: expl };
  }
  function answersFor(term) {
    var t = term.trim(), a = [t];
    if (/s$/i.test(t)) a.push(t.replace(/s$/i, '')); else if (!/(y|ory|ing|ence|ance|ism)$/i.test(t)) a.push(t + 's');
    if (/ise/.test(t)) a.push(t.replace(/ise/g, 'ize')); if (/ize/.test(t)) a.push(t.replace(/ize/g, 'ise'));
    return a;
  }
  function buildChunk(ch, all) {
    var qs = [], used = {};
    var push = function (q) { var k = q.type + '|' + q.prompt + '|' + (q.text || '') + '|' + (q.sentence || ''); if (!used[k]) { used[k] = 1; qs.push(q); } };
    var otherTerms = function (d) { return shuffle(all.defs.filter(function (x) { return x !== d; }).map(function (x) { return x.term; })); };
    var otherDefs = function (d) { return shuffle(all.defs.filter(function (x) { return x !== d; }).map(function (x) { return trimTo(x.def, 130); })); };
    ch.defs.forEach(function (d) {
      var expl = cap(d.term) + ': ' + d.def + '.';
      var ot = otherTerms(d), od = otherDefs(d);
      if (ot.length >= 3) push(mcq('Which term matches this description? "' + trimTo(d.def, 220) + '"', d.term, ot, expl));
      if (od.length >= 3) push(mcq('What does "' + d.term + '" mean?', trimTo(d.def, 130), od, expl));
      push({ type: 'type_answer', prompt: trimTo(d.def, 240) + '. What is this called?', answers: answersFor(d.term), explanation: expl });
      var re = new RegExp('\\b' + esc(d.term) + '\\b', 'i');
      if (re.test(d.src) && d.src.length < 260) push({ type: 'fill_gap', prompt: 'Complete the sentence from your notes.', text: d.src.replace(re, '___'), answers: answersFor(d.term), explanation: d.src });
    });
    var pool = ch.defs.length >= 3 ? ch.defs : all.defs;
    if (pool.length >= 3) {
      var pick = shuffle(pool).slice(0, 4);
      push({ type: 'match', prompt: 'Match each term to its meaning.', pairs: pick.map(function (d) { return [d.term, trimTo(d.def, 70)]; }), explanation: pick.map(function (d) { return d.term + ': ' + trimTo(d.def, 90); }).join('. ') + '.' });
    }
    /* swaps only happen between sister terms, like 'short-term memory' and 'long-term memory' */
    var fam = {}; all.defs.forEach(function (d) { var w = words(d.term); if (w.length >= 2) { var tail = w.slice(1).join(' ').toLowerCase(); (fam[tail] = fam[tail] || []).indexOf(w[0].toLowerCase()) < 0 && fam[tail].push(w[0].toLowerCase()); } });
    var sister = function (s) {
      for (var tail in fam) { if (fam[tail].length < 2) continue;
        for (var k = 0; k < fam[tail].length; k++) { var m = s.match(new RegExp('\\b(' + esc(fam[tail][k]) + ')\\s+' + esc(tail) + '\\b', 'i'));
          if (m) { var alt = fam[tail].filter(function (h) { return h !== fam[tail][k] && !new RegExp('\\b' + esc(h) + '\\s+' + esc(tail) + '\\b', 'i').test(s); }); if (alt.length) return { orig: m[1], alt: alt[Math.floor(Math.random() * alt.length)] }; } } }
      return null;
    };
    ch.facts.forEach(function (s, i) {
      var hit = all.defs.map(function (d) { return d.term; }).concat(all.terms).filter(function (t, k, arr) { return arr.indexOf(t) === k && !GENERIC[t.toLowerCase()] && new RegExp('\\b' + esc(t) + '\\b', 'i').test(s); });
      if (!hit.length) return;
      var t = hit[0], re = new RegExp('\\b' + esc(t) + '\\b', 'i');
      if (i % 3 === 0) push({ type: 'fill_gap', prompt: 'Complete the sentence from your notes.', text: s.replace(re, '___'), answers: answersFor(s.match(re)[0]), explanation: s });
      var sw = sister(s);
      if (sw && i % 3 === 1) {
        var wrong = /^[A-Z]/.test(sw.orig) ? cap(sw.alt) : sw.alt;
        push({ type: 'fix_error', prompt: 'One word is wrong. Find it and fix it.', sentence: s.replace(new RegExp('\\b' + esc(sw.orig) + '\\b'), wrong), wrong: wrong, correct: sw.orig, explanation: s });
      } else if (sw && i % 3 === 2) {
        var fal = Math.random() < 0.5, w2 = /^[A-Z]/.test(sw.orig) ? cap(sw.alt) : sw.alt;
        var shown = fal ? s.replace(new RegExp('\\b' + esc(sw.orig) + '\\b'), w2) : s;
        push({ type: 'mc', prompt: 'True or false? "' + shown + '"', options: ['True', 'False'], answer: fal ? 1 : 0, explanation: fal ? 'False. Your notes say: ' + s : 'True. ' + s });
      }
    });
    ch.lists.forEach(function (L) {
      push({ type: 'order', prompt: 'Put these in order: ' + trimTo(L.title, 80), items: L.items, explanation: L.title + ': ' + L.items.join(', then ') + '.' });
    });
    return qs;
  }

  function build(opts) {
    var code = opts.code, week = opts.week, docs = opts.docs || [];
    var sections = [];
    docs.forEach(function (d) { d.sections.forEach(function (s) { sections.push({ title: clean(s.title), lines: tidyLines(s.lines || []), doc: d.name }); }); });
    sections = sections.filter(function (s) { return s.lines.length || s.title; });
    if (!sections.length) return { error: 'Couldn\'t find any text in these files. If they\'re scanned images, save them as text-based PDFs first.' };

    /* lists that have an order: numbered lines, or titles about stages, steps and sequences */
    sections.forEach(function (s) {
      s.lists = [];
      var nums = s.lines.filter(function (l) { return /^\d+[.)]\s+\S/.test(l); });
      var shortLines = s.lines.filter(function (l) { return words(l).length <= 9 && l.length < 70; });
      if (nums.length >= 3 && nums.length <= 7) s.lists.push({ title: s.title || 'the steps in your notes', items: nums.map(function (l) { return trimTo(l.replace(/^\d+[.)]\s+/, '').replace(/[.:;]$/, ''), 60); }) });
      else if (/\b(stages?|steps?|process|phases?|sequence|cycle|timeline|order|levels?|hierarchy)\b/i.test(s.title) && shortLines.length >= 3 && shortLines.length <= 7 && shortLines.length === s.lines.length)
        s.lists.push({ title: s.title, items: shortLines.map(function (l) { return l.replace(/^[-*–]\s*/, '').replace(/[.:;]$/, ''); }) });
    });

    var allLines = [], allSent = [];
    sections.forEach(function (s) { allLines = allLines.concat(s.lines); });
    allSent = sentencesOf(allLines);
    var defs = findDefs(allSent, allLines);
    var terms = keyTerms(allSent, defs);
    var isFact = function (s) { var n = words(s).length; return n >= 8 && n <= 40 && /[.!]$/.test(s) && !PRON.test(s) && !/\?$/.test(s) && !/^(see|read|click|note|source|figure|table|adapted)\b/i.test(s); };

    /* group sections into skills, each needing enough material */
    var chunks = [], cur = null;
    sections.forEach(function (s) {
      var sent = sentencesOf(s.lines);
      var d = defs.filter(function (x) { return s.lines.some(function (l) { return l.indexOf(x.src) > -1 || (l.length > 25 && x.src.indexOf(l) > -1); }); });
      var facts = sent.filter(isFact);
      var weight = d.length * 3 + facts.length + s.lists.length * 3;
      var title = s.title && !BORING.test(s.title) && s.title.length > 3 ? s.title : '';
      if (!cur || (title && cur.weight >= 6) || cur.weight >= 18) { cur = { title: title, best: title ? weight : -1, defs: [], facts: [], lists: [], weight: 0, docs: {} }; chunks.push(cur); }
      if (title && weight > cur.best) { cur.title = title; cur.best = weight; }
      cur.defs = cur.defs.concat(d.filter(function (x) { return cur.defs.indexOf(x) < 0; }));
      cur.facts = cur.facts.concat(facts); cur.lists = cur.lists.concat(s.lists); cur.weight += weight; cur.docs[s.doc] = 1;
    });
    chunks = chunks.filter(function (c) { return c.weight > 0; });
    /* merge tiny groups into their neighbour, and keep it to 8 skills at most */
    for (var i = chunks.length - 1; i > 0; i--) if (chunks[i].weight < 5) { var p = chunks[i - 1]; p.defs = p.defs.concat(chunks[i].defs); p.facts = p.facts.concat(chunks[i].facts); p.lists = p.lists.concat(chunks[i].lists); p.weight += chunks[i].weight; if (!p.title) p.title = chunks[i].title; chunks.splice(i, 1); }
    while (chunks.length > 8) { var a = chunks.pop(), b = chunks[chunks.length - 1]; b.defs = b.defs.concat(a.defs); b.facts = b.facts.concat(a.facts); b.lists = b.lists.concat(a.lists); b.weight += a.weight; }

    var all = { defs: defs, terms: terms };
    var skills = [], n = 0;
    chunks.forEach(function (c) {
      var qs = shuffle(buildChunk(c, all)).slice(0, 12);
      if (qs.length < 3) return;
      n++;
      var t = c.title ? trimTo(c.title.replace(/[:.]$/, ''), 60) : (c.defs[0] ? c.defs[0].term : 'key ideas, part ' + n);
      var verb = c.defs.length >= 2 ? 'Define key terms' : c.lists.length ? 'Recall the order' : 'Recall facts';
      skills.push({ id: code + '-' + week + '.' + n, name: verb + ': ' + t, summary: 'Made from ' + Object.keys(c.docs).join(', ') + '. ' + qs.length + ' questions.', questions: qs, generated: true });
    });
    if (!skills.length) return { error: 'Couldn\'t find enough definitions or facts to make questions. Notes with full sentences and "term: meaning" lines work best.' };
    var titles = sections.map(function (s) { return s.title; }).filter(function (t) { return t && !BORING.test(t) && t.length > 3 && t.length < 70; });
    var topic = titles[0] || docs[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b(week|wk|lecture|lec|slides?|notes?)\s*\d*\b/gi, '').trim() || 'Week ' + week;
    return { week: { week: week, topic: trimTo(topic, 70), summary: 'Made automatically from ' + docs.map(function (d) { return d.name; }).join(', ') + '.', skills: skills, generated: true, made: Date.now() },
      stats: { skills: skills.length, questions: skills.reduce(function (a, s) { return a + s.questions.length; }, 0), defs: defs.length } };
  }

  window.LamplightGen = { extract: extract, build: build, canRead: canRead };
})();
