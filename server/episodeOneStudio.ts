import fs from "node:fs/promises";
import path from "node:path";
import { fileExists, probeVideo, type VideoProbeResult } from "./videoProbe.js";
import type { AnimeTimingSheet } from "./animeTiming.js";

type BuiltFrame = {
  imageRef: string;
  panelId: string;
  title: string;
  characters?: string[];
  prompt?: string;
  referenceUrl?: string;
  image?: {
    publicPath?: string;
    outputPath?: string;
    provider?: string;
    status?: string;
  };
  clip?: {
    publicPath?: string;
    outputPath?: string;
    requestId?: string;
    modelId?: string;
    status?: string;
    prompt?: string;
  };
  error?: string;
};

type Manifest = {
  id: string;
  status: string;
  providerMode?: string;
  startedAt?: string;
  updatedAt?: string;
  timingSheetPath?: string;
  timing?: AnimeTimingSheet;
  timingQc?: {
    status: "passed" | "timing_failed" | "missing_audio";
    plannedDurationSec: number;
    finalVideoDurationSec?: number;
    audioDurationSec?: number;
    driftSec?: number;
    maxAudioVideoDriftSec: number;
    message: string;
  };
  finalVideo?: {
    outputPath?: string;
    publicPath?: string;
  };
  voice?: {
    provider?: string;
    path?: string;
    fileName?: string;
    characterCount?: number;
  };
  frames: BuiltFrame[];
};

type ReferenceLock = {
  status: string;
  styleSource: string;
  globalStyleLock: string;
  forbidden: string[];
  characters: Array<{
    id: string;
    name: string;
    referencePath: string;
    locks: string[];
  }>;
};

type StoryboardPromptPacket = {
  status: string;
  styleLock: string;
  modelSheetReferences: string[];
  negativePrompt: string;
  frames: Array<{
    imageRef: string;
    panelId: string;
    title: string;
    characters: string[];
    prompt: string;
  }>;
};

type SeedanceHandoff = {
  status: string;
  providerTarget: string;
  aspectRatio: string;
  styleLock: string;
  referenceRule: string;
  globalNegative: string[];
  masterPrompt: string;
  orderedReferences: Array<{
    imageRef: string;
    panelId: string;
    title: string;
    durationSec: number;
    motion: string;
  }>;
  voiceover: string[];
  nextStep: string;
};

type ActionBoard = {
  status: string;
  purpose: string;
  animationRule: string;
  panels: Array<{
    panelId: string;
    title: string;
    camera: string;
    actionStart: string;
    actionImpact: string;
    actionEnd: string;
    emotion: string;
    fx: string;
    qcGate: string;
  }>;
};

type RejectionReport = {
  status: string;
  reason: string;
  doNotPublish: boolean;
  blockers: string[];
  nextBuildRules: string[];
  currentArtifacts?: {
    finalVideo?: string;
    purpose?: string;
  };
};

const buildsRoot = path.resolve(process.cwd(), "out", "episode-builds", "season-one", "episode-01-the-first-pulse");
const productionRoot = path.resolve(process.cwd(), "ops", "production", "season-one", "episode-01-the-first-pulse");
const fallbackPublicVideoPath = "/generated/videos/episode-01-the-first-pulse-qc-failed.mp4";

export type EpisodeOneStudio = {
  id: string;
  title: string;
  status: "needs_fix" | "ready" | "building" | "missing";
  manifestStatus?: string;
  mode: "storyboard_studio";
  providerMode?: string;
  updatedAt?: string;
  sourceLinks: Array<{
    label: string;
    href: string;
  }>;
  stageFlow: Array<{
    id: string;
    label: string;
    status: "passed" | "current" | "blocked" | "waiting";
    summary: string;
    count?: string;
  }>;
  references: ReferenceLock;
  package: {
    providerTarget: string;
    aspectRatio: string;
    styleLock: string;
    referenceRule: string;
    masterPrompt: string;
    globalNegative: string[];
    nextStep: string;
    voiceover: string[];
  };
  editor: {
    status: "ready_for_review" | "waiting_for_clips" | "missing";
    assembler: string;
    remotionLayer: string;
    clipsAssembled: number;
    totalClips: number;
    audioAttached: boolean;
    finalVideoPath?: string;
    note: string;
  };
  finalVideo?: {
    publicPath: string;
    probe?: VideoProbeResult | null;
  };
  voice?: Manifest["voice"] & {
    quality: "rejected" | "pending" | "approved";
    note: string;
  };
  timing?: {
    status: "ready" | "timing_failed";
    targetWpm: number;
    totalDurationSec: number;
    audioDurationSec?: number;
    driftSec?: number;
    maxAudioVideoDriftSec: number;
    qcStatus: "passed" | "timing_failed" | "missing_audio" | "pending";
    panels: Array<{
      panelId: string;
      narration: string;
      wordCount: number;
      finalClipDurationSec: number;
      actionBeat: string;
    }>;
  };
  qc: {
    status: "failed" | "pending" | "passed";
    summary: string;
    blockers: string[];
    nextFixes: string[];
    forbidden: string[];
    gate: string;
  };
  frames: Array<{
    imageRef: string;
    panelId: string;
    title: string;
    characters: string[];
    prompt: string;
    motion: string;
    durationSec?: number;
    camera?: string;
    actionStart?: string;
    actionImpact?: string;
    actionEnd?: string;
    emotion?: string;
    fx?: string;
    qcGate?: string;
    imagePath?: string;
    clipPath?: string;
    clipStatus: "missing" | "queued" | "ready" | "error";
    requestId?: string;
    modelId?: string;
    error?: string;
  }>;
};

