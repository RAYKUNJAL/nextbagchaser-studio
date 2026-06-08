import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type VideoAgentRunOptions = {
  keyframeProvider?: string;
  clipProvider?: string;
  waitForClip?: boolean;
  requireLlm?: boolean;
  voiceProvider?: string;
  characterId?: string;
  storyboardDirectorProvider?: string;
  storyboardFrameProvider?: string;
  storyboardOnly?: boolean;
  packetPath?: string;
  storyboardPath?: string;
  sourceRunId?: string;
  renderWidth?: string | number;
  renderHeight?: string | number;
  renderDurationFrames?: string | number;
};

export type VideoAgentJobStatus = "queued" | "running" | "completed" | "failed";

export type VideoAgentJobRecord = {
  id: string;
  status: VideoAgentJobStatus;
  startedAt: string;
  updatedAt: string;
  pid?: number;
  exitCode?: number | null;
  error?: string;
  logPath: string;
  logTail?: string;
  options: Pick<
    VideoAgentRunOptions,
    | "keyframeProvider"
    | "clipProvider"
    | "voiceProvider"
    | "storyboardDirectorProvider"
    | "storyboardFrameProvider"
    | "characterId"
    | "storyboardOnly"
    | "sourceRunId"
    | "renderWidth"
    | "renderHeight"
    | "renderDurationFrames"
  >;
};

export type VideoAgentStartedRun = {
  jobId: string;
  pid?: number;
  logPath: string;
};

const jobsPath = path.resolve(process.cwd(), "data", "video-agent-jobs.json");
const logsDir = path.resolve(process.cwd(), "data", "video-agent-jobs");

export function buildVideoAgentEnv(options: VideoAgentRunOptions = {}) {
  const envOverrides: NodeJS.ProcessEnv = {};
  if (options.keyframeProvider) envOverrides.KEYFRAME_IMAGE_PROVIDER = options.keyframeProvider;
  if (options.clipProvider) envOverrides.VIDEO_CLIP_PROVIDER = options.clipProvider;
  if (typeof options.waitForClip === "boolean") envOverrides.VIDEO_AGENT_WAIT_FOR_CLIP = String(options.waitForClip);
  if (typeof options.requireLlm === "boolean") envOverrides.VIDEO_AGENT_REQUIRE_LLM = String(options.requireLlm);
  if (options.voiceProvider) envOverrides.VOICE_PROVIDER = options.voiceProvider;
  if (options.characterId) envOverrides.VIDEO_AGENT_CHARACTER_ID = options.characterId;
  if (options.storyboardDirectorProvider) envOverrides.STORYBOARD_DIRECTOR_PROVIDER = options.storyboardDirectorProvider;
  if (options.storyboardFrameProvider) envOverrides.STORYBOARD_FRAME_PROVIDER = options.storyboardFrameProvider;
  if (typeof options.storyboardOnly === "boolean") envOverrides.VIDEO_AGENT_STORYBOARD_ONLY = String(options.storyboardOnly);
  if (options.packetPath) envOverrides.VIDEO_AGENT_PACKET_PATH = options.packetPath;
  if (options.storyboardPath) envOverrides.VIDEO_AGENT_STORYBOARD_PATH = options.storyboardPath;
  if (options.sourceRunId) envOverrides.VIDEO_AGENT_SOURCE_RUN_ID = options.sourceRunId;
  if (options.renderWidth) envOverrides.VIDEO_AGENT_RENDER_WIDTH = String(options.renderWidth);
  if (options.renderHeight) envOverrides.VIDEO_AGENT_RENDER_HEIGHT = String(options.renderHeight);
  if (options.renderDurationFrames) envOverrides.VIDEO_AGENT_RENDER_DURATION_FRAMES = String(options.renderDurationFrames);
  return sanitizeEnv({ ...process.env, ...envOverrides });
}

