import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { createGeneratedVideoClip, createKeyframeImage, resolveGeneratedVideoClip, type ImageProviderResult, type VideoProviderResult } from "./mediaProviders.js";
import { resolveReferenceAssetUrl } from "./referenceAssets.js";
import { createVoiceover, type VoiceJobResponse } from "./voice.js";
import { registerEpisodeBuildContent } from "./contentStorage.js";
import {
  assertTimingSheetComplete,
  createAnimeTimingSheet,
  getTimingForPanel,
  syncTimingSheetToAudioDuration,
  writeTimingSheet,
  type AnimeTimingSheet,
  type TimingActionPanel,
} from "./animeTiming.js";
import { probeMediaDuration } from "./videoProbe.js";

dotenv.config();

type FramePrompt = {
  imageRef: string;
  panelId: string;
  title: string;
  characters: string[];
  prompt: string;
};

type FramePromptPacket = {
  project: string;
  episode: string;
  styleLock: string;
  negativePrompt: string;
  modelSheetReferences: string[];
  frames: FramePrompt[];
};

type SeedanceReference = {
  imageRef: string;
  panelId: string;
  title: string;
  durationSec: number;
  motion: string;
};

type SeedanceHandoff = {
  masterPrompt: string;
  orderedReferences: SeedanceReference[];
  voiceover: string[];
};

type ActionBoard = {
  panels: TimingActionPanel[];
};

type ReferenceLock = {
  globalStyleLock: string;
  forbidden: string[];
  styleReferencePaths?: string[];
  qualityReference?: {
    chatGptBibleSheets?: string[];
    premiumActionFrames?: string[];
  };
  characters: Array<{
    id: string;
    name: string;
    referencePath: string;
    locks: string[];
  }>;
};

type BuiltFrame = FramePrompt & {
  image?: ImageProviderResult;
  referenceUrl?: string;
  clip?: VideoProviderResult;
  error?: string;
};

type EpisodeBuildManifest = {
  id: string;
  status: "running" | "frames-ready" | "clips-queued" | "completed" | "failed" | "timing_failed";
  startedAt: string;
  updatedAt: string;
  sourceDir: string;
  outputDir: string;
  providerMode: "live";
  timingSheetPath?: string;
  timing?: AnimeTimingSheet;
  voice?: VoiceJobResponse;
  frames: BuiltFrame[];
  error?: string;
};