export async function getEpisodeOneStudio(): Promise<EpisodeOneStudio> {
  const manifestPath = await resolveLatestManifestPath().catch(() => undefined);
  if (!manifestPath) {
    return {
      id: "episode-01-the-first-pulse",
      title: "Episode 1: The First Pulse",
      status: "missing",
      mode: "storyboard_studio",
      sourceLinks: sourceLinks(),
      stageFlow: missingStageFlow(),
      references: fallbackReferenceLock(),
      package: fallbackPackage(),
      editor: {
        status: "missing",
        assembler: "ffmpeg concat + audio mux",
        remotionLayer: "Remotion title, CTA, captions, thumbnail layer",
        clipsAssembled: 0,
        totalClips: 0,
        audioAttached: false,
        note: "No clips are ready for the editor yet.",
      },
      qc: {
        status: "pending",
        summary: "No Episode 1 production build has been found yet.",
        blockers: [],
        nextFixes: ["Run the Episode 1 builder after the server has provider access."],
        forbidden: [],
        gate: "No animation gate has run yet.",
      },
      frames: [],
    };
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as Manifest;
  const referenceLock = (await readJson<ReferenceLock>("reference-lock.json")) ?? fallbackReferenceLock();
  const promptPacket = await readJson<StoryboardPromptPacket>("storyboard-frame-prompts.json");
  const seedanceHandoff = (await readJson<SeedanceHandoff>("seedance-handoff.json")) ?? fallbackSeedanceHandoff();
  const actionBoard = await readJson<ActionBoard>("storyboard-action-board.json");
  const rejectionReport = await readJson<RejectionReport>("episode-01-qc-rejection.json");
  const timingSheet = manifest.timing ?? (await readJson<AnimeTimingSheet>("timing-sheet.json"));
  const publicVideoPath = manifest.finalVideo?.publicPath ?? fallbackPublicVideoPath;
  const finalVideoPath = manifest.finalVideo?.outputPath
    ? path.resolve(manifest.finalVideo.outputPath)
    : path.resolve(process.cwd(), "public", publicVideoPath.replace(/^\/+/, ""));
  const finalExists = await fileExists(finalVideoPath);
  const probe = finalExists ? await probeVideo(finalVideoPath).catch(() => null) : null;
  const frames = buildFrames(manifest, promptPacket, seedanceHandoff, actionBoard);

  const readyClips = frames.filter((frame) => frame.clipStatus === "ready").length;
  const readyArt = frames.filter((frame) => Boolean(frame.imagePath)).length;
  const actionReady = actionBoard?.panels.length ?? 0;
  const timingFailed = manifest.status === "timing_failed" || manifest.timingQc?.status === "timing_failed";
  const readyForReview = frames.length > 0 && readyArt === frames.length && readyClips === frames.length && finalExists && manifest.status === "completed" && !timingFailed;
  const status: EpisodeOneStudio["status"] = timingFailed ? "needs_fix" : readyForReview ? "ready" : "building";

  return {
    id: manifest.id,
    title: "Episode 1: The First Pulse",
    status,
    manifestStatus: manifest.status,
    mode: "storyboard_studio",
    providerMode: manifest.providerMode,
    updatedAt: manifest.updatedAt,
    sourceLinks: sourceLinks(),
    stageFlow: [
      {
        id: "script",
        label: "Script",
        status: "passed",
        summary: "Season 1 Episode 1 packet exists and is the story source.",
        count: "1 packet",
      },
      {
        id: "references",
        label: "Character Lock",
        status: "passed",
        summary: "Approved model sheets are locked as the visual source of truth.",
        count: `${referenceLock.characters.length} sheets`,
      },
      {
        id: "storyboard",
        label: "Storyboard",
        status: readyForReview ? "passed" : "current",
        summary: "Storyboard panels and action movement are ready for inspection and animation handoff.",
        count: `${frames.length} panels`,
      },
      {
        id: "art",
        label: "Artwork",
        status: readyArt === frames.length && frames.length > 0 ? "passed" : "waiting",
        summary: readyArt === frames.length && frames.length > 0
          ? "2D storyboard artwork exists for every panel and is ready for human style review."
          : "Artwork generation is still waiting on missing storyboard frames.",
        count: `${readyArt}/${frames.length} frames`,
      },
      {
        id: "timing",
        label: "Timing",
        status: timingFailed ? "blocked" : timingSheet ? "passed" : "waiting",
        summary: timingFailed
          ? "Audio/video timing drift exceeded the allowed 0.5 second gate."
          : timingSheet
            ? "Narration timing sheet is active and controls clip duration."
            : "Timing sheet is missing.",
        count: timingSheet ? `${Math.round(timingSheet.totals.finalClipDurationSec)}s` : undefined,
      },
      {
        id: "qc",
        label: "QC Gate",
        status: timingFailed ? "blocked" : readyForReview ? "current" : "waiting",
        summary: timingFailed
          ? "Timing QC failed; rebuild or retime before publishing."
          : readyForReview
          ? "Automated package is complete; human visual QC must approve character/style lock before publishing."
          : "QC is waiting for complete art, clips, audio, and edit output.",
        count: timingFailed ? "failed" : readyForReview ? "review" : "waiting",
      },
      {
        id: "animation",
        label: "Animation",
        status: readyClips === frames.length && frames.length > 0 ? "passed" : "waiting",
        summary: readyClips === frames.length && frames.length > 0
          ? "Seedance clips were generated from the new 2D storyboard artwork."
          : "Animation is waiting for completed storyboard art.",
        count: `${readyClips}/${frames.length} clips`,
      },
      {
        id: "voice",
        label: "Voice",
        status: manifest.voice ? "passed" : "waiting",
        summary: manifest.voice
          ? "Narration audio was reused from the existing Episode 1 voiceover as requested."
          : "No voice pass found.",
        count: manifest.voice ? "reused" : "missing",
      },
      {
        id: "edit",
        label: "Edit",
        status: finalExists ? "current" : "waiting",
        summary: finalExists
          ? "Final vertical preview is assembled with reused narration and is ready for review."
          : "No assembled vertical edit found.",
        count: finalExists && probe ? `${Math.round(probe.duration)}s` : undefined,
      },
    ],
    references: referenceLock,
    package: {
      providerTarget: seedanceHandoff.providerTarget,
      aspectRatio: seedanceHandoff.aspectRatio,
      styleLock: seedanceHandoff.styleLock,
      referenceRule: seedanceHandoff.referenceRule,
      masterPrompt: seedanceHandoff.masterPrompt,
      globalNegative: seedanceHandoff.globalNegative,
      nextStep: seedanceHandoff.nextStep,
      voiceover: seedanceHandoff.voiceover,
    },
    editor: {
      status: readyForReview ? "ready_for_review" : "waiting_for_clips",
      assembler: "server/episodeOneAssembleFfmpeg.ts concatenates completed clips and muxes narration audio",
      remotionLayer: "video/compositions/OpaijaEpisodeOne.tsx adds clean title, CTA, and edit overlays outside generated artwork",
      clipsAssembled: readyClips,
      totalClips: frames.length,
      audioAttached: Boolean(manifest.voice?.path),
      finalVideoPath: finalExists ? publicVideoPath : undefined,
      note:
        timingFailed
          ? "The editor assembled the package, but timing QC failed because the final video and voiceover duration do not match."
          : readyForReview
          ? "The AI editor/assembler produced a new vertical preview from the 2D rebuild, with narration reused from the existing Episode 1 audio."
          : "The editor is ready, but it needs completed QC-approved clips before final assembly.",
    },
    finalVideo: finalExists ? { publicPath: publicVideoPath, probe } : undefined,
    voice: manifest.voice
      ? {
          ...manifest.voice,
          path: toPublicPath(manifest.voice.path),
          quality: "pending",
          note: "This rebuild reuses the existing Episode 1 narration. Keep it if the cadence works; replace it later if performance direction needs to be stronger.",
        }
      : undefined,
    timing: timingSheet
      ? {
          status: timingFailed ? "timing_failed" : "ready",
          targetWpm: timingSheet.targetWpm,
          totalDurationSec: timingSheet.totals.finalClipDurationSec,
          audioDurationSec: manifest.timingQc?.audioDurationSec ?? timingSheet.audioDurationSec,
          driftSec: manifest.timingQc?.driftSec,
          maxAudioVideoDriftSec: timingSheet.maxAudioVideoDriftSec,
          qcStatus: manifest.timingQc?.status ?? "pending",
          panels: timingSheet.panels.map((panel) => ({
            panelId: panel.panelId,
            narration: panel.narration,
            wordCount: panel.wordCount,
            finalClipDurationSec: panel.finalClipDurationSec,
            actionBeat: panel.actionBeat,
          })),
        }
      : undefined,
    qc: {
      status: timingFailed ? "failed" : readyForReview ? "pending" : "failed",
      summary: timingFailed
        ? manifest.timingQc?.message ?? "Timing QC failed; final video and voiceover do not match within 0.5 seconds."
        : readyForReview
        ? "New 2D Episode 1 rebuild is complete and stored. Human visual QC should inspect character/style lock before this becomes publishable."
        : rejectionReport?.reason ??
          "Creative QC rejected this pass. It proves the pipeline works, but it is not release-ready because action, voice performance, and text/artifact filtering need another pass.",
      blockers: timingFailed
        ? ["Do not publish this version.", "Regenerate or retime the edit so final video and voiceover differ by no more than 0.5 seconds."]
        : readyForReview ? [] : ["Do not publish this version.", ...(rejectionReport?.blockers ?? [])],
      nextFixes: timingFailed
        ? [
            "Recalculate timing-sheet.json from the exact narration audio.",
            "Regenerate or trim clips to timing-sheet.json.",
            "Reassemble the edit and confirm timing QC passes.",
          ]
        : readyForReview
        ? [
            "Review every storyboard frame for Kai, Marius, Mother Lall, Listening Bois, wardrobe, hair, weapons, and no generated lettering.",
            "Watch all 17 clips for action readability, face drift, hand errors, and unwanted text artifacts.",
            "Approve the stored preview or mark failed panels for a targeted rebuild.",
          ]
        : rejectionReport?.nextBuildRules ?? [
            "Create action-pair storyboard frames for every fight or transformation beat.",
            "Add frame QC before Seedance: block lettering, logos, poster text, weak silhouettes, and costume drift.",
            "Use a stronger voice direction script with pauses, emotion, and Caribbean cadence notes.",
            "Run the next build on the VPS once server authentication is available.",
          ],
      forbidden: referenceLock.forbidden,
      gate: timingFailed
        ? `Timing failed. Drift ${manifest.timingQc?.driftSec ?? "unknown"}s, allowed ${manifest.timingQc?.maxAudioVideoDriftSec ?? 0.5}s.`
        : readyForReview
        ? `Package complete: ${actionReady} action-board panels, ${readyArt} artwork frames, ${readyClips} clips, reused audio, and final edit are ready for human QC.`
        : `Animation is blocked until ${actionReady} action-board panels and all ${frames.length} storyboard frames pass character/style/no-text QC.`,
    },
    frames,
  };
}

function buildFrames(
  manifest: Manifest,
  promptPacket?: StoryboardPromptPacket | null,
  seedanceHandoff?: SeedanceHandoff,
  actionBoard?: ActionBoard | null,
): EpisodeOneStudio["frames"] {
  const promptsByPanel = new Map((promptPacket?.frames ?? []).map((frame) => [frame.panelId, frame]));
  const handoffByPanel = new Map((seedanceHandoff?.orderedReferences ?? []).map((frame) => [frame.panelId, frame]));
  const actionByPanel = new Map((actionBoard?.panels ?? []).map((frame) => [frame.panelId, frame]));

  return manifest.frames.map((frame) => {
    const prompt = promptsByPanel.get(frame.panelId);
    const handoff = handoffByPanel.get(frame.panelId);
    const action = actionByPanel.get(frame.panelId);

    return {
      imageRef: frame.imageRef,
      panelId: frame.panelId,
      title: frame.title,
      characters: frame.characters ?? prompt?.characters ?? [],
      prompt: frame.prompt ?? prompt?.prompt ?? "",
      motion: handoff?.motion ?? frame.clip?.prompt ?? "No motion note has been written yet.",
      durationSec: handoff?.durationSec,
      camera: action?.camera,
      actionStart: action?.actionStart,
      actionImpact: action?.actionImpact,
      actionEnd: action?.actionEnd,
      emotion: action?.emotion,
      fx: action?.fx,
      qcGate: action?.qcGate,
      imagePath: frame.image?.publicPath,
      clipPath: frame.clip?.publicPath,
      clipStatus: frame.error ? "error" : frame.clip?.publicPath ? "ready" : frame.clip?.requestId ? "queued" : "missing",
      requestId: frame.clip?.requestId,
      modelId: frame.clip?.modelId,
      error: frame.error,
    };
  });
}

async function resolveLatestManifestPath() {
  const candidates = await fs.readdir(buildsRoot, { withFileTypes: true });
  const manifests = await Promise.all(
    candidates
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const manifestPath = path.join(buildsRoot, entry.name, "build-manifest.json");
        const stat = await fs.stat(manifestPath).catch(() => undefined);
        return stat ? { manifestPath, mtimeMs: stat.mtimeMs } : undefined;
      }),
  );
  const latest = manifests
    .filter((candidate): candidate is { manifestPath: string; mtimeMs: number } => Boolean(candidate))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

  if (!latest) throw new Error(`No Episode 1 manifest found in ${buildsRoot}.`);
  return latest.manifestPath;
}

