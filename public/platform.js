(() => {
  "use strict";
  const STORAGE_KEY = "likkle-legends-progress-v1";
  const DEFAULT_GUEST_LEVELS = 3;
  const GAME_IDS = new Set(["block-carnival", "island-quiz", "reef-rescue"]);
  const state = { account: null, ready: false, gateHard: false, platformUrl: "/learn", guestLevels: DEFAULT_GUEST_LEVELS };

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  }
  function saveProgress(progress) { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
  function loadSocialLayer() {
    if (document.querySelector('script[data-likkle-social]')) return;
    const script = document.createElement("script");
    script.src = "/social.js"; script.defer = true; script.dataset.likkleSocial = "true";
    document.head.appendChild(script);
  }
  function summary() {
    const progress = loadProgress();
    const records = Object.entries(progress).filter(([id]) => GAME_IDS.has(id)).map(([, record]) => record);
    const totalLevels = records.reduce((sum, game) => sum + (Number(game.level) || 0), 0);
    const gamesPlayed = Object.entries(progress).filter(([id, game]) => GAME_IDS.has(id) && (Number(game.level) || 0) > 0).length;
    const stamps = records.reduce((sum, game) => sum + (Number(game.stamps) || 0), 0);
    return { progress, totalLevels, gamesPlayed, stamps };
  }
  function emitReady() {
    dispatchEvent(new CustomEvent("likkle:ready", { detail: { ...summary(), account: state.account, platformUrl: state.platformUrl } }));
  }

  function injectGate() {
    if (document.getElementById("llUnlockGate")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div id="llUnlockGate" class="ll-overlay" role="dialog" aria-modal="true" aria-labelledby="llGateTitle" hidden>
        <section class="ll-modal">
          <div class="ll-modal-head"><div><p class="eyebrow">Free Island Passport</p><h2 id="llGateTitle">Keep the adventure going</h2></div><button id="llCloseGate" class="ll-close" type="button" aria-label="Close">×</button></div>
          <p class="ll-copy">A parent, guardian, educator or adult player can unlock every game and save progress. No payment required.</p>
          <div class="ll-benefits"><span>✓ All 1,188+ levels</span><span>✓ Cloud progress</span><span>✓ New game alerts</span></div>
          <form id="llUnlockForm" class="ll-form">
            <label>I am unlocking as<select name="role" required><option value="">Choose one</option><option value="parent">Parent or guardian</option><option value="educator">Educator</option><option value="adult_player">Adult player</option></select></label>
            <label>Adult email address<input name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required></label>
            <label class="ll-check"><input name="adult_confirm" type="checkbox" required><span>I confirm that I am 18 or older and agree to the <a href="/terms.html" target="_blank">Terms</a> and <a href="/privacy.html" target="_blank">Privacy Policy</a>.</span></label>
            <label class="ll-check"><input name="marketing" type="checkbox"><span>Send me new Caribbean games and Likkle Legends learning updates. Optional.</span></label>
            <button type="submit">Email my free unlock link</button>
            <p id="llMessage" class="ll-message" role="status"></p>
          </form>
          <span class="ll-underage">Under 18? Ask an adult to complete this step.</span>
          <p class="ll-privacy">We do not ask children for names or email addresses. Game progress remains on this device until an adult creates an account.</p>
        </section>
      </div>`);
    const gate = document.getElementById("llUnlockGate");
    const close = document.getElementById("llCloseGate");
    close.addEventListener("click", () => { if (!state.gateHard) gate.hidden = true; });
    gate.addEventListener("click", event => { if (event.target === gate && !state.gateHard) gate.hidden = true; });
    document.getElementById("llUnlockForm").addEventListener("submit", requestUnlock);
    document.querySelectorAll("[data-unlock-trigger]").forEach(button => button.addEventListener("click", () => openGate(false)));
    if (location.pathname !== "/" && !document.querySelector(".ll-hub-link")) {
      document.body.insertAdjacentHTML("beforeend", '<a class="ll-hub-link" href="/">✦ All Likkle Legends games</a>');
    }
  }

  function openGate(hard = false) {
    injectGate(); state.gateHard = hard;
    document.getElementById("llCloseGate").hidden = hard;
    document.getElementById("llUnlockGate").hidden = false;
    setTimeout(() => document.querySelector("#llUnlockForm input[type=email]")?.focus(), 40);
  }

  async function requestUnlock(event) {
    event.preventDefault();
    const form = event.currentTarget, message = document.getElementById("llMessage"), button = form.querySelector("button");
    const data = new FormData(form);
    button.disabled = true; message.textContent = "Sending your secure unlock link…";
    try {
      const response = await fetch("/api/auth/request-unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), role: data.get("role"), adult_confirm: data.get("adult_confirm") === "on", marketing_consent: data.get("marketing") === "on" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send the link.");
      message.textContent = result.message || "Check your email for the free unlock link.";
      form.querySelectorAll("input,select,button").forEach(control => control.disabled = true);
    } catch (error) { message.textContent = error.message; button.disabled = false; }
  }

  function guestCap() {
    return Number.isInteger(state.guestLevels) && state.guestLevels > 0 ? state.guestLevels : DEFAULT_GUEST_LEVELS;
  }
  function requireAccess(options = {}) {
    const completed = Math.max(0, Number(options.completedLevels) || 0);
    // Levels 1–guestCap are always playable, including when a game asks with completedLevels 0.
    if (completed < guestCap()) return true;
    // This traffic build keeps later levels free. Block Carnival and Island Quiz only
    // check the boolean, so a future lock must call openGate(false) before returning false.
    return true;
  }

  async function recordLevel(gameId, level, score = 0, stamps = 1) {
    const progress = loadProgress();
    const prior = progress[gameId] || { level: 0, score: 0, stamps: 0 };
    progress[gameId] = { level: Math.max(prior.level, Number(level) || 0), score: Math.max(prior.score, Number(score) || 0), stamps: Math.max(prior.stamps, Number(stamps) || 0), updatedAt: new Date().toISOString() };
    saveProgress(progress); emitReady();
    dispatchEvent(new CustomEvent("likkle:score", { detail: { gameId, level, score, stamps } }));
    if (!state.account) return;
    try { await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game_id: gameId, level, score, stamps }) }); } catch { /* local progress remains safe */ }
  }

  async function initialize() {
    injectGate();
    loadSocialLayer();
    try {
      const response = await fetch("/api/me", { credentials: "same-origin" });
      if (response.ok) {
        const result = await response.json(); state.account = result.account || null; state.platformUrl = result.platform_url || "/learn";
        state.guestLevels = Number.isInteger(result.guest_levels) ? result.guest_levels : DEFAULT_GUEST_LEVELS;
        if (result.progress) {
          const local = loadProgress();
          Object.entries(result.progress).forEach(([id, remote]) => { local[id] = { ...(local[id] || {}), ...remote, level: Math.max(local[id]?.level || 0, remote.level || 0), score: Math.max(local[id]?.score || 0, remote.score || 0), stamps: Math.max(local[id]?.stamps || 0, remote.stamps || 0) }; });
          saveProgress(local);
        }
      }
    } catch { /* guest play works offline */ }
    state.ready = true; emitReady();
    if (new URLSearchParams(location.search).get("verified") === "1") {
      history.replaceState({}, "", location.pathname); state.gateHard = false; document.getElementById("llUnlockGate").hidden = true;
    }
  }

  window.LikkleLegends = {
    requireAccess,
    recordLevel,
    openUnlock: () => openGate(false),
    isUnlocked: () => Boolean(state.account),
    get guestLevelCap() { return guestCap(); },
    getProgress: loadProgress,
    getSummary: summary
  };
  addEventListener("likkle:level-complete", event => { const detail = event.detail || {}; recordLevel(detail.gameId, detail.level, detail.score, detail.stamps); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize); else initialize();
})();
