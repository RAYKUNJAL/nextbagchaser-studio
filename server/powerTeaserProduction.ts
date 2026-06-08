import fs from "node:fs/promises";
import path from "node:path";
import { buildCharacterReferencePack, characterCatalog, resolveCharacter, type CharacterBrief } from "./characterReferencePack.js";
import { upsertContentStorageItem } from "./contentStorage.js";

export type PowerTeaserBeat = {
  beatId: string;
  label: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  visualAction: string;
  cameraMove: string;
  impactFrame: string;
  sfx: string;
  musicHit: string;
  voiceLine: string;
  voicePlacement: "before_action" | "after_impact" | "under_hold" | "none";
  characterLock: string;
  qcNotes: string[];
};

export type PowerTeaserStoryboardPanel = {
  panelId: string;
  beatId: string;
  poseType: "start" | "impact" | "end";
  prompt: string;
  forbidden: string[];
  seedanceRole: string;
};

export type PowerTeaserPackage = {
  id: string;
  format: "opaija_power_teaser";
  status: "dry_run_ready" | "needs_fix" | "approved_for_animation";
  createdAt: string;
  updatedAt: string;
  runtimeTargetSec: {
    min: number;
    max: number;
    planned: number;
  };
  character: {
    id: string;
    name: string;
    shortName: string;
    role: string;
    power: string;
    weapon: string;
    referencePath: string;
  };
  structure: string[];
  styleLock: {
    source: string;
    summary: string;
    required: string[];
    forbidden: string[];
  };
  audioActionRules: {
    maxDriftSec: number;
    voiceStyle: string;
    rule: string;
  };
  voiceLines: string[];
  beats: PowerTeaserBeat[];
  storyboardPanels: PowerTeaserStoryboardPanel[];
  seedanceHandoff: {
    provider: "openrouter-seedance";
    durationSource: "audio-action-beat-sheet";
    orderedReferences: Array<{
      imageRef: string;
      panelId: string;
      beatId: string;
      instruction: string;
    }>;
    masterPrompt: string;
    negativePrompt: string;
  };
  qc: {
    status: "passed" | "blocked";
    checks: Array<{
      id: string;
      status: "passed" | "blocked";
      message: string;
    }>;
  };
  files: {
    packetPath: string;
    beatSheetPath: string;
    seedanceHandoffPath: string;
  };
};

const rootDir = path.resolve(process.cwd(), "ops", "production", "power-teasers");
const launchCharacterIds = ["kairo", "nia", "asha", "jabari", "marius", "selah"];