async function readJson<T>(fileName: string): Promise<T | null> {
  const filePath = path.join(productionRoot, fileName);
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function toPublicPath(value?: string) {
  if (!value) return value;
  if (value.startsWith("/")) return value;
  const normalized = value.replace(/\\/g, "/");
  const publicIndex = normalized.lastIndexOf("/public/");
  return publicIndex >= 0 ? normalized.slice(publicIndex + "/public".length) : value;
}

function sourceLinks() {
  return [
    { label: "Modeled workflow: Higgsfield Seedance", href: "https://higgsfield.ai/seedance-intro" },
    { label: "Provider docs reference", href: "https://higgsfieldapi.com/documentation.php" },
    { label: "Storyboard-to-video workflow video", href: "https://youtu.be/Is4wgEpPMJQ?si=WXt1M9Nkis5SLwF4" },
  ];
}

function missingStageFlow(): EpisodeOneStudio["stageFlow"] {
  return [
    {
      id: "script",
      label: "Script",
      status: "waiting",
      summary: "No run manifest found.",
    },
    {
      id: "storyboard",
      label: "Storyboard",
      status: "waiting",
      summary: "Run the builder to create the storyboard package.",
    },
  ];
}

function fallbackPackage(): EpisodeOneStudio["package"] {
  const seedance = fallbackSeedanceHandoff();
  return {
    providerTarget: seedance.providerTarget,
    aspectRatio: seedance.aspectRatio,
    styleLock: seedance.styleLock,
    referenceRule: seedance.referenceRule,
    masterPrompt: seedance.masterPrompt,
    globalNegative: seedance.globalNegative,
    nextStep: seedance.nextStep,
    voiceover: seedance.voiceover,
  };
}

function fallbackReferenceLock(): ReferenceLock {
  return {
    status: "fallback",
    styleSource: "Current approved OPAIJA character/model sheets",
    globalStyleLock:
      "2D Caribbean anime model-sheet style, clean black ink, bright Caribbean palette, readable silhouettes, no generated text.",
    forbidden: ["no text", "no character drift", "no costume drift", "no weak action", "no reference-sheet grids"],
    characters: [
      {
        id: "kairo-kai-baptiste",
        name: "Kairo Kai Baptiste",
        referencePath: "/assets/characters/kairo-kai-baptiste.png",
        locks: ["black sleeveless hoodie", "red/orange sash", "Listening Bois", "seed pendant"],
      },
    ],
  };
}

function fallbackSeedanceHandoff(): SeedanceHandoff {
  return {
    status: "fallback",
    providerTarget: "fal/Seedance 2.0 reference-to-video",
    aspectRatio: "9:16",
    styleLock: "Locked OPAIJA 2D Caribbean anime model-sheet style.",
    referenceRule: "Generate clean storyboard frames first; use model sheets only as identity references.",
    globalNegative: ["no text", "no character drift", "no weak action"],
    masterPrompt:
      "Animate ordered OPAIJA storyboard frames as a fast-paced Caribbean anime sequence with exact character preservation.",
    orderedReferences: [],
    voiceover: [],
    nextStep: "Create approved storyboard frames, then send the ordered frames to Seedance/fal.",
  };
}
