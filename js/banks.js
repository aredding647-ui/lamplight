/* Lamplight: adds the question banks made from your uploads (saved per subject) to the built-in ones.
   Load straight after data/units.js on any page that uses questions. */
(function () {
  var U = window.LAMPLIGHT_UNITS = window.LAMPLIGHT_UNITS || {};
  function read(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function apply() {
    /* clear anything added last time, so a refresh starts clean */
    Object.keys(U).forEach(function (k) {
      if (U[k].generated) delete U[k];
      else U[k].weekList = U[k].weekList.filter(function (w) { return !w.generated; });
    });
    read('lamplight:subjects', []).forEach(function (s) {
      var bank = read('lamplight:bank:' + s.id, null);
      if (!bank || !bank.weekList || !bank.weekList.length) return;
      var key = s.code || s.id;
      if (U[key]) {
        bank.weekList.forEach(function (w) { if (!U[key].weekList.some(function (x) { return x.week === w.week; })) U[key].weekList.push(w); });
        U[key].weekList.sort(function (a, b) { return a.week - b.week; });
      } else {
        U[key] = { code: key, name: s.name, term: s.term || '', weeks: s.weeks, weekList: bank.weekList.slice().sort(function (a, b) { return a.week - b.week; }), generated: true };
      }
    });
  }
  apply();
  window.LamplightBanks = { refresh: apply, read: function (sid) { return read('lamplight:bank:' + sid, null); },
    save: function (sid, bank) { localStorage.setItem('lamplight:bank:' + sid, JSON.stringify(bank)); apply(); },
    remove: function (sid) { localStorage.removeItem('lamplight:bank:' + sid); apply(); } };
})();
