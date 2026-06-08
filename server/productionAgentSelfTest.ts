import dotenv from "dotenv";
import { createProductionRun, getProductionRun, listProductionRuns } from "./productionAgent.js";
import { getModelRouterStatus } from "./modelRouter.js";

dotenv.config();

const result = await createProductionRun({
  mode: "local-qwen",
  characterId: "kairo",
  brief: "Self-test dry production packet. Use fallback if Qwen is unavailable, but record the model attempt.",
});

const loaded = await getProductionRun(result.manifest.id);
const runs = await listProductionRuns();
const router = getModelRouterStatus();

const ok =
  Boolean(loaded.story.title) &&
  loaded.storyboard.length >= 5 &&
  loaded.qc.score >= 70 &&
  runs.some((run) => run.id === result.manifest.id) &&
  router.defaultBrain === "qwen-local";

console.log(
  JSON.stringify(
    {
      ok,
      id: result.manifest.id,
      status: result.manifest.status,
      qcScore: loaded.qc.score,
      storyboardShots: loaded.storyboard.length,
      qwenModel: router.qwen.model,
      modelAttempts: loaded.modelResults.length,
      latestRunCount: runs.length,
    },
    null,
    2,
  ),
);

if (!ok) process.exitCode = 1;
