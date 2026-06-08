import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveGeneratedVideoClip, type VideoProviderResult } from "./mediaProviders.js";
import { getFalJobStatus } from "./seedance.js";

dotenv.config();

type BuiltFrame = {
  panelId: string;
  title: string;
  clip?: VideoProviderResult;
  error?: string;
};

type EpisodeBuildManifest = {
  id: string;
  status: "running" | "frames-ready" | "clips-queued" | "completed" | "failed";
  updatedAt: string;
  frames: BuiltFrame[];
};

const buildsRoot = path.resolve(process.cwd(), "out", "episode-builds", "season-one", "episode-01-the-first-pulse");
const clipConcurrency = Number(process.env.EPISODE_RESOLVE_CLIP_CONCURRENCY ?? 2);

async function main() {
  const manifestPath = await resolveManifestPath();
  const manifest = await readJson<EpisodeBuildManifest>(manifestPath);

  manifest.frames = await mapLimit(manifest.frames, clipConcurrency, async (frame) => {
    if (!frame.clip?.requestId || frame.clip.outputPath) return frame;
    try {
      const status = frame.clip.provider === "seedance" ? await getFalJobStatus(frame.clip.modelId, frame.clip.requestId) : undefined;
      const state = readStatus(status);
      if (state && !isCompleteState(state)) {
        return { ...frame, clip: { ...frame.clip, input: { ...frame.clip.input, providerStatus: status } } };
      }

      const clip = await resolveGeneratedVideoClip({
        job: frame.clip,
        fileName: `${manifest.id}-${frame.panelId}.mp4`,
      });
      return { ...frame, clip, error: undefined };
    } catch (error) {
      return { ...frame, error: error instanceof Error ? error.message : "Clip resolution failed." };
    }
  });

  const completed = manifest.frames.filter((frame) => frame.clip?.outputPath).length;
  const queued = manifest.frames.filter((frame) => frame.clip?.requestId && !frame.clip.outputPath).length;
  manifest.status = completed === manifest.frames.length ? "completed" : "clips-queued";
  manifest.updatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ ok: true, manifestPath, status: manifest.status, completed, queued }, null, 2));
}

function readStatus(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return String(record.status ?? record.state ?? "").toUpperCase();
}

function isCompleteState(status: string) {
  return status === "COMPLETED" || status === "COMPLETE" || status === "SUCCEEDED" || status === "SUCCESS";
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
