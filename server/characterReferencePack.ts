export type CharacterBrief = {
  id: string;
  name: string;
  shortName: string;
  role: string;
  island: string;
  power: string;
  weapon: string;
  image: string;
  status: "locked" | "needs-bible" | "needs-model-sheet";
  priority: "P1" | "P2";
  strengths: string[];
  risks: string[];
  merchHooks: string[];
};

export type CharacterReferencePack = {
  id: string;
  name: string;
  shortName: string;
  status: CharacterBrief["status"];
  modelSheet: string;
  referenceImages: string[];
  identityLock: string;
  motionLanguage: string[];
  wardrobeAndProps: string[];
  powerRules: string[];
  forbiddenDrift: string[];
  seedanceContinuityPrompt: string;
};

export const characterCatalog: CharacterBrief[] = [
  {
    id: "kairo",
    name: 'Kairo "Kai" Baptiste',
    shortName: "Kai",
    role: "Main hero / first Opaija Seed wielder",
    island: "Trinidad",
    power: "Tempo Pulse + Echo Pulse",
    weapon: "The Listening Bois",
    status: "locked",
    priority: "P1",
    image: "assets/characters/kairo-kai-baptiste.png",
    strengths: ["Lean athletic movement", "Strong heart", "Learns through rhythm"],
    risks: ["Impulsive", "Still learning command"],
    merchHooks: ["Seed pendant", "staff replica", "doubles catchphrase tee"],
  },
  {
    id: "nia",
    name: "Nia Toussaint",
    shortName: "Nia",
    role: "Chantwell / lavway voice specialist",
    island: "Trinidad",
    power: "Voice Pulse + Lavway Command",
    weapon: "Lavway scarf + rhythm bell",
    status: "locked",
    priority: "P1",
    image: "assets/characters/nia-toussaint.png",
    strengths: ["Persuasive voice", "Emotional intelligence", "Memory through song"],
    risks: ["Self-doubt", "Vocal strain"],
    merchHooks: ["Gold hoop set", "voice pulse poster", "lavway lyric cards"],
  },
  {
    id: "malik",
    name: "Malik St. Hill",
    shortName: "Malik",
    role: "Rival boishman / disciplined fighter",
    island: "Trinidad",
    power: "Rhythm Break + Vibration Shatter",
    weapon: "Rootbreaker drum, sticks, wrist wraps",
    status: "locked",
    priority: "P1",
    image: "assets/characters/malik-st-hill.png",
    strengths: ["Discipline", "Precision", "Strategy", "Leadership"],
    risks: ["Perfectionism", "Pressure to prove himself"],
    merchHooks: ["Rootbreaker drum skin", "training wrap", "red-black sneaker colorway"],
  },
  {
    id: "asha",
    name: "Asha Singh-Baptiste",
    shortName: "Asha",
    role: "Matador / medic / historian",
    island: "Trinidad",
    power: "Echo Pulse + Memory Sight",
    weapon: "Bandage cords + matador baton",
    status: "locked",
    priority: "P1",
    image: "assets/characters/asha-singh-baptiste.png",
    strengths: ["Observation", "Healing", "Historical knowledge", "Calm under pressure"],
    risks: ["Overthinking", "Trust issues"],
    merchHooks: ["Archive notebook", "map scarf", "teal-gold jewelry"],
  },
  {
    id: "jabari",
    name: 'Jabari "Jabs" Henry',
    shortName: "Jabs",
    role: "Drummer / comic relief / content creator",
    island: "Trinidad",
    power: "Drum Sync + Pulse Timing",
    weapon: "Kalinda drum + L-stick beat sticks",
    status: "locked",
    priority: "P1",
    image: "assets/characters/jabari-jabs-henry.png",
    strengths: ["Timing", "Adaptability", "Morale boost", "Quick thinking"],
    risks: ["Distractible", "Talks under pressure"],
    merchHooks: ["Headphones", "drum strap", "signature orange beat sticks"],
  },
  {
    id: "tariq",
    name: "Tariq Davidson",
    shortName: "Tariq",
    role: "Scout / Tidewatch boishman / Tobago bridge",
    island: "Tobago",
    power: "Tide Sense + Coastal Watch",
    weapon: "Tidewatch bois staff",
    status: "locked",
    priority: "P1",
    image: "assets/characters/tariq-davidson.png",
    strengths: ["Observation", "Agility", "Endurance", "Empathy"],
    risks: ["Overthinks", "Self-doubt"],
    merchHooks: ["Shell pendant", "tide mark symbol", "sea cloth sash"],
  },
  {
    id: "mother-lall",
    name: "Mother Lall",
    shortName: "Mother Lall",
    role: "Doubles vendor / secret Guardian messenger",
    island: "Trinidad",
    power: "Secret Voice Pulse + Message Sigils",
    weapon: "Doubles tray + serving spoon",
    status: "locked",
    priority: "P1",
    image: "assets/characters/mother-lall.png",
    strengths: ["Wisdom", "Intuition", "Community trust", "Coded communication"],
    risks: ["Overprotective", "Hides too much"],
    merchHooks: ["Doubles wrapper art", "pepper sauce bottle", "vendor cart sticker"],
  },
  {
    id: "papa-etienne",
    name: "Papa Etienne Roach",
    shortName: "Papa Etienne",
    role: "Elder batonier / mentor / former Guardian",
    island: "Trinidad",
    power: "Root Pulse + Memory Strike",
    weapon: "Sacred bois hidden cane",
    status: "locked",
    priority: "P1",
    image: "assets/characters/papa-etienne-roach.png",
    strengths: ["Experience", "Patience", "Hidden speed", "Ancestral knowledge"],
    risks: ["Guilt", "Secrecy", "Aging body"],
    merchHooks: ["Guardian pendant", "sacred cane replica", "The stick is not a gift tee"],
  },
  {
    id: "marius",
    name: "Marius Vale",
    shortName: "Marius",
    role: "Main villain / False One Drum",
    island: "Caribbean",
    power: "Silence Pulse + Memory Theft",
    weapon: "Black bois / silence staff",
    status: "locked",
    priority: "P1",
    image: "assets/characters/marius-vale.png",
    strengths: ["Strategic genius", "Leadership", "Intimidation", "Power control"],
    risks: ["Obsession with control", "Cannot trust"],
    merchHooks: ["False One Drum crest", "silence staff poster", "One drum. One command. tee"],
  },
  {
    id: "selah",
    name: "Selah Vale",
    shortName: "Selah",
    role: "Villain heir / possible future ally",
    island: "Caribbean diaspora",
    power: "Silence Pulse",
    weapon: "Silence baton",
    status: "locked",
    priority: "P1",
    image: "assets/characters/selah-vale.png",
    strengths: ["Speed", "Precision", "Discipline", "Tactical awareness"],
    risks: ["Divided loyalty", "Emotional repression"],
    merchHooks: ["Noise is weakness tee", "silence baton poster", "purple-black sticker pack"],
  },
];

