import fs from "node:fs/promises";
import path from "node:path";
import { updateApprovedQueueScheduleConfig } from "./approvedQueueScheduler.js";
import { getVideoProviderComparison } from "./videoProviderComparison.js";

export type VideoProductionDecision = {
  appliedAt: string;
  winner: "seedance-reference-clip" | "openai-sora-reference-clip";
  clipProvider: "seedance" | "openai";
  reason: string;
  approvedQueueSchedule: ReturnType<typeof updateApprovedQueueScheduleConfig>;
};

const decisionPath = path.resolve(process.cwd(), "data", "video-production-decision.json");

export async function getVideoProductionDecision() {
  try {
    return JSON.parse(await fs.readFile(decisionPath, "utf8")) as VideoProductionDecision;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function applyVideoProductionWinner() {
  const comparison = await getVideoProviderComparison();
  if (comparison.decisionGate !== "ready" || !comparison.winner) {
    throw new Error(`Provider bakeoff is not ready. Current gate: ${comparison.decisionGate}.`);
  }

  const clipProvider = comparison.winner === "openai-sora-reference-clip" ? "openai" : "seedance";
  const approvedQueueSchedule = updateApprovedQueueScheduleConfig({
    enabled: true,
    intervalMinutes: 30,
    keyframeProvider: "openai",
    clipProvider,
    voiceProvider: "openai",
    storyboardFrameProvider: "openai",
    waitForClip: true,
    confirmLiveSpend: true,
    maxRuns: 2,
  });

  const decision: VideoProductionDecision = {
    appliedAt: new Date().toISOString(),
    winner: comparison.winner,
    clipProvider,
    reason: comparison.recommendation,
    approvedQueueSchedule,
  };

  await fs.mkdir(path.dirname(decisionPath), { recursive: true });
  await fs.writeFile(decisionPath, `${JSON.stringify(decision, null, 2)}\n`, "utf8");
  return decision;
}
