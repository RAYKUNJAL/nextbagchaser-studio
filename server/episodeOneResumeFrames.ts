import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { createKeyframeImage, type ImageProviderResult } from "./mediaProviders.js";
import { resolveReferenceAssetUrl } from "./referenceAssets.js";

dotenv.config();

type FramePrompt = {
  imageRef: string;
  panelId: string;
  title: string;
  characters: string[];
  prompt: string;
};

type FramePromptPacket = {
  styleLock: string;
  negativePrompt: string;
  modelSheetReferences: string[];
  frames: FramePrompt[];
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
  clip?: {
    requestId?: string;
  };
  error?: string;
};

type EpisodeBuildManifest = {
  id: string;
  status: "running" | "frames-ready" | "clips-queued" | "completed" | "failed";
  updatedAt: string;
  frames: BuiltFrame[];
};

const sourceDir = path.resolve(process.cwd(), "ops", "production", "season-one", "episode-01-the-first-pulse");
const buildsRoot = path.resolve(process.cwd(), "out", "episode-builds", "season-one", "episode-01-the-first-pulse");
const frameConcurrency = Number(process.env.EPISODE_BUILD_FRAME_CONCURRENCY ?? 1);

async function main() {
  const manifestPath = await resolveManifestPath();
  const manifest = await readJson<EpisodeBuildManifest>(manifestPath);
  const framePacket = await readJson<FramePromptPacket>(path.join(sourceDir, "storyboard-frame-prompts.json"));
  const referenceLock = await readJson<ReferenceLock>(path.join(sourceDir, "reference-lock.json"));

  manifest.frames = await mapLimit(manifest.frames, frameConcurrency, async (frame) => {
    const localImagePath = await resolveLocalImagePath(manifest.id, frame.panelId);
    if (frame.image?.publicPath && localImagePath) {
      return { ...frame, error: frame.clip?.requestId ? frame.error : undefined };
    }
    if (localImagePath) {
      const image = {
        provider: "openai",
        status: "created",
        prompt: frame.prompt,
        outputPath: localImagePath,
        publicPath: `/generated/keyframes/${path.basename(localImagePath)}`,
      } satisfies ImageProviderResult;
      const referenceUrl = await withRetries(() => resolveReferenceAssetUrl({ outputPath: image.outputPath, publicPath: image.publicPath }));
      return { ...frame, image, referenceUrl, error: undefined };
    }

    try {
      const sourceFrame = framePacket.frames.find((candidate) => candidate.panelId === frame.panelId) ?? frame;
      const characterRefs = resolveFrameCharacterRefs(sourceFrame, referenceLock);
      const referenceImagePaths = [
        ...characterRefs.map((character) => toLocalPublicPath(character.referencePath)),
        ...resolveStyleReferencePaths(referenceLock),
      ];
      const image = await withRetries(() =>
        createKeyframeImage({
          fileName: `${manifest.id}-${frame.panelId}.png`,
          prompt: [
            "CRITICAL STYLE LOCK: use the supplied ChatGPT OPAIJA bible sheet images as the visual source of truth, not a generic anime interpretation.",
            "Match the bible sheet style exactly: premium 2D Trini/Caribbean anime, clean black ink, flat cel-shaded animated-series color, warm brown skin tones, expressive Caribbean facial structure, and Trinidad/Tobago street energy.",
            "Weapon/framing safety is mandatory: show the complete staff or bois tip-to-tip inside the frame, keep all hands and feet visible unless the panel explicitly says close-up, leave at least 10 percent safe margin around weapon tips, and never crop Kai's staff, pendant, face, loc silhouette, or sash.",
            referenceLock.globalStyleLock,
            framePacket.styleLock,
            `Panel ${frame.panelId}: ${frame.title}. Characters: ${sourceFrame.characters.join(", ")}.`,
            `Exact bible character locks to preserve: ${characterRefs.map((character) => `${character.name}: ${character.locks.join(", ")}`).join(" | ")}.`,
            sourceFrame.prompt,
            `Approved visual reference image files supplied to the provider: ${referenceImagePaths.map((referencePath) => path.relative(process.cwd(), referencePath)).join(", ")}.`,
            `Hard negatives: ${framePacket.negativePrompt}. ${referenceLock.forbidden.join(" ")}`,
          ].join("\n"),
          referenceImagePaths,
        }),
      );
      if (image.status === "dry_run" || !image.outputPath) return { ...frame, ...sourceFrame, image, error: undefined };
      const referenceUrl = await withRetries(() => resolveReferenceAssetUrl({ outputPath: image.outputPath, publicPath: image.publicPath }));
      return { ...frame, ...sourceFrame, image, referenceUrl, error: undefined };
    } catch (error) {
      return { ...frame, error: error instanceof Error ? error.message : "Frame resume failed." };
    }
  });

  const images = manifest.frames.filter((frame) => frame.image?.publicPath).length;
  manifest.status = images === manifest.frames.length ? "frames-ready" : "running";
  manifest.updatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, manifestPath, status: manifest.status, images, frames: manifest.frames.length }, null, 2));
}

function resolveFrameCharacterRefs(frame: FramePrompt, referenceLock: ReferenceLock) {
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

function resolveStyleReferencePaths(referenceLock: ReferenceLock) {
  const fromQualityReference = [
    ...(referenceLock.qualityReference?.chatGptBibleSheets ?? []),
    ...(referenceLock.qualityReference?.premiumActionFrames ?? []),
  ];
  const paths = [...(referenceLock.styleReferencePaths ?? []), ...fromQualityReference];
  return paths.map(toLocalPublicPath);
}

function toLocalPublicPath(publicPath: string) {
  return path.resolve(process.cwd(), "public", publicPath.replace(/^\/+/, ""));
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
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
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
