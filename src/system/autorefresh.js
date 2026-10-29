// Keeps an unattended TV healthy: reloads after sleep, picks up new code, syncs the clock,
// and reloads once a night. Self-contained: main.js just calls startAutoRefresh().
import { WATCH, WAKE_GAP_MS, MIN_LIFE_MS, UPDATE_MS, SYNC_MS } from "../config.js";
import { state } from "../core/state.js";
import { nowMs, fmt } from "../core/time.js";

const BOOT = Date.now();

// 1. Cache-busted reload: a new URL each time, keeps ?mode= and friends.
function hardReload() {
  const u = new URL(location.href);
  u.searchParams.set("r", Date.now());
  location.replace(u.toString());
}
// Only reload once the network answers, otherwise the TV could land on an error page.
let reloading = false;
export function safeReload() {
  if (reloading) return;
  reloading = true;
  (function attempt() {
    fetch("index.html?v=" + Date.now(), { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        hardReload();
      })
      .catch(function () {
        setTimeout(attempt, 5000);
      });
  })();
}

// onClockSync: called after the clock offset changed (re-render time and mode)
export function startAutoRefresh(onClockSync) {
  // 2. Wake handler: resume events plus a late-tick check.
  function onWake() {
    if (Date.now() - BOOT > MIN_LIFE_MS) safeReload();
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) onWake();
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) onWake(); // pageshow also fires on every normal load
  });
  window.addEventListener("focus", onWake);
  window.addEventListener("online", onWake);
  let lastBeat = Date.now();
  setInterval(function () {
    const n = Date.now();
    if (n - lastBeat > WAKE_GAP_MS) onWake();
    lastBeat = n;
  }, 1000);

  // 3. Update check: reload when the served files differ from what we saw at start.
  let baseline = null;
  function snapshot() {
    return Promise.all(
      WATCH.map(function (f) {
        return fetch(f + "?v=" + Date.now(), { cache: "no-store" }).then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.text();
        });
      })
    ).then(function (parts) {
      return parts.join("\n/*--*/\n");
    });
  }
  function checkUpdate() {
    snapshot()
      .then(function (s) {
        if (baseline === null) baseline = s;
        else if (s !== baseline) safeReload();
      })
      .catch(function () {});
  }

  // 4. Clock sync from our own server's Date header (works in standby too).
  function syncClock() {
    fetch("index.html?v=" + Date.now(), { method: "HEAD", cache: "no-store" })
      .then(function (res) {
        const h = res.headers.get("Date");
        if (!h) return;
        const off = new Date(h).getTime() - Date.now();
        state.clockOffset = Math.abs(off) > 5000 ? off : 0; // ignore normal jitter
        onClockSync();
      })
      .catch(function () {});
  }

  syncClock();
  checkUpdate();
  setInterval(syncClock, SYNC_MS);
  setInterval(checkUpdate, UPDATE_MS);

  // 5. Nightly reload in standby, on Brussels time
  setInterval(function () {
    const h = parseInt(fmt(new Date(nowMs())), 10) % 24;
    if (state.standby && h === 23 && Date.now() - BOOT > 45 * 60 * 1000) safeReload();
  }, 30 * 60 * 1000);
}
