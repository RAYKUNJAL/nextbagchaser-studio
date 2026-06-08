import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import {
  assertTimingSheetComplete,
  syncTimingSheetToAudioDuration,
  writeTimingSheet,
  type AnimeTimingSheet,
} from "./animeTiming.js";
import { probeMediaDuration } from "./videoProbe.js";
import { createVoiceover } from "./voice.js";

dotenv.config();

type Manifest = {
  id: string;
  updatedAt?: string;
  voice?: unknown;
  timing?: AnimeTimingSheet;
  timingSheetPath?: string;
  frames?: Array<{ panelId: string }>;
};

const buildsRoot = path.resolve(process.cwd(), "out", "episode-builds", "season-one", "episode-01-the-first-pulse");

const episodeOneNarration = [
  "Before the sun fully touches Trinidad, rhythm is already moving.",
  "It is in the maxi horns, the steelpan echoes, the school shoes on concrete, and the doubles cart where Kai Baptiste only wants breakfast.",
  "Mother Lall sees the pulse before he does. A coded wrapper passes through her hands. A warning hides inside ordinary food.",
  "Across the street, Asha reads a mark that should have stayed buried.",
  "Behind the old wall, the Listening Bois wakes. Wood remembers. Dust lifts. Kai reaches, and the street opens into a gayelle older than any map.",
  "Nia breaks fear with her lavway. Mother Lall blocks silence with a spoon like it was always a weapon.",
  "Then Marius Vale steps into the rhythm and removes sound itself.",
  "Selah watches from above. Malik tests Kai below. Papa Etienne stops them both with one strike of his cane.",
  "The rumor spreads. Tobago answers. The Stillwater Order kneels.",
  "Kai hears a drumbeat no one else can hear.",
  "The first pulse has awakened, and every island will have to choose a side.",
].join(" ");

async function main() {
  const manifestPath = await resolveManifestPath();
  const manifest = await readJson<Manifest>(manifestPath);
  const voice = await createVoiceover({
    text: episodeOneNarration,
    fileName: `${manifest.id}-full-narrator.mp3`,
    stability: 0.48,
    similarityBoost: 0.82,
    style: 0.32,
  });

  manifest.voice = voice;
  await syncManifestTimingToVoice(manifest);
  manifest.updatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, manifestPath, voice }, null, 2));
}

async function syncManifestTimingToVoice(manifest: Manifest) {
  const voicePath = typeof manifest.voice === "object" && manifest.voice && "path" in manifest.voice ? manifest.voice.path : undefined;
  if (typeof voicePath !== "string" || !manifest.timing) return;

  const audioPath = path.resolve(process.cwd(), "public", voicePath.replace(/^\/+/, ""));
  const audioDurationSec = await probeMediaDuration(audioPath);
  const syncedTiming = syncTimingSheetToAudioDuration(manifest.timing, audioDurationSec);
  assertTimingSheetComplete(
    syncedTiming,
    manifest.frames?.map((frame) => frame.panelId) ?? syncedTiming.panels.map((panel) => panel.panelId),
  );

  manifest.timing = syncedTiming;
  if (manifest.timingSheetPath) {
    await writeTimingSheet(path.resolve(process.cwd(), manifest.timingSheetPath), syncedTiming);
  }
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
