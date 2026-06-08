import fs from "node:fs";
import path from "node:path";
import { processApprovedStoryboardQueue, type ApprovedQueueOptions } from "./videoApprovedQueue.js";

export type ApprovedQueueSchedulerStatus = Required<
  Pick<ApprovedQueueOptions, "keyframeProvider" | "clipProvider" | "voiceProvider" | "storyboardFrameProvider" | "waitForClip" | "maxRuns">
> & {
  enabled: boolean;
  intervalMinutes: number;
  confirmLiveSpend: boolean;
  renderWidth?: string | number;
  renderHeight?: string | number;
  renderDurationFrames?: string | number;
  nextRunAt?: string;
  lastRunAt?: string;
  lastResult?: Awaited<ReturnType<typeof processApprovedStoryboardQueue>>;
};

export type ApprovedQueueScheduleConfig = Partial<ApprovedQueueSchedulerStatus>;

let timer: NodeJS.Timeout | null = null;
let schedulerStatus: ApprovedQueueSchedulerStatus = {
  enabled: false,
  intervalMinutes: 30,
  keyframeProvider: "mock",
  clipProvider: "mock",
  voiceProvider: "mock",
  storyboardFrameProvider: "mock",
  waitForClip: false,
  confirmLiveSpend: false,
  maxRuns: 3,
};

const configPath = path.resolve(process.cwd(), "data", "approved-queue-schedule.json");

export function startApprovedQueueScheduler() {
  const config = getApprovedQueueScheduleConfig();
  schedulerStatus = {
    ...schedulerStatus,
    ...config,
    nextRunAt: undefined,
  };
  if (timer) clearTimeout(timer);
  if (!schedulerStatus.enabled) return schedulerStatus;
  scheduleNextTick();
  return schedulerStatus;
}

export function getApprovedQueueSchedulerStatus() {
  return schedulerStatus;
}

export function updateApprovedQueueScheduleConfig(input: ApprovedQueueScheduleConfig) {
  const current = getApprovedQueueScheduleConfig();
  const next = normalizeConfig({ ...current, ...input });
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return startApprovedQueueScheduler();
}

function scheduleNextTick() {
  if (timer) clearTimeout(timer);
  const nextRun = new Date(Date.now() + Math.max(1, schedulerStatus.intervalMinutes) * 60_000);
  schedulerStatus = { ...schedulerStatus, nextRunAt: nextRun.toISOString() };
  timer = setTimeout(async () => {
    try {
      const lastResult = await processApprovedStoryboardQueue(schedulerStatus);
      schedulerStatus = {
        ...schedulerStatus,
        lastRunAt: new Date().toISOString(),
        lastResult,
      };
    } finally {
      scheduleNextTick();
    }
  }, Math.max(1000, nextRun.getTime() - Date.now()));
}

export function getApprovedQueueScheduleConfig(): ApprovedQueueSchedulerStatus {
  const fileConfig = readConfigFile();
  return normalizeConfig({
    enabled: process.env.APPROVED_QUEUE_SCHEDULE_ENABLED === "true",
    intervalMinutes: Number(process.env.APPROVED_QUEUE_SCHEDULE_INTERVAL_MINUTES ?? 30),
    keyframeProvider: process.env.APPROVED_QUEUE_KEYFRAME_PROVIDER ?? "mock",
    clipProvider: process.env.APPROVED_QUEUE_CLIP_PROVIDER ?? "mock",
    voiceProvider: process.env.APPROVED_QUEUE_VOICE_PROVIDER ?? "mock",
    storyboardFrameProvider: process.env.APPROVED_QUEUE_STORYBOARD_FRAME_PROVIDER ?? "mock",
    waitForClip: process.env.APPROVED_QUEUE_WAIT_FOR_CLIP === "true",
    confirmLiveSpend: process.env.CONFIRM_LIVE_PROVIDER_SPEND === "true",
    maxRuns: Number(process.env.APPROVED_QUEUE_MAX_RUNS ?? 3),
    renderWidth: process.env.APPROVED_QUEUE_RENDER_WIDTH,
    renderHeight: process.env.APPROVED_QUEUE_RENDER_HEIGHT,
    renderDurationFrames: process.env.APPROVED_QUEUE_RENDER_DURATION_FRAMES,
    ...fileConfig,
  });
}

function readConfigFile(): ApprovedQueueScheduleConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as ApprovedQueueScheduleConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function normalizeConfig(input: ApprovedQueueScheduleConfig): ApprovedQueueSchedulerStatus {
  return {
    enabled: Boolean(input.enabled),
    intervalMinutes: Math.max(1, Number(input.intervalMinutes ?? 30)),
    keyframeProvider: input.keyframeProvider?.trim() || "mock",
    clipProvider: input.clipProvider?.trim() || "mock",
    voiceProvider: input.voiceProvider?.trim() || "mock",
    storyboardFrameProvider: input.storyboardFrameProvider?.trim() || "mock",
    waitForClip: Boolean(input.waitForClip),
    confirmLiveSpend: Boolean(input.confirmLiveSpend),
    maxRuns: Math.max(1, Number(input.maxRuns ?? 3)),
    renderWidth: input.renderWidth,
    renderHeight: input.renderHeight,
    renderDurationFrames: input.renderDurationFrames,
    nextRunAt: input.nextRunAt,
    lastRunAt: input.lastRunAt,
    lastResult: input.lastResult,
  };
}
