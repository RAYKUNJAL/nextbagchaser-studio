(() => {
  "use strict";

  const STORAGE_KEY = "likkle-reef-rescue-v1";
  const MAX_LEVEL = 100;
  const GUEST_LEVELS = 3;
  const ZONES = [
    { name: "Belize Barrier Reef", flag: "🇧🇿", guide: "Tali the Turtle", emoji: "🐢" },
    { name: "Tobago Cays", flag: "🇻🇨", guide: "Kori the Crab", emoji: "🦀" },
    { name: "Buccoo Reef", flag: "🇹🇹", guide: "Ibis the Ranger", emoji: "🐦" },
    { name: "Montego Bay", flag: "🇯🇲", guide: "Ziggy the Parrotfish", emoji: "🐠" },
    { name: "Soufrière Coast", flag: "🇱🇨", guide: "Lulu the Lobster", emoji: "🦞" },
    { name: "Folkestone Reef", flag: "🇧🇧", guide: "Bim the Flying Fish", emoji: "🐟" },
    { name: "Molinere Reef", flag: "🇬🇩", guide: "Nella the Ray", emoji: "🦈" },
    { name: "Exuma Cays", flag: "🇧🇸", guide: "Coco the Conch", emoji: "🐚" },
    { name: "Bonaire Marine Park", flag: "🇧🇶", guide: "Fina the Flamingo", emoji: "🦩" },
    { name: "Caribbean Sea Quest", flag: "🌎", guide: "The Reef Ranger Crew", emoji: "⭐" }
  ];
  const LESSONS = [
    ["A living underwater city", "Coral reefs are built by tiny animals called coral polyps. Fish use the reef for food, shelter and nursery grounds.", "Keep plastic out of drains, rivers and beaches."],
    ["Turtles need clean seas", "Caribbean sea turtles can mistake floating plastic bags for jellyfish, one of their foods.", "Choose reusable bags and pick up loose plastic safely."],
    ["Parrotfish make sand", "Parrotfish nibble algae from coral. The coral rock they digest becomes some of the soft sand on Caribbean beaches.", "Never buy jewelry or souvenirs made from coral."],
    ["Mangroves are nurseries", "Young fish hide among mangrove roots before moving out to coral reefs as they grow.", "Protect mangroves—they protect young reef life too."],
    ["Reefs protect our shores", "Healthy coral reefs soften strong waves and help reduce damage to Caribbean coastlines during storms.", "Support reef-safe coastal choices and clean beaches."],
    ["Seagrass stores carbon", "Seagrass meadows feed turtles, shelter young fish and store carbon in the sea floor.", "Anchor boats only in marked areas, away from seagrass."],
    ["Coral can feel stress", "Very warm water can make coral lose the algae that give it food and colour. This is called coral bleaching.", "Save energy and learn how climate choices affect the ocean."],
    ["Conch need time to grow", "Queen conch are important to Caribbean culture and reef food webs. Young conch need healthy seagrass habitats.", "Follow local seasons and size rules when choosing seafood."],
    ["Every drain reaches the sea", "Rubbish dropped on a street can travel through drains and rivers until it reaches a beach or reef.", "Put waste in the right bin—even when you are far inland."],
    ["Reef-safe exploring", "Touching or standing on coral can damage living polyps that took many years to grow.", "Look, float and photograph, but never touch the coral."],
    ["Ghost nets keep fishing", "Lost fishing line and nets can trap turtles, fish and seabirds long after people leave them behind.", "Collect fishing line safely or report it to a local group."],
    ["Tiny choices add up", "Refillable bottles and lunch containers reduce the single-use plastic that can reach Caribbean waters.", "Pack one reusable item on your next trip."],
    ["Sponges filter water", "Caribbean sea sponges filter large amounts of seawater and create hiding places for small reef animals.", "Leave sponges and shells where they belong."],
    ["Reefs feed communities", "Caribbean reefs support fisheries, tourism and coastal livelihoods across many islands and territories.", "Choose responsibly caught seafood when you can."],
    ["One connected Caribbean", "Currents can carry coral larvae, fish and also pollution between islands. Ocean care is a regional team effort.", "Share one reef fact with a friend or family member."],
    ["Night on the reef", "Some reef animals rest by day and feed at night. Corals may extend tiny tentacles after sunset.", "Use wildlife-friendly lights near nesting beaches."],
    ["Hawksbills help reefs", "Hawksbill turtles eat sponges, helping keep space open for different coral species to grow.", "Give turtles plenty of space in the water and on beaches."],
    ["Coral grows slowly", "Many massive corals grow less than a finger-width each year, so a large colony may be decades old.", "Protect what took generations to build."],
    ["Citizen scientists help", "Divers, fishers and students can report bleaching, litter and wildlife sightings to help researchers.", "Join a supervised beach count or community clean-up."],
    ["A healthy reef is busy", "A reef with many kinds of coral, fish and invertebrates is often more resilient when conditions change.", "Celebrate biodiversity—every native species has a role."]
  ];
  const TRASH = [
    { icon: "🥤", label: "plastic cup", points: 50 }, { icon: "🧴", label: "plastic bottle", points: 55 },
    { icon: "🥫", label: "can", points: 60 }, { icon: "🛍️", label: "plastic bag", points: 65 },
    { icon: "🧃", label: "drink carton", points: 55 }, { icon: "👞", label: "old shoe", points: 70 },
    { icon: "🛢️", label: "oil drum", points: 90, tough: true }, { icon: "🕸️", label: "ghost net", points: 100, tough: true }
  ];
  const WILDLIFE = [
    { icon: "🐢", label: "sea turtle" }, { icon: "🐠", label: "reef fish" }, { icon: "🐟", label: "parrotfish" },
    { icon: "🦀", label: "reef crab" }, { icon: "🐙", label: "octopus" }, { icon: "🐬", label: "dolphin" },
    { icon: "🦈", label: "reef shark" }, { icon: "🦞", label: "lobster" }
  ];

  const $ = selector => document.querySelector(selector);
  const els = {
    arena: $("#arena"), layer: $("#entityLayer"), particles: $("#particleLayer"), countdown: $("#countdown"), coach: $("#coachBubble"),
    score: $("#scoreValue"), best: $("#bestValue"), combo: $("#comboValue"), stamps: $("#stampValue"), lives: $("#livesValue"), time: $("#timeValue"),
    level: $("#levelNumber"), target: $("#targetScore"), targetFill: $("#targetFill"), targetMeter: $(".rr-meter"), difficulty: $("#difficultyLabel"),
    zoneFlag: $("#zoneFlag"), zoneName: $("#zoneName"), guideEmoji: $("#guideEmoji"), guideName: $("#guideName"), factTitle: $("#factTitle"), factText: $("#factText"), actionText: $("#actionText"), passportText: $("#passportText"), passportFill: $("#passportFill"),
    sound: $("#soundButton"), pause: $("#pauseButton"), restart: $("#restartButton"), levels: $("#levelsButton"),
    startOverlay: $("#startOverlay"), startLabel: $("#startLevelLabel"), play: $("#playButton"), chooseLevel: $("#chooseLevelButton"),
    pauseOverlay: $("#pauseOverlay"), resume: $("#resumeButton"), pauseRestart: $("#pauseRestartButton"),
    resultOverlay: $("#resultOverlay"), resultIcon: $("#resultIcon"), resultKicker: $("#resultKicker"), resultTitle: $("#resultTitle"), resultMessage: $("#resultMessage"), finalScore: $("#finalScore"), finalCombo: $("#finalCombo"), finalCleared: $("#finalCleared"), finalStamp: $("#finalStamp"), resultFact: $("#resultFact"), learnReward: $("#learnReward"), next: $("#nextButton"), retry: $("#retryButton"),
    levelsOverlay: $("#levelsOverlay"), closeLevels: $("#closeLevelsButton"), levelGrid: $("#levelGrid")
  };

  let saved = loadSaved();
  let selectedLevel = Math.min(MAX_LEVEL, Math.max(1, saved.highestUnlocked || 1));
  let level = selectedLevel;
  let score = 0, lives = 3, timeLeft = 35, combo = 0, bestCombo = 0, cleared = 0, elapsed = 0;
  let running = false, paused = false, starting = false, startRequest = false, soundOn = saved.sound !== false, lastFrame = 0, spawnClock = 0, frameId = 0, coachTimer = 0, runToken = 0;
  let entities = [], audioContext = null;

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  }
  function persist() {
    saved.sound = soundOn;
    saved.highestUnlocked = Math.min(MAX_LEVEL, Math.max(saved.highestUnlocked || 1, selectedLevel));
    saved.completed = saved.completed || {};
    saved.bestScores = saved.bestScores || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }
  function zoneFor(number = level) { return ZONES[Math.min(9, Math.floor((number - 1) / 10))]; }
  function lessonFor(number = level) { return LESSONS[(number - 1) % LESSONS.length]; }
  function configFor(number = level) {
    const band = Math.floor((number - 1) / 10);
    return {
      duration: Math.max(25, 36 - Math.floor(number / 15)),
      target: 300 + number * 45 + band * 75,
      spawnMs: Math.max(300, 820 - number * 4.8),
      speed: 52 + number * 1.22,
      wildlifeChance: Math.min(.34, .12 + number * .0022),
      bonusChance: number > 4 ? .035 : .015
    };
  }
  function stampCount() { return Object.keys(saved.completed || {}).length; }
  function difficultyText(number) {
    if (number <= 10) return "Trainee rescuer";
    if (number <= 30) return "Junior Reef Ranger";
    if (number <= 60) return "Island Ocean Guardian";
    if (number <= 90) return "Master Reef Ranger";
    return "Caribbean Reef Champion";
  }
  function formatScore(value) { return Math.max(0, Math.round(value)).toLocaleString(); }

  function updateLesson() {
    const zone = zoneFor(selectedLevel), lesson = lessonFor(selectedLevel);
    els.zoneFlag.textContent = zone.flag; els.zoneName.textContent = zone.name;
    els.guideEmoji.textContent = zone.emoji; els.guideName.textContent = zone.guide;
    els.factTitle.textContent = lesson[0]; els.factText.textContent = lesson[1]; els.actionText.textContent = lesson[2];
    els.level.textContent = selectedLevel; els.target.textContent = `${formatScore(configFor(selectedLevel).target)} points`;
    els.difficulty.textContent = difficultyText(selectedLevel);
    els.startLabel.textContent = `Level ${selectedLevel} · ${zone.name}`;
    const stamps = stampCount(); els.stamps.textContent = stamps; els.passportText.textContent = `${stamps} / 100 stamps`; els.passportFill.style.width = `${stamps}%`;
    els.best.textContent = formatScore((saved.bestScores || {})[selectedLevel] || 0);
  }
  function updateHUD() {
    const config = configFor();
    els.score.textContent = formatScore(score); els.combo.textContent = `×${Math.max(1, combo)}`; els.time.textContent = Math.max(0, Math.ceil(timeLeft));
    els.lives.textContent = `${"♥ ".repeat(Math.max(0, lives)).trim()}${lives < 3 ? ` ${"♡ ".repeat(3 - Math.max(0, lives)).trim()}` : ""}`;
    const percent = Math.min(100, score / config.target * 100); els.targetFill.style.width = `${percent}%`; els.targetMeter.setAttribute("aria-valuenow", String(Math.round(percent)));
    els.best.textContent = formatScore(Math.max((saved.bestScores || {})[level] || 0, score));
  }

  function buildLevelGrid() {
    els.levelGrid.replaceChildren();
    const unlocked = Math.min(MAX_LEVEL, saved.highestUnlocked || 1);
    for (let number = 1; number <= MAX_LEVEL; number++) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "rr-level-button"; button.textContent = number;
      button.setAttribute("aria-label", `Level ${number}, ${zoneFor(number).name}`);
      if ((saved.completed || {})[number]) button.classList.add("complete");
      if (number === unlocked) button.classList.add("current");
      if (number > unlocked) { button.classList.add("locked"); button.disabled = true; button.title = "Complete the previous level to unlock"; }
      button.addEventListener("click", () => { selectedLevel = number; updateLesson(); els.levelsOverlay.hidden = true; els.startOverlay.hidden = false; });
      els.levelGrid.append(button);
    }
  }

  function ensureAudio() {
    if (!soundOn) return null;
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }
  function tone(kind) {
    const ctx = ensureAudio(); if (!ctx) return;
    const now = ctx.currentTime, oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.type = kind === "miss" ? "sawtooth" : "sine";
    const notes = { hit: [520, 720, .1], bonus: [660, 1040, .22], miss: [170, 100, .18], start: [330, 660, .3], win: [523, 1046, .6] };
    const note = notes[kind] || notes.hit; oscillator.frequency.setValueAtTime(note[0], now); oscillator.frequency.exponentialRampToValueAtTime(note[1], now + note[2]);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.14, now + .015); gain.gain.exponentialRampToValueAtTime(.0001, now + note[2]);
    oscillator.start(now); oscillator.stop(now + note[2] + .02);
  }

  function clearEntities() { entities.forEach(item => item.element.remove()); entities = []; els.particles.replaceChildren(); }
  function spawnEntity() {
    if (!running || paused) return;
    const config = configFor();
    const roll = Math.random();
    let kind = "trash", data;
    if (roll < config.bonusChance) { kind = "bonus"; data = { icon: "⭐", label: "reef boost", points: 140 }; }
    else if (roll < config.bonusChance + config.wildlifeChance) { kind = "wildlife"; data = WILDLIFE[Math.floor(Math.random() * WILDLIFE.length)]; }
    else { data = TRASH[Math.floor(Math.random() * Math.min(TRASH.length, 4 + Math.ceil(level / 20)))]; }
    const size = window.innerWidth < 740 ? 58 : 64;
    const width = els.arena.clientWidth;
    const element = document.createElement("button");
    element.type = "button"; element.className = "rr-entity"; element.dataset.kind = kind; element.setAttribute("aria-label", kind === "wildlife" ? `Protect the ${data.label}; do not tap` : `Clear ${data.label}`);
    element.innerHTML = `<span aria-hidden="true">${data.icon}</span>`;
    const item = { element, kind, data, x: 8 + Math.random() * Math.max(20, width - size - 16), y: -size, speed: config.speed * (.78 + Math.random() * .52), wave: Math.random() * 6.28, hits: data.tough ? 2 : 1 };
    if (kind === "wildlife") item.speed *= .72;
    element.addEventListener("pointerdown", event => { event.preventDefault(); hitEntity(item); }, { passive: false });
    els.layer.append(element); entities.push(item);
  }
  function hitEntity(item) {
    if (!running || paused || !entities.includes(item)) return;
    if (item.kind === "wildlife") {
      score = Math.max(0, score - 100); combo = 0; lives--;
      floatText(item, "Friend! −1 ♥", "#ff8992"); removeEntity(item, true); tone("miss"); coach(`${item.data.icon} That's a ${item.data.label}. Protect wildlife!`);
      if (navigator.vibrate) navigator.vibrate(70); updateHUD(); if (lives <= 0) finish(false, "The reef needs another try"); return;
    }
    item.hits--;
    if (item.hits > 0) { floatText(item, "Tap again!", "#fff0a3"); item.element.animate([{ transform: "translate(var(--x),var(--y)) rotate(-8deg)" }, { transform: "translate(var(--x),var(--y)) rotate(8deg)" }], { duration: 140, iterations: 2 }); tone("hit"); return; }
    combo++; bestCombo = Math.max(bestCombo, combo); cleared++;
    const multiplier = Math.min(4, 1 + Math.floor((combo - 1) / 5));
    const gained = item.data.points * multiplier; score += gained;
    if (item.kind === "bonus") { timeLeft += 3; lives = Math.min(3, lives + 1); tone("bonus"); floatText(item, `+${gained} · +3 sec`, "#7dffd9"); }
    else { tone("hit"); floatText(item, `+${gained}`, "#ffe06b"); }
    removeEntity(item, true); updateHUD();
    if (score >= configFor().target) finish(true);
  }
  function removeEntity(item, animate = false) {
    const index = entities.indexOf(item); if (index >= 0) entities.splice(index, 1);
    if (animate) { item.element.classList.add("rr-hit"); setTimeout(() => item.element.remove(), 270); } else item.element.remove();
  }
  function floatText(item, text, color) {
    const label = document.createElement("span"); label.className = "rr-float-text"; label.textContent = text; label.style.color = color;
    label.style.left = `${item.x + 7}px`; label.style.top = `${item.y + 5}px`; els.particles.append(label); setTimeout(() => label.remove(), 780);
  }
  function coach(message) {
    clearTimeout(coachTimer); els.coach.querySelector("p").innerHTML = `<strong>Kori says:</strong> ${message}`; els.coach.classList.remove("hidden");
    coachTimer = setTimeout(() => els.coach.classList.add("hidden"), 2600);
  }

  function frame(now) {
    if (!running) return;
    if (paused) { lastFrame = now; frameId = requestAnimationFrame(frame); return; }
    const delta = Math.min(.04, (now - lastFrame) / 1000 || 0); lastFrame = now; elapsed += delta; timeLeft -= delta; spawnClock += delta * 1000;
    const config = configFor();
    while (spawnClock >= config.spawnMs) { spawnClock -= config.spawnMs; spawnEntity(); }
    const limit = els.arena.clientHeight - 54;
    [...entities].forEach(item => {
      item.y += item.speed * delta; item.wave += delta * 2.4;
      const sway = Math.sin(item.wave) * 12; item.element.style.setProperty("--x", `${item.x + sway}px`); item.element.style.setProperty("--y", `${item.y}px`); item.element.style.transform = `translate(${item.x + sway}px,${item.y}px)`;
      if (item.y >= limit) {
        removeEntity(item);
        if (item.kind === "trash") { lives--; combo = 0; tone("miss"); coach("Rubbish reached the coral—keep watch near the bottom!"); if (navigator.vibrate) navigator.vibrate(45); }
      }
    });
    updateHUD();
    if (lives <= 0) finish(false, "Too much rubbish reached the coral");
    else if (timeLeft <= 0) finish(score >= config.target, score >= config.target ? "Mission complete" : "Time ran out—almost there!");
    else frameId = requestAnimationFrame(frame);
  }

  function guestCap() {
    const hinted = Number(window.LikkleLegends?.guestLevelCap);
    return Number.isInteger(hinted) && hinted > 0 ? hinted : GUEST_LEVELS;
  }
  function accessGranted(number) {
    if (number <= guestCap()) return true;
    const check = window.LikkleLegends?.requireAccess;
    if (typeof check !== "function") return false;
    try { return check({ completedLevels: Math.max(0, number - 1), prompt: false }) === true; }
    catch { return false; }
  }
  function highestAllowedLevel() {
    const progress = Math.min(MAX_LEVEL, Math.max(1, Number(saved.highestUnlocked) || 1, selectedLevel || 1));
    if (accessGranted(progress)) return progress;
    for (let number = progress - 1; number > guestCap(); number--) {
      if (accessGranted(number)) return number;
    }
    return guestCap();
  }
  function showUnlock(blocking = true) {
    if (blocking && typeof window.LikkleLegends?.openUnlock === "function") {
      window.LikkleLegends.openUnlock();
      return;
    }
    let banner = document.getElementById("rrGuestUnlock");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "rrGuestUnlock";
      banner.setAttribute("role", "status");
      banner.innerHTML = `<p>Levels 1–${guestCap()} are open for guests. An adult can unlock the rest of the reef journey. No payment.</p><button type="button" id="rrGuestUnlockClose">Keep playing</button>`;
      document.body.append(banner);
      const dismiss = event => { event.preventDefault(); banner.hidden = true; };
      const close = banner.querySelector("#rrGuestUnlockClose");
      close.addEventListener("pointerdown", dismiss);
      close.addEventListener("click", dismiss);
    }
    banner.hidden = false;
  }
  function waitForGateClose() {
    const gate = document.getElementById("llUnlockGate");
    if (!gate || gate.hidden) return Promise.resolve();
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        if (!gate.hidden) return;
        observer.disconnect();
        resolve();
      });
      observer.observe(gate, { attributes: true, attributeFilter: ["hidden"] });
    });
  }
  function releaseCountdown() {
    els.countdown.hidden = true;
    els.countdown.style.pointerEvents = "none";
  }
  async function startGame() {
    if (running || starting || startRequest) return;
    startRequest = true;
    try {
      if (!accessGranted(selectedLevel)) {
        selectedLevel = highestAllowedLevel();
        updateLesson();
        showUnlock();
        await waitForGateClose();
        if (!accessGranted(selectedLevel)) return;
      }
    const token = ++runToken;
    level = selectedLevel; const config = configFor();
    clearEntities(); score = 0; lives = 3; timeLeft = config.duration; combo = 0; bestCombo = 0; cleared = 0; elapsed = 0; spawnClock = config.spawnMs * .7;
    running = false; paused = false; starting = true; startRequest = false; els.startOverlay.hidden = true; els.resultOverlay.hidden = true; els.pauseOverlay.hidden = true;
    els.pause.disabled = false; els.restart.disabled = false; updateLesson(); updateHUD(); ensureAudio();
    els.countdown.hidden = false;
    els.countdown.style.pointerEvents = "auto";
    for (const value of ["3", "2", "1", "GO!"]) {
      els.countdown.textContent = value; tone(value === "GO!" ? "start" : "hit"); await wait(value === "GO!" ? 450 : 620);
      if (token !== runToken) { if (!running) releaseCountdown(); return; }
    }
    releaseCountdown(); starting = false; running = true; lastFrame = performance.now(); coach("Tap the rubbish. Let every sea creature swim safely!"); frameId = requestAnimationFrame(frame);
    } finally { startRequest = false; }
  }
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function pauseGame(show = true) {
    if (!running) return; paused = show; els.pauseOverlay.hidden = !show; els.pause.textContent = show ? "▶ Resume" : "Ⅱ Pause";
    if (!show) { lastFrame = performance.now(); ensureAudio(); }
  }
  function restartGame() { runToken++; starting = false; running = false; paused = false; cancelAnimationFrame(frameId); startGame(); }
  function finish(success, message = "") {
    if (!running) return; running = false; paused = false; cancelAnimationFrame(frameId); clearEntities();
    els.pause.disabled = true; els.restart.disabled = true;
    const lesson = lessonFor(level);
    if (success) {
      const timeBonus = Math.max(0, Math.ceil(timeLeft)) * 20; score += timeBonus;
      saved.completed = saved.completed || {}; saved.bestScores = saved.bestScores || {};
      const earnedNewStamp = !saved.completed[level];
      saved.completed[level] = true; saved.bestScores[level] = Math.max(saved.bestScores[level] || 0, score);
      saved.highestUnlocked = Math.max(saved.highestUnlocked || 1, Math.min(MAX_LEVEL, level + 1));
      selectedLevel = Math.min(MAX_LEVEL, level + 1); persist(); tone("win");
      els.resultIcon.textContent = level === MAX_LEVEL ? "🏆" : "🏅"; els.resultKicker.textContent = "Mission complete"; els.resultTitle.textContent = level === MAX_LEVEL ? "Caribbean champion!" : "Reef rescued!";
      els.resultMessage.textContent = earnedNewStamp ? `You protected ${zoneFor(level).name} and earned a Reef Passport stamp.` : `You protected ${zoneFor(level).name} and improved your ranger skills.`; els.finalStamp.textContent = earnedNewStamp ? "+1" : "Saved";
      els.next.hidden = level >= MAX_LEVEL; els.retry.textContent = level >= MAX_LEVEL ? "Play this mission again" : "Play level again"; els.learnReward.hidden = false;
      window.LikkleLegends?.recordLevel?.("reef-rescue", level, Math.round(score), stampCount());
    } else {
      saved.bestScores = saved.bestScores || {}; saved.bestScores[level] = Math.max(saved.bestScores[level] || 0, score); persist(); tone("miss");
      selectedLevel = level; els.resultIcon.textContent = "🛟"; els.resultKicker.textContent = "Ranger regroup"; els.resultTitle.textContent = "The reef needs you!";
      els.resultMessage.textContent = message || "Try again, tap faster and remember to protect the wildlife."; els.finalStamp.textContent = "—"; els.next.hidden = true; els.retry.textContent = "Try again"; els.learnReward.hidden = true;
    }
    els.finalScore.textContent = formatScore(score); els.finalCombo.textContent = `×${Math.max(1, bestCombo)}`; els.finalCleared.textContent = cleared; els.resultFact.textContent = lesson[1];
    updateLesson(); buildLevelGrid(); els.resultOverlay.hidden = false;
  }

  const pressStart = event => {
    if (event.type === "pointerdown" && event.button > 0) return;
    if (event.cancelable) event.preventDefault();
    startGame();
  };
  els.play.addEventListener("pointerdown", pressStart);
  els.play.addEventListener("click", pressStart);
  els.chooseLevel.addEventListener("click", () => { buildLevelGrid(); els.startOverlay.hidden = true; els.levelsOverlay.hidden = false; });
  els.levels.addEventListener("click", () => { if (starting) { runToken++; starting = false; releaseCountdown(); } if (running) pauseGame(true); buildLevelGrid(); els.levelsOverlay.hidden = false; });
  els.closeLevels.addEventListener("click", () => { els.levelsOverlay.hidden = true; if (running && paused) pauseGame(false); else if (!running) els.startOverlay.hidden = false; });
  els.pause.addEventListener("click", () => pauseGame(!paused)); els.resume.addEventListener("click", () => pauseGame(false));
  els.restart.addEventListener("click", restartGame); els.pauseRestart.addEventListener("click", restartGame);
  els.retry.addEventListener("click", () => { selectedLevel = level; startGame(); }); els.next.addEventListener("click", startGame);
  els.sound.addEventListener("click", () => { soundOn = !soundOn; els.sound.textContent = soundOn ? "🔊" : "🔇"; els.sound.setAttribute("aria-label", soundOn ? "Turn sound off" : "Turn sound on"); persist(); if (soundOn) tone("hit"); });
  document.addEventListener("keydown", event => { if (event.key.toLowerCase() === "p" && running) pauseGame(!paused); if (event.key.toLowerCase() === "r" && running) restartGame(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && running && !paused) pauseGame(true); });
  addEventListener("likkle:ready", event => {
    const remoteLevel = Math.min(MAX_LEVEL, Math.max(0, Number(event.detail?.progress?.["reef-rescue"]?.level) || 0));
    if (!remoteLevel) return;
    saved.completed = saved.completed || {};
    for (let number = 1; number <= remoteLevel; number++) saved.completed[number] = true;
    saved.highestUnlocked = Math.min(MAX_LEVEL, Math.max(saved.highestUnlocked || 1, remoteLevel + 1));
    if (!running && !starting) {
      const next = Math.max(selectedLevel, saved.highestUnlocked || 1);
      if (accessGranted(next)) selectedLevel = next;
      else { selectedLevel = highestAllowedLevel(); showUnlock(false); }
    }
    persist(); updateLesson(); buildLevelGrid();
  });

  saved.completed = saved.completed || {}; saved.bestScores = saved.bestScores || {}; saved.highestUnlocked = Math.max(1, saved.highestUnlocked || 1);
  if (!accessGranted(selectedLevel)) { selectedLevel = highestAllowedLevel(); showUnlock(false); }
  els.sound.textContent = soundOn ? "🔊" : "🔇"; updateLesson(); updateHUD(); buildLevelGrid(); persist();
})();
