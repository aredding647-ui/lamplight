/* Lamplight: cloud saving.
   Pages keep saving to this browser (localStorage) exactly as before. This file sits underneath:
   every change to a "lamplight:" item is copied up to your Supabase account, and when a page opens
   it brings down anything newer from your other devices. Load it in <head>, after js/config.js. */
(function () {
  var CFG = window.LAMPLIGHT_CONFIG || {};
  var BASE = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
  var KEY = String(CFG.supabaseAnonKey || '');
  var READY = /^https:\/\//.test(BASE) && KEY.length > 20 && KEY.indexOf('YOUR-') === -1;
  var TABLE = 'lamplight_kv';
  var LOG = 'lamplight:log';
  var SESSION = 'lamplight:_session', META = 'lamplight:_meta', PENDING = 'lamplight:_pending', SYNCED = 'lamplight:_synced';
  var LOCAL_ONLY = { 'lamplight:theme': 1 }; /* lights on/off stays per device */

  var LS; try { LS = window.localStorage; } catch (e) { return; }
  var SP = Storage.prototype, rawSet = SP.setItem, rawRemove = SP.removeItem, rawGet = SP.getItem;
  function noop() {}
  function isSynced(k) { return typeof k === 'string' && k.indexOf('lamplight:') === 0 && k.indexOf('lamplight:_') !== 0 && !LOCAL_ONLY[k]; }
  function rj(k, d) { try { var v = rawGet.call(LS, k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function wj(k, v) { try { rawSet.call(LS, k, JSON.stringify(v)); } catch (e) {} }
  function rm(k) { try { rawRemove.call(LS, k); } catch (e) {} }

  /* ---------- status, for the avatar dot and the Account page ---------- */
  var state = { status: 'off', error: '', last: +(rawGet.call(LS, SYNCED) || 0) || null };
  var listeners = [];
  function emit() { listeners.forEach(function (f) { try { f(api()); } catch (e) {} }); paintAvatar(); }
  function setStatus(s, err) { state.status = s; state.error = err || ''; emit(); }

  /* ---------- notice every change the pages make ---------- */
  var applying = false, timer = null;
  function touch(k) {
    var m = rj(META, {}); m[k] = Date.now(); wj(META, m);
    var p = rj(PENDING, {}); p[k] = 1; wj(PENDING, p);
    schedule();
  }
  SP.setItem = function (k, v) { rawSet.call(this, k, v); if (this === LS && !applying && isSynced(k)) touch(k); };
  SP.removeItem = function (k) { rawRemove.call(this, k); if (this === LS && !applying && isSynced(k)) touch(k); };
  function schedule() { if (!READY || !session()) return; clearTimeout(timer); timer = setTimeout(function () { push(); }, 1500); }

  /* ---------- talking to Supabase ---------- */
  function session() { return rj(SESSION, null); }
  function saveSession(s) { if (s) wj(SESSION, s); else rm(SESSION); }
  function fromAuth(r) {
    return { access_token: r.access_token, refresh_token: r.refresh_token,
      expires_at: Date.now() + ((r.expires_in || 3600) * 1000), user: { id: r.user.id, email: r.user.email } };
  }
  function call(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ apikey: KEY, 'Content-Type': 'application/json' }, opts.headers || {});
    return fetch(BASE + path, Object.assign({}, opts, { headers: headers })).then(function (res) {
      return res.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!res.ok) {
          var e = new Error(friendly((j && (j.error_description || j.msg || j.message || j.error)) || ('Something went wrong (' + res.status + ')')));
          e.status = res.status; throw e;
        }
        return j;
      });
    });
  }
  function friendly(m) {
    if (/invalid login credentials/i.test(m)) return 'That email and password don\'t match an account.';
    if (/email not confirmed/i.test(m)) return 'Check your email and click the confirm link first, then sign in.';
    if (/already registered/i.test(m)) return 'There\'s already an account with that email. Try signing in.';
    if (/password should be at least/i.test(m)) return 'Your password needs at least 6 characters.';
    if (/relation .* does not exist|could not find the table/i.test(m)) return 'The Lamplight table isn\'t set up yet. Run supabase/schema.sql in Supabase.';
    return m;
  }
  var refreshing = null;
  function token(retried) {
    var s = session();
    if (!s) return Promise.reject(new Error('Not signed in'));
    if (s.expires_at - 60000 > Date.now()) return Promise.resolve(s.access_token);
    if (!refreshing) {
      var used = s.refresh_token;
      refreshing = call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', keepalive: true, body: JSON.stringify({ refresh_token: used }) })
        .then(function (r) { var n = fromAuth(r); saveSession(n); return n.access_token; })
        .catch(function (e) {
          if (e.status !== 400 && e.status !== 401) throw e; /* offline or a hiccup: stay signed in and try later */
          var now2 = session();
          /* another page may have just refreshed the session; if so, use that one */
          if (now2 && now2.refresh_token !== used) return now2.access_token;
          if (!retried) return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { refreshing = null; return token(true); });
          saveSession(null); wj('lamplight:_signedout', { t: Date.now(), why: e.message });
          setStatus('off', 'You were signed out. Sign in again to keep saving.'); throw e;
        })
        .then(function (t) { refreshing = null; return t; }, function (e) { refreshing = null; throw e; });
    }
    return refreshing;
  }
  function authed(path, opts) {
    return token().then(function (t) {
      opts = opts || {}; opts.headers = Object.assign({ Authorization: 'Bearer ' + t }, opts.headers || {});
      return call(path, opts);
    });
  }

  /* practice logs from two devices are combined, never overwritten */
  function mergeLog(a, b) {
    if (a == null) return b; if (b == null) return a; if (a === b) return a;
    var A, B; try { A = JSON.parse(a); B = JSON.parse(b); } catch (e) { return a; }
    if (!Array.isArray(A) || !Array.isArray(B)) return a;
    var seen = {}, out = [];
    A.concat(B).forEach(function (x) { var id = x && (x.t + '|' + x.s + '|' + x.ok); if (!seen[id]) { seen[id] = 1; out.push(x); } });
    out.sort(function (x, y) { return (x.t || 0) - (y.t || 0); });
    var s = JSON.stringify(out.slice(-3000));
    return s === a ? a : s;
  }

  /* ---------- bring newer things down ---------- */
  function pull(firstTime) {
    if (!READY || !session()) return Promise.resolve(false);
    setStatus('syncing');
    return authed('/rest/v1/' + TABLE + '?select=key,value,ts,deleted', { method: 'GET' }).then(function (rows) {
      var fresh = firstTime || !rawGet.call(LS, SYNCED); /* first time on this device: the cloud copy wins */
      var meta = rj(META, {}), pend = rj(PENDING, {}), changed = false, seen = {};
      applying = true;
      try {
        (rows || []).forEach(function (r) {
          seen[r.key] = 1;
          if (!isSynced(r.key)) return;
          var local = rawGet.call(LS, r.key), remote = r.deleted ? null : r.value, ts = +r.ts || 0;
          if (r.key === LOG) {
            var merged = mergeLog(local, remote);
            if (merged !== local) { rawSet.call(LS, LOG, merged); changed = true; }
            if (merged !== remote) pend[LOG] = 1; else delete pend[LOG];
            meta[LOG] = Math.max(meta[LOG] || 0, ts);
            return;
          }
          var mine = meta[r.key] || 0;
          if (fresh || (ts > mine && !pend[r.key])) {
            if (remote !== local) { if (remote === null) rawRemove.call(LS, r.key); else rawSet.call(LS, r.key, remote); changed = true; }
            meta[r.key] = ts; delete pend[r.key];
          } else if (mine > ts && remote !== local) pend[r.key] = 1;
        });
        for (var i = 0; i < LS.length; i++) {
          var k = LS.key(i);
          if (isSynced(k) && !seen[k]) { pend[k] = 1; if (!meta[k]) meta[k] = Date.now(); }
        }
      } finally { applying = false; }
      wj(META, meta); wj(PENDING, pend);
      state.last = Date.now(); rawSet.call(LS, SYNCED, String(state.last));
      setStatus('synced');
      return push().then(function () { return changed; });
    }).catch(function (e) { setStatus(session() ? 'error' : 'off', e.message); return false; });
  }

  /* ---------- send changes up ---------- */
  var pushing = false;
  function push(leaving) {
    if (!READY || !session()) return Promise.resolve();
    if (pushing) { schedule(); return Promise.resolve(); }
    var pend = rj(PENDING, {}), keys = Object.keys(pend).filter(isSynced);
    if (!keys.length) { if (state.status !== 'error') setStatus('synced'); return Promise.resolve(); }
    pushing = true; setStatus('syncing');
    var me = session().user.id;
    /* combine the practice log with the cloud copy first, so nothing from another device is lost */
    var pre = keys.indexOf(LOG) > -1 && !leaving
      ? authed('/rest/v1/' + TABLE + '?select=value,deleted&key=eq.' + encodeURIComponent(LOG), { method: 'GET' }).then(function (r) {
          var remote = r && r[0] && !r[0].deleted ? r[0].value : null, local = rawGet.call(LS, LOG), merged = mergeLog(local, remote);
          if (merged !== local) { applying = true; try { rawSet.call(LS, LOG, merged); } finally { applying = false; } }
        })
      : Promise.resolve();
    var sent = {};
    return pre.then(function () {
      var meta = rj(META, {});
      var rows = keys.map(function (k) {
        var v = rawGet.call(LS, k); sent[k] = meta[k] || 0;
        return { user_id: me, key: k, value: v, ts: meta[k] || Date.now(), deleted: v === null };
      });
      var body = JSON.stringify(rows);
      return authed('/rest/v1/' + TABLE + '?on_conflict=user_id,key', {
        method: 'POST', body: body, keepalive: !!leaving && body.length < 60000,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
      });
    }).then(function () {
      var p = rj(PENDING, {}), m = rj(META, {});
      keys.forEach(function (k) { if ((m[k] || 0) === sent[k]) delete p[k]; });
      wj(PENDING, p);
      state.last = Date.now(); rawSet.call(LS, SYNCED, String(state.last));
      pushing = false;
      if (Object.keys(p).length) { schedule(); setStatus('syncing'); } else setStatus('synced');
    }).catch(function (e) { pushing = false; setStatus(session() ? 'error' : 'off', e.message); });
  }

  /* ---------- sign in, sign up, sign out ---------- */
  function signIn(email, password) {
    return call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email, password: password }) })
      .then(function (r) { saveSession(fromAuth(r)); rm(SYNCED); rm('lamplight:_signedout'); return pull(true); });
  }
  function signUp(email, password) {
    return call('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: email, password: password }) })
      .then(function (r) {
        if (r && r.access_token) { saveSession(fromAuth(r)); rm(SYNCED); return pull(true).then(function () { return { signedIn: true }; }); }
        return { confirm: true };
      });
  }
  function signOut() {
    var p = session() ? push().then(function () { return authed('/auth/v1/logout', { method: 'POST' }); }).catch(noop) : Promise.resolve();
    return p.then(function () { saveSession(null); rm(SYNCED); setStatus('off'); });
  }

  function api() {
    var s = session();
    var so = rj('lamplight:_signedout', null);
    return { ready: READY, signedIn: !!s, signedOutAt: !s && so ? so.t : null, email: s ? s.user.email : '', status: s ? state.status : 'off', error: state.error, last: state.last,
      pending: Object.keys(rj(PENDING, {})).length };
  }

  function changePassword(pw) { return authed('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: pw }) }); }
  window.LamplightSync = {
    info: api, signIn: signIn, signUp: signUp, signOut: signOut, changePassword: changePassword,
    syncNow: function () { return pull(false); },
    on: function (f) { listeners.push(f); f(api()); }
  };

  /* ---------- little dot on the avatar: green saved, yellow saving, red problem ---------- */
  var css = document.createElement('style');
  css.textContent = '.avatar{position:relative}.avatar[data-sync]::after{content:"";position:absolute;right:-5px;bottom:-5px;width:13px;height:13px;border-radius:99px;border:2px solid var(--ink);background:var(--good)}' +
    '.avatar[data-sync="syncing"]::after{background:var(--hl-yellow)}.avatar[data-sync="error"]::after{background:var(--bad)}';
  (document.head || document.documentElement).appendChild(css);
  function paintAvatar() {
    if (!document.body) return;
    var a = api();
    document.querySelectorAll('a.avatar').forEach(function (el) {
      el.setAttribute('href', 'account.html');
      if (a.signedIn) { el.setAttribute('data-sync', a.status); el.title = a.status === 'error' ? 'Cloud saving has a problem' : a.status === 'syncing' ? 'Saving to the cloud' : 'Saved to the cloud'; }
      else { el.removeAttribute('data-sync'); el.title = 'Your account'; }
    });
  }

  /* ---------- when to sync ---------- */
  function reloadOnce() {
    var t = +(sessionStorage.getItem('lamplight:_reload') || 0);
    if (Date.now() - t < 15000) return;
    try { sessionStorage.setItem('lamplight:_reload', String(Date.now())); } catch (e) {}
    location.reload();
  }
  function onOpen() {
    paintAvatar();
    if (!READY || !session()) return;
    pull(false).then(function (changed) { if (changed && !/account\.html$/.test(location.pathname)) reloadOnce(); else emit(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onOpen); else onOpen();
  document.addEventListener('visibilitychange', function () {
    if (!READY || !session()) return;
    if (document.visibilityState === 'hidden') { clearTimeout(timer); push(true); }
    else if (Date.now() - (state.last || 0) > 5 * 60000) {
      pull(false).then(function (changed) { if (changed && !/practice\.html$|arena\.html$|account\.html$/.test(location.pathname)) reloadOnce(); });
    }
  });
  window.addEventListener('online', function () { if (READY && session()) push(); });
})();
