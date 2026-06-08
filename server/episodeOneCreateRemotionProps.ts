import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { assertTimingSheetComplete, getTimingForPanel, type AnimeTimingSheet } from "./animeTiming.js";

dotenv.config();

type Frame = {
  panelId: string;
  title: string;
  clip?: {
    publicPath?: string;
  };
};

type Manifest = {
  id: string;
  timingSheetPath?: string;
  timing?: AnimeTimingSheet;
  voice?: {
    path?: string;
  };
  frames: Frame[];
};

type SeedanceReference = {
  panelId: string;
  durationSec: number;
};

type SeedanceHandoff = {
  orderedReferences: SeedanceReference[];
};

const sourceDir = path.resolve(process.cwd(), "ops", "production", "season-one", "episode-01-the-first-pulse");
const buildsRoot = path.resolve(process.cwd(), "out", "episode-builds", "season-one", "episode-01-the-first-pulse");

async function main() {
  const manifestPath = await resolveManifestPath();
  const manifest = await readJson<Manifest>(manifestPath);
  const seedance = await readJson<SeedanceHandoff>(path.join(sourceDir, "seedance-handoff.json"));
  const timing = manifest.timing ?? (await readJson<AnimeTimingSheet>(manifest.timingSheetPath ?? path.join(sourceDir, "timing-sheet.json")));
  assertTimingSheetComplete(timing, manifest.frames.map((frame) => frame.panelId));

  const scenes = manifest.frames.map((frame) => {
    const reference = seedance.orderedReferences.find((candidate) => candidate.panelId === frame.panelId);
    const panelTiming = getTimingForPanel(timing, frame.panelId);
    if (!frame.clip?.publicPath) throw new Error(`Frame ${frame.panelId} does not have a completed clip.`);
    return {
      panelId: frame.panelId,
      title: frame.title,
      clipPath: frame.clip.publicPath,
      narration: panelTiming?.narration ?? "",
      actionBeat: panelTiming?.actionBeat ?? reference?.panelId ?? "",
      durationInFrames: Math.round((panelTiming?.finalClipDurationSec ?? reference?.durationSec ?? 4) * 30),
    };
  });

  const props = {
    episodeTitle: "The First Pulse",
    tagline: "The rhythm has awakened.",
    cta: "Join the founder list at opaija.com",
    timingSheet: {
      targetWpm: timing.targetWpm,
      wordsPerSecond: timing.wordsPerSecond,
      totalDurationSec: timing.totals.finalClipDurationSec,
      maxAudioVideoDriftSec: timing.maxAudioVideoDriftSec,
    },
    audioPath: manifest.voice?.path ?? "",
    scenes,
  };

  const outputDir = path.resolve(process.cwd(), "out", "episode-builds", "season-one", "episode-01-the-first-pulse", manifest.id);
  const outputPath = path.join(outputDir, "remotion-props.json");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(props, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ ok: true, outputPath, scenes: scenes.length, durationInFrames: scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0) }, null, 2));
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

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
