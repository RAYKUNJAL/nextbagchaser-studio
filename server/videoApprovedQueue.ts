import path from "node:path";
import fs from "node:fs/promises";
import { startVideoAgentRun, type VideoAgentRunOptions } from "./videoAgentRunner.js";
import { listVideoRuns } from "./videoRuns.js";
import { summarizePacketReadiness, validateVideoPacket } from "./videoPacketValidator.js";

export type ApprovedQueueOptions = Pick<
  VideoAgentRunOptions,
  "keyframeProvider" | "clipProvider" | "voiceProvider" | "storyboardFrameProvider" | "waitForClip"
> & {
  confirmLiveSpend?: boolean;
  maxRuns?: number;
  renderWidth?: string | number;
  renderHeight?: string | number;
  renderDurationFrames?: string | number;
};

export async function processApprovedStoryboardQueue(options: ApprovedQueueOptions = {}) {
  const providerValues = [
    options.keyframeProvider ?? "mock",
    options.clipProvider ?? "mock",
    options.voiceProvider ?? "mock",
    options.storyboardFrameProvider ?? "mock",
  ];
  const usesLiveProvider = providerValues.some((provider) => provider !== "mock");
  if (usesLiveProvider && !options.confirmLiveSpend) {
    throw new Error("Live provider spend must be confirmed before building the approved storyboard queue.");
  }

  const runs = await listVideoRuns();
  const alreadyRenderedSources = new Set(runs.map((run) => run.sourceRunId).filter(Boolean));
  const approved = runs.filter((run) => run.status === "approved" && !alreadyRenderedSources.has(run.id));
  const started: Array<{ sourceRunId: string; title: string; pid: number | undefined }> = [];
  const skipped: Array<{ sourceRunId: string; title: string; reason: string }> = [];

  for (const run of approved.slice(0, options.maxRuns ?? 3)) {
    const readiness = await validateVideoPacket(run.packetPath);
    if (!readiness.ok) {
      skipped.push({ sourceRunId: run.id, title: run.title, reason: summarizePacketReadiness(readiness) });
      continue;
    }

    const queueLock = await getActiveQueueLock(readiness.packetDir);
    if (queueLock) {
      skipped.push({ sourceRunId: run.id, title: run.title, reason: "Render already queued or running." });
      continue;
    }

    await writeQueueLock(readiness.packetDir, run.id);

    const launched = startVideoAgentRun({
      keyframeProvider: options.keyframeProvider ?? "mock",
      clipProvider: options.clipProvider ?? "mock",
      voiceProvider: options.voiceProvider ?? "mock",
      storyboardFrameProvider: options.storyboardFrameProvider ?? "mock",
      waitForClip: options.waitForClip ?? false,
      packetPath: run.packetPath,
      storyboardPath: path.join(readiness.packetDir, "storyboard.json"),
      sourceRunId: run.id,
      storyboardOnly: false,
      requireLlm: false,
      renderWidth: options.renderWidth,
      renderHeight: options.renderHeight,
      renderDurationFrames: options.renderDurationFrames,
    });
    started.push({ sourceRunId: run.id, title: run.title, pid: launched.pid });
  }

  return {
    ok: true,
    scanned: approved.length,
    started,
    skipped,
  };
}

async function getActiveQueueLock(packetDir: string) {
  const lockPath = path.join(packetDir, ".approved-render-queue.json");
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    const lock = JSON.parse(raw) as { queuedAt?: string };
    const queuedAt = Date.parse(lock.queuedAt ?? "");
    if (Number.isFinite(queuedAt) && Date.now() - queuedAt < 2 * 60 * 60 * 1000) return lock;
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeQueueLock(packetDir: string, sourceRunId: string) {
  await fs.writeFile(
    path.join(packetDir, ".approved-render-queue.json"),
    `${JSON.stringify({ sourceRunId, queuedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
}

export async function getApprovedStoryboardQueueStatus() {
  const runs = await listVideoRuns();
  const alreadyRenderedSources = new Set(runs.map((run) => run.sourceRunId).filter(Boolean));
  const approvedRuns = runs.filter((run) => run.status === "approved");
  const eligible: Array<{ id: string; title: string; characterName?: string }> = [];
  const blocked: Array<{ id: string; title: string; reason: string }> = [];
  const rendered: Array<{ id: string; title: string }> = [];

  for (const run of approvedRuns) {
    if (alreadyRenderedSources.has(run.id)) {
      rendered.push({ id: run.id, title: run.title });
      continue;
    }

    const readiness = await validateVideoPacket(run.packetPath);
    if (!readiness.ok) {
      blocked.push({ id: run.id, title: run.title, reason: summarizePacketReadiness(readiness) });
      continue;
    }

    eligible.push({ id: run.id, title: run.title, characterName: run.characterName });
  }

  return {
    ok: true,
    approved: approvedRuns.length,
    eligible,
    blocked,
    rendered,
    counts: {
      approved: approvedRuns.length,
      eligible: eligible.length,
      blocked: blocked.length,
      rendered: rendered.length,
    },
  };
}