const sourceDir = path.resolve(process.cwd(), "ops", "production", "season-one", "episode-01-the-first-pulse");
const buildId = `episode-01-real-build-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const outputDir = path.resolve(process.cwd(), "out", "episode-builds", "season-one", "episode-01-the-first-pulse", buildId);
const manifestPath = path.join(outputDir, "build-manifest.json");
const waitForClips = process.env.EPISODE_BUILD_WAIT_FOR_CLIPS === "true";
const frameLimit = Number(process.env.EPISODE_BUILD_MAX_FRAMES ?? 17);
const selectedPanelIds = new Set(
  (process.env.EPISODE_BUILD_PANEL_IDS ?? "")
    .split(",")
    .map((panelId) => panelId.trim())
    .filter(Boolean),
);
const frameConcurrency = Number(process.env.EPISODE_BUILD_FRAME_CONCURRENCY ?? 2);
const clipConcurrency = Number(process.env.EPISODE_BUILD_CLIP_CONCURRENCY ?? 2);
const reuseVoicePath = process.env.EPISODE_REUSE_VOICE_PATH;

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  process.env.REFERENCE_ASSET_HOST = process.env.REFERENCE_ASSET_HOST ?? "fal";
  process.env.VIDEO_PROVIDER = process.env.VIDEO_PROVIDER ?? "fal";
  process.env.VIDEO_CLIP_PROVIDER = process.env.VIDEO_CLIP_PROVIDER ?? "seedance";

  const framePacket = await readJson<FramePromptPacket>(path.join(sourceDir, "storyboard-frame-prompts.json"));
  const seedance = await readJson<SeedanceHandoff>(path.join(sourceDir, "seedance-handoff.json"));
  const actionBoard = await readJson<ActionBoard>(path.join(sourceDir, "storyboard-action-board.json"));
  const referenceLock = await readJson<ReferenceLock>(path.join(sourceDir, "reference-lock.json"));
  const selectedFrames = selectedPanelIds.size
    ? framePacket.frames.filter((frame) => selectedPanelIds.has(frame.panelId))
    : framePacket.frames.slice(0, frameLimit);
  if (!selectedFrames.length) {
    throw new Error(`No storyboard frames matched EPISODE_BUILD_PANEL_IDS=${Array.from(selectedPanelIds).join(",")}.`);
  }
  let timing = createAnimeTimingSheet({
    references: seedance.orderedReferences.filter((reference) => selectedFrames.some((frame) => frame.panelId === reference.panelId)),
    voiceover: seedance.voiceover,
    actionPanels: actionBoard.panels,
    source: "ops/production/season-one/episode-01-the-first-pulse/seedance-handoff.json",
  });
  assertTimingSheetComplete(timing, selectedFrames.map((frame) => frame.panelId));
  const timingSheetPath = path.join(outputDir, "timing-sheet.json");
  const manifest: EpisodeBuildManifest = {
    id: buildId,
    status: "running",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceDir,
    outputDir,
    providerMode: "live",
    timing,
    timingSheetPath,
    frames: selectedFrames.map((frame) => ({ ...frame })),
  };
  await writeTimingSheet(timingSheetPath, timing);
  await writeManifest(manifest);

  try {
    manifest.voice = reuseVoicePath ? createReusedVoice(reuseVoicePath) : await createVoiceover({
      text: seedance.voiceover.join("\n\n"),
      fileName: `${buildId}-narrator.mp3`,
    });
    const audioDuration = await resolveVoiceDuration(manifest.voice).catch(() => undefined);
    if (audioDuration) {
      timing = syncTimingSheetToAudioDuration(timing, audioDuration);
      assertTimingSheetComplete(timing, selectedFrames.map((frame) => frame.panelId));
      manifest.timing = timing;
      await writeTimingSheet(timingSheetPath, timing);
    }
    await writeManifest(touch(manifest));

    manifest.frames = await mapLimit(manifest.frames, frameConcurrency, async (frame) => buildFrameArt(frame, framePacket, referenceLock));
    manifest.status = "frames-ready";
    await writeManifest(touch(manifest));

    manifest.frames = await mapLimit(manifest.frames, clipConcurrency, async (frame) => {
      if (!frame.image?.outputPath || !frame.referenceUrl) return frame;
      const ref = seedance.orderedReferences.find((candidate) => candidate.panelId === frame.panelId);
      return buildSeedanceClip(frame, ref, timing, seedance.masterPrompt);
    });
    manifest.status = waitForClips ? "completed" : "clips-queued";
    await writeManifest(touch(manifest));
    await registerEpisodeBuildContent({
      id: manifest.id,
      title: "Episode 1: The First Pulse - 2D Artwork Rebuild",
      buildId: manifest.id,
      episode: "01 - The First Pulse",
      status: manifest.status === "completed" ? "needs_review" : "draft",
      style: framePacket.styleLock,
      notes: [
        "New rebuild uses the locked 2D Caribbean anime model-sheet style.",
        reuseVoicePath ? `Reused existing narration audio: ${reuseVoicePath}` : "Generated a new narration scratch file.",
        "Artwork still requires human visual QC before publish.",
      ],
      assets: [
        { type: "manifest", label: "Build manifest", filePath: manifestPath },
        ...(manifest.voice?.path ? [{ type: "audio" as const, label: "Narration audio", publicPath: manifest.voice.path }] : []),
        ...(manifest.timingSheetPath ? [{ type: "timing" as const, label: "Narration timing sheet", filePath: manifest.timingSheetPath }] : []),
        ...manifest.frames.flatMap((frame) => [
          ...(frame.image?.publicPath ? [{ type: "image" as const, label: `${frame.panelId} ${frame.title}`, publicPath: frame.image.publicPath }] : []),
          ...(frame.clip?.publicPath ? [{ type: "clip" as const, label: `${frame.panelId} ${frame.title}`, publicPath: frame.clip.publicPath }] : []),
        ]),
      ],
    });
    console.log(JSON.stringify({ ok: true, id: manifest.id, status: manifest.status, outputDir, manifestPath }, null, 2));
  } catch (error) {
    manifest.status = "failed";
    manifest.error = error instanceof Error ? error.message : "Episode build failed.";
    await writeManifest(touch(manifest));
    console.error(JSON.stringify({ ok: false, id: manifest.id, error: manifest.error, outputDir, manifestPath }, null, 2));
    process.exitCode = 1;
  }
}

function createReusedVoice(publicPath: string): VoiceJobResponse {
  return {
    provider: "mock",
    status: "created",
    path: publicPath,
    fileName: path.basename(publicPath),
    characterCount: 0,
  } as VoiceJobResponse;
}

async function buildFrameArt(frame: BuiltFrame, packet: FramePromptPacket, referenceLock: ReferenceLock): Promise<BuiltFrame> {
  try {
    const characterRefs = resolveFrameCharacterRefs(frame, referenceLock);
    const referenceImagePaths = [
      ...characterRefs.map((character) => toLocalPublicPath(character.referencePath)),
      ...resolveStyleReferencePaths(referenceLock),
    ];
    const image = await createKeyframeImage({
      fileName: `${buildId}-${frame.panelId}.png`,
      prompt: [
        "CRITICAL STYLE LOCK: use the supplied ChatGPT OPAIJA bible sheet images as the visual source of truth, not a generic anime interpretation.",
        "Match the bible sheet style exactly: premium 2D Trini/Caribbean anime, clean confident black ink, flat cel-shaded animated-series color, warm brown skin tones, expressive Caribbean facial structure, rounded chins, full lips, broad African/Caribbean nose language, and Trinidad/Tobago street energy.",
        "For action frames, upgrade the same bible-sheet look into a premium dark cinematic trailer finish: charcoal/brown environment, controlled gold/orange Opaija energy, warm rim light, staff lightning, impact sparks, flying debris, cracked ground, dramatic shadows, kinetic martial posing, sharp anime/comic finish, expensive franchise-ready contrast.",
        "Weapon/framing safety is mandatory: show the complete staff or bois tip-to-tip inside the frame, keep all hands and feet visible unless the panel explicitly says close-up, leave at least 10 percent clean safe margin around weapon tips, and never crop Kai's staff, pendant, face, loc silhouette, or sash.",
        "This is not generic anime, not pseudo-3D, not plastic, not photoreal, not painterly fantasy art. It must look like it was drawn from the exact OPAIJA bible sheets.",
        "Do not generate baked title text, signage, labels, subtitles, UI, or logos inside the artwork; title and CTA are added later in the editor layer.",
        referenceLock.globalStyleLock,
        packet.styleLock,
        `Panel ${frame.panelId}: ${frame.title}.`,
        `Characters: ${frame.characters.join(", ")}.`,
        `Exact bible character locks to preserve: ${characterRefs.map((character) => `${character.name}: ${character.locks.join(", ")}`).join(" | ")}.`,
        frame.prompt,
        `Approved visual reference image files supplied to the provider: ${referenceImagePaths.map((referencePath) => path.relative(process.cwd(), referencePath)).join(", ")}.`,
        `Negative constraints: ${packet.negativePrompt}. ${referenceLock.forbidden.join(" ")}`,
      ].join("\n"),
      referenceImagePaths,
    });
    if (image.status === "dry_run" || !image.outputPath) return { ...frame, image, error: undefined };
    const referenceUrl = await resolveReferenceAssetUrl({ outputPath: image.outputPath, publicPath: image.publicPath });
    return { ...frame, image, referenceUrl };
  } catch (error) {
    return { ...frame, error: error instanceof Error ? error.message : "Frame generation failed." };
  }
}

function resolveStyleReferencePaths(referenceLock: ReferenceLock) {
  const fromQualityReference = [
    ...(referenceLock.qualityReference?.chatGptBibleSheets ?? []),
    ...(referenceLock.qualityReference?.premiumActionFrames ?? []),
  ];
  const paths = [...(referenceLock.styleReferencePaths ?? []), ...fromQualityReference];
  return paths.map(toLocalPublicPath);
}

function resolveFrameCharacterRefs(frame: BuiltFrame, referenceLock: ReferenceLock) {
  const tags = [frame.title, ...frame.characters, frame.prompt].join(" ").toLowerCase();
  const matches = referenceLock.characters.filter((character) => {
    const name = character.name.toLowerCase();
    const id = character.id.toLowerCase();
    const shortNames = [
      name,
      id,
      ...name.split(/\s+/),
      id.replace(/-/g, " "),
      character.name.includes("Kai") ? "kai" : "",
      character.name.includes("Jabs") ? "jabs" : "",
      character.name.includes("Mother Lall") ? "mother lall" : "",
      character.name.includes("Marius") ? "marius" : "",
      character.name.includes("Malik") ? "malik" : "",
      character.name.includes("Asha") ? "asha" : "",
      character.name.includes("Nia") ? "nia" : "",
      character.name.includes("Papa") ? "papa" : "",
      character.name.includes("Selah") ? "selah" : "",
      character.name.includes("Tariq") ? "tariq" : "",
    ].filter(Boolean);
    return shortNames.some((candidate) => tags.includes(candidate.toLowerCase()));
  });

  if (matches.length) return matches.slice(0, 4);
  const kai = referenceLock.characters.find((character) => character.id === "kairo-kai-baptiste");
  return kai ? [kai] : referenceLock.characters.slice(0, 1);
}

function toLocalPublicPath(publicPath: string) {
  return path.resolve(process.cwd(), "public", publicPath.replace(/^\/+/, ""));
}

async function buildSeedanceClip(
  frame: BuiltFrame,
  reference: SeedanceReference | undefined,
  timing: AnimeTimingSheet,
  masterPrompt: string,
): Promise<BuiltFrame> {
  try {
    const panelTiming = getTimingForPanel(timing, frame.panelId);
    if (!panelTiming) throw new Error(`Missing timing sheet row for ${frame.panelId}.`);
    const prompt = [
      masterPrompt,
      `Current shot: ${frame.panelId} - ${frame.title}.`,
      `Narration beat: ${panelTiming.narration}.`,
      `Timed action beat: ${panelTiming.actionBeat}.`,
      `Motion: ${reference?.motion ?? "Controlled cinematic motion with readable character acting."}`,
      `Target final edit length: ${panelTiming.finalClipDurationSec}s from timing-sheet.json.`,
      "Preserve the exact character identity, face, hair, outfit, props, weapon, skin tone, and style from the reference image.",
      "Do not generate text. Do not morph the character. Keep action readable.",
    ].join("\n");
    const clip = await createGeneratedVideoClip({
      mode: "image-to-video",
      imageUrl: frame.referenceUrl,
      prompt,
      duration: toSeedanceDuration(panelTiming.finalClipDurationSec),
      resolution: "720p",
      aspectRatio: "9:16",
      generateAudio: false,
      fast: true,
    });
    const resolvedClip = waitForClips ? await resolveGeneratedVideoClip({ job: clip, fileName: `${buildId}-${frame.panelId}.mp4` }) : clip;
    return { ...frame, clip: resolvedClip };
  } catch (error) {
    return { ...frame, error: error instanceof Error ? error.message : "Seedance clip failed." };
  }
}

function toSeedanceDuration(durationSec: number): `${number}` {
  return String(Math.min(15, Math.max(4, Math.round(durationSec)))) as `${number}`;
}

async function resolveVoiceDuration(voice: VoiceJobResponse) {
  if (!voice.path) return undefined;
  const localPath = path.resolve(process.cwd(), "public", voice.path.replace(/^\/+/, ""));
  return probeMediaDuration(localPath);
}

function touch(manifest: EpisodeBuildManifest) {
  return { ...manifest, updatedAt: new Date().toISOString() };
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

async function writeManifest(manifest: EpisodeBuildManifest) {
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function mapLimit<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

main();
