/* ============================================================================
 * reviews-feed.js — reviews.html (Replay Feed) page logic + alert sound.
 *
 * Polls the schedule for the selected date, fetches every game's live feed,
 * extracts tracked events via Reviews (manager challenges, crew-chief /
 * umpire reviews, boundary calls, ABS pitch challenges, official-scorer
 * pending rulings, official scoring changes, under-review status and
 * runs-at-risk), persists them via FeedLog, and renders the chat-style
 * feed with tabs, stats and an active-review strip. New events play the
 * cha-ching alert (Reviews.shouldAlertForReview — ABS included, the
 * intentional difference vs upstream) and runs-at-risk events raise a
 * desktop notification when enabled.
 *
 * Sound engine (the Sound Lab contract — see sound-lab.html):
 *  - alertSoundSpec.bellStrikes[0].at is the "ching" strike time.
 *  - Prefers a real recording at assets/audio/cha-ching.{mp3,wav,ogg,m4a}
 *    (probed by primeAlertSound); falls back to a synthesized ~2 s
 *    cha-ching (playSynthAlertNow). playAlertSound() obeys a 2.5 s cooldown.
 *  - getAlertSample() returns { url, duration, sampleRate, channels, gain }
 *    or null. Installed recordings are normalized to −2.0 dBFS peak.
 *  - setAlertSampleFromBytes(bytes, name) validates + decodes + normalizes
 *    a dropped file; returns { gain } or null when refused.
 *
 * Bootstrap is skipped on pages with no #feed-list (sound-lab.html loads
 * this file for its audio alone and must never poll statsapi).
 *
 * Rebuilt from the contracts in reviews.html, sound-lab.html, server.mjs
 * and README.md (the original file was missing from the upload; see
 * COORDINATION.md T5 and flagged-for-review.html F-01/F-05).
 * ==========================================================================*/
