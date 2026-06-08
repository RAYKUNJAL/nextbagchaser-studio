import { startVideoAgentRun } from "./videoAgentRunner.js";
import { characterCatalog } from "./characterReferencePack.js";
import fs from "node:fs";
import path from "node:path";

export type VideoAgentSchedulerStatus = {
  enabled: boolean;
  times: string[];
  timezone: string;
  characterId?: string;
  characterIds: string[];
  nextCharacterId?: string;
  keyframeProvider: string;
  clipProvider: string;
  voiceProvider: string;
  storyboardDirectorProvider: string;
  storyboardFrameProvider: string;
  storyboardOnly: boolean;
  waitForClip: boolean;
  requireLlm: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunPid?: number;
  lastCharacterId?: string;
};

export type VideoAgentScheduleConfig = Partial<
  Pick<
    VideoAgentSchedulerStatus,
    | "enabled"
    | "times"
    | "timezone"
    | "characterId"
    | "characterIds"
    | "keyframeProvider"
    | "clipProvider"
    | "voiceProvider"
    | "storyboardDirectorProvider"
    | "storyboardFrameProvider"
    | "storyboardOnly"
    | "waitForClip"
    | "requireLlm"
  >
>;

let schedulerStatus: VideoAgentSchedulerStatus = {
  enabled: false,
  times: [],
  timezone: "server-local",
  characterIds: [],
  keyframeProvider: "mock",
  clipProvider: "mock",
  voiceProvider: "mock",
  storyboardDirectorProvider: "local",
  storyboardFrameProvider: "mock",
  storyboardOnly: true,
  waitForClip: false,
  requireLlm: false,
};
let timer: NodeJS.Timeout | null = null;
let scheduledRunCount = 0;
const configPath = path.resolve(process.cwd(), "data", "video-agent-schedule.json");
const defaultCharacterIds = characterCatalog.filter((character) => character.status === "locked").map((character) => character.id);

export function startVideoAgentScheduler() {
  const config = getVideoAgentScheduleConfig();
  schedulerStatus = {
    ...schedulerStatus,
    enabled: config.enabled ?? false,
    times: config.times ?? [],
    timezone: config.timezone ?? "server-local",
    characterId: config.characterId,
    characterIds: config.characterIds ?? [],
    nextCharacterId: undefined,
    keyframeProvider: config.keyframeProvider ?? "mock",
    clipProvider: config.clipProvider ?? "mock",
    voiceProvider: config.voiceProvider ?? "mock",
    storyboardDirectorProvider: config.storyboardDirectorProvider ?? "local",
    storyboardFrameProvider: config.storyboardFrameProvider ?? "mock",
    storyboardOnly: config.storyboardOnly ?? true,
    waitForClip: config.waitForClip ?? false,
    requireLlm: config.requireLlm ?? false,
  };

  if (timer) clearTimeout(timer);
  if (!schedulerStatus.enabled) return schedulerStatus;
  if (!schedulerStatus.times.length) return schedulerStatus;
  scheduleNextTick();
  return schedulerStatus;
}

export function getVideoAgentSchedulerStatus() {
  return schedulerStatus;
}

export function updateVideoAgentScheduleConfig(input: VideoAgentScheduleConfig) {
  const current = getVideoAgentScheduleConfig();
  const next = normalizeScheduleConfig({ ...current, ...input });
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return startVideoAgentScheduler();
}

function scheduleNextTick() {
  if (timer) clearTimeout(timer);
  const nextRun = getNextRunDate(schedulerStatus.times);
  if (!nextRun) return;
  const nextCharacterId = selectScheduledCharacterId();
  schedulerStatus = { ...schedulerStatus, nextRunAt: nextRun.toISOString(), nextCharacterId };
  timer = setTimeout(() => {
    const characterId = selectScheduledCharacterId();
    const started = startVideoAgentRun({
      keyframeProvider: schedulerStatus.keyframeProvider,
      clipProvider: schedulerStatus.clipProvider,
      voiceProvider: schedulerStatus.voiceProvider,
      storyboardDirectorProvider: schedulerStatus.storyboardDirectorProvider,
      storyboardFrameProvider: schedulerStatus.storyboardFrameProvider,
      storyboardOnly: schedulerStatus.storyboardOnly,
      characterId,
      waitForClip: schedulerStatus.waitForClip,
      requireLlm: schedulerStatus.requireLlm,
    });
    scheduledRunCount += 1;
    schedulerStatus = {
      ...schedulerStatus,
      lastRunAt: new Date().toISOString(),
      lastRunPid: started.pid,
      lastCharacterId: characterId,
    };
    scheduleNextTick();
  }, Math.max(1000, nextRun.getTime() - Date.now()));
}

