import type { StoryboardShot, VideoPacket } from "./videoAgent.js";
import type { CharacterReferencePack } from "./characterReferencePack.js";

export type StoryboardPanel = {
  panelId: string;
  parentShot: number;
  timecode: string;
  durationSeconds: number;
  camera: string;
  composition: string;
  action: string;
  emotion: string;
  fx: string;
  narration: string;
  audio: string;
  firstPose: string;
  endPose: string;
  negativeSpace?: string;
  artworkPrompt: string;
  animationPrompt: string;
  continuityLock: string;
  forbidden: string[];
};

export type StoryboardPanelPackage = {
  title: string;
  characterName?: string;
  runtimeSeconds: number;
  panelCount: number;
  trainingRules: string[];
  panels: StoryboardPanel[];
};

export function buildStoryboardPanelPackage({
  packet,
  storyboard,
  referencePack,
}: {
  packet: VideoPacket;
  storyboard: StoryboardShot[];
  referencePack: CharacterReferencePack;
}): StoryboardPanelPackage {
  let cursor = 0;
  const panels = storyboard.flatMap((shot) => {
    const count = shouldSplitShot(shot) ? 2 : 1;
    const duration = roundToTenth(shot.durationSeconds / count);
    const shotPanels = Array.from({ length: count }, (_, index) => {
      const panelStart = cursor + duration * index;
      const panelEnd = index === count - 1 ? cursor + shot.durationSeconds : panelStart + duration;
      const suffix = count === 1 ? "" : index === 0 ? "A" : "B";
      return buildPanel({
        packet,
        shot,
        referencePack,
        panelId: `${shot.shotNumber}${suffix}`,
        panelIndex: index,
        panelCount: count,
        startSec: panelStart,
        endSec: panelEnd,
      });
    });
    cursor += shot.durationSeconds;
    return shotPanels;
  });

  return {
    title: packet.title,
    characterName: packet.characterName,
    runtimeSeconds: cursor,
    panelCount: panels.length,
    trainingRules: [
      "Split every production shot into animator-readable panels when a movement has a beginning and an end pose.",
      "Every panel must include camera, composition, action, emotion, FX, narration, audio, first pose, end pose, artwork prompt, animation prompt, and continuity lock.",
      "Storyboard artwork panels are production frames, not model sheets, grids, labels, or multiple-pose reference pages.",
      "Action must move through clean key poses; if motion gets complex, prioritize character identity and anatomy over camera flash.",
      "Final captions, titles, and CTAs are added in Remotion, not generated inside AI video frames.",
    ],
    panels,
  };
}