(function () {
  'use strict';

  var POLL_MS = 15000;
  var ALERT_COOLDOWN_MS = 2500;
  var SOUND_KEY = 'mlb-sound-enabled';
  var NOTIFY_KEY = 'mlb-notify-enabled';
  var AUDIO_CANDIDATES = [
    'assets/audio/cha-ching.mp3',
    'assets/audio/cha-ching.wav',
    'assets/audio/cha-ching.ogg',
    'assets/audio/cha-ching.m4a',
  ];

  /** Synthesized cha-ching spec. Bell struck once at 0.5 s; total ~2.02 s. */
  var alertSoundSpec = {
    duration: 2.019,
    bellStrikes: [{ at: 0.5, primeHz: 2098 }],
  };

  var state = {
    date: null,
    filter: 'all',
    entries: [],          // feed-log entries { gamePk, review, firstSeen, lastSeen, matchupLabel }
    order: [],
    snapshots: {},        // gamePk -> { atBatIndex: snapshot }
    irregularities: {},   // gamePk -> [notes]
    grace: {},
    settled: [],
    games: [],            // schedule games for the date
    gameLabels: {},       // gamePk -> "AWAY @ HOME"
    underReview: {},      // gamePk -> { statusCode, description }
    timer: null,
    countdownTimer: null,
    nextPoll: 0,
    unsubscribe: null,
    booted: false,
  };

  /* ============================================================ sound */
  var audioCtx = null;
  var soundEnabled = false;
  var lastAlertAt = 0;
  var installedSample = null;   // { url, buffer, duration, sampleRate, channels, gain }
  var primePromise = null;

  try { soundEnabled = window.localStorage.getItem(SOUND_KEY) === '1'; } catch (e) { soundEnabled = false; }

  function getCtx() {
    if (audioCtx) return audioCtx;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  }

  function ensureCtxRunning() {
    var ctx = getCtx();
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
      var p = ctx.resume();
      if (p && p.catch) p.catch(function () { /* needs a gesture */ });
    }
    return ctx;
  }

  function peakOfBuffer(buffer) {
    var peak = 0;
    for (var c = 0; c < buffer.numberOfChannels; c++) {
      var d = buffer.getChannelData(c);
      for (var i = 0; i < d.length; i++) {
        var v = d[i] < 0 ? -d[i] : d[i];
        if (v > peak) peak = v;
      }
    }
    return peak;
  }

  function gainForPeak(peak) {
    if (!peak || peak <= 0) return 1;
    var target = Math.pow(10, -2.0 / 20); // −2.0 dBFS (sound-lab.html)
    return target / peak;
  }

  function looksLikeText(bytes) {
    var head = bytes.subarray(0, Math.min(512, bytes.length));
    var text = '';
    for (var i = 0; i < head.length; i++) text += String.fromCharCode(head[i]);
    if (/^\s*(<!doctype html|<html|<head|<\?xml|\{|\[)/i.test(text)) return true;
    var printable = 0;
    for (var j = 0; j < head.length; j++) {
      var b = head[j];
      if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e)) printable += 1;
    }
    return head.length > 0 && printable / head.length > 0.97;
  }

  function decodeBytes(bytes) {
    var ctx = ensureCtxRunning();
    if (!ctx) return Promise.reject(new Error('AudioContext unavailable'));
    // decodeAudioData detaches the buffer it is handed — copy first.
    var copy = bytes.slice(0);
    if (ctx.decodeAudioData.length >= 1) {
      return ctx.decodeAudioData(copy);
    }
    return Promise.reject(new Error('decodeAudioData unavailable'));
  }

  function installBuffer(url, buffer) {
    var peak = peakOfBuffer(buffer);
    installedSample = {
      url: url,
      buffer: buffer,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      gain: gainForPeak(peak),
    };
    return installedSample;
  }

  function primeAlertSound() {
    if (installedSample) return Promise.resolve(installedSample);
    if (primePromise) return primePromise;
    primePromise = (function tryNext(idx) {
      if (idx >= AUDIO_CANDIDATES.length) return Promise.resolve(null);
      var url = AUDIO_CANDIDATES[idx];
      return fetch(url, { cache: 'no-store' }).then(function (res) {
        if (!res.ok) return tryNext(idx + 1);
        var ct = res.headers.get('content-type') || '';
        if (ct.indexOf('text/html') !== -1) return tryNext(idx + 1);
        return res.arrayBuffer().then(function (ab) {
          var bytes = new Uint8Array(ab);
          if (bytes.length < 512 || looksLikeText(bytes)) return tryNext(idx + 1);
          return decodeBytes(bytes).then(function (buffer) {
            return installBuffer(url, buffer);
          }, function () { return tryNext(idx + 1); });
        });
      }, function () { return tryNext(idx + 1); });
    })(0).then(function (sample) {
      if (!sample) primePromise = null; // allow a later re-probe
      return sample;
    });
    return primePromise;
  }

  function setAlertSampleFromBytes(bytes, name) {
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8.length < 512 || looksLikeText(u8)) return Promise.resolve(null);
    return decodeBytes(u8).then(function (buffer) {
      var sample = installBuffer('session:' + (name || 'dropped-file'), buffer);
      return { gain: sample.gain, duration: sample.duration };
    }, function () { return null; });
  }

  function playBufferNow(buffer, gain) {
    var ctx = ensureCtxRunning();
    if (!ctx || !buffer) return false;
    try {
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      var g = ctx.createGain();
      g.gain.value = gain || 1;
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
      return true;
    } catch (e) { return false; }
  }

  function noiseBuffer(ctx, seconds) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Synthesized cha-ching: key-slam "cha", bell "ching" at 0.5 s, drawer thud. */
  function playSynthNow() {
    var ctx = ensureCtxRunning();
    if (!ctx) return false;
    try {
      var t0 = ctx.currentTime + 0.02;
      var master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);

      // --- "cha": bright broadband attacks (key slam + gear train) ---
      var chaDur = alertSoundSpec.bellStrikes[0].at;
      var noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(ctx, chaDur);
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3200;
      bp.Q.value = 0.6;
      var chaGain = ctx.createGain();
      chaGain.gain.setValueAtTime(0.0001, t0);
      chaGain.gain.exponentialRampToValueAtTime(0.55, t0 + 0.03);
      chaGain.gain.setValueAtTime(0.55, t0 + chaDur - 0.08);
      chaGain.gain.exponentialRampToValueAtTime(0.0001, t0 + chaDur);
      noise.connect(bp);
      bp.connect(chaGain);
      chaGain.connect(master);
      noise.start(t0);
      noise.stop(t0 + chaDur + 0.02);
      // Separate metallic key hits inside the cha.
      [0.02, 0.14, 0.27].forEach(function (off) {
        var osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 2400 + Math.random() * 800;
        var og = ctx.createGain();
        og.gain.setValueAtTime(0.12, t0 + off);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.05);
        osc.connect(og);
        og.connect(master);
        osc.start(t0 + off);
        osc.stop(t0 + off + 0.06);
      });

      // --- "ching": inharmonic bell struck ONCE at 0.5 s ---
      var strikeAt = t0 + alertSoundSpec.bellStrikes[0].at;
      var prime = alertSoundSpec.bellStrikes[0].primeHz;
      [1, 2.76, 5.4, 8.9].forEach(function (ratio, idx) {
        var bell = ctx.createOscillator();
        bell.type = 'sine';
        bell.frequency.value = prime * ratio;
        var bg = ctx.createGain();
        var amp = 0.5 / (idx + 1);
        bg.gain.setValueAtTime(amp, strikeAt);
        bg.gain.exponentialRampToValueAtTime(0.0001, strikeAt + 1.1);
        bell.connect(bg);
        bg.connect(master);
        bell.start(strikeAt);
        bell.stop(strikeAt + 1.15);
      });

      // --- drawer: slide + thud to a stop (~1.3–2.0 s) ---
      var drawerAt = t0 + 1.3;
      var slide = ctx.createBufferSource();
      slide.buffer = noiseBuffer(ctx, 0.45);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      var slideGain = ctx.createGain();
      slideGain.gain.setValueAtTime(0.0001, drawerAt);
      slideGain.gain.exponentialRampToValueAtTime(0.25, drawerAt + 0.12);
      slideGain.gain.exponentialRampToValueAtTime(0.0001, drawerAt + 0.45);
      slide.connect(lp);
      lp.connect(slideGain);
      slideGain.connect(master);
      slide.start(drawerAt);
      slide.stop(drawerAt + 0.5);
      var thud = ctx.createOscillator();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(140, drawerAt + 0.42);
      thud.frequency.exponentialRampToValueAtTime(55, drawerAt + 0.6);
      var thudGain = ctx.createGain();
      thudGain.gain.setValueAtTime(0.4, drawerAt + 0.42);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, drawerAt + 0.68);
      thud.connect(thudGain);
      thudGain.connect(master);
      thud.start(drawerAt + 0.42);
      thud.stop(drawerAt + 0.7);
      return true;
    } catch (e) { return false; }
  }

  function playAlertSound() {
    if (!soundEnabled) return false;
    var now = Date.now();
    if (now - lastAlertAt < ALERT_COOLDOWN_MS) return false;
    lastAlertAt = now;
    if (installedSample) return playBufferNow(installedSample.buffer, installedSample.gain);
    return playSynthNow();
  }

  function playSynthAlertNow() {
    if (!ensureCtxRunning()) return false;
    return playSynthNow();
  }

  function playAlertSampleNow() {
    if (!installedSample) return false;
    return playBufferNow(installedSample.buffer, installedSample.gain);
  }

  function setSoundEnabled(on) {
    soundEnabled = !!on;
    try { window.localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0'); } catch (e) { /* ignore */ }
    syncSoundButton();
    if (soundEnabled) ensureCtxRunning();
  }

  function getSoundEnabled() { return soundEnabled; }

  function syncSoundButton() {
    var btn = UI.$('sound-toggle-btn');
    if (btn) btn.textContent = soundEnabled ? '🔊 Sound On' : '🔇 Sound Off';
  }

  /* ------------------------------------------------- notifications */
  var notifyEnabled = false;
  try { notifyEnabled = window.localStorage.getItem(NOTIFY_KEY) === '1'; } catch (e) { notifyEnabled = false; }

  function syncNotifyButton() {
    var btn = UI.$('notify-toggle-btn');
    if (btn) btn.textContent = notifyEnabled ? '🔔 Run Alerts On' : '⚪ Run Alerts Off';
  }

  function notifyRunsAtRisk(entry) {
    if (!notifyEnabled) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    var r = entry.review || {};
    try {
      new Notification('⚾ Runs at risk — ' + (entry.matchupLabel || 'game'), {
        body: (r.label || 'Review') + ' could take a run off the scoreboard. ' + (r.playDescription || ''),
      });
    } catch (e) { /* ignore */ }
  }

  /* ============================================================ feed */
  var TABS = [
    { key: 'all', label: 'All' },
    { key: 'challenge', label: 'Challenges' },
    { key: 'review', label: 'Reviews' },
    { key: 'boundary', label: 'Boundary Calls' },
    { key: 'abs', label: 'ABS' },
    { key: 'under-review', label: 'Under Review' },
    { key: 'runs-at-risk', label: 'Runs at Risk' },
    { key: 'pending', label: 'Scoring Pending' },
    { key: 'scoring', label: 'Scoring Changes' },
  ];

  function currentDate() { return state.date || UI.todayStr(); }

  function entryKey(e) {
    return e.gamePk + ':' + (e.review.id || e.review.atBatIndex || '');
  }

  function matchupLabel(game) {
    if (!game || !game.teams) return 'Game ' + (game && game.gamePk);
    return UI.teamAbbr(game.teams.away?.team) + ' @ ' + UI.teamAbbr(game.teams.home?.team);
  }

  function addEntry(gamePk, review, label) {
    var now = Date.now();
    var key = gamePk + ':' + (review.id || review.atBatIndex || '');
    var existing = null;
    state.entries.forEach(function (e) { if (entryKey(e) === key) existing = e; });
    if (existing) {
      existing.lastSeen = now;
      existing.review = Object.assign({}, existing.review, review);
      return { entry: existing, isNew: false };
    }
    var entry = {
      gamePk: gamePk,
      review: review,
      firstSeen: now,
      lastSeen: now,
      matchupLabel: label || state.gameLabels[gamePk] || null,
    };
    state.entries.push(entry);
    state.order.push(key);
    return { entry: entry, isNew: true };
  }

  function addIrregularity(gamePk, note) {
    if (!note) return;
    var list = state.irregularities[gamePk] || (state.irregularities[gamePk] = []);
    if (list.indexOf(note) === -1) list.push(note);
    if (list.length > 30) list.splice(0, list.length - 30);
  }

  function processFeed(game, feed) {
    var gamePk = game.gamePk;
    var label = matchupLabel(game);
    state.gameLabels[gamePk] = label;
    var extracted = Reviews.extractReviewsFromFeed(feed);
    var newEntries = [];

    extracted.reviews.forEach(function (r) {
      var res = addEntry(gamePk, r, label);
      if (res.isNew) newEntries.push(res.entry);
    });
    extracted.pending.forEach(function (r) {
      var res = addEntry(gamePk, r, label);
      if (res.isNew) newEntries.push(res.entry);
    });

    if (extracted.underReview.active) {
      state.underReview[gamePk] = extracted.underReview;
    } else {
      delete state.underReview[gamePk];
    }

    // Scoring changes: snapshot every completed play, diff vs previous.
    var plays = (feed.liveData && feed.liveData.plays && feed.liveData.plays.allPlays) || [];
    var snaps = state.snapshots[gamePk] || (state.snapshots[gamePk] = {});
    plays.forEach(function (play, idx) {
      if (play.about?.isComplete !== true) return;
      var snap = Reviews.snapshotPlay(play);
      if (!snap) return;
      var key = String(play.about ? play.about.atBatIndex : idx);
      var prev = snaps[key];
      if (prev) {
        var change = Reviews.detectScoringChange(prev, snap);
        if (change) {
          var review = {
            id: 'scoring-' + key + '-' + Date.now(),
            typeKey: 'scoring',
            label: 'Official scoring change',
            badgeClass: 'scoring',
            atBatIndex: play.about ? play.about.atBatIndex : null,
            inning: play.about ? play.about.inning : null,
            halfInning: play.about ? play.about.halfInning : null,
            isTopInning: play.about ? play.about.isTopInning : null,
            batter: play.matchup && play.matchup.batter ? play.matchup.batter.fullName : null,
            pitcher: play.matchup && play.matchup.pitcher ? play.matchup.pitcher.fullName : null,
            playDescription: play.result ? play.result.description : null,
            history: [change.from, change.to],
            summary: change.summary,
          };
          var res = addEntry(gamePk, review, label);
          if (res.isNew) newEntries.push(res.entry);
        } else if (Reviews.isPayloadOnlyEdit(prev, snap)) {
          addIrregularity(gamePk, 'Play ' + key + ': payload edited without reclassification (description/RBI only) — flagged for review.');
        }
      }
      snaps[key] = snap;
    });

    // Counter regressions (used moving backwards) are irregularities.
    var counters = extracted.counters;
    if (counters && counters.manager) {
      ['away', 'home'].forEach(function (side) {
        var c = counters.manager[side];
        if (c && typeof c.used === 'number') {
          var gk = gamePk + '-counter-manager-' + side;
          var prevUsed = state.grace[gk];
          var note = Reviews.flagCounterRegression(prevUsed, c.used, 'Manager challenges used (' + side + ')');
          if (note) addIrregularity(gamePk, note);
          state.grace[gk] = c.used;
        }
      });
    }

    // Runs-at-risk desktop notifications for new entries.
    newEntries.forEach(function (entry) {
      var play = plays.filter(function (p) {
        return String(p.about && p.about.atBatIndex) === String(entry.review.atBatIndex);
      })[0];
      if (play && Reviews.runsAtRisk(play)) {
        entry.review.runsAtRisk = true;
        notifyRunsAtRisk(entry);
      }
    });

    // Alert sound: one per poll max (cooldown bounds bursts).
    var alertable = newEntries.filter(function (e) { return Reviews.shouldAlertForReview(e.review); });
    if (alertable.length) playAlertSound();

    return newEntries;
  }

  function persist() {
    if (!window.FeedLog) return Promise.resolve(null);
    var log = {
      v: 1,
      date: currentDate(),
      savedAt: Date.now(),
      entries: state.entries.slice(-FeedLog.MAX_ROWS),
      order: state.order.slice(-FeedLog.MAX_ROWS),
      snapshots: state.snapshots,
      irregularities: state.irregularities,
      grace: state.grace,
      settled: state.settled,
    };
    return FeedLog.save(log);
  }

  function restoreFromLog(log) {
    if (!log) return;
    state.entries = Array.isArray(log.entries) ? log.entries : [];
    state.order = Array.isArray(log.order) ? log.order : state.entries.map(entryKey);
    state.snapshots = log.snapshots || {};
    state.irregularities = log.irregularities || {};
    state.grace = log.grace || {};
    state.settled = Array.isArray(log.settled) ? log.settled : [];
    state.entries.forEach(function (e) {
      if (e && e.gamePk && e.matchupLabel) state.gameLabels[e.gamePk] = e.matchupLabel;
    });
  }

  /* ------------------------------------------------------- rendering */
  function renderTabs() {
    var host = UI.$('feed-tabs');
    if (!host) return;
    host.innerHTML = '';
    TABS.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'tab-btn' + (state.filter === t.key ? ' tab-on' : '');
      b.textContent = t.label;
      b.addEventListener('click', function () {
        state.filter = t.key;
        renderTabs();
        renderFeed();
      });
      host.appendChild(b);
    });
  }

  function entryMatchesFilter(entry) {
    var r = entry.review || {};
    if (state.filter === 'all') return Reviews.visibleInAllFeed(r);
    if (state.filter === 'under-review') return !!state.underReview[entry.gamePk];
    if (state.filter === 'runs-at-risk') return r.runsAtRisk === true;
    return r.typeKey === state.filter;
  }

  function renderStats() {
    var host = UI.$('feed-stats');
    if (!host) return;
    var counts = { all: 0, challenge: 0, review: 0, boundary: 0, abs: 0, 'runs-at-risk': 0, pending: 0, scoring: 0 };
    state.entries.forEach(function (e) {
      var r = e.review || {};
      if (Reviews.visibleInAllFeed(r)) counts.all += 1;
      if (counts[r.typeKey] !== undefined) counts[r.typeKey] += 1;
      if (r.runsAtRisk) counts['runs-at-risk'] += 1;
    });
    var defs = [
      ['Events', counts.all], ['Challenges', counts.challenge], ['Reviews', counts.review],
      ['Boundary', counts.boundary], ['ABS', counts.abs], ['Runs at Risk', counts['runs-at-risk']],
      ['Pending', counts.pending], ['Scoring', counts.scoring],
    ];
    host.innerHTML = '';
    defs.forEach(function (d) {
      var chip = document.createElement('div');
      chip.className = 'stat-chip';
      chip.innerHTML = '<strong>' + d[1] + '</strong><span>' + UI.esc(d[0]) + '</span>';
      host.appendChild(chip);
    });
  }

  function renderActiveStrip() {
    var host = UI.$('active-strip');
    if (!host) return;
    host.innerHTML = '';
    Object.keys(state.underReview).forEach(function (gamePk) {
      var info = state.underReview[gamePk];
      var a = document.createElement('a');
      a.className = 'active-chip';
      a.href = UI.gameUrl(gamePk);
      a.textContent = '⏳ ' + (state.gameLabels[gamePk] || 'Game ' + gamePk) +
        (info.statusCode ? ' (' + info.statusCode + ')' : '');
      host.appendChild(a);
    });
  }

  function renderFeed() {
    renderStats();
    renderActiveStrip();
    var host = UI.$('feed-list');
    if (!host) return;
    var entries = state.entries.filter(entryMatchesFilter);
    // Newest first.
    entries = entries.slice().sort(function (a, b) { return (b.firstSeen || 0) - (a.firstSeen || 0); });
    host.innerHTML = '';
    if (!entries.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No tracked events for this filter yet. New challenges, reviews, ABS challenges, pending rulings and scoring changes will appear here live.';
      host.appendChild(empty);
      return;
    }
    entries.slice(0, 200).forEach(function (entry) {
      var r = entry.review || {};
      var item = document.createElement('div');
      item.className = 'feed-item' + (r.runsAtRisk ? ' runs-at-risk' : '');
      var head = document.createElement('div');
      head.className = 'feed-item-head';
      var badge = document.createElement('span');
      badge.className = 'badge ' + (r.badgeClass || 'review');
      badge.textContent = r.label || 'Review';
      var matchup = document.createElement('span');
      matchup.className = 'feed-matchup';
      matchup.textContent = entry.matchupLabel || ('Game ' + entry.gamePk);
      var time = document.createElement('span');
      time.className = 'feed-time';
      time.textContent = entry.firstSeen ? new Date(entry.firstSeen).toLocaleTimeString() : '';
      head.appendChild(badge);
      head.appendChild(matchup);
      head.appendChild(time);
      var body = document.createElement('div');
      body.className = 'feed-body';
      body.textContent = r.summary || r.playDescription || r.description || '';
      var meta = document.createElement('div');
      meta.className = 'feed-meta';
      var bits = [];
      if (r.inning) bits.push((r.isTopInning ? 'Top ' : 'Bot ') + r.inning);
      if (r.batter) bits.push('Batter: ' + r.batter);
      if (r.pitcher) bits.push('Pitcher: ' + r.pitcher);
      if (r.code) bits.push('Code: ' + r.code);
      if (r.runsAtRisk) bits.push('⚠️ Runs at Risk');
      if (r.history) bits.push('History: ' + r.history.join(' → '));
      meta.textContent = bits.join(' · ');
      item.appendChild(head);
      item.appendChild(body);
      if (bits.length) item.appendChild(meta);
      var notes = state.irregularities[entry.gamePk] || [];
      notes.forEach(function (note) {
        var div = document.createElement('div');
        div.className = 'irregularity';
        div.textContent = '⚠️ ' + note;
        item.appendChild(div);
      });
      host.appendChild(item);
    });
  }

  function setLiveDot(mode) {
    var dot = UI.$('live-dot');
    if (!dot) return;
    dot.className = 'live-dot' + (mode === 'off' ? ' off' : mode === 'err' ? ' err' : '');
  }

  function tickCountdown() {
    var el = UI.$('countdown');
    if (!el) return;
    var secs = Math.max(0, Math.ceil((state.nextPoll - Date.now()) / 1000));
    el.textContent = secs + 's';
  }

  function load() {
    var date = currentDate();
    UI.setDateNav(date);
    UI.setStatus('Polling ' + UI.fmtDateLabel(date) + '…');
    setLiveDot('off');
    return Api.getSchedule(date).then(function (data) {
      state.games = (data && data.dates && data.dates[0] && data.dates[0].games) || [];
      // Fetch feeds sequentially in small batches to avoid hammering the API.
      var queue = state.games.slice();
      function nextBatch() {
        if (!queue.length) return Promise.resolve();
        var batch = queue.splice(0, 4);
        return Promise.all(batch.map(function (game) {
          return Api.getFeed(game.gamePk).then(function (feed) {
            processFeed(game, feed);
          }, function () { /* one failed feed must not block the rest */ });
        })).then(nextBatch);
      }
      return nextBatch().then(function () {
        return persist().then(function () {
          renderTabs();
          renderFeed();
          setLiveDot('on');
          UI.setStatus(state.entries.length + ' tracked event' + (state.entries.length === 1 ? '' : 's') +
            ' · ' + state.games.length + ' games · updated ' + new Date().toLocaleTimeString());
        });
      });
    }, function (err) {
      setLiveDot('err');
      UI.setStatus('Could not load the schedule: ' + err.message, true);
      UI.showBanner('Schedule unavailable — the MLB StatsAPI did not respond. Check your connection and try again.', true);
      renderTabs();
      renderFeed();
    }).then(function () {
      state.nextPoll = Date.now() + POLL_MS;
      tickCountdown();
    });
  }

  function restart() {
    if (state.timer) clearInterval(state.timer);
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    if (state.unsubscribe) { state.unsubscribe(); state.unsubscribe = null; }
    state.timer = setInterval(load, POLL_MS);
    state.countdownTimer = setInterval(tickCountdown, 1000);
    state.nextPoll = Date.now() + POLL_MS;
    // Restore persisted rows first, then subscribe to the server tail (when
    // present) and poll. On Pages the subscribe fails quietly and polling
    // alone drives the feed.
    var date = currentDate();
    var boot = window.FeedLog ? FeedLog.load(date).then(function (log) {
      restoreFromLog(log);
      renderTabs();
      renderFeed();
    }) : Promise.resolve();
    boot.then(function () {
      if (window.FeedLog) {
        state.unsubscribe = FeedLog.subscribe(date, function (pushed) {
          restoreFromLog(FeedLog.mergeLogs(
            { v: 1, date: date, entries: state.entries, order: state.order,
              snapshots: state.snapshots, irregularities: state.irregularities,
              grace: state.grace, settled: state.settled },
            pushed));
          renderFeed();
        });
      }
      load();
    });
  }

  /* --------------------------------------------------------- public */
  var ReplayFeed = {
    alertSoundSpec: alertSoundSpec,
    prevDay: function () { state.date = UI.addDays(currentDate(), -1); restart(); },
    nextDay: function () { state.date = UI.addDays(currentDate(), 1); restart(); },
    pickDate: function () {
      var picker = UI.$('date-picker');
      if (picker && UI.isValidDateStr(picker.value)) state.date = picker.value;
      restart();
    },
    today: function () { state.date = UI.todayStr(); restart(); },
    setSoundEnabled: setSoundEnabled,
    getSoundEnabled: getSoundEnabled,
    playAlertSound: playAlertSound,
    playSynthAlertNow: playSynthAlertNow,
    playAlertSampleNow: playAlertSampleNow,
    clearAlertSample: function () { installedSample = null; primePromise = null; },
    primeAlertSound: primeAlertSound,
    getAlertSample: function () {
      if (!installedSample) return null;
      return {
        url: installedSample.url,
        duration: installedSample.duration,
        sampleRate: installedSample.sampleRate,
        channels: installedSample.channels,
        gain: installedSample.gain,
      };
    },
    setAlertSampleFromBytes: setAlertSampleFromBytes,
    _state: state,
  };

  if (typeof window !== 'undefined') window.ReplayFeed = ReplayFeed;
  if (typeof module !== 'undefined' && module.exports) module.exports = ReplayFeed;

  /* --------------------------------------------------------- bootstrap */
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      syncSoundButton();
      syncNotifyButton();
      var soundBtn = UI.$('sound-toggle-btn');
      if (soundBtn) {
        soundBtn.addEventListener('click', function () {
          setSoundEnabled(!soundEnabled);
          if (soundEnabled) playAlertSound();
        });
      }
      var notifyBtn = UI.$('notify-toggle-btn');
      if (notifyBtn) {
        notifyBtn.addEventListener('click', function () {
          notifyEnabled = !notifyEnabled;
          try { window.localStorage.setItem(NOTIFY_KEY, notifyEnabled ? '1' : '0'); } catch (e) { /* ignore */ }
          if (notifyEnabled && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
          }
          syncNotifyButton();
        });
      }
      var refresh = UI.$('refresh-btn');
      if (refresh) refresh.addEventListener('click', load);
      // First-gesture primer: browsers block AudioContext until interaction.
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
        window.addEventListener(evt, function primer() {
          if (soundEnabled) ensureCtxRunning();
          primeAlertSound();
        }, { once: true, passive: true });
      });
      // Sound Lab loads this file for audio alone: never poll without a feed.
      if (!UI.$('feed-list')) {
        primeAlertSound();
        return;
      }
      if (state.booted) return;
      state.booted = true;
      state.date = UI.todayStr();
      restart();
    });
  }
})();