export async function createPowerTeaserDryRun(characterId = "kairo") {
  const character = resolveCharacter(characterId);
  if (!character) throw new Error(`Unknown Opaija character: ${characterId}`);
  const now = new Date().toISOString();
  const id = `${character.id}-power-teaser-${slugTimestamp(now)}`;
  const packetDir = path.join(rootDir, character.id, id);
  const referencePack = buildCharacterReferencePack(character);
  const beats = buildBeats(character, referencePack.identityLock);
  const storyboardPanels = buildStoryboardPanels(character, beats, referencePack.forbiddenDrift);
  const packageDraft: PowerTeaserPackage = {
    id,
    format: "opaija_power_teaser",
    status: "dry_run_ready",
    createdAt: now,
    updatedAt: now,
    runtimeTargetSec: { min: 20, max: 35, planned: sumDuration(beats) },
    character: {
      id: character.id,
      name: character.name,
      shortName: character.shortName,
      role: character.role,
      power: character.power,
      weapon: character.weapon,
      referencePath: `/${character.image}`,
    },
    structure: ["hook hit", "identity reveal", "power action", "threat/cliffhanger", "CTA"],
    styleLock: {
      source: "public/assets/characters bible sheets",
      summary: "Dark cinematic 2D Trini anime with orange/gold rhythm energy, sharp linework, full weapon readability, Afro-Caribbean costume detail.",
      required: [
        `Use ${character.name}'s approved model sheet only.`,
        `Keep ${character.weapon} visible in power and combat frames.`,
        "Use full-body or three-quarter action framing when the weapon is active.",
        "Use gold/orange rhythm lightning, black ink shadows, and Trinidad street/gayelle energy.",
      ],
      forbidden: referencePack.forbiddenDrift,
    },
    audioActionRules: {
      maxDriftSec: 0.25,
      voiceStyle: "Action-first VO: 2-3 short lines only. SFX and music carry the fight rhythm.",
      rule: "Voice lines must land before the action they set up or after the impact they reveal; never run as generic narration across unrelated motion.",
    },
    voiceLines: beats.map((beat) => beat.voiceLine).filter(Boolean),
    beats,
    storyboardPanels,
    seedanceHandoff: buildSeedanceHandoff(character, beats, storyboardPanels, referencePack.seedanceContinuityPrompt),
    qc: runDryRunQc(character, beats, storyboardPanels),
    files: {
      packetPath: path.join(packetDir, "power-teaser-package.json"),
      beatSheetPath: path.join(packetDir, "audio-action-beat-sheet.json"),
      seedanceHandoffPath: path.join(packetDir, "seedance-handoff.json"),
    },
  };

  await fs.mkdir(packetDir, { recursive: true });
  await fs.writeFile(packageDraft.files.packetPath, `${JSON.stringify(packageDraft, null, 2)}\n`, "utf8");
  await fs.writeFile(packageDraft.files.beatSheetPath, `${JSON.stringify({ id, beats, audioActionRules: packageDraft.audioActionRules }, null, 2)}\n`, "utf8");
  await fs.writeFile(packageDraft.files.seedanceHandoffPath, `${JSON.stringify(packageDraft.seedanceHandoff, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(rootDir, "latest.json"), `${JSON.stringify({ id, characterId: character.id, packetPath: packageDraft.files.packetPath }, null, 2)}\n`, "utf8");

  await upsertContentStorageItem({
    id,
    title: `${character.shortName} Power Teaser - Audio Action Dry Run`,
    category: "storyboard",
    status: "needs_review",
    style: packageDraft.styleLock.summary,
    createdAt: now,
    updatedAt: now,
    buildId: id,
    episode: "Character Power Teasers",
    notes: [
      "No paid animation was generated.",
      "This package locks the audio-action beat grid before storyboard art or Seedance animation.",
      `Timing gate: max ${packageDraft.audioActionRules.maxDriftSec}s drift for teaser exports.`,
      `QC status: ${packageDraft.qc.status}.`,
    ],
    assets: [
      { type: "manifest", label: "Power teaser package", filePath: packageDraft.files.packetPath },
      { type: "timing", label: "Audio-action beat sheet", filePath: packageDraft.files.beatSheetPath },
      { type: "source", label: "Seedance handoff", filePath: packageDraft.files.seedanceHandoffPath },
      { type: "image", label: `${character.shortName} approved bible sheet`, publicPath: `/${character.image}` },
    ],
  });

  return packageDraft;
}

export async function getPowerTeaserStudio() {
  const latest = await readLatest().catch(() => undefined);
  const activePackage = latest ? await readPackage(latest.packetPath).catch(() => undefined) : undefined;
  return {
    mode: "power_teaser_studio",
    title: "Opaija Power Teaser Studio",
    summary:
      "Build vertical character-power teasers with audio-action sync before animation. Start with Kai, then run Nia, Asha, Jabs, Marius, and Selah.",
    firstFormat: {
      teaserRuntimeSec: "20-35",
      episodeRuntimeSec: "60-90",
      compilationGoal: "30-minute specials are built later from vertical chapters.",
    },
    launchCharacters: launchCharacterIds.map((id) => {
      const character = characterCatalog.find((candidate) => candidate.id === id)!;
      return {
        id: character.id,
        name: character.name,
        shortName: character.shortName,
        power: character.power,
        weapon: character.weapon,
        referencePath: `/${character.image}`,
      };
    }),
    workflow: [
      "Script Agent writes a fast power teaser.",
      "Beat Director creates the frame-accurate audio-action grid.",
      "Storyboard Agent creates start, impact, and end pose panels.",
      "Style Lock QC blocks drift before animation.",
      "Animation Agent sends only approved panels to OpenRouter/Seedance.",
      "Sound/Edit Agent adds voice, SFX, music hits, captions, CTA, and final timing.",
      "Review Agent marks approved, needs_fix, or do_not_publish.",
    ],
    activePackage,
  };
}

async function readLatest() {
  return JSON.parse(await fs.readFile(path.join(rootDir, "latest.json"), "utf8")) as { id: string; characterId: string; packetPath: string };
}

async function readPackage(packetPath: string) {
  return JSON.parse(await fs.readFile(packetPath, "utf8")) as PowerTeaserPackage;
}

function buildBeats(character: CharacterBrief, identityLock: string): PowerTeaserBeat[] {
  const isKai = character.id === "kairo";
  const rows = isKai
    ? [
        {
          label: "Hook Hit",
          durationSec: 3.5,
          visualAction: "Kai drops into a low landing; orange rhythm cracks outward before he speaks.",
          cameraMove: "Fast vertical push-in from cracked ground to Kai's eyes.",
          impactFrame: "Ground pulse explodes under Kai's sneaker, dust and orange lightning frozen for one frame.",
          sfx: "Ground crack, low drum boom, breath catch.",
          musicHit: "Single tassa/808 hybrid hit on landing.",
          voiceLine: "Trinidad does not wait for permission.",
          voicePlacement: "after_impact" as const,
        },
        {
          label: "Identity Reveal",
          durationSec: 5,
          visualAction: "The Listening Bois slides into frame; Kai catches it without looking and squares his shoulders.",
          cameraMove: "Whip pan following the full staff from tip to Kai's grip.",
          impactFrame: "Full staff visible edge-to-edge, Kai's pendant flashing orange.",
          sfx: "Wood scrape, pendant chime, cloth whip.",
          musicHit: "Rhythm line starts under the catch.",
          voiceLine: "Kai Baptiste heard the first pulse.",
          voicePlacement: "under_hold" as const,
        },
        {
          label: "Power Action",
          durationSec: 8,
          visualAction: "Kai spins the staff once, plants it, and sends a clean rhythm wave across the gayelle.",
          cameraMove: "Side tracking into low-angle impact, then one snap zoom on the pulse wave.",
          impactFrame: "Staff tip hits ground; orange/gold lightning ring expands without covering Kai's face.",
          sfx: "Staff strike, pulse burst, gravel lift, crowd gasp.",
          musicHit: "Three drum hits synced to spin, plant, pulse.",
          voiceLine: "",
          voicePlacement: "none" as const,
        },
        {
          label: "Threat Cliffhanger",
          durationSec: 7,
          visualAction: "The orange pulse slams into a black silence ring; Kai looks up as sound cuts out.",
          cameraMove: "Rack focus from pulse wave to a dark off-screen silhouette.",
          impactFrame: "Orange rhythm wave frozen against black silence edge.",
          sfx: "All sound cuts, then one heartbeat.",
          musicHit: "Dropout followed by sub hit.",
          voiceLine: "But silence was already hunting him.",
          voicePlacement: "after_impact" as const,
        },
        {
          label: "CTA Hold",
          durationSec: 4,
          visualAction: "Kai holds a ready stance with full staff visible; empty top and bottom space reserved for editor text.",
          cameraMove: "Locked hero frame, slight energy shimmer only.",
          impactFrame: "Kai in readable hero silhouette, staff uncut, orange cracks behind him.",
          sfx: "Rhythm hum, cloth flutter.",
          musicHit: "Short resolve with unresolved tail.",
          voiceLine: "",
          voicePlacement: "none" as const,
        },
      ]
    : genericCharacterRows(character);

  let cursor = 0;
  return rows.map((row, index) => {
    const startSec = cursor;
    cursor += row.durationSec;
    return {
      beatId: `B${index + 1}`,
      label: row.label,
      startSec: roundSec(startSec),
      endSec: roundSec(cursor),
      durationSec: row.durationSec,
      visualAction: row.visualAction,
      cameraMove: row.cameraMove,
      impactFrame: row.impactFrame,
      sfx: row.sfx,
      musicHit: row.musicHit,
      voiceLine: row.voiceLine,
      voicePlacement: row.voicePlacement,
      characterLock: identityLock,
      qcNotes: [
        "Voice placement must match this beat, not generic narration.",
        "Captions/CTA are editor-layer only.",
        `Keep ${character.weapon} readable when power activates.`,
      ],
    };
  });
}

function genericCharacterRows(character: CharacterBrief) {
  return [
    {
      label: "Hook Hit",
      durationSec: 4,
      visualAction: `${character.shortName} enters with a readable power omen tied to ${character.power}.`,
      cameraMove: "Fast push-in to eyes and hands.",
      impactFrame: "Power symbol flashes without text or logo artifacts.",
      sfx: "Breath, low drum, power shimmer.",
      musicHit: "Single hard hit.",
      voiceLine: `${character.shortName} does not move alone.`,
      voicePlacement: "after_impact" as const,
    },
    {
      label: "Identity Reveal",
      durationSec: 5,
      visualAction: `${character.weapon} comes into full frame as ${character.shortName} takes stance.`,
      cameraMove: "Weapon-follow pan into three-quarter pose.",
      impactFrame: `Full ${character.weapon} visible with approved outfit locked.`,
      sfx: "Weapon/prop motion, cloth whip.",
      musicHit: "Rhythm enters.",
      voiceLine: `${character.power} answers the rhythm.`,
      voicePlacement: "under_hold" as const,
    },
    {
      label: "Power Action",
      durationSec: 8,
      visualAction: `${character.shortName} releases one clean power command with start, impact, and recovery poses.`,
      cameraMove: "Side track into low-angle impact.",
      impactFrame: "Power effect peaks while face and silhouette stay readable.",
      sfx: "Pulse burst, impact hit, air pressure.",
      musicHit: "Three synced hits.",
      voiceLine: "",
      voicePlacement: "none" as const,
    },
    {
      label: "Cliffhanger",
      durationSec: 6,
      visualAction: "A stronger threat interrupts the power and forces a choice.",
      cameraMove: "Rack focus from hero to off-screen danger.",
      impactFrame: "Hero freezes in decision pose.",
      sfx: "Dropout, heartbeat.",
      musicHit: "Sub hit.",
      voiceLine: "Every island will have to choose.",
      voicePlacement: "after_impact" as const,
    },
  ];
}

function buildStoryboardPanels(character: CharacterBrief, beats: PowerTeaserBeat[], forbidden: string[]) {
  return beats.flatMap((beat) =>
    (["start", "impact", "end"] as const).map((poseType) => ({
      panelId: `${beat.beatId}-${poseType.toUpperCase()}`,
      beatId: beat.beatId,
      poseType,
      prompt: [
        `Vertical 9:16 cinematic 2D Trini anime frame of ${character.name}.`,
        `Pose type: ${poseType}. Beat: ${beat.label}.`,
        `Action: ${poseType === "start" ? beat.visualAction : poseType === "impact" ? beat.impactFrame : "Recovery/hold pose after the beat, ready for the next cut."}`,
        `Camera: ${beat.cameraMove}.`,
        `Keep ${character.weapon} visible and not cropped when active.`,
        "Dark cinematic orange/gold rhythm energy, sharp anime linework, Afro-Caribbean wardrobe detail, no text.",
      ].join(" "),
      forbidden,
      seedanceRole: `Use as @Image reference for ${beat.label} ${poseType} pose.`,
    })),
  );
}

function buildSeedanceHandoff(
  character: CharacterBrief,
  beats: PowerTeaserBeat[],
  storyboardPanels: PowerTeaserStoryboardPanel[],
  continuityPrompt: string,
) {
  return {
    provider: "openrouter-seedance" as const,
    durationSource: "audio-action-beat-sheet" as const,
    orderedReferences: storyboardPanels.map((panel, index) => ({
      imageRef: `@Image${index + 1}`,
      panelId: panel.panelId,
      beatId: panel.beatId,
      instruction: panel.seedanceRole,
    })),
    masterPrompt: [
      continuityPrompt,
      `Build a ${sumDuration(beats)} second vertical power teaser for ${character.name}.`,
      "Follow the audio-action beat sheet exactly. Sync camera moves, impacts, SFX moments, and voice placements to the timecodes.",
      "Use start/impact/end references as pose anchors. Do not generate text, logos, subtitles, watermarks, crowds, or reference sheets.",
    ].join(" "),
    negativePrompt:
      "text, letters, subtitles, watermark, logo, cropped staff, missing weapon, face drift, skin tone drift, costume redesign, broken hands, extra fingers, random crowd, reference sheet grid, collage, melted weapon",
  };
}

function runDryRunQc(character: CharacterBrief, beats: PowerTeaserBeat[], panels: PowerTeaserStoryboardPanel[]) {
  const total = sumDuration(beats);
  const checks = [
    {
      id: "runtime",
      status: total >= 20 && total <= 35 ? "passed" as const : "blocked" as const,
      message: `Planned runtime is ${total}s. Required teaser range is 20-35s.`,
    },
    {
      id: "voice-density",
      status: beats.filter((beat) => beat.voiceLine).length <= 3 ? "passed" as const : "blocked" as const,
      message: "Voiceover is sparse enough for action-first editing.",
    },
    {
      id: "pose-anchors",
      status: panels.length === beats.length * 3 ? "passed" as const : "blocked" as const,
      message: "Each beat has start, impact, and end pose prompts.",
    },
    {
      id: "weapon-lock",
      status: panels.every((panel) => panel.prompt.includes(character.weapon)) ? "passed" as const : "blocked" as const,
      message: `${character.weapon} is named in every storyboard prompt.`,
    },
  ];
  return {
    status: checks.every((check) => check.status === "passed") ? "passed" as const : "blocked" as const,
    checks,
  };
}

function sumDuration(beats: Array<{ durationSec: number }>) {
  return roundSec(beats.reduce((sum, beat) => sum + beat.durationSec, 0));
}

function roundSec(value: number) {
  return Math.round(value * 100) / 100;
}

function slugTimestamp(value: string) {
  return value.toLowerCase().replace(/[:.]/g, "-");
}
