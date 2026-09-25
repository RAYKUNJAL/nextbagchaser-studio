(() => {
  "use strict";

  const SIZE = 8;
  const STORAGE_KEY = "cbc-game-v2";
  const LEGACY_STORAGE_KEY = "cbc-game-v1";
  const ASSET_ROOT = "./assets/items/";
  const ITEM_COLORS = {
    food: ["#ffd166", "#e47b2f"],
    nature: ["#6ce5c2", "#247fa6"],
    culture: ["#d0adff", "#6c4fd3"]
  };
  const FLAG_CODES = {
    trinidad: "tt", jamaica: "jm", barbados: "bb", guyana: "gy", grenada: "gd", "saint-lucia": "lc",
    bahamas: "bs", "dominican-republic": "do", haiti: "ht", "puerto-rico": "pr", antigua: "ag", dominica: "dm",
    "st-vincent": "vc", "st-kitts": "kn", cuba: "cu", belize: "bz"
  };

  const SHAPES = [
    { name: "Single", cells: [[0, 0]], weight: 7 },
    { name: "Domino", cells: [[0, 0], [1, 0]], weight: 9 },
    { name: "Tall domino", cells: [[0, 0], [0, 1]], weight: 9 },
    { name: "Three bar", cells: [[0, 0], [1, 0], [2, 0]], weight: 8 },
    { name: "Tall three", cells: [[0, 0], [0, 1], [0, 2]], weight: 8 },
    { name: "Four bar", cells: [[0, 0], [1, 0], [2, 0], [3, 0]], weight: 4 },
    { name: "Tall four", cells: [[0, 0], [0, 1], [0, 2], [0, 3]], weight: 4 },
    { name: "Square", cells: [[0, 0], [1, 0], [0, 1], [1, 1]], weight: 8 },
    { name: "Small L", cells: [[0, 0], [0, 1], [1, 1]], weight: 7 },
    { name: "L", cells: [[0, 0], [0, 1], [0, 2], [1, 2]], weight: 5 },
    { name: "J", cells: [[1, 0], [1, 1], [0, 2], [1, 2]], weight: 5 },
    { name: "T", cells: [[0, 0], [1, 0], [2, 0], [1, 1]], weight: 5 },
    { name: "S", cells: [[1, 0], [2, 0], [0, 1], [1, 1]], weight: 4 },
    { name: "Z", cells: [[0, 0], [1, 0], [1, 1], [2, 1]], weight: 4 },
    { name: "Big corner", cells: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]], weight: 2 },
    { name: "3 by 3 square", cells: [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]], weight: 1 }
  ];

  const DESTINATION_SPECS = [
    { id: "trinidad", label: "Trinidad & Tobago", flag: "🇹🇹", chapter: "Port of Spain Nights", vibe: "Carnival heat", colors: ["#fff4e6", "#e62333"], accent: "#ffd04d", accent2: "#ff426d", hue: 0,
      food: ["Doubles", "food-00.webp"], nature: ["Scarlet Ibis", "nature-00.webp"], culture: ["Steelpan", "culture-10.webp"] },
    { id: "jamaica", label: "Jamaica", flag: "🇯🇲", chapter: "Kingston Sunset", vibe: "Sound-system glow", colors: ["#f9d616", "#169b62"], accent: "#f9d616", accent2: "#31c66b", hue: 38,
      food: ["Ackee & Saltfish", "food-01.webp"], nature: ["Doctor Bird", "nature-01.webp"], culture: ["Julie Mango", "culture-06.webp"] },
    { id: "barbados", label: "Barbados", flag: "🇧🇧", chapter: "Bridgetown Glow", vibe: "Coastal rhythm", colors: ["#ffc726", "#2589e8"], accent: "#ffc726", accent2: "#3aa7ff", hue: 185,
      food: ["Flying Fish & Cou-Cou", "food-02.webp"], nature: ["Pride of Barbados", "nature-02.webp"], culture: ["Conch Shell", "culture-12.webp"] },
    { id: "guyana", label: "Guyana", flag: "🇬🇾", chapter: "Demerara River Lights", vibe: "Rainforest color", colors: ["#fcd116", "#009e49"], accent: "#fcd116", accent2: "#1bc46d", hue: 55,
      food: ["Pepperpot", "food-03.webp"], nature: ["Jaguar", "nature-03.webp"], culture: ["Cacao Pod", "culture-08.webp"] },
    { id: "grenada", label: "Grenada", flag: "🇬🇩", chapter: "Spice Isle Market", vibe: "Spice and garden", colors: ["#fcd116", "#ce1126"], accent: "#fcd116", accent2: "#ef4b4f", hue: 15,
      food: ["Oil Down", "food-04.webp"], nature: ["Grenada Dove", "nature-04.webp"], culture: ["Nutmeg", "culture-07.webp"] },
    { id: "saint-lucia", label: "Saint Lucia", flag: "🇱🇨", chapter: "Pitons at Sunset", vibe: "Mountain coast", colors: ["#fcd116", "#66ccff"], accent: "#fcd116", accent2: "#49bff4", hue: 180,
      food: ["Green Fig & Saltfish", "food-05.webp"], nature: ["Saint Lucia Parrot", "nature-05.webp"], culture: ["Tropical Orchid", "culture-05.webp"] },
    { id: "bahamas", label: "The Bahamas", flag: "🇧🇸", chapter: "Junkanoo Harbour", vibe: "Aquamarine energy", colors: ["#f9d616", "#00abc9"], accent: "#f9d616", accent2: "#26c8df", hue: 170,
      food: ["Conch Fritters", "food-06.webp"], nature: ["Caribbean Flamingo", "nature-06.webp"], culture: ["Coconut Drink", "culture-14.webp"] },
    { id: "dominican-republic", label: "Dominican Republic", flag: "🇩🇴", chapter: "Santo Domingo Beat", vibe: "Merengue color", colors: ["#ffffff", "#ce1126"], accent: "#ffffff", accent2: "#f04b58", hue: 325,
      food: ["Mangú", "food-07.webp"], nature: ["Hispaniolan Parrot", "nature-07.webp"], culture: ["Maracas", "culture-13.webp"] },
    { id: "haiti", label: "Haiti", flag: "🇭🇹", chapter: "Jacmel Art Night", vibe: "Mountain and market", colors: ["#d21034", "#2349b8"], accent: "#ffcc4d", accent2: "#e42c54", hue: 300,
      food: ["Griot & Pikliz", "food-08.webp"], nature: ["Hispaniolan Trogon", "nature-08.webp"], culture: ["Bougainvillea", "culture-03.webp"] },
    { id: "puerto-rico", label: "Puerto Rico", flag: "🇵🇷", chapter: "Old San Juan Nights", vibe: "Coquí after dark", colors: ["#ffffff", "#ed0000"], accent: "#63c9ff", accent2: "#f24055", hue: 215,
      food: ["Mofongo", "food-09.webp"], nature: ["Coquí Frog", "nature-09.webp"], culture: ["Hibiscus", "culture-02.webp"] },
    { id: "antigua", label: "Antigua & Barbuda", flag: "🇦🇬", chapter: "English Harbour Glow", vibe: "Harbour breeze", colors: ["#fcd116", "#e72b37"], accent: "#fcd116", accent2: "#ff5662", hue: 10,
      food: ["Ducana & Saltfish", "food-10.webp"], nature: ["Frigatebird", "nature-10.webp"], culture: ["Postman Butterfly", "culture-01.webp"] },
    { id: "dominica", label: "Dominica", flag: "🇩🇲", chapter: "Nature Island Rain", vibe: "Emerald wilds", colors: ["#fcd116", "#13864b"], accent: "#fcd116", accent2: "#36ce7e", hue: 70,
      food: ["Callaloo", "food-11.webp"], nature: ["Sisserou Parrot", "nature-11.webp"], culture: ["Heliconia", "culture-04.webp"] },
    { id: "st-vincent", label: "St Vincent & Grenadines", flag: "🇻🇨", chapter: "Grenadine Blue", vibe: "Volcano and sea", colors: ["#fcd116", "#009e60"], accent: "#fcd116", accent2: "#24bf75", hue: 115,
      food: ["Breadfruit & Jackfish", "food-12.webp"], nature: ["Saint Vincent Parrot", "nature-12.webp"], culture: ["Blue Morpho", "culture-00.webp"] },
    { id: "st-kitts", label: "St Kitts & Nevis", flag: "🇰🇳", chapter: "Basseterre Breeze", vibe: "Sugar coast", colors: ["#fcd116", "#009e49"], accent: "#fcd116", accent2: "#ed4052", hue: 42,
      food: ["Goat Water", "food-13.webp"], nature: ["Brown Pelican", "nature-13.webp"], culture: ["Golden Pineapple", "culture-09.webp"] },
    { id: "cuba", label: "Cuba", flag: "🇨🇺", chapter: "Havana Carnival", vibe: "Old-city rhythm", colors: ["#ffffff", "#d52b1e"], accent: "#ffd04d", accent2: "#ef4054", hue: 335,
      food: ["Ropa Vieja", "food-14.webp"], nature: ["Tocororo", "nature-14.webp"], culture: ["Carnival Mask", "culture-11.webp"] },
    { id: "belize", label: "Belize", flag: "🇧🇿", chapter: "Barrier Reef Light", vibe: "Reef and rainforest", colors: ["#4ac7ff", "#1c52a5"], accent: "#5fe1d4", accent2: "#4b8cff", hue: 190,
      food: ["Rice, Beans & Stew Chicken", "food-15.webp"], nature: ["Keel-Billed Toucan", "nature-15.webp"], culture: ["Cacao Pod", "culture-08.webp"] },
    { id: "aruba", label: "Aruba", flag: "🇦🇼", vibe: "Desert coast", future: true, food: ["Keshi Yena"], nature: ["Shoco Owl"], culture: ["Divi-Divi Tree"] },
    { id: "curacao", label: "Curaçao", flag: "🇨🇼", vibe: "Willemstad color", future: true, food: ["Funchi"], nature: ["White-Tailed Deer"], culture: ["Laraha Orange"] },
    { id: "bonaire", label: "Bonaire", flag: "🇧🇶", vibe: "Salt and flamingos", future: true, food: ["Kabritu Stoba"], nature: ["Bonaire Flamingo"], culture: ["Kadushi Cactus"] },
    { id: "cayman", label: "Cayman Islands", flag: "🇰🇾", vibe: "Blue water wilds", future: true, food: ["Cayman-Style Beef"], nature: ["Blue Iguana"], culture: ["Silver Thatch Palm"] },
    { id: "turks-caicos", label: "Turks & Caicos", flag: "🇹🇨", vibe: "Conch and clear seas", future: true, food: ["Conch Salad"], nature: ["Brown Pelican"], culture: ["Turk's Head Cactus"] },
    { id: "bvi", label: "British Virgin Islands", flag: "🇻🇬", vibe: "Sailing waters", future: true, food: ["Fish & Fungi"], nature: ["Anegada Rock Iguana"], culture: ["Frangipani"] },
    { id: "usvi", label: "U.S. Virgin Islands", flag: "🇻🇮", vibe: "Harbour carnival", future: true, food: ["Kallaloo"], nature: ["Bananaquit"], culture: ["Flamboyant Tree"] },
    { id: "anguilla", label: "Anguilla", flag: "🇦🇮", vibe: "White-sand calm", future: true, food: ["Grilled Crayfish"], nature: ["Anguilla Racer"], culture: ["Lignum Vitae"] },
    { id: "montserrat", label: "Montserrat", flag: "🇲🇸", vibe: "Emerald volcano", future: true, food: ["Goat Water"], nature: ["Montserrat Oriole"], culture: ["Heliconia"] },
    { id: "martinique", label: "Martinique", flag: "🇲🇶", vibe: "Creole coast", future: true, food: ["Accras"], nature: ["Martinique Oriole"], culture: ["Anthurium"] },
    { id: "guadeloupe", label: "Guadeloupe", flag: "🇬🇵", vibe: "Butterfly islands", future: true, food: ["Bokit"], nature: ["Guadeloupe Woodpecker"], culture: ["Tropical Orchid"] },
    { id: "sint-maarten", label: "Sint Maarten", flag: "🇸🇽", vibe: "Festival shore", future: true, food: ["Johnny Cakes"], nature: ["Brown Pelican"], culture: ["Flamboyant"] },
    { id: "saint-martin", label: "Saint Martin", flag: "🇲🇫", vibe: "French-Caribbean color", future: true, food: ["Cod Fritters"], nature: ["Sugar Bird"], culture: ["Bougainvillea"] },
    { id: "suriname", label: "Suriname", flag: "🇸🇷", vibe: "River and rainforest", future: true, food: ["Pom"], nature: ["Red-Faced Spider Monkey"], culture: ["Water Lily"] },
    { id: "french-guiana", label: "French Guiana", flag: "🇬🇫", vibe: "Amazonian Caribbean", future: true, food: ["Bouillon d'Awara"], nature: ["Scarlet Macaw"], culture: ["Cacao"] }
  ];

  const DESTINATIONS = DESTINATION_SPECS.map((d, index) => {
    if (d.future) {
      return { ...d, colors: ["#88d8c8", "#365b8d"], accent: "#ffd04d", accent2: "#4bc7b1", hue: 0, unlock: Infinity, chapter: `${d.label} — Future Chapter`, items: [] };
    }
    const colors = d.colors;
    const flagAsset = `./assets/flags/${FLAG_CODES[d.id]}.png`;
    return {
      ...d, flagAsset,
      unlock: index < 3 ? 0 : (index - 2) * 2,
      items: [
        { id: `${d.id}-flag`, name: `${d.label} Flag`, kind: "Island Flag", flag: d.flag, asset: flagAsset, colors },
        { id: `${d.id}-food`, name: d.food[0], kind: "Island Food", asset: ASSET_ROOT + d.food[1], colors: ITEM_COLORS.food },
        { id: `${d.id}-nature`, name: d.nature[0], kind: "Island Wildlife", asset: ASSET_ROOT + d.nature[1], colors: ITEM_COLORS.nature },
        { id: `${d.id}-culture`, name: d.culture[0], kind: "Island Treasure", asset: ASSET_ROOT + d.culture[1], colors: ITEM_COLORS.culture }
      ]
    };
  });
  const TREASURES = DESTINATIONS.flatMap(destination => destination.items.map(item => ({ ...item, destinationId: destination.id })));
  const TREASURE_BY_ID = new Map(TREASURES.map(item => [item.id, item]));
  const DESTINATION_BY_ID = new Map(DESTINATIONS.map(destination => [destination.id, destination]));
  const LEVELS_PER_ISLAND = 64;
  const PLAYABLE_DESTINATIONS = DESTINATIONS.filter(destination => !destination.future);
  const TOTAL_LEVELS = PLAYABLE_DESTINATIONS.length * LEVELS_PER_ISLAND;

  const $ = selector => document.querySelector(selector);
  const els = {
    board: $("#board"), tray: $("#tray"), score: $("#score"), highScore: $("#highScore"), lines: $("#lines"), combo: $("#combo"), comboCard: $("#comboCard"),
    feverFill: $("#feverFill"), feverText: $("#feverText"), feverMeter: $(".meter"), rushBadge: $("#rushBadge"), callout: $("#callout"), effectsLayer: $("#effectsLayer"), tipText: $("#tipText"),
    coachCard: $("#coachCard"), coachStep: $("#coachStep"), coachTitle: $("#coachTitle"), coachText: $("#coachText"), rulesSteps: [...document.querySelectorAll(".rules-strip div")],
    startScreen: $("#startScreen"), pauseScreen: $("#pauseScreen"), stopScreen: $("#stopScreen"), settingsScreen: $("#settingsScreen"), gameOverScreen: $("#gameOverScreen"),
    playButton: $("#playButton"), mapBackButton: $("#mapBackButton"), prevIslandButton: $("#prevIslandButton"), nextIslandButton: $("#nextIslandButton"), startResumeButton: $("#startResumeButton"), pauseButton: $("#pauseButton"), stopButton: $("#stopButton"), settingsButton: $("#settingsButton"),
    resumeButton: $("#resumeButton"), restartFromPause: $("#restartFromPause"), keepPlayingButton: $("#keepPlayingButton"), confirmStopButton: $("#confirmStopButton"),
    closeSettings: $("#closeSettings"), playAgainButton: $("#playAgainButton"), changeIslandButton: $("#changeIslandButton"), openMapButton: $("#openMapButton"),
    musicToggle: $("#musicToggle"), soundToggle: $("#soundToggle"), hapticToggle: $("#hapticToggle"), motionToggle: $("#motionToggle"),
    islandLabel: $("#islandLabel"), chapterName: $("#chapterName"), foodEmoji: $("#foodEmoji"), foodName: $("#foodName"), foodProgress: $("#foodProgress"),
    passportCount: $("#passportCount"), passportFill: $("#passportFill"), treasureShelf: $("#treasureShelf"), goalLinesCheck: $("#goalLinesCheck"), goalRushCheck: $("#goalRushCheck"), goalTreasureCheck: $("#goalTreasureCheck"),
    finalScore: $("#finalScore"), finalBest: $("#finalBest"), finalLines: $("#finalLines"), finalCombo: $("#finalCombo"), gameOverTitle: $("#gameOverTitle"), resultKicker: $("#resultKicker"), confetti: $("#confetti"),
    destinationMap: $("#destinationMap"), journeySummary: $("#journeySummary"), currentIslandFlag: $("#currentIslandFlag"), unlockTitle: $("#unlockTitle"), unlockText: $("#unlockText"),
    rotatePieceButton: $("#rotatePieceButton"), swapPieceButton: $("#swapPieceButton"), swapCount: $("#swapCount"), pieceToolStatus: $("#pieceToolStatus"),
    nextUnlockName: $("#nextUnlockName"), nextUnlockProgress: $("#nextUnlockProgress")
  };

  const saved = loadSaved();
  const settings = { music: saved.music !== false, sound: saved.sound !== false, haptics: saved.haptics !== false, reducedMotion: saved.reducedMotion === true };
  const collection = new Set(migrateCollection(saved.collection));
  const levelProgress = saved.levelProgress && typeof saved.levelProgress === "object" ? { ...saved.levelProgress } : {};
  let board = emptyBoard();
  let pieces = [];
  let selectedPiece = null;
  let score = 0;
  let totalLines = 0;
  let combo = 0;
  let maxCombo = 0;
  let fever = 0;
  let rushMoves = 0;
  let collectedThisRun = 0;
  let lastCollected = null;
  let recentCollected = [];
  let theme = DESTINATION_BY_ID.has(saved.theme) ? saved.theme : "trinidad";
  let running = false;
  let paused = false;
  let locked = false;
  let hasRushed = false;
  let tutorial = false;
  let mapPreview = false;
  let audioContext = null;
  let musicTimer = null;
  let musicGain = null;
  let musicStep = 0;
  let noiseBuffer = null;
  let activeLevel = 1;
  let levelCompleted = false;
  let resultMode = "";
  let seed = Date.now() >>> 0;
  let drag = null;
  let suppressPieceClick = false;
  let swapsRemaining = 3;

  function emptyBoard() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(null)); }

  function loadSaved() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (current) return current;
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
      return legacy;
    } catch { return {}; }
  }

  function migrateCollection(items) {
    if (!Array.isArray(items)) return [];
    const aliases = {
      "flag-tt": "trinidad-flag", "flag-jm": "jamaica-flag", "flag-bb": "barbados-flag", "flag-gy": "guyana-flag", "flag-gd": "grenada-flag", "flag-lc": "saint-lucia-flag", "flag-bs": "bahamas-flag", "flag-do": "dominican-republic-flag", "flag-ht": "haiti-flag", "flag-pr": "puerto-rico-flag",
      "food-doubles": "trinidad-food", "food-ackee": "jamaica-food", "food-flyingfish": "barbados-food", "food-pepperpot": "guyana-food", "food-oildown": "grenada-food", "food-conch": "bahamas-food", "food-mofongo": "puerto-rico-food", "bird-ibis": "trinidad-nature", "bird-humming": "jamaica-nature", "bird-flamingo": "bahamas-nature", "flower-pride": "barbados-nature"
    };
    return items.map(id => aliases[id] || id).filter(id => TREASURE_BY_ID.has(id));
  }

  function persist() {
    const prior = loadSaved();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...prior, theme, music: settings.music, sound: settings.sound, haptics: settings.haptics, reducedMotion: settings.reducedMotion,
      tutorialSeen: prior.tutorialSeen || tutorial, highScore: Math.max(prior.highScore || 0, score), collection: [...collection], levelProgress
    }));
  }

  function currentDestination() { return DESTINATION_BY_ID.get(theme) || DESTINATIONS[0]; }
  function isUnlocked(index, stamps = collection.size) { return !DESTINATIONS[index].future && stamps >= DESTINATIONS[index].unlock; }
  function unlockedCount(stamps = collection.size) { return DESTINATIONS.filter((_, index) => isUnlocked(index, stamps)).length; }
  function nextLockedDestination() { return DESTINATIONS.find((destination, index) => !destination.future && !isUnlocked(index)) || null; }
  function completedOnIsland(destinationId = theme) { return Math.max(0, Math.min(LEVELS_PER_ISLAND, Number(levelProgress[destinationId]) || 0)); }
  function currentIslandLevel(destinationId = theme) { return Math.min(LEVELS_PER_ISLAND, completedOnIsland(destinationId) + 1); }
  function completedLevelCount() { return PLAYABLE_DESTINATIONS.reduce((sum, destination) => sum + completedOnIsland(destination.id), 0); }
  function hydrateCloudProgress(event) {
    const cloud = event.detail?.progress?.["block-carnival"];
    const completed = Math.max(0, Math.min(TOTAL_LEVELS, Number(cloud?.level) || 0));
    if (completed <= completedLevelCount()) return;
    let remaining = completed;
    PLAYABLE_DESTINATIONS.forEach(destination => {
      const restored = Math.min(LEVELS_PER_ISLAND, remaining);
      levelProgress[destination.id] = Math.max(completedOnIsland(destination.id), restored);
      remaining = Math.max(0, remaining - LEVELS_PER_ISLAND);
    });
    persist();
    applyTheme();
    renderDestinationMap();
    updateHUD();
  }
  function globalLevelNumber(destinationId = theme, localLevel = currentIslandLevel(destinationId)) {
    const islandIndex = Math.max(0, PLAYABLE_DESTINATIONS.findIndex(destination => destination.id === destinationId));
    return islandIndex * LEVELS_PER_ISLAND + localLevel;
  }

  function levelGoal(level = activeLevel) {
    const tier = Math.floor((level - 1) / 8);
    const kind = ["lines", "score", "treasures", "combo", "fever"][(level - 1) % 5];
    // Each stage is a run, not a two-line sprint. Guest levels 1–3 stay finishable
    // on a careful board; later tiers ask for more lines, points, and finds.
    if (kind === "lines") return { kind, target: Math.min(12, 6 + tier * 2), label: "Clear lines" };
    if (kind === "score") return { kind, target: 1400 + tier * 500, label: "Score points" };
    if (kind === "treasures") return { kind, target: Math.min(12, 6 + tier), label: "Collect treasures" };
    if (kind === "combo") return { kind, target: Math.min(5, 3 + Math.floor(tier / 3)), label: "Build a combo" };
    return { kind, target: Math.min(100, 80 + tier * 2), label: "Fill Carnival Fever" };
  }

  function levelGoalProgress(goal = levelGoal()) {
    if (goal.kind === "lines") return totalLines;
    if (goal.kind === "score") return score;
    if (goal.kind === "treasures") return collectedThisRun;
    if (goal.kind === "combo") return maxCombo;
    return rushMoves > 0 ? 100 : fever;
  }

  function levelGoalText(goal = levelGoal(), includeProgress = true) {
    const progress = Math.min(goal.target, Math.floor(levelGoalProgress(goal)));
    const suffix = includeProgress ? ` (${progress}/${goal.target}${goal.kind === "fever" ? "%" : ""})` : "";
    if (goal.kind === "lines") return `Clear ${goal.target} line${goal.target === 1 ? "" : "s"}${suffix}`;
    if (goal.kind === "score") return `Score ${goal.target.toLocaleString()} points${suffix}`;
    if (goal.kind === "treasures") return `Collect ${goal.target} treasure${goal.target === 1 ? "" : "s"}${suffix}`;
    if (goal.kind === "combo") return `Reach a ×${goal.target} combo${suffix}`;
    return `Reach ${goal.target}% Carnival Fever${suffix}`;
  }

  function seedFromText(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
    return result >>> 0;
  }

  function random() {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  }

  function weightedShape(source = SHAPES) {
    const total = source.reduce((sum, shape) => sum + shape.weight, 0);
    let pick = random() * total;
    for (const shape of source) { pick -= shape.weight; if (pick <= 0) return shape; }
    return source[0] || SHAPES[0];
  }

  function pickTreasure(index = 0) {
    const destination = currentDestination();
    if (index < destination.items.length && pieces.length === 0) return destination.items[index];
    return destination.items[Math.floor(random() * destination.items.length)];
  }

  function makePiece(shape, index, treasure = null) {
    return {
      id: `${Date.now()}-${index}-${Math.floor(random() * 1e6)}`,
      name: shape.name,
      cells: shape.cells.map(([x, y]) => ({ x, y })),
      rotation: 0,
      treasure: treasure || pickTreasure(index),
      used: false
    };
  }

  function setCoach(step, title, message, tip = "Tap or drag") {
    els.coachStep.textContent = `STEP ${step} OF 3`;
    els.coachTitle.textContent = title;
    els.coachText.textContent = message;
    els.tipText.textContent = tip;
    els.coachCard.dataset.step = String(step);
    els.rulesSteps.forEach((item, index) => {
      item.classList.toggle("active", index + 1 === step);
      item.classList.toggle("done", index + 1 < step);
    });
  }

  function generateTray(first = false) {
    const destination = currentDestination();
    if (first && tutorial) {
      pieces = [makePiece(SHAPES[3], 0, destination.items[0]), makePiece(SHAPES[8], 1, destination.items[1]), makePiece(SHAPES[1], 2, destination.items[2])];
    } else if (first) {
      pieces = [0, 1, 2].map(index => makePiece(weightedShape(), index, destination.items[index]));
    } else {
      pieces = [0, 1, 2].map(index => makePiece(weightedShape(), index));
      let attempts = 0;
      while (!pieces.some(pieceHasAnyFit) && attempts < 10) {
        pieces = [0, 1, 2].map(index => makePiece(weightedShape(), index));
        attempts++;
      }
    }
    selectedPiece = null;
    renderTray();
    setCoach(1, "Choose a piece", "Pick one of the three island collectibles.");
    requestAnimationFrame(checkGameOver);
  }

  function startGame() {
    if (window.LikkleLegends && !window.LikkleLegends.requireAccess({ completedLevels: completedLevelCount() })) return;
    const index = DESTINATIONS.findIndex(destination => destination.id === theme);
    if (index < 0 || !isUnlocked(index)) theme = DESTINATIONS[0].id;
    activeLevel = currentIslandLevel(); levelCompleted = false; resultMode = ""; swapsRemaining = 3;
    seed = (seedFromText(theme) ^ Math.imul(activeLevel, 2654435761)) >>> 0;
    board = emptyBoard(); score = 0; totalLines = 0; combo = 0; maxCombo = 0; fever = 0; rushMoves = 0;
    collectedThisRun = 0; lastCollected = null; recentCollected = []; hasRushed = false;
    selectedPiece = null; locked = false; paused = false; running = true; mapPreview = false;
    tutorial = !loadSaved().tutorialSeen;
    if (tutorial) {
      const tutorialTreasure = currentDestination().items[0];
      for (let x = 0; x < 5; x++) board[7][x] = { colors: tutorialTreasure.colors, treasure: tutorialTreasure };
    }
    applyTheme(); renderBoard(); generateTray(true); updateHUD(); updateControls();
    if (tutorial) setCoach(1, "Choose the flag", "Pick the 3-block flag piece to finish the glowing bottom row.", "Start with the flag");
    els.startScreen.hidden = true; els.gameOverScreen.hidden = true; els.pauseScreen.hidden = true; els.stopScreen.hidden = true;
    els.playButton.hidden = false; els.mapBackButton.hidden = true;
    sound("start"); startMusic();
  }

  function createTreasureVisual(treasure, className) {
    if (treasure.asset) {
      const image = document.createElement("img");
      image.className = className;
      if (treasure.kind === "Island Flag") image.classList.add("flag-art");
      image.src = treasure.asset;
      image.alt = "";
      image.draggable = false;
      image.addEventListener("error", () => {
        if (!treasure.flag) return;
        const fallback = document.createElement("span");
        fallback.className = className.replace("art", "flag").replace("treasure", "flag");
        fallback.textContent = treasure.flag; fallback.setAttribute("aria-hidden", "true");
        image.replaceWith(fallback);
      }, { once: true });
      return image;
    }
    const flag = document.createElement("span");
    flag.className = className.replace("art", "flag").replace("treasure", "flag");
    flag.textContent = treasure.flag;
    flag.setAttribute("aria-hidden", "true");
    return flag;
  }

  function renderBoard() {
    els.board.innerHTML = "";
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const data = board[y][x];
        const cell = document.createElement("button");
        cell.type = "button"; cell.className = "cell"; cell.dataset.x = String(x); cell.dataset.y = String(y);
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", `Row ${y + 1}, column ${x + 1}${data ? `, filled${data.treasure ? ` with ${data.treasure.name}` : ""}` : ", empty"}`);
        if (data) {
          cell.classList.add("filled");
          if (data.colors) { cell.style.setProperty("--piece-a", data.colors[0]); cell.style.setProperty("--piece-b", data.colors[1]); }
          if (data.special) cell.classList.add("special");
          if (data.treasure) {
            cell.classList.add("treasure"); cell.title = data.treasure.name;
            cell.appendChild(createTreasureVisual(data.treasure, data.treasure.asset ? "board-treasure" : "board-art"));
          }
        }
        cell.addEventListener("click", () => tryPlace(x, y));
        cell.addEventListener("pointerenter", () => selectedPiece && !paused && showGhost(selectedPiece, x, y));
        els.board.appendChild(cell);
      }
    }
  }

  function renderTray() {
    els.tray.innerHTML = "";
    pieces.forEach(piece => {
      const slot = document.createElement("button");
      slot.type = "button"; slot.className = "piece-slot"; slot.dataset.id = piece.id;
      slot.style.setProperty("--piece-a", piece.treasure.colors[0]); slot.style.setProperty("--piece-b", piece.treasure.colors[1]);
      slot.setAttribute("aria-label", `${piece.treasure.name}, ${piece.name}, ${piece.cells.length} blocks, rotated ${piece.rotation || 0} degrees${piece.used ? ", used" : ""}`);
      slot.disabled = piece.used || paused;
      if (piece.used) slot.classList.add("used");
      if (selectedPiece?.id === piece.id) slot.classList.add("selected");

      const visual = document.createElement("span"); visual.className = "piece-visual";
      const maxX = Math.max(...piece.cells.map(cell => cell.x));
      const maxY = Math.max(...piece.cells.map(cell => cell.y));
      const mini = document.createElement("span"); mini.className = "mini-grid";
      mini.style.width = `calc(var(--unit) * ${maxX + 1})`; mini.style.height = `calc(var(--unit) * ${maxY + 1})`;
      piece.cells.forEach(cell => {
        const block = document.createElement("span"); block.className = "mini-block";
        block.style.left = `calc(var(--unit) * ${cell.x})`; block.style.top = `calc(var(--unit) * ${cell.y})`;
        block.appendChild(createTreasureVisual(piece.treasure, "mini-treasure-art")); mini.appendChild(block);
      });
      const collectiblePreview = document.createElement("span"); collectiblePreview.className = "piece-collectible-preview";
      collectiblePreview.appendChild(createTreasureVisual(piece.treasure, "piece-art"));
      const shapePreview = document.createElement("span"); shapePreview.className = "piece-shape-preview"; shapePreview.appendChild(mini);
      visual.append(collectiblePreview, shapePreview);
      slot.appendChild(visual);
      const label = document.createElement("span"); label.className = "piece-treasure"; label.textContent = piece.treasure.name; slot.appendChild(label);

      slot.addEventListener("click", () => {
        if (suppressPieceClick) { suppressPieceClick = false; return; }
        selectPiece(piece);
      });
      slot.addEventListener("pointerdown", event => beginDrag(event, piece, slot));
      els.tray.appendChild(slot);
    });
    updatePieceTools();
  }

  function normalizeCells(cells) {
    const minX = Math.min(...cells.map(cell => cell.x)), minY = Math.min(...cells.map(cell => cell.y));
    return cells.map(cell => ({ x: cell.x - minX, y: cell.y - minY })).sort((a, b) => a.y - b.y || a.x - b.x);
  }

  function rotatedCells(cells) {
    const maxY = Math.max(...cells.map(cell => cell.y));
    return normalizeCells(cells.map(cell => ({ x: maxY - cell.y, y: cell.x })));
  }

  function updatePieceTools() {
    const available = Boolean(selectedPiece && !selectedPiece.used && running && !paused && !locked && !drag);
    els.rotatePieceButton.disabled = !available;
    els.swapPieceButton.disabled = !available || swapsRemaining <= 0;
    els.swapCount.textContent = String(swapsRemaining);
    const pieceName = selectedPiece?.name || "piece";
    els.rotatePieceButton.setAttribute("aria-label", available ? `Rotate selected ${pieceName} 90 degrees clockwise. Keyboard shortcut R.` : "Select an unused piece to rotate it");
    els.swapPieceButton.setAttribute("aria-label", swapsRemaining > 0 ? `Swap selected piece for a new shape. ${swapsRemaining} swap${swapsRemaining === 1 ? "" : "s"} remaining.` : "No swaps remaining this run");
  }

  function rotateSelectedPiece() {
    if (!selectedPiece || selectedPiece.used || !running || paused || locked || drag) return;
    selectedPiece.cells = rotatedCells(selectedPiece.cells);
    selectedPiece.rotation = ((selectedPiece.rotation || 0) + 90) % 360;
    clearGhost(); renderTray(); sound("pickup"); haptic(8);
    els.pieceToolStatus.textContent = `${selectedPiece.name} rotated to ${selectedPiece.rotation} degrees.`;
    setCoach(2, "Piece rotated", "Tap an empty square or drag the new shape onto open spaces.", `${selectedPiece.rotation}° · ${selectedPiece.treasure.name}`);
  }

  function swapSelectedPiece() {
    if (!selectedPiece || selectedPiece.used || !running || paused || locked || drag || swapsRemaining <= 0) return;
    const index = pieces.findIndex(piece => piece.id === selectedPiece.id);
    if (index < 0) return;
    const alternatives = SHAPES.filter(shape => shape.name !== selectedPiece.name);
    const viable = alternatives.filter(shape => pieceHasAnyFit({ cells: shape.cells.map(([x, y]) => ({ x, y })), used: false }));
    const shape = weightedShape(viable.length ? viable : alternatives);
    const replacement = makePiece(shape, index, selectedPiece.treasure);
    pieces[index] = replacement; selectedPiece = replacement; swapsRemaining -= 1;
    clearGhost(); renderTray(); sound("pickup"); haptic([8, 25, 8]);
    els.pieceToolStatus.textContent = `Selected piece swapped for ${replacement.name}. ${swapsRemaining} swaps remaining.`;
    setCoach(2, "Fresh shape ready", `You have ${swapsRemaining} swap${swapsRemaining === 1 ? "" : "s"} left this run.`, replacement.treasure.name);
    if (!pieces.some(pieceHasAnyFit)) setTimeout(checkGameOver, 0);
  }

  function selectPiece(piece) {
    if (!running || paused || locked || piece.used) return;
    selectedPiece = selectedPiece?.id === piece.id ? null : piece;
    clearGhost(); renderTray();
    if (selectedPiece) {
      sound("pickup"); haptic(8);
      setCoach(2, "Place it on the board", "Tap an empty square or drag the piece onto open spaces.", piece.treasure.name);
    } else {
      setCoach(1, "Choose a piece", "Pick one of the three island collectibles.");
    }
  }

  function beginDrag(event, piece, slot) {
    if (!running || paused || locked || piece.used || event.button > 0) return;
    event.preventDefault();
    selectedPiece = piece;
    els.tray.querySelectorAll(".piece-slot").forEach(item => item.classList.toggle("selected", item.dataset.id === piece.id));
    updatePieceTools();
    sound("pickup"); haptic(7);
    setCoach(2, "Place it on the board", "Drag onto open spaces. The bright preview shows where it will land.", piece.treasure.name);
    drag = { pointerId: event.pointerId, piece, valid: false, x: -1, y: -1 };
    updatePieceTools();
    slot.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", handleDrag, { passive: false });
    window.addEventListener("pointerup", endDrag, { once: true });
    handleDrag(event);
  }

  function handleDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const position = cellFromPoint(event.clientX, event.clientY - (event.pointerType === "touch" ? 48 : 0));
    if (!position) { clearGhost(); drag.valid = false; return; }
    drag.x = position.x; drag.y = position.y; drag.valid = canPlace(drag.piece, drag.x, drag.y);
    showGhost(drag.piece, drag.x, drag.y);
  }

  function endDrag(event) {
    window.removeEventListener("pointermove", handleDrag);
    if (!drag || event.pointerId !== drag.pointerId) { drag = null; return; }
    const drop = { ...drag }; drag = null; suppressPieceClick = true;
    updatePieceTools();
    setTimeout(() => { suppressPieceClick = false; }, 80);
    if (drop.valid) commitPlacement(drop.piece, drop.x, drop.y);
    else { clearGhost(); if (drop.x >= 0) { sound("invalid"); haptic([15, 25, 15]); } }
  }

  function cellFromPoint(clientX, clientY) {
    const rect = els.board.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    return {
      x: Math.max(0, Math.min(SIZE - 1, Math.floor((clientX - rect.left) / (rect.width / SIZE)))),
      y: Math.max(0, Math.min(SIZE - 1, Math.floor((clientY - rect.top) / (rect.height / SIZE))))
    };
  }

  function tryPlace(x, y) {
    if (!selectedPiece || !running || paused || locked) return;
    if (canPlace(selectedPiece, x, y)) commitPlacement(selectedPiece, x, y);
    else { showGhost(selectedPiece, x, y); sound("invalid"); haptic([15, 25, 15]); setTimeout(clearGhost, 260); }
  }

  function canPlace(piece, originX, originY) {
    return piece.cells.every(({ x, y }) => {
      const tx = originX + x, ty = originY + y;
      return tx >= 0 && tx < SIZE && ty >= 0 && ty < SIZE && !board[ty][tx];
    });
  }

  function pieceHasFit(piece) {
    if (!piece || piece.used) return false;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (canPlace(piece, x, y)) return true;
    return false;
  }

  function pieceHasAnyFit(piece) {
    if (!piece || piece.used) return false;
    let cells = piece.cells.map(cell => ({ ...cell }));
    for (let turn = 0; turn < 4; turn++) {
      if (pieceHasFit({ ...piece, cells })) return true;
      cells = rotatedCells(cells);
    }
    return false;
  }

  function showGhost(piece, originX, originY) {
    clearGhost();
    const valid = canPlace(piece, originX, originY);
    piece.cells.forEach(({ x, y }) => {
      const tx = originX + x, ty = originY + y;
      if (tx >= 0 && tx < SIZE && ty >= 0 && ty < SIZE) {
        const cell = getCell(tx, ty);
        cell?.classList.add(valid ? "ghost-valid" : "ghost-invalid");
        if (valid && cell && !cell.classList.contains("filled")) cell.appendChild(createTreasureVisual(piece.treasure, "ghost-treasure-art"));
      }
    });
  }

  function clearGhost() {
    els.board.querySelectorAll(".ghost-valid,.ghost-invalid").forEach(cell => cell.classList.remove("ghost-valid", "ghost-invalid"));
    els.board.querySelectorAll(".ghost-treasure-art,.ghost-treasure-flag").forEach(visual => visual.remove());
  }

  async function commitPlacement(piece, originX, originY) {
    if (locked || paused || !canPlace(piece, originX, originY)) return;
    locked = true; clearGhost();
    const pieceIndex = pieces.findIndex(item => item.id === piece.id);
    const wasRushing = rushMoves > 0;
    const scoreBefore = score;
    piece.cells.forEach(({ x, y }, index) => {
      board[originY + y][originX + x] = { colors: piece.treasure.colors, treasure: piece.treasure, special: wasRushing && index === 0 && random() < .4 };
    });
    pieces[pieceIndex].used = true; selectedPiece = null;
    const multiplier = wasRushing ? 2 : 1;
    score += piece.cells.length * multiplier;
    sound("place"); haptic(18); renderBoard(); renderTray();

    const completed = findCompletedLines();
    if (completed.rows.length || completed.cols.length) {
      combo += 1; maxCombo = Math.max(maxCombo, combo);
      const count = completed.rows.length + completed.cols.length;
      score += Math.round((100 + Math.max(0, count - 1) * 75) * (1 + Math.min(combo - 1, 10) * .1) * multiplier);
      totalLines += count;
      fever = Math.min(100, fever + 20 * count + Math.min(combo * 3, 12));
      const unlockBefore = unlockedCount();
      const finds = collectTreasures(completed);
      const unlockAfter = unlockedCount();
      showCallout(count >= 2 ? "Carnival Clear!" : combo >= 2 ? "Big Up!" : "Sweet!");
      sound(count >= 2 ? "multi" : "clear"); haptic(count >= 2 ? [25,35,35,30,55] : [28,30,38]);
      markClearing(completed);
      boardExplosion(count, score - scoreBefore);
      burstConfetti(18 + count * 22);
      await wait(settings.reducedMotion ? 20 : 400);
      if (finds.length) {
        const find = finds[finds.length - 1];
        showCallout(`${find.name}!`);
      }
      completed.rows.forEach(row => { for (let x = 0; x < SIZE; x++) board[row][x] = null; });
      completed.cols.forEach(col => { for (let y = 0; y < SIZE; y++) board[y][col] = null; });
      if (unlockAfter > unlockBefore) {
        const unlocked = DESTINATIONS[unlockBefore];
        setTimeout(() => { showCallout(`${unlocked.label} Unlocked!`); burstConfetti(85); sound("rush"); }, 520);
      }
      if (!wasRushing && fever >= 100) activateRush();
      renderBoard();
    } else {
      combo = 0;
    }

    if (wasRushing) { rushMoves -= 1; if (rushMoves === 0) endRush(); }
    const trayFinished = pieces.every(item => item.used);
    if (trayFinished) {
      generateTray();
    } else if (completed.rows.length || completed.cols.length) {
      setCoach(3, "Line cleared!", "Keep building full rows or columns to raise Carnival Fever.", "Choose another piece");
    } else {
      setCoach(3, "Complete a line", "Fill every square in one row or column to clear it and score big.", "Choose another piece");
    }
    updateHUD(); persist(); locked = false;
    if (checkLevelComplete()) return;
    if (!pieces.some(pieceHasAnyFit)) checkGameOver();
    if (tutorial) {
      tutorial = false; const prior = loadSaved(); prior.tutorialSeen = true; localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prior, collection: [...collection] }));
      setCoach(3, "Now build your own line", "Fill a complete row or column to clear it and collect treasures.", "Choose another piece");
    }
  }

  function findCompletedLines() {
    const rows = [], cols = [];
    for (let y = 0; y < SIZE; y++) if (board[y].every(Boolean)) rows.push(y);
    for (let x = 0; x < SIZE; x++) if (board.every(row => row[x])) cols.push(x);
    return { rows, cols };
  }

  function collectTreasures({ rows, cols }) {
    const cells = new Set(), finds = [];
    rows.forEach(y => { for (let x = 0; x < SIZE; x++) cells.add(`${x},${y}`); });
    cols.forEach(x => { for (let y = 0; y < SIZE; y++) cells.add(`${x},${y}`); });
    cells.forEach(key => {
      const [x, y] = key.split(",").map(Number); const item = board[y][x]?.treasure;
      if (item && !finds.some(find => find.id === item.id)) finds.push(item);
    });
    finds.forEach(item => {
      lastCollected = item; collectedThisRun += 1; recentCollected = [...recentCollected.filter(id => id !== item.id), item.id].slice(-5);
      if (!collection.has(item.id)) collection.add(item.id);
      score += 75;
    });
    return finds;
  }

  function markClearing({ rows, cols }) {
    const marked = new Set();
    rows.forEach(y => { for (let x = 0; x < SIZE; x++) marked.add(`${x},${y}`); });
    cols.forEach(x => { for (let y = 0; y < SIZE; y++) marked.add(`${x},${y}`); });
    marked.forEach(key => { const [x, y] = key.split(",").map(Number); getCell(x, y)?.classList.add("clearing"); });
  }

  function boardExplosion(lines, points) {
    const colors = ["var(--accent)", "var(--accent-2)", "#ffffff", "#62e9ff", "#ff62bc"];
    const particleCount = settings.reducedMotion ? 0 : 24 + lines * 14;
    for (let index = 0; index < particleCount; index++) {
      const particle = document.createElement("i"); particle.className = "board-particle";
      const angle = random() * Math.PI * 2, distance = 65 + random() * 190;
      particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`); particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      particle.style.setProperty("--size", `${5 + random() * 10}px`); particle.style.setProperty("--color", colors[Math.floor(random() * colors.length)]);
      els.effectsLayer.appendChild(particle); setTimeout(() => particle.remove(), 900);
    }
    const wave = document.createElement("i"); wave.className = "shockwave"; els.effectsLayer.appendChild(wave); setTimeout(() => wave.remove(), 800);
    const pop = document.createElement("b"); pop.className = "score-pop"; pop.textContent = `+${Math.max(100, points).toLocaleString()}`; els.effectsLayer.appendChild(pop); setTimeout(() => pop.remove(), 1100);
    document.body.classList.remove("screen-shake"); void document.body.offsetWidth; document.body.classList.add("screen-shake"); setTimeout(() => document.body.classList.remove("screen-shake"), 420);
  }

  function activateRush() {
    fever = 100; rushMoves = 6; hasRushed = true;
    document.body.classList.add("rush"); els.rushBadge.hidden = false;
    showCallout("Fete Mode!"); boardExplosion(3, 500); burstConfetti(140); sound("rush"); haptic([30,40,30,40,65]);
  }

  function endRush() { fever = 0; document.body.classList.remove("rush"); els.rushBadge.hidden = true; showCallout("Full Vibes!"); }

  function checkLevelComplete() {
    if (!running || paused || levelCompleted) return false;
    const goal = levelGoal();
    if (levelGoalProgress(goal) < goal.target) return false;
    levelCompleted = true;
    levelProgress[theme] = Math.max(completedOnIsland(), activeLevel);
    score += 250 + activeLevel * 20;
    updateHUD(); persist();
    window.LikkleLegends?.recordLevel("block-carnival", completedLevelCount(), score, collection.size);
    showCallout("Level Complete!"); burstConfetti(180); haptic([30,35,45,35,70]);
    finishRun("complete");
    return true;
  }

  function checkGameOver() {
    if (!running || paused || locked || pieces.some(pieceHasAnyFit)) return;
    if (swapsRemaining > 0) {
      if (!selectedPiece || selectedPiece.used) selectedPiece = pieces.find(piece => !piece.used) || null;
      renderTray(); showCallout("Use a swap!"); sound("invalid");
      setCoach(2, "Swap can save this run", "No current shape fits. Swap the selected piece for a new one.", `${swapsRemaining} swaps left`);
      return;
    }
    finishRun("no-moves");
  }

  function finishRun(reason) {
    running = false; paused = false; locked = false; resultMode = reason; stopMusic(); persist(); updateControls();
    const high = Math.max(loadSaved().highScore || 0, score);
    const completed = reason === "complete";
    els.resultKicker.textContent = completed ? `${currentDestination().label} · Level ${activeLevel} of ${LEVELS_PER_ISLAND}` : "Run complete";
    els.gameOverTitle.textContent = completed ? (activeLevel >= LEVELS_PER_ISLAND ? "Island mastered!" : "Level complete!") : reason === "stopped" ? "Run stopped" : "Board full—try again";
    els.finalScore.textContent = score.toLocaleString(); els.finalBest.textContent = high.toLocaleString();
    els.finalLines.textContent = String(totalLines); els.finalCombo.textContent = `×${Math.max(1, maxCombo)}`;
    els.playAgainButton.innerHTML = completed ? (activeLevel >= LEVELS_PER_ISLAND ? "Choose another island <span>›</span>" : "Next level <span>›</span>") : "Try again <span>↻</span>";
    els.pauseScreen.hidden = true; els.stopScreen.hidden = true;
    setTimeout(() => { els.gameOverScreen.hidden = false; sound(completed ? "rush" : "gameover"); }, reason === "stopped" ? 0 : 420);
  }

  function updateHUD() {
    const high = Math.max(loadSaved().highScore || 0, score);
    els.score.textContent = score.toLocaleString(); els.highScore.textContent = high.toLocaleString(); els.lines.textContent = String(totalLines); els.combo.textContent = `×${Math.max(1, combo)}`;
    if (combo > 1) { els.comboCard.classList.remove("hot"); void els.comboCard.offsetWidth; els.comboCard.classList.add("hot"); }
    const displayFever = rushMoves > 0 ? 100 : fever;
    els.feverFill.style.width = `${displayFever}%`; els.feverText.textContent = rushMoves > 0 ? `${rushMoves} moves` : `${Math.round(fever)}%`; els.feverMeter.setAttribute("aria-valuenow", String(Math.round(displayFever)));

    const featured = lastCollected || currentDestination().items[1];
    renderLatestTreasure(featured);
    els.foodName.textContent = featured.name; els.foodProgress.textContent = lastCollected ? featured.kind : "Clear the marked block to collect";
    els.passportCount.textContent = `${collection.size} / ${TREASURES.length}`; els.passportFill.style.width = `${Math.min(100, collection.size / TREASURES.length * 100)}%`;
    renderTreasureShelf(); updateUnlockMessaging();
    setDone(els.goalLinesCheck, totalLines >= 5); setDone(els.goalRushCheck, hasRushed); setDone(els.goalTreasureCheck, collectedThisRun >= 3);
  }

  function renderLatestTreasure(item) {
    els.foodEmoji.innerHTML = "";
    els.foodEmoji.appendChild(createTreasureVisual(item, item.asset ? "latest-art" : "piece-art"));
  }

  function renderTreasureShelf() {
    els.treasureShelf.innerHTML = "";
    const ids = recentCollected.length ? recentCollected : [...collection].filter(id => TREASURE_BY_ID.has(id)).slice(-5);
    if (!ids.length) {
      const empty = document.createElement("span"); empty.className = "treasure-empty"; empty.textContent = "Clear marked pieces to fill your Caribbean passport."; els.treasureShelf.appendChild(empty); return;
    }
    ids.map(id => TREASURE_BY_ID.get(id)).filter(Boolean).forEach(item => {
      const token = document.createElement("span"); token.className = "treasure-token"; token.title = `${item.kind}: ${item.name}`; token.setAttribute("aria-label", `${item.kind}: ${item.name}`);
      token.appendChild(createTreasureVisual(item, item.asset ? "latest-art" : "piece-art")); els.treasureShelf.appendChild(token);
    });
  }

  function updateUnlockMessaging() {
    const next = nextLockedDestination();
    const destination = currentDestination();
    const shownLevel = running ? activeLevel : currentIslandLevel();
    const goal = levelGoal(shownLevel);
    els.currentIslandFlag.textContent = "";
    const currentFlag = document.createElement("img"); currentFlag.src = destination.flagAsset; currentFlag.alt = `${destination.label} flag`; currentFlag.className = "unlock-flag-art";
    currentFlag.addEventListener("error", () => { const fallback=document.createElement("span"); fallback.textContent=destination.flag; fallback.setAttribute("role","img"); fallback.setAttribute("aria-label",currentFlag.alt); currentFlag.replaceWith(fallback); }, { once:true });
    els.currentIslandFlag.appendChild(currentFlag);
    els.unlockTitle.textContent = `Level ${shownLevel} of ${LEVELS_PER_ISLAND} · Journey ${globalLevelNumber(theme, shownLevel)} of ${TOTAL_LEVELS}`;
    els.unlockText.textContent = `Goal: ${levelGoalText(goal, running)}`;
    if (next) {
      const remaining = Math.max(0, next.unlock - collection.size);
      els.nextUnlockName.textContent = next.label; els.nextUnlockProgress.textContent = `Collect ${remaining} more unique treasure${remaining === 1 ? "" : "s"} to unlock`;
    } else {
      const futureCount = DESTINATIONS.filter(destination => destination.future).length;
      els.nextUnlockName.textContent = "More Caribbean chapters ahead"; els.nextUnlockProgress.textContent = "Future destinations are visible on the journey map";
    }
  }

  function renderDestinationMap() {
    els.destinationMap.innerHTML = "";
    const available = DESTINATIONS.filter((_, index) => isUnlocked(index));
    if (!available.some(destination => destination.id === theme)) theme = available[0].id;
    const destination = currentDestination();
    const currentIndex = Math.max(0, available.findIndex(item => item.id === theme));
    const card = document.createElement("div"); card.className = "destination-card destination-featured selected";
    card.style.setProperty("--card-accent", destination.accent2); card.setAttribute("role", "radio"); card.setAttribute("aria-checked", "true");
    const flag = document.createElement("span"); flag.className = "destination-flag";
    const flagImage = document.createElement("img"); flagImage.src = destination.flagAsset; flagImage.alt = `${destination.label} flag`; flagImage.className = "destination-flag-art";
    flagImage.addEventListener("error", () => { flag.textContent=destination.flag; flag.setAttribute("role","img"); flag.setAttribute("aria-label",flagImage.alt); }, { once:true }); flag.appendChild(flagImage);
    const copy = document.createElement("span"); copy.className = "destination-copy";
    const name = document.createElement("b"); name.textContent = destination.label;
    const destinationLevel = currentIslandLevel(destination.id);
    const detail = document.createElement("small"); detail.textContent = `Level ${destinationLevel} of ${LEVELS_PER_ISLAND} · ${destination.vibe} · ${destination.food[0]}`;
    copy.append(name, detail); card.append(flag, copy); els.destinationMap.appendChild(card);
    const count = available.length;
    els.journeySummary.textContent = `${completedLevelCount().toLocaleString()} of ${TOTAL_LEVELS.toLocaleString()} levels complete · ${currentIndex + 1} of ${count} islands unlocked`;
    els.prevIslandButton.disabled = mapPreview || count < 2;
    els.nextIslandButton.disabled = mapPreview || count < 2;
    els.playButton.innerHTML = `Play ${destination.label} · Level ${destinationLevel} <span>›</span>`;
    els.playButton.setAttribute("aria-label", `Play ${destination.label} level ${destinationLevel}`);
  }

  function cycleDestination(direction) {
    if (mapPreview) return;
    const available = DESTINATIONS.filter((_, index) => isUnlocked(index));
    if (available.length < 2) return;
    const currentIndex = Math.max(0, available.findIndex(destination => destination.id === theme));
    theme = available[(currentIndex + direction + available.length) % available.length].id;
    applyTheme(); persist(); renderDestinationMap(); sound("pickup"); haptic(7);
  }

  function applyTheme() {
    const destination = currentDestination();
    document.body.dataset.theme = destination.id;
    document.documentElement.style.setProperty("--accent", destination.accent);
    document.documentElement.style.setProperty("--accent-2", destination.accent2);
    document.documentElement.style.setProperty("--accent-3", destination.colors[0]);
    document.documentElement.style.setProperty("--tile-hi", destination.colors[0]);
    document.documentElement.style.setProperty("--tile", destination.colors[1]);
    document.querySelector(".scene").style.filter = `hue-rotate(${destination.hue}deg) saturate(1.04)`;
    const shownLevel = running ? activeLevel : currentIslandLevel();
    els.islandLabel.textContent = `${destination.label} · Level ${shownLevel} of ${LEVELS_PER_ISLAND}`; els.chapterName.textContent = destination.chapter;
    updateUnlockMessaging();
  }

  function pauseGame() {
    if (!running || paused || locked) return;
    paused = true; stopMusic(); clearGhost(); renderTray(); els.pauseScreen.hidden = false; updateControls();
  }

  function resumeGame() {
    if (!running) return;
    paused = false; els.pauseScreen.hidden = true; els.stopScreen.hidden = true; renderTray(); updateControls(); startMusic();
  }

  function openStopDialog() {
    if (!running || locked) return;
    paused = true; stopMusic(); clearGhost(); renderTray(); els.stopScreen.hidden = false; updateControls();
  }

  function openMapPreview() {
    if (!running) { showStartMap(); return; }
    if (locked) return;
    paused = true; mapPreview = true; stopMusic(); clearGhost(); renderTray();
    els.playButton.hidden = true; els.mapBackButton.hidden = false; els.startScreen.hidden = false;
    renderDestinationMap(); updateControls();
  }

  function closeMapPreview() {
    mapPreview = false; els.startScreen.hidden = true; els.playButton.hidden = false; els.mapBackButton.hidden = true; resumeGame();
  }

  function showStartMap() {
    running = false; paused = false; mapPreview = false; stopMusic();
    els.gameOverScreen.hidden = true; els.startScreen.hidden = false; els.playButton.hidden = false; els.mapBackButton.hidden = true;
    renderDestinationMap(); updateControls();
  }

  function updateControls() {
    els.startResumeButton.disabled = running && !paused;
    els.startResumeButton.innerHTML = paused && running ? '<span aria-hidden="true">▶</span> Resume' : running ? '<span aria-hidden="true">●</span> Running' : '<span aria-hidden="true">▶</span> Start';
    els.pauseButton.disabled = !running || paused;
    els.stopButton.disabled = !running;
    updatePieceTools();
  }

  function getCell(x, y) { return els.board.querySelector(`[data-x="${x}"][data-y="${y}"]`); }
  function setDone(element, done) { element.textContent = done ? "●" : "○"; element.classList.toggle("done", done); }
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function showCallout(text) {
    els.callout.textContent = text; els.callout.classList.remove("show"); void els.callout.offsetWidth; els.callout.classList.add("show");
  }

  function burstConfetti(count = 40) {
    if (settings.reducedMotion) return;
    const colors = ["#ffca4b", "#ff426d", "#40e0d0", "#ffffff", "#9c6bff", "#24c768"];
    for (let index = 0; index < count; index++) {
      const bit = document.createElement("i"); bit.className = "confetti";
      bit.style.left = `${random() * 100}%`; bit.style.background = colors[Math.floor(random() * colors.length)];
      bit.style.setProperty("--fall", `${1.5 + random() * 1.7}s`); bit.style.setProperty("--drift", `${-150 + random() * 300}px`); bit.style.setProperty("--rot", `${random() * 360}deg`);
      bit.style.animationDelay = `${random() * .3}s`; els.confetti.appendChild(bit); setTimeout(() => bit.remove(), 3500);
    }
  }

  function haptic(pattern) { if (settings.haptics && navigator.vibrate) navigator.vibrate(pattern); }

  function ensureAudio() {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return null;
    audioContext ||= new AudioEngine();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function musicTone(frequency, duration, volume, type = "triangle", delay = 0) {
    const context = ensureAudio();
    if (!context || !musicGain) return;
    const when = context.currentTime + delay;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(.0001, when); gain.gain.exponentialRampToValueAtTime(volume, when + .012); gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
    oscillator.connect(gain).connect(musicGain); oscillator.start(when); oscillator.stop(when + duration + .025);
  }

  function panNote(frequency) {
    musicTone(frequency, .16, .12, "sine");
    musicTone(frequency * 2.01, .1, .035, "triangle", .006);
  }

  function percussion(kind) {
    const context = ensureAudio();
    if (!context || !musicGain) return;
    const now = context.currentTime;
    if (kind === "kick") {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = "sine"; oscillator.frequency.setValueAtTime(105, now); oscillator.frequency.exponentialRampToValueAtTime(46, now + .1);
      gain.gain.setValueAtTime(.22, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .13);
      oscillator.connect(gain).connect(musicGain); oscillator.start(now); oscillator.stop(now + .14); return;
    }
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, Math.floor(context.sampleRate * .055), context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noiseBuffer; filter.type = "highpass"; filter.frequency.value = kind === "clap" ? 1200 : 5200;
    gain.gain.setValueAtTime(kind === "clap" ? .09 : .045, now); gain.gain.exponentialRampToValueAtTime(.0001, now + (kind === "clap" ? .05 : .025));
    source.connect(filter).connect(gain).connect(musicGain); source.start(now);
  }

  function musicTick() {
    if (!running || paused || !settings.music || !musicGain) return;
    const destinationIndex = Math.max(0, PLAYABLE_DESTINATIONS.findIndex(destination => destination.id === theme));
    const roots = [261.63, 293.66, 329.63, 349.23];
    const patterns = [
      [0, 7, 12, 7, 4, 7, 11, 7, 0, 7, 12, 14, 12, 7, 4, 7],
      [0, 4, 7, 12, 7, 4, 9, 7, 0, 5, 9, 12, 9, 5, 4, 7],
      [0, 7, 9, 12, 9, 7, 4, 7, 2, 7, 11, 14, 11, 7, 5, 7]
    ];
    const root = roots[destinationIndex % roots.length];
    const pattern = patterns[destinationIndex % patterns.length];
    if (musicStep % 2 === 0) panNote(root * Math.pow(2, pattern[musicStep] / 12));
    if (musicStep === 0 || musicStep === 8) percussion("kick");
    if (musicStep === 4 || musicStep === 12) percussion("clap");
    if (musicStep % 2 === 1) percussion("shaker");
    if (musicStep % 4 === 0) musicTone(root / 2, .19, .055, "triangle");
    musicStep = (musicStep + 1) % 16;
  }

  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
    if (musicGain && audioContext) {
      const fadingGain = musicGain;
      fadingGain.gain.cancelScheduledValues(audioContext.currentTime);
      fadingGain.gain.setValueAtTime(Math.max(.0001, fadingGain.gain.value), audioContext.currentTime);
      fadingGain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + .12);
      setTimeout(() => fadingGain.disconnect(), 160);
    }
    musicGain = null;
  }

  function startMusic() {
    stopMusic();
    if (!settings.music || !running || paused) return;
    const context = ensureAudio();
    if (!context) return;
    musicGain = context.createGain(); musicGain.gain.value = .34; musicGain.connect(context.destination); musicStep = 0;
    musicTick(); musicTimer = setInterval(musicTick, 132);
  }

  function sound(kind) {
    if (!settings.sound) return;
    try {
      const context = ensureAudio(); if (!context) return;
      const now = context.currentTime;
      const notes = {
        pickup: [[380,.04,.035]], place: [[220,.055,.05],[330,.04,.06]], invalid: [[120,.08,.045]],
        clear: [[430,.06,.04],[610,.08,.07],[820,.12,.1]], multi: [[360,.06,.04],[540,.06,.07],[720,.08,.1],[980,.14,.13]],
        rush: [[330,.08,.05],[440,.08,.1],[660,.1,.16],[880,.2,.24]], start: [[280,.08,.04],[420,.09,.12],[560,.12,.2]], gameover: [[330,.12,.03],[247,.16,.14],[196,.22,.28]]
      }[kind] || [[300,.06,.03]];
      notes.forEach(([frequency, duration, delay]) => {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = kind === "invalid" ? "square" : "sine"; oscillator.frequency.setValueAtTime(frequency, now + delay);
        gain.gain.setValueAtTime(.0001, now + delay); gain.gain.exponentialRampToValueAtTime(.08, now + delay + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + delay + duration);
        oscillator.connect(gain).connect(context.destination); oscillator.start(now + delay); oscillator.stop(now + delay + duration + .02);
      });
    } catch { /* Audio is an enhancement. */ }
  }

  els.playButton.addEventListener("click", startGame);
  els.mapBackButton.addEventListener("click", closeMapPreview);
  els.prevIslandButton.addEventListener("click", () => cycleDestination(-1));
  els.nextIslandButton.addEventListener("click", () => cycleDestination(1));
  els.startResumeButton.addEventListener("click", () => { if (running && paused) resumeGame(); else if (!running) showStartMap(); });
  els.pauseButton.addEventListener("click", pauseGame);
  els.stopButton.addEventListener("click", openStopDialog);
  els.resumeButton.addEventListener("click", resumeGame);
  els.restartFromPause.addEventListener("click", startGame);
  els.keepPlayingButton.addEventListener("click", resumeGame);
  els.confirmStopButton.addEventListener("click", () => finishRun("stopped"));
  els.openMapButton.addEventListener("click", openMapPreview);
  els.settingsButton.addEventListener("click", () => { els.settingsScreen.hidden = false; });
  els.closeSettings.addEventListener("click", () => { els.settingsScreen.hidden = true; });
  els.settingsScreen.addEventListener("click", event => { if (event.target === els.settingsScreen) els.settingsScreen.hidden = true; });
  els.playAgainButton.addEventListener("click", () => {
    if (resultMode === "complete" && activeLevel >= LEVELS_PER_ISLAND) showStartMap();
    else startGame();
  });
  els.changeIslandButton.addEventListener("click", showStartMap);
  els.musicToggle.addEventListener("change", () => {
    settings.music = els.musicToggle.checked; persist();
    if (settings.music && running && !paused) startMusic(); else stopMusic();
  });
  els.soundToggle.addEventListener("change", () => { settings.sound = els.soundToggle.checked; persist(); sound("pickup"); });
  els.hapticToggle.addEventListener("change", () => { settings.haptics = els.hapticToggle.checked; persist(); haptic(20); });
  els.motionToggle.addEventListener("change", () => { settings.reducedMotion = els.motionToggle.checked; document.body.classList.toggle("reduce-motion", settings.reducedMotion); persist(); });
  els.rotatePieceButton.addEventListener("click", rotateSelectedPiece);
  els.swapPieceButton.addEventListener("click", swapSelectedPiece);
  document.addEventListener("keydown", event => {
    const target = event.target;
    const dialogOpen = !els.settingsScreen.hidden || !els.stopScreen.hidden || !els.pauseScreen.hidden || !els.startScreen.hidden || !els.gameOverScreen.hidden;
    if (event.key.toLowerCase() === "r" && !event.repeat && !dialogOpen && !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      if (running && !paused && selectedPiece) { event.preventDefault(); rotateSelectedPiece(); }
      return;
    }
    if (event.key !== "Escape") return;
    if (!els.settingsScreen.hidden) els.settingsScreen.hidden = true;
    else if (!els.stopScreen.hidden) resumeGame();
    else if (!els.pauseScreen.hidden) resumeGame();
    else if (mapPreview) closeMapPreview();
    else if (running) pauseGame();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && running && !paused) pauseGame(); });
  addEventListener("likkle:ready", hydrateCloudProgress);

  els.musicToggle.checked = settings.music; els.soundToggle.checked = settings.sound; els.hapticToggle.checked = settings.haptics; els.motionToggle.checked = settings.reducedMotion;
  document.body.classList.toggle("reduce-motion", settings.reducedMotion);
  applyTheme(); renderDestinationMap(); renderBoard(); updateHUD(); updateControls();
})();
