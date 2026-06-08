import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { registerEpisodeBuildContent } from "./contentStorage.js";
import { assertTimingSheetComplete, getTimingForPanel, type AnimeTimingSheet } from "./animeTiming.js";
import { probeMediaDuration, probeVideo } from "./videoProbe.js";

dotenv.config();

type Frame = {
  panelId: string;
  title: string;
  clip?: {
    outputPath?: string;
    publicPath?: string;
  };
};

type Manifest = {
  id: string;
  status?: "running" | "frames-ready" | "clips-queued" | "completed" | "failed" | "timing_failed";
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
    outputPath: string;
    publicPath: string;
  };
  voice?: {
    path?: string;
  };
  frames: Array<
    Frame & {
      image?: {
        publicPath?: string;
      };
    }
  >;
};

const buildsRoot = path.resolve(process.cwd(), "out", "episode-builds", "season-one", "episode-01-the-first-pulse");
const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string | null;

async function main() {
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide an ffmpeg binary.");
  const manifestPath = await resolveManifestPath();
  const manifest = await readJson<Manifest>(manifestPath);
  const outputDir = path.resolve(process.cwd(), "out", "episode-builds", "season-one", "episode-01-the-first-pulse", manifest.id);
  const concatPath = path.join(outputDir, "episode-01-concat.txt");
  const outputPath = path.resolve(process.cwd(), "out", "episode-01-the-first-pulse.mp4");
  const publicFileName = `${manifest.id.toLowerCase()}-episode-01-the-first-pulse.mp4`;
  const publicOutputPath = path.resolve(process.cwd(), "public", "generated", "videos", publicFileName);
  const publicLatestPath = path.resolve(process.cwd(), "public", "generated", "videos", "episode-01-the-first-pulse-latest-2d.mp4");
  const publicPath = `/generated/videos/${publicFileName}`;
  const audioPath = manifest.voice?.path ? path.resolve(process.cwd(), "public", manifest.voice.path.replace(/^\/+/, "")) : undefined;
  const timing = manifest.timing ?? (await readJson<AnimeTimingSheet>(manifest.timingSheetPath ?? path.join(sourceDir(), "timing-sheet.json")));
  assertTimingSheetComplete(timing, manifest.frames.map((frame) => frame.panelId));

  const clipPaths = await Promise.all(manifest.frames.map(async (frame) => {
    if (!frame.clip?.outputPath) throw new Error(`Frame ${frame.panelId} is missing a completed clip.`);
    const panelTiming = getTimingForPanel(timing, frame.panelId);
    if (!panelTiming) throw new Error(`Frame ${frame.panelId} is missing timing-sheet duration.`);
    return normalizeClipToTiming(frame.clip.outputPath, outputDir, frame.panelId, panelTiming.finalClipDurationSec);
  }));

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(concatPath, clipPaths.map((clipPath) => `file '${escapeConcatPath(clipPath)}'`).join("\n") + "\n", "utf8");

  const args = [
    "-y",
    "-hide_banner",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
  ];

  if (audioPath) {
    args.push("-i", audioPath, "-map", "0:v:0", "-map", "1:a:0");
  } else {
    args.push("-map", "0:v:0");
  }

  args.push(
    "-vf",
    "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1",
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
  );

  if (audioPath) args.push("-af", "apad", "-c:a", "aac", "-b:a", "160k", "-shortest");
  args.push("-movflags", "+faststart", outputPath);

  await run(ffmpegPath, args);
  const finalProbe = await probeVideo(outputPath);
  const audioDuration = audioPath ? await probeMediaDuration(audioPath).catch(() => undefined) : undefined;
  const drift = audioDuration ? Math.abs(finalProbe.duration - audioDuration) : undefined;
  const timingPassed = audioDuration ? drift !== undefined && drift <= timing.maxAudioVideoDriftSec : false;
  await fs.mkdir(path.dirname(publicOutputPath), { recursive: true });
  await fs.copyFile(outputPath, publicOutputPath);
  await fs.copyFile(outputPath, publicLatestPath);
  manifest.finalVideo = {
    outputPath,
    publicPath,
  };
  manifest.timing = timing;
  manifest.timingQc = {
    status: audioDuration ? (timingPassed ? "passed" : "timing_failed") : "missing_audio",
    plannedDurationSec: timing.totals.finalClipDurationSec,
    finalVideoDurationSec: finalProbe.duration,
    audioDurationSec: audioDuration,
    driftSec: drift,
    maxAudioVideoDriftSec: timing.maxAudioVideoDriftSec,
    message: audioDuration
      ? timingPassed
        ? "Final video duration matches voiceover within the allowed drift."
        : "Final video duration does not match voiceover within the allowed drift."
      : "No voiceover duration was available for timing QC.",
  };
  if (manifest.timingQc.status === "timing_failed") manifest.status = "timing_failed";
  manifest.updatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await registerEpisodeBuildContent({
    id: manifest.id,
    title: "Episode 1: The First Pulse - 2D Rebuild Final",
    buildId: manifest.id,
    episode: "01 - The First Pulse",
    status: manifest.timingQc.status === "timing_failed" ? "rejected" : "needs_review",
    style: "2D Caribbean anime model-sheet style",
    notes: [
      "Final vertical video assembled from the current rebuild clips.",
      "Narration audio is reused from the existing Episode 1 narration file.",
      `Timing QC: ${manifest.timingQc.status}. Planned ${manifest.timingQc.plannedDurationSec}s, final ${manifest.timingQc.finalVideoDurationSec}s, audio ${manifest.timingQc.audioDurationSec ?? "missing"}s.`,
      "Human visual QC is still required before publish.",
    ],
    assets: [
      { type: "video", label: "Final vertical preview", publicPath },
      { type: "video", label: "Latest 2D preview alias", publicPath: "/generated/videos/episode-01-the-first-pulse-latest-2d.mp4" },
      { type: "manifest", label: "Build manifest", filePath: manifestPath },
      ...(manifest.timingSheetPath ? [{ type: "timing" as const, label: "Narration timing sheet", filePath: manifest.timingSheetPath }] : []),
      ...(manifest.voice?.path ? [{ type: "audio" as const, label: "Narration audio", publicPath: manifest.voice.path }] : []),
      ...manifest.frames.flatMap((frame) => [
        ...(frame.image?.publicPath ? [{ type: "image" as const, label: `${frame.panelId} ${frame.title}`, publicPath: frame.image.publicPath }] : []),
        ...(frame.clip?.outputPath ? [{ type: "clip" as const, label: `${frame.panelId} ${frame.title}`, publicPath: frame.clip.publicPath }] : []),
      ]),
    ],
  });

  const stat = await fs.stat(outputPath);
  console.log(
    JSON.stringify(
      { ok: true, outputPath, publicOutputPath, publicPath, bytes: stat.size, clips: clipPaths.length, audioPath, timingQc: manifest.timingQc },
      null,
      2,
    ),
  );
}

function escapeConcatPath(value: string) {
  return path.resolve(value).replace(/\\/g, "/").replace(/'/g, "'\\''");
}

async function normalizeClipToTiming(inputPath: string, outputDir: string, panelId: string, durationSec: number) {
  const timedDir = path.join(outputDir, "timed-clips");
  await fs.mkdir(timedDir, { recursive: true });
  const outputPath = path.join(timedDir, `${panelId.toLowerCase()}-${durationSec.toFixed(2)}s.mp4`);
  await run(ffmpegPath!, [
    "-y",
    "-hide_banner",
    "-stream_loop",
    "-1",
    "-i",
    inputPath,
    "-t",
    String(durationSec),
    "-an",
    "-vf",
    "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    outputPath,
  ]);
  return outputPath;
}

function sourceDir() {
  return path.resolve(process.cwd(), "ops", "production", "season-one", "episode-01-the-first-pulse");
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

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} exited with code ${code}.`));
    });
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
