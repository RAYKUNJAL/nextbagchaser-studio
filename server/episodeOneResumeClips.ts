import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { createGeneratedVideoClip, type ImageProviderResult, type VideoProviderResult } from "./mediaProviders.js";
import { resolveReferenceAssetUrl } from "./referenceAssets.js";
import { assertTimingSheetComplete, getTimingForPanel, type AnimeTimingSheet } from "./animeTiming.js";

dotenv.config();

type FramePrompt = {
  imageRef: string;
  panelId: string;
  title: string;
  characters: string[];
  prompt: string;
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
  updatedAt: string;
  sourceDir: string;
  outputDir: string;
  timingSheetPath?: string;
  timing?: AnimeTimingSheet;
  frames: BuiltFrame[];
};

const sourceDir = path.resolve(process.cwd(), "ops", "production", "season-one", "episode-01-the-first-pulse");
const buildsRoot = path.resolve(process.cwd(), "out", "episode-builds", "season-one", "episode-01-the-first-pulse");
const clipConcurrency = Number(process.env.EPISODE_BUILD_CLIP_CONCURRENCY ?? 1);

async function main() {
  process.env.REFERENCE_ASSET_HOST = process.env.REFERENCE_ASSET_HOST ?? "fal";
  process.env.VIDEO_PROVIDER = process.env.VIDEO_PROVIDER ?? "fal";
  process.env.VIDEO_CLIP_PROVIDER = process.env.VIDEO_CLIP_PROVIDER ?? "seedance";

  const manifestPath = await resolveManifestPath();
  const seedance = await readJson<SeedanceHandoff>(path.join(sourceDir, "seedance-handoff.json"));
  const manifest = await readJson<EpisodeBuildManifest>(manifestPath);
  const timing = manifest.timing ?? (await readJson<AnimeTimingSheet>(manifest.timingSheetPath ?? path.join(sourceDir, "timing-sheet.json")));
  assertTimingSheetComplete(timing, manifest.frames.map((frame) => frame.panelId));
  manifest.timing = timing;

  manifest.frames = await mapLimit(manifest.frames, clipConcurrency, async (frame) => {
    if (frame.clip?.requestId && !frame.error) return frame;

    const localImagePath = await resolveLocalImagePath(manifest.id, frame.panelId);
    if (!localImagePath) {
      return { ...frame, error: `No generated keyframe found for ${frame.panelId}.` };
    }

    const image =
      frame.image ??
      ({
        provider: "openai",
        status: "created",
        prompt: frame.prompt,
        outputPath: localImagePath,
        publicPath: `/generated/keyframes/${path.basename(localImagePath)}`,
      } satisfies ImageProviderResult);

    const referenceUrl = frame.referenceUrl ?? (await withRetries(() => resolveReferenceAssetUrl({ outputPath: image.outputPath, publicPath: image.publicPath })));
    if (!referenceUrl) return { ...frame, image, error: `No reference URL could be created for ${frame.panelId}.` };

    const ref = seedance.orderedReferences.find((candidate) => candidate.panelId === frame.panelId);
    const clip = await withRetries(() => buildSeedanceClip(frame, referenceUrl, ref, timing));
    return { ...frame, image, referenceUrl, clip, error: undefined };
  });

  manifest.status = "clips-queued";
  manifest.updatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        manifestPath,
        clipsQueued: manifest.frames.filter((frame) => frame.clip?.requestId).length,
        missingClips: manifest.frames.filter((frame) => !frame.clip?.requestId).length,
      },
      null,
      2,
    ),
  );
}

async function buildSeedanceClip(
  frame: BuiltFrame,
  referenceUrl: string,
  reference: SeedanceReference | undefined,
  timing: AnimeTimingSheet,
) {
  const panelTiming = getTimingForPanel(timing, frame.panelId);
  if (!panelTiming) throw new Error(`Missing timing sheet row for ${frame.panelId}.`);
  const prompt = [
    `Animate this OPAIJA storyboard frame as 2D Caribbean anime.`,
    `Shot ${frame.panelId}: ${frame.title}.`,
    `Narration beat: ${panelTiming.narration}.`,
    `Timed action beat: ${panelTiming.actionBeat}.`,
    `Motion: ${reference?.motion ?? "Controlled cinematic motion with readable character acting."}`,
    `Target final edit length: ${panelTiming.finalClipDurationSec}s from timing-sheet.json.`,
    "Preserve the exact face, hair, outfit, weapon, skin tone, flat cel-shaded 2D style, and silhouette from the image.",
    "No text. No morphing. No pseudo-3D. No painterly look. Keep the action readable.",
  ].join("\n");

  return createGeneratedVideoClip({
    mode: "image-to-video",
    imageUrl: referenceUrl,
    prompt,
    duration: toSeedanceDuration(panelTiming.finalClipDurationSec),
    resolution: "720p",
    aspectRatio: "9:16",
    generateAudio: false,
    fast: true,
  });
}

function toSeedanceDuration(durationSec: number): `${number}` {
  return String(Math.min(15, Math.max(4, Math.round(durationSec)))) as `${number}`;
}

async function resolveManifestPath() {
  if (process.env.EPISODE_BUILD_MANIFEST) return path.resolve(process.cwd(), process.env.EPISODE_BUILD_MANIFEST);

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

  if (!latest) throw new Error(`No episode build manifest found in ${buildsRoot}.`);
  return latest.manifestPath;
}

async function resolveLocalImagePath(buildId: string, panelId: string) {
  const safeName = `${buildId}-${panelId}.png`.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  const outputPath = path.resolve(process.cwd(), "public", "generated", "keyframes", safeName);
  const stat = await fs.stat(outputPath).catch(() => undefined);
  return stat?.isFile() ? outputPath : undefined;
}

async function withRetries<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw lastError;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