export function buildStoryboardPanelMarkdown(pkg: StoryboardPanelPackage) {
  return [
    `# ${pkg.title}`,
    "",
    `Character: ${pkg.characterName ?? "Locked Opaija character"}`,
    "Package: Professional storyboard panel sheet",
    `Runtime: ${pkg.runtimeSeconds}s`,
    `Panels: ${pkg.panelCount}`,
    "",
    "## Agent Training Rules",
    "",
    ...pkg.trainingRules.map((rule) => `- ${rule}`),
    "",
    ...pkg.panels.flatMap((panel) => [
      `## Panel ${panel.panelId}`,
      "",
      `Duration: ${panel.timecode}`,
      `Camera: ${panel.camera}`,
      `Emotion: ${panel.emotion}`,
      `FX: ${panel.fx}`,
      "",
      "### Composition",
      "",
      "```txt",
      panel.composition,
      "```",
      "",
      `Action: ${panel.action}`,
      `First pose: ${panel.firstPose}`,
      `End pose: ${panel.endPose}`,
      panel.negativeSpace ? `Negative space: ${panel.negativeSpace}` : "",
      `Narration: ${panel.narration}`,
      `Audio: ${panel.audio}`,
      "",
      "### Artwork Prompt",
      "",
      panel.artworkPrompt,
      "",
      "### Animation Prompt",
      "",
      panel.animationPrompt,
      "",
      "### Forbidden",
      "",
      ...panel.forbidden.map((rule) => `- ${rule}`),
      "",
    ]),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildStoryboardContactSheetSvg(pkg: StoryboardPanelPackage) {
  const columns = 3;
  const cardWidth = 360;
  const cardHeight = 300;
  const gap = 28;
  const rows = Math.ceil(pkg.panels.length / columns);
  const width = columns * cardWidth + (columns + 1) * gap;
  const height = 170 + rows * cardHeight + (rows + 1) * gap;
  const cards = pkg.panels
    .map((panel, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = gap + col * (cardWidth + gap);
      const y = 140 + gap + row * (cardHeight + gap);
      return renderPanelCard({ panel, x, y, width: cardWidth, height: cardHeight });
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f8f2e7"/>
  <text x="${gap}" y="52" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#15120f">${escapeXml(pkg.title)}</text>
  <text x="${gap}" y="86" font-family="Arial, sans-serif" font-size="18" fill="#5b4633">${escapeXml(pkg.characterName ?? "Locked Opaija character")} / ${pkg.runtimeSeconds}s / ${pkg.panelCount} panels</text>
  <text x="${gap}" y="116" font-family="Arial, sans-serif" font-size="14" fill="#7a2618">Production storyboard contact sheet - artwork panels for AI image generation and Seedance/Sora animation handoff</text>
  ${cards}
</svg>
`;
}

function buildPanel({
  packet,
  shot,
  referencePack,
  panelId,
  panelIndex,
  panelCount,
  startSec,
  endSec,
}: {
  packet: VideoPacket;
  shot: StoryboardShot;
  referencePack: CharacterReferencePack;
  panelId: string;
  panelIndex: number;
  panelCount: number;
  startSec: number;
  endSec: number;
}) {
  const character = packet.characterName ?? referencePack.name;
  const phase = panelCount === 1 ? "hold" : panelIndex === 0 ? "setup" : "payoff";
  const action = refineAction({ character, shot, phase });
  const emotion = chooseEmotion(shot, phase);
  const fx = chooseFx(shot, phase);
  const camera = refineCamera(shot.camera, phase);
  const firstPose = panelIndex === 0 ? (shot.firstFrame ?? `${character} begins from a clean key pose.`) : midpointPose(character, shot);
  const endPose = panelIndex === panelCount - 1 ? (shot.lastFrame ?? `${character} lands in a clean held pose.`) : midpointPose(character, shot);
  const composition = buildComposition({ shot, character, fx, panelId, phase });
  const continuityLock = shot.continuityLock ?? referencePack.seedanceContinuityPrompt;
  const forbidden = [
    "extra fingers",
    "weapon changes",
    "costume drift",
    "body morphing",
    "random crowds",
    "text generation",
    "logo generation",
    "overpowered FX covering face",
  ];
  const artworkPrompt = [
    `Panel ${panelId} artwork for "${packet.title}".`,
    referencePack.identityLock,
    `${camera}. ${action}`,
    `Emotion: ${emotion}. FX: ${fx}.`,
    `First pose: ${firstPose}`,
    `End pose: ${endPose}`,
    "Single finished storyboard artwork panel, cinematic production frame, vertical 9:16, clean black ink linework, Caribbean anime, gold/orange/red/teal/cream palette.",
    "No labels, no captions, no panel letters, no text, no character sheet grid, no multiple poses.",
  ].join(" ");
  const animationPrompt = [
    `Animate panel ${panelId} from ${formatTimestamp(startSec)} to ${formatTimestamp(endSec)}.`,
    action,
    `${camera}.`,
    `Emotion should read as ${emotion}.`,
    `FX: ${fx}.`,
    continuityLock,
    "Keep motion simple and readable through clean anime key poses.",
    "No subtitles, no logo text, no random extra characters, no character drift.",
  ].join(" ");

  return {
    panelId,
    parentShot: shot.shotNumber,
    timecode: `${formatTimestamp(startSec)}-${formatTimestamp(endSec)}`,
    durationSeconds: roundToTenth(endSec - startSec),
    camera,
    composition,
    action,
    emotion,
    fx,
    narration: shot.narrationBeat,
    audio: chooseAudio(shot, phase),
    firstPose,
    endPose,
    negativeSpace: shot.shotType.toLowerCase().includes("cta") ? "Top 20% for title, bottom 15% for CTA in Remotion." : undefined,
    artworkPrompt,
    animationPrompt,
    continuityLock,
    forbidden,
  };
}

function shouldSplitShot(shot: StoryboardShot) {
  if (shot.durationSeconds <= 3) return false;
  if (shot.shotType.toLowerCase().includes("cta")) return false;
  return true;
}

function refineAction({ character, shot, phase }: { character: string; shot: StoryboardShot; phase: string }) {
  const lower = `${shot.shotType} ${shot.action}`.toLowerCase();
  if (phase === "setup") {
    if (lower.includes("enter") || lower.includes("steps")) return `${character} pauses at the gayelle threshold, then commits the first step into the circle.`;
    if (lower.includes("grip")) return `${character} brings the weapon or power focus into frame and tightens the grip.`;
    if (lower.includes("power") || lower.includes("pulse")) return `Tiny rhythm particles gather around ${character}'s hands before the power fully wakes.`;
    if (lower.includes("strike") || lower.includes("impact")) return `${character} coils the body into one clear loaded attack pose.`;
  }
  if (phase === "payoff") {
    if (lower.includes("enter") || lower.includes("steps")) return `${character} lands the step as dust and ground pulse rise in rhythm.`;
    if (lower.includes("grip")) return `${character} turns and locks eyes with the unseen opponent without revealing them.`;
    if (lower.includes("power") || lower.includes("pulse")) return `Tempo Pulse and Echo Pulse expand in controlled rhythm rings around ${character}.`;
    if (lower.includes("strike") || lower.includes("impact")) return `${character} releases one clean rhythm-command strike across the gayelle.`;
  }
  return shot.action;
}

function chooseEmotion(shot: StoryboardShot, phase: string) {
  const lower = `${shot.shotType} ${shot.action}`.toLowerCase();
  if (lower.includes("enter") || lower.includes("steps")) return phase === "setup" ? "curious" : "focused";
  if (lower.includes("grip") || lower.includes("lock")) return phase === "setup" ? "determined" : "ready";
  if (lower.includes("strike") || lower.includes("impact")) return phase === "setup" ? "controlled" : "dominant";
  if (lower.includes("power") || lower.includes("pulse")) return phase === "setup" ? "calm" : "powerful";
  if (lower.includes("cta") || lower.includes("final") || lower.includes("pose")) return "legendary";
  return "focused";
}

function chooseFx(shot: StoryboardShot, phase: string) {
  const lower = `${shot.shotType} ${shot.action}`.toLowerCase();
  if (lower.includes("enter") || lower.includes("steps") || lower.includes("dust")) return phase === "setup" ? "floating dust" : "ground rhythm pulse";
  if (lower.includes("grip") || lower.includes("lock")) return "none";
  if (lower.includes("strike") || lower.includes("impact")) return phase === "setup" ? "pulse build" : "impact rhythm wave";
  if (lower.includes("power") || lower.includes("pulse")) return phase === "setup" ? "tiny shimmer particles" : "gold/orange/teal rhythm rings";
  if (lower.includes("cta") || lower.includes("final") || lower.includes("pose")) return "Opaija mark energy frame";
  return "subtle gold dust";
}

function chooseAudio(shot: StoryboardShot, phase: string) {
  const lower = `${shot.shotType} ${shot.action}`.toLowerCase();
  if (lower.includes("enter") || lower.includes("steps")) return phase === "setup" ? "soft wind, single distant drum" : "dust step, low drum hit";
  if (lower.includes("grip")) return "hand grip cloth creak, breath, drum tension";
  if (lower.includes("strike") || lower.includes("impact")) return phase === "setup" ? "sharp inhale, pulse charge" : "clean impact hit, bass rhythm wave";
  if (lower.includes("power") || lower.includes("pulse")) return phase === "setup" ? "quiet shimmer, heartbeat drum" : "rising rhythm wave";
  return "music resolves, final drum tail";
}

function refineCamera(camera: string, phase: string) {
  if (phase === "setup") return `${camera}; hold the starting key pose long enough for character readability`;
  if (phase === "payoff") return `${camera}; continue into the payoff pose with controlled motion`;
  return camera;
}

function midpointPose(character: string, shot: StoryboardShot) {
  return `${character} reaches the midpoint of shot ${shot.shotNumber}: clear silhouette, readable hands, stable face, stable weapon.`;
}

function buildComposition({
  shot,
  character,
  fx,
  panelId,
  phase,
}: {
  shot: StoryboardShot;
  character: string;
  fx: string;
  panelId: string;
  phase: string;
}) {
  const title = `Panel ${panelId} / ${shot.shotType} / ${phase}`;
  return [
    title,
    "+--------------------------+",
    "|  sky / bamboo / dust     |",
    "|                          |",
    `|        ${character.slice(0, 12).padEnd(12, " ")}      |`,
    "|          O               |",
    "|         /|\\              |",
    "|         / \\              |",
    `|  FX: ${fx.slice(0, 18).padEnd(18, " ")} |`,
    "+--------------------------+",
  ].join("\n");
}

function renderPanelCard({
  panel,
  x,
  y,
  width,
  height,
}: {
  panel: StoryboardPanel;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const frameX = x + 24;
  const frameY = y + 58;
  const frameW = width - 48;
  const frameH = 154;
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="#fffaf1" stroke="#25170f" stroke-width="2"/>
    <text x="${x + 22}" y="${y + 32}" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#15120f">Panel ${escapeXml(panel.panelId)}</text>
    <text x="${x + 116}" y="${y + 32}" font-family="Arial, sans-serif" font-size="13" fill="#71402b">${escapeXml(panel.timecode)}</text>
    <rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" fill="#f1dfbf" stroke="#7a2618" stroke-width="2"/>
    <circle cx="${frameX + frameW / 2}" cy="${frameY + 50}" r="17" fill="#8f5632" stroke="#25170f" stroke-width="3"/>
    <line x1="${frameX + frameW / 2}" y1="${frameY + 67}" x2="${frameX + frameW / 2}" y2="${frameY + 112}" stroke="#25170f" stroke-width="5"/>
    <line x1="${frameX + frameW / 2}" y1="${frameY + 82}" x2="${frameX + frameW / 2 - 46}" y2="${frameY + 112}" stroke="#25170f" stroke-width="5"/>
    <line x1="${frameX + frameW / 2}" y1="${frameY + 82}" x2="${frameX + frameW / 2 + 46}" y2="${frameY + 112}" stroke="#25170f" stroke-width="5"/>
    <line x1="${frameX + frameW / 2}" y1="${frameY + 112}" x2="${frameX + frameW / 2 - 35}" y2="${frameY + 144}" stroke="#25170f" stroke-width="5"/>
    <line x1="${frameX + frameW / 2}" y1="${frameY + 112}" x2="${frameX + frameW / 2 + 35}" y2="${frameY + 144}" stroke="#25170f" stroke-width="5"/>
    <path d="M ${frameX + 40} ${frameY + 124} C ${frameX + 100} ${frameY + 96}, ${frameX + frameW - 100} ${frameY + 96}, ${frameX + frameW - 40} ${frameY + 124}" fill="none" stroke="#e28324" stroke-width="5"/>
    <path d="M ${frameX + 56} ${frameY + 136} C ${frameX + 126} ${frameY + 116}, ${frameX + frameW - 126} ${frameY + 116}, ${frameX + frameW - 56} ${frameY + 136}" fill="none" stroke="#1f8a8a" stroke-width="3"/>
    <text x="${x + 22}" y="${y + 238}" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#15120f">${escapeXml(panel.emotion)} / ${escapeXml(panel.fx)}</text>
    <text x="${x + 22}" y="${y + 264}" font-family="Arial, sans-serif" font-size="12" fill="#3c2b20">${escapeXml(truncate(panel.action, 62))}</text>
  </g>`;
}

function formatTimestamp(seconds: number) {
  const whole = Math.floor(seconds);
  const tenths = Math.round((seconds - whole) * 10);
  return tenths > 0 ? `0:${String(whole).padStart(2, "0")}.${tenths}` : `0:${String(whole).padStart(2, "0")}`;
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