export function resolveCharacter(characterId?: string) {
  const requested = characterId?.toLowerCase();
  return characterCatalog.find((character) => character.id === requested || character.name.toLowerCase() === requested || character.shortName.toLowerCase() === requested);
}

export function buildCharacterReferencePack(character: CharacterBrief): CharacterReferencePack {
  const identityLock = [
    `${character.name} (${character.shortName}) is the only featured character unless another named Opaija character is explicitly requested.`,
    `Role: ${character.role}. Island logic: ${character.island}.`,
    `Power: ${character.power}. Weapon/prop focus: ${character.weapon}.`,
    "Preserve the approved reference art face, hair, skin tone, silhouette, wardrobe language, symbols, weapon scale, and proportions.",
  ].join(" ");

  return {
    id: character.id,
    name: character.name,
    shortName: character.shortName,
    status: character.status,
    modelSheet: character.image,
    referenceImages: [character.image],
    identityLock,
    motionLanguage: [
      `${character.shortName} moves with ${character.strengths.join(", ").toLowerCase()}.`,
      "Action must read as clean key poses connected by controlled anime motion, not random body morphing.",
      "Camera motion should support the story beat; do not hide weak anatomy behind excessive blur.",
    ],
    wardrobeAndProps: [
      `Keep ${character.weapon} visible when the shot involves power, combat, or command.`,
      "Keep Caribbean streetwear, Kalenda/Calinda and Carnival-inspired details consistent with the approved model sheet.",
      "No generic fantasy armor, no unrequested costume redesign, no random extra jewelry or symbols.",
    ],
    powerRules: [
      `${character.power} should appear as readable Opaija pulse energy tied to rhythm, voice, memory, tide, root, or silence logic as appropriate.`,
      "Power effects must not cover the face or replace the character silhouette.",
      "Effects should use the Opaija palette: gold, orange, red, teal, cream, black ink.",
    ],
    forbiddenDrift: [
      "Do not convert the model sheet into a grid, turnaround, collage, label sheet, or multiple-pose reference page.",
      "Do not change age, face shape, nose structure, skin tone, hair, core outfit, weapon, or power identity.",
      "Do not add subtitles, watermark text, logos, random crowds, extra limbs, broken hands, or melted weapon geometry.",
    ],
    seedanceContinuityPrompt: [
      identityLock,
      "Use storyboard frames as cinematic production frames, not as character sheets.",
      "Maintain the same character identity through every shot and transition.",
      "If motion becomes complex, prioritize face stability, hand readability, weapon continuity, and clear silhouette over flashy camera movement.",
    ].join(" "),
  };
}