export function getVideoAgentScheduleConfig(): Required<Omit<VideoAgentScheduleConfig, "characterId">> & {
  characterId?: string;
} {
  const fileConfig = readConfigFile();
  return normalizeScheduleConfig({
    enabled: process.env.VIDEO_AGENT_SCHEDULE_ENABLED === "true",
    times: parseCsv(process.env.VIDEO_AGENT_SCHEDULE_TIMES ?? "09:00,19:00").filter((time) =>
      /^\d{2}:\d{2}$/.test(time),
    ),
    timezone: process.env.VIDEO_AGENT_SCHEDULE_TIMEZONE ?? "server-local",
    characterId: process.env.VIDEO_AGENT_SCHEDULE_CHARACTER_ID?.trim() || undefined,
    characterIds: parseScheduleCharacterIds(),
    keyframeProvider: process.env.VIDEO_AGENT_SCHEDULE_KEYFRAME_PROVIDER ?? "mock",
    clipProvider: process.env.VIDEO_AGENT_SCHEDULE_CLIP_PROVIDER ?? "mock",
    voiceProvider: process.env.VIDEO_AGENT_SCHEDULE_VOICE_PROVIDER ?? "mock",
    storyboardDirectorProvider: process.env.VIDEO_AGENT_SCHEDULE_STORYBOARD_DIRECTOR_PROVIDER ?? "local",
    storyboardFrameProvider: process.env.VIDEO_AGENT_SCHEDULE_STORYBOARD_FRAME_PROVIDER ?? "mock",
    storyboardOnly: process.env.VIDEO_AGENT_SCHEDULE_STORYBOARD_ONLY !== "false",
    waitForClip: process.env.VIDEO_AGENT_SCHEDULE_WAIT_FOR_CLIP === "true",
    requireLlm: process.env.VIDEO_AGENT_SCHEDULE_REQUIRE_LLM === "true",
    ...fileConfig,
  });
}

function parseScheduleCharacterIds() {
  const fixedCharacterId = process.env.VIDEO_AGENT_SCHEDULE_CHARACTER_ID?.trim();
  if (fixedCharacterId) return [fixedCharacterId];
  return parseCsv(process.env.VIDEO_AGENT_SCHEDULE_CHARACTER_IDS ?? defaultCharacterIds.join(","));
}

function selectScheduledCharacterId() {
  if (schedulerStatus.characterId) return schedulerStatus.characterId;
  if (!schedulerStatus.characterIds.length) return undefined;
  return schedulerStatus.characterIds[scheduledRunCount % schedulerStatus.characterIds.length];
}

function getNextRunDate(times: string[]) {
  const now = new Date();
  const candidates = times.flatMap((time) => {
    const [hour, minute] = time.split(":").map(Number);
    return [0, 1].map((dayOffset) => {
      const date = new Date(now);
      date.setDate(now.getDate() + dayOffset);
      date.setHours(hour, minute, 0, 0);
      return date;
    });
  });
  return candidates.filter((date) => date.getTime() > now.getTime()).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
}

function readConfigFile(): VideoAgentScheduleConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as VideoAgentScheduleConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function normalizeScheduleConfig(input: VideoAgentScheduleConfig) {
  const characterId = input.characterId?.trim() || undefined;
  return {
    enabled: Boolean(input.enabled),
    times: (input.times?.length ? input.times : ["09:00", "19:00"]).filter((time) => /^\d{2}:\d{2}$/.test(time)),
    timezone: input.timezone?.trim() || "server-local",
    characterId,
    characterIds: characterId
      ? [characterId]
      : (input.characterIds?.length ? input.characterIds : defaultCharacterIds)
          .map((id) => id.trim())
          .filter(Boolean),
    keyframeProvider: input.keyframeProvider?.trim() || "mock",
    clipProvider: input.clipProvider?.trim() || "mock",
    voiceProvider: input.voiceProvider?.trim() || "mock",
    storyboardDirectorProvider: input.storyboardDirectorProvider?.trim() || "local",
    storyboardFrameProvider: input.storyboardFrameProvider?.trim() || "mock",
    storyboardOnly: input.storyboardOnly ?? true,
    waitForClip: Boolean(input.waitForClip),
    requireLlm: Boolean(input.requireLlm),
  };
}

function parseCsv(raw: string) {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
