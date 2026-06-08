import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { characterCatalog, type CharacterBrief } from "./characterReferencePack.js";
import { validateVideoPacket } from "./videoPacketValidator.js";
import { updateVideoRunReview } from "./videoRuns.js";
import type { VideoPacket } from "./videoAgent.js";

dotenv.config();

type BatchResult = {
  characterId: string;
  characterName: string;
  ok: boolean;
  runId?: string;
  packetPath?: string;
  packetReady?: boolean;
  error?: string;
};

export type SeasonStoryboardBatchSummary = {
  ok: boolean;
  generatedAt: string;
  count: number;
  ready: number;
  failed: number;
  results: BatchResult[];
};

export type SeasonStoryboardBatchApproval = {
  ok: boolean;
  approved: Array<{ id: string; title: string }>;
  skipped: Array<{ id?: string; characterName: string; reason: string }>;
};

export async function runSeasonStoryboardBatch(characterIds?: string[]): Promise<SeasonStoryboardBatchSummary> {
  const characters = selectCharacters(characterIds);
  const results: BatchResult[] = [];

  for (const character of characters) {
    const result = await runCharacterStoryboard(character);
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
  }

  const summary = {
    ok: results.every((result) => result.ok && result.packetReady),
    generatedAt: new Date().toISOString(),
    count: results.length,
    ready: results.filter((result) => result.packetReady).length,
    failed: results.filter((result) => !result.ok || !result.packetReady).length,
    results,
  };

  await fs.mkdir(path.resolve(process.cwd(), "data"), { recursive: true });
  await fs.writeFile(path.resolve(process.cwd(), "data", "season-storyboard-batch.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return summary;
}

export async function getLatestSeasonStoryboardBatch(): Promise<SeasonStoryboardBatchSummary | null> {
  try {
    return JSON.parse(await fs.readFile(path.resolve(process.cwd(), "data", "season-storyboard-batch.json"), "utf8")) as SeasonStoryboardBatchSummary;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function approveLatestSeasonStoryboardBatch(): Promise<SeasonStoryboardBatchApproval> {
  const batch = await getLatestSeasonStoryboardBatch();
  if (!batch) {
    return {
      ok: false,
      approved: [],
      skipped: [{ characterName: "Season batch", reason: "No Season storyboard batch has been built yet." }],
    };
  }

  const approved: SeasonStoryboardBatchApproval["approved"] = [];
  const skipped: SeasonStoryboardBatchApproval["skipped"] = [];

  for (const result of batch.results) {
    if (!result.runId || !result.packetPath || !result.packetReady) {
      skipped.push({
        id: result.runId,
        characterName: result.characterName,
        reason: "Storyboard packet is missing, failed, or not packet-ready.",
      });
      continue;
    }

    const readiness = await validateVideoPacket(result.packetPath);
    if (!readiness.ok) {
      skipped.push({
        id: result.runId,
        characterName: result.characterName,
        reason: readiness.checks.filter((check) => !check.ok).map((check) => check.reason).join(" "),
      });
      continue;
    }

    const run = await updateVideoRunReview({
      id: result.runId,
      status: "approved",
      reviewNote: "Approved from Season 1 storyboard batch.",
    });
    if (!run) {
      skipped.push({ id: result.runId, characterName: result.characterName, reason: "Video run not found." });
      continue;
    }
    approved.push({ id: run.id, title: run.title });
  }

  return {
    ok: approved.length > 0 && skipped.length === 0,
    approved,
    skipped,
  };
}

async function main() {
  const summary = await runSeasonStoryboardBatch();
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

function selectCharacters(characterIds?: string[]) {
  const requested = characterIds?.length ? characterIds : parseCsv(process.env.SEASON_STORYBOARD_CHARACTER_IDS ?? "");
  const locked = characterCatalog.filter((character) => character.status === "locked");
  if (!requested.length) return locked;
  const selected = requested
    .map((id) => locked.find((character) => character.id === id))
    .filter((character): character is CharacterBrief => Boolean(character));
  return selected.length ? selected : locked;
}

async function runCharacterStoryboard(character: CharacterBrief): Promise<BatchResult> {
  const packet = buildSeasonOnePacket(character);
  const packetInputPath = path.resolve(process.cwd(), "data", "season-storyboard-packets", `${character.id}.json`);
  await fs.mkdir(path.dirname(packetInputPath), { recursive: true });
  await fs.writeFile(packetInputPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm run video:agent"] : ["run", "video:agent"];
  const child = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: sanitizeEnv({
      ...process.env,
      VIDEO_AGENT_PACKET_PATH: packetInputPath,
      VIDEO_AGENT_CHARACTER_ID: character.id,
      VIDEO_AGENT_STORYBOARD_ONLY: "true",
      VIDEO_AGENT_REQUIRE_LLM: "false",
      STORYBOARD_DIRECTOR_PROVIDER: process.env.SEASON_STORYBOARD_DIRECTOR_PROVIDER ?? "local",
      STORYBOARD_FRAME_PROVIDER: process.env.SEASON_STORYBOARD_FRAME_PROVIDER ?? "mock",
      KEYFRAME_IMAGE_PROVIDER: "mock",
      VIDEO_CLIP_PROVIDER: "mock",
      VOICE_PROVIDER: "mock",
    }),
  });

  if (child.status !== 0) {
    return {
      characterId: character.id,
      characterName: character.name,
      ok: false,
      error: [child.error instanceof Error ? child.error.message : "", child.stderr, child.stdout].filter(Boolean).join("\n").slice(0, 3000),
    };
  }

  const runOutput = parseLastJsonObject(child.stdout);
  const packetPath = typeof runOutput?.packetPath === "string" ? runOutput.packetPath : undefined;
  const readiness = packetPath ? await validateVideoPacket(packetPath) : null;
  return {
    characterId: character.id,
    characterName: character.name,
    ok: Boolean(runOutput?.ok),
    runId: typeof runOutput?.id === "string" ? runOutput.id : undefined,
    packetPath,
    packetReady: readiness?.ok ?? false,
    error: readiness && !readiness.ok ? readiness.checks.filter((check) => !check.ok).map((check) => check.reason).join(" ") : undefined,
  };
}

function buildSeasonOnePacket(character: CharacterBrief): VideoPacket {
  const powerPhrase = character.power.toLowerCase();
  return {
    title: `Season 1 Character Teaser: ${character.shortName} Enters the Gayelle`,
    hook: `${character.shortName} does not enter the circle alone. The rhythm enters with them.`,
    category: "SEASON 1 TEASER",
    narration: [
      `${character.name} steps into the gayelle carrying ${character.weapon}.`,
      `Every drumbeat tests ${character.shortName}'s control, every shadow tries to pull the rhythm off course.`,
      `But ${character.shortName} answers with ${powerPhrase}, holding the line between memory, movement, and command.`,
      "This is the first season of Opaija waking up.",
    ].join(" "),
    captionLines: [
      `${character.shortName} enters the gayelle.`,
      `${character.power} wakes up.`,
      "Join the founder list.",
    ],
    characterId: character.id,
    characterName: character.name,
    characterImage: character.image,
    storyBeat: `${character.shortName} gets a Season 1 intro beat built for a vertical social teaser and Seedance reference-to-video handoff.`,
    socialCaption: `${character.name} enters the gayelle. Follow Opaija for Season 1 Caribbean anime teasers.`,
    hashtags: ["#Opaija", "#CaribbeanAnime", "#AnimeShorts", "#SeasonOne"],
    qcChecklist: [
      `Face and outfit match ${character.name}`,
      `${character.weapon} stays readable`,
      `${character.power} is visible without hiding the silhouette`,
      "No reference-sheet layout or image text appears in storyboard frames",
    ],
  };
}

function parseLastJsonObject(raw: string) {
  const trimmed = raw.trim();
  for (let index = trimmed.lastIndexOf("{"); index >= 0; index = trimmed.lastIndexOf("{", index - 1)) {
    try {
      return JSON.parse(trimmed.slice(index)) as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return null;
}

function parseCsv(raw: string) {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function sanitizeEnv(env: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(env).filter(([key, value]) => Boolean(key) && !key.includes("=") && typeof value === "string"),
  ) as NodeJS.ProcessEnv;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