export function startVideoAgentRun(options: VideoAgentRunOptions = {}): VideoAgentStartedRun {
  const isWindows = process.platform === "win32";
  const command = isWindows ? "cmd.exe" : "npm";
  const args = isWindows ? ["/d", "/s", "/c", "npm run video:agent:prod"] : ["run", "video:agent:prod"];
  const jobId = makeJobId();
  fs.mkdirSync(logsDir, { recursive: true });
  const logPath = path.join(logsDir, `${jobId}.log`);
  const logFd = fs.openSync(logPath, "a");
  const now = new Date().toISOString();
  const baseRecord: VideoAgentJobRecord = {
    id: jobId,
    status: "queued",
    startedAt: now,
    updatedAt: now,
    logPath,
    options: summarizeOptions(options),
  };

  upsertVideoAgentJob(baseRecord);
  fs.writeSync(logFd, `[${now}] queued video agent job ${jobId}\n`);

  try {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      detached: !isWindows,
      env: buildVideoAgentEnv(options),
      stdio: ["ignore", logFd, logFd],
      windowsHide: true,
    });

    upsertVideoAgentJob({
      ...baseRecord,
      status: "running",
      pid: child.pid,
      updatedAt: new Date().toISOString(),
    });

    child.on("error", (error) => {
      const updatedAt = new Date().toISOString();
      fs.writeSync(logFd, `[${updatedAt}] failed to start: ${error.message}\n`);
      upsertVideoAgentJob({
        ...baseRecord,
        status: "failed",
        pid: child.pid,
        error: error.message,
        updatedAt,
      });
      closeLogFile(logFd);
    });

    child.on("exit", (code) => {
      const updatedAt = new Date().toISOString();
      const status: VideoAgentJobStatus = code === 0 ? "completed" : "failed";
      fs.writeSync(logFd, `[${updatedAt}] job ${status} with exit code ${code}\n`);
      upsertVideoAgentJob({
        ...baseRecord,
        status,
        pid: child.pid,
        exitCode: code,
        updatedAt,
      });
      closeLogFile(logFd);
    });

    if (!isWindows) child.unref();
    return { jobId, pid: child.pid, logPath };
  } catch (error) {
    const updatedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Unable to start video agent.";
    fs.writeSync(logFd, `[${updatedAt}] spawn failed: ${message}\n`);
    upsertVideoAgentJob({
      ...baseRecord,
      status: "failed",
      error: message,
      updatedAt,
    });
    closeLogFile(logFd);
    throw error;
  }
}

export function listVideoAgentJobs() {
  return readVideoAgentJobs()
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .map(withLogTail);
}

export function getVideoAgentJob(id: string) {
  const job = readVideoAgentJobs().find((record) => record.id === id);
  return job ? withLogTail(job) : null;
}

function sanitizeEnv(env: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(env).filter(([key, value]) => {
      return Boolean(key) && !key.includes("=") && typeof value === "string";
    }),
  ) as NodeJS.ProcessEnv;
}

function makeJobId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function summarizeOptions(options: VideoAgentRunOptions): VideoAgentJobRecord["options"] {
  return {
    keyframeProvider: options.keyframeProvider,
    clipProvider: options.clipProvider,
    voiceProvider: options.voiceProvider,
    storyboardDirectorProvider: options.storyboardDirectorProvider,
    storyboardFrameProvider: options.storyboardFrameProvider,
    characterId: options.characterId,
    storyboardOnly: options.storyboardOnly,
    sourceRunId: options.sourceRunId,
    renderWidth: options.renderWidth,
    renderHeight: options.renderHeight,
    renderDurationFrames: options.renderDurationFrames,
  };
}

function readVideoAgentJobs(): VideoAgentJobRecord[] {
  try {
    const raw = fs.readFileSync(jobsPath, "utf8");
    const parsed = JSON.parse(raw) as VideoAgentJobRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function upsertVideoAgentJob(record: VideoAgentJobRecord) {
  fs.mkdirSync(path.dirname(jobsPath), { recursive: true });
  const records = readVideoAgentJobs();
  const index = records.findIndex((current) => current.id === record.id);
  if (index >= 0) records[index] = record;
  else records.unshift(record);
  fs.writeFileSync(jobsPath, `${JSON.stringify(records.slice(0, 50), null, 2)}\n`, "utf8");
}

function withLogTail(record: VideoAgentJobRecord): VideoAgentJobRecord {
  try {
    const stat = fs.statSync(record.logPath);
    const bytes = Math.min(stat.size, 8000);
    const fd = fs.openSync(record.logPath, "r");
    const buffer = Buffer.alloc(bytes);
    fs.readSync(fd, buffer, 0, bytes, Math.max(0, stat.size - bytes));
    fs.closeSync(fd);
    return { ...record, logTail: buffer.toString("utf8") };
  } catch {
    return record;
  }
}

function closeLogFile(fd: number) {
  try {
    fs.closeSync(fd);
  } catch {
    // The child process or operating system may already have closed it.
  }
}
