/* Lamplight: the second menu bar under "Learning".
   Subject tabs come from the subjects the student has added.
   In this prototype they're saved in the browser (localStorage); later they come from the student's account. */
(function () {
  var KEY = 'lamplight:subjects';
  var COLOURS = [
    { name: 'Yellow', v: 'var(--hl-yellow)' }, { name: 'Pink', v: 'var(--hl-pink)' },
    { name: 'Blue', v: 'var(--hl-blue)' }, { name: 'Green', v: 'var(--hl-green)' }, { name: 'Orange', v: 'var(--hl-orange)' }
  ];
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  window.Lamplight = window.Lamplight || {};
  window.Lamplight.subjects = load;
  window.Lamplight.saveSubjects = save;
  window.Lamplight.esc = esc;

  var TOOLS = [
    { key: 'foryou', name: 'For you', href: 'recommendations.html',
      icon: '<path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.9 6.4 20.1l1.4-6.3L3 9.5l6.4-.6Z"/>' },
    { key: 'plans', name: 'Skill plans', href: 'skill-plans.html',
      icon: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>' },
    { key: 'awards', name: 'Awards', href: 'awards.html',
      icon: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5"/>' }
  ];

  var mount = document.getElementById('subnav');

  function current() {
    if (!mount) return '';
    var c = mount.getAttribute('data-current') || '';
    if (c === 'subject') return 'subject:' + (location.hash.slice(1) || '');
    if (c === 'unit') return 'subject:' + (mount.getAttribute('data-unit') || '');
    return c;
  }

  function render() {
    if (!mount) return;
    var list = load(), cur = current();
    var html = '<div class="wrap"><nav class="subbar" aria-label="Learning"><div class="sub-units">';
    var shownDone = false;
    list.slice().sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0); }).forEach(function (u) {
      if (u.done && !shownDone) { shownDone = true; html += '<span class="sub-term" aria-hidden="true">' + esc(u.term ? u.term.split(' ')[0] : 'Done') + '</span>'; }
      var on = cur === 'subject:' + u.id;
      html += '<a class="sub-tab unit-t" href="subject.html#' + u.id + '"' + (on ? ' aria-current="page"' : '') + ' style="--c:' + u.colour + '">' +
        '<i aria-hidden="true"></i>' + esc(u.name) + (u.done ? '<small class="donemark">done</small>' : '') + (u.code ? '<small>' + esc(u.code) + '</small>' : '') + '</a>';
    });
    html += '<button type="button" class="sub-tab add-t' + (list.length ? '' : ' first') + '" data-add>' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
      (list.length ? 'Add subject' : 'Add your first subject') + '</button>';
    html += '</div><span class="sub-sep" aria-hidden="true"></span><div class="sub-tools">';
    TOOLS.forEach(function (t) {
      var on = cur === t.key;
      html += '<a class="sub-tab" href="' + t.href + '"' + (on ? ' aria-current="page"' : '') + '>' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t.icon + '</svg>' + t.name + '</a>';
    });
    html += '</div></nav></div>';
    mount.innerHTML = html;
    var on = mount.querySelector('[aria-current="page"]'), bar = mount.querySelector('.subbar');
    if (on && bar && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = on.offsetLeft - 12;
  }

  /* ---------- "What's your subject called?" dialog ---------- */
  var dlg = document.createElement('dialog');
  dlg.className = 'add-dialog';
  dlg.innerHTML =
    '<form method="dialog" id="addForm">' +
      '<span class="hand">new subject</span>' +
      '<h2>What\'s your subject called?</h2>' +
      '<label class="field"><span>Subject name</span><input id="subName" name="name" required maxlength="60" autocomplete="off" placeholder="e.g. Consumer Behaviour"></label>' +
      '<label class="field"><span>Unit code <em>(optional)</em></span><input id="subCode" name="code" maxlength="12" autocomplete="off" placeholder="e.g. MMK265"></label>' +
      '<div class="field"><span>How many weeks?</span><div class="chips" id="subWeeks">' +
        [6, 10, 11, 12, 13].map(function (n) { return '<button type="button" class="chip-b" data-w="' + n + '" aria-pressed="' + (n === 12) + '">' + n + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="field"><span>Pick a highlighter</span><div class="chips" id="subColour">' +
        COLOURS.map(function (c, i) { return '<button type="button" class="swatch" data-c="' + c.v + '" aria-label="' + c.name + '" aria-pressed="' + (i === 0) + '" style="background:' + c.v + '"></button>'; }).join('') +
      '</div></div>' +
      '<p class="err" id="subErr" hidden>Give your subject a name first.</p>' +
      '<div class="actions"><button type="button" class="btn" id="subCancel">Cancel</button><button type="submit" class="btn btn-yellow" id="subSave">Add subject</button></div>' +
    '</form>';
  document.body.appendChild(dlg);

  function pick(groupId, btn) {
    dlg.querySelectorAll('#' + groupId + ' button').forEach(function (b) { b.setAttribute('aria-pressed', b === btn); });
  }
  dlg.querySelector('#subWeeks').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) pick('subWeeks', b); });
  dlg.querySelector('#subColour').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) pick('subColour', b); });
  dlg.querySelector('#subCancel').addEventListener('click', function () { dlg.close(); });

  function openAdd() {
    var n = load().length;
    dlg.querySelector('#subName').value = '';
    dlg.querySelector('#subCode').value = '';
    dlg.querySelector('#subErr').hidden = true;
    var sw = dlg.querySelectorAll('#subColour button');
    pick('subColour', sw[n % sw.length]);
    dlg.querySelector('h2').textContent = n ? 'What\'s this subject called?' : 'What\'s your subject called?';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(function () { dlg.querySelector('#subName').focus(); }, 30);
  }
  window.Lamplight.addSubject = openAdd;

  dlg.querySelector('#addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = dlg.querySelector('#subName').value.trim();
    if (!name) { dlg.querySelector('#subErr').hidden = false; dlg.querySelector('#subName').focus(); return; }
    var code = dlg.querySelector('#subCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    var weeks = +dlg.querySelector('#subWeeks [aria-pressed="true"]').getAttribute('data-w');
    var colour = dlg.querySelector('#subColour [aria-pressed="true"]').getAttribute('data-c');
    var id = 's' + Date.now().toString(36);
    var list = load(); list.push({ id: id, name: name, code: code, weeks: weeks, colour: colour, created: Date.now() });
    save(list);
    dlg.close();
    location.href = 'subject.html#' + id;
    if (/subject\.html$/.test(location.pathname)) { render(); window.dispatchEvent(new Event('lamplight:subjects')); }
  });

  if (mount) mount.addEventListener('click', function (e) { if (e.target.closest('[data-add]')) openAdd(); });
  window.addEventListener('hashchange', render);
  window.addEventListener('lamplight:subjects', render);
  render();
})();
