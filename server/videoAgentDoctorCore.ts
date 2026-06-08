import path from "node:path";
import { hasVerifiedProvider, listProviderSmokeTests } from "./providerSmokeTests.js";
import { getVideoAgentReadiness } from "./providerReadiness.js";
import { listVideoRuns } from "./videoRuns.js";
import { getVideoAgentScheduleConfig, getVideoAgentSchedulerStatus } from "./videoAgentScheduler.js";
import { fileExists, probeVideo } from "./videoProbe.js";
import { getProviderBakeoffPreflight } from "./providerBakeoffPreflight.js";
import { getVideoProviderComparison } from "./videoProviderComparison.js";
import { getVideoProductionDecision } from "./videoProductionDecision.js";
import { getLatestProviderBakeoffPacket } from "./providerBakeoffPackets.js";
import { validateVideoPacket } from "./videoPacketValidator.js";
import { getVideoWorkflowResearch } from "./videoWorkflowResearch.js";

export async function getVideoAgentDoctor() {
  const liveGenerationVerified =
    (await hasVerifiedProvider("openai-storyboard-frame")) && (await hasVerifiedProvider("seedance-reference-clip"));
  const readiness = getVideoAgentReadiness({ liveGenerationVerified });
  const runs = await listVideoRuns();
  const smokeTests = await listProviderSmokeTests();
  const bakeoffPreflight = await getProviderBakeoffPreflight();
  const providerComparison = await getVideoProviderComparison();
  const workflowResearch = getVideoWorkflowResearch();
  const productionDecision = await getVideoProductionDecision();
  const latestBakeoffPacket = await getLatestProviderBakeoffPacket();
  const activeSchedule = getVideoAgentSchedulerStatus();
  const configuredSchedule = getVideoAgentScheduleConfig();
  const schedule = {
    ...configuredSchedule,
    nextRunAt: activeSchedule.nextRunAt,
    nextCharacterId: activeSchedule.nextCharacterId,
    lastRunAt: activeSchedule.lastRunAt,
    lastRunPid: activeSchedule.lastRunPid,
    lastCharacterId: activeSchedule.lastCharacterId,
  };
  const latestRun = runs[0] ?? null;
  const latestRenderedRun = runs.find((run) => Boolean(run.outputPath || run.publicVideoPath)) ?? null;
  const latestStoryboardRun = runs.find((run) => run.status === "planned" || Boolean(run.packetPath)) ?? null;
  const latestOutputExists = latestRun?.outputPath ? await fileExists(latestRun.outputPath) : false;
  const latestPublicOutputExists = latestRun?.publicVideoPath
    ? await fileExists(`public/${latestRun.publicVideoPath.replace(/^\//, "")}`)
    : false;
  const latestOutputProbe = latestRun?.outputPath && latestOutputExists ? await probeVideo(latestRun.outputPath) : null;
  const latestRenderedOutputExists = latestRenderedRun?.outputPath ? await fileExists(latestRenderedRun.outputPath) : false;
  const latestRenderedPublicOutputExists = latestRenderedRun?.publicVideoPath
    ? await fileExists(`public/${latestRenderedRun.publicVideoPath.replace(/^\//, "")}`)
    : false;
  const latestRenderedOutputProbe =
    latestRenderedRun?.outputPath && latestRenderedOutputExists ? await probeVideo(latestRenderedRun.outputPath) : null;
  const latestStoryboardReady = latestStoryboardRun?.packetPath
    ? await fileExists(path.join(path.dirname(latestStoryboardRun.packetPath), "scene_manifest.json"))
    : false;
  const latestStoryboardReadiness = latestStoryboardRun?.packetPath
    ? await validateVideoPacket(latestStoryboardRun.packetPath)
    : null;

  return {
    ok:
      Boolean(latestRun) &&
      (Boolean(latestOutputExists && latestPublicOutputExists && latestOutputProbe?.valid) ||
        Boolean(latestRenderedOutputExists && latestRenderedPublicOutputExists && latestRenderedOutputProbe?.valid) ||
        latestStoryboardReady),
    recommendation: readiness.recommendation,
    stack: readiness.stack,
    workflowResearch: {
      currentAnswer: workflowResearch.currentAnswer,
      recommendedStack: workflowResearch.recommendedStack,
      providerDecision: workflowResearch.providerDecision,
      references: workflowResearch.references,
    },
    providerSummary: readiness.providers.map((provider) => ({
      id: provider.id,
      status: provider.status,
      configured: provider.configured,
    })),
    blockers: readiness.blockers,
    liveReady: readiness.liveReady,
    liveGenerationVerified,
    bakeoffPreflight,
    providerComparison: {
      readyForDecision: providerComparison.readyForDecision,
      decisionGate: providerComparison.decisionGate,
      winner: providerComparison.winner,
      nextStep: providerComparison.nextStep,
      providers: providerComparison.providers.map((provider) => ({
        id: provider.id,
        status: provider.status,
        liveTested: provider.liveTested,
        artifactReady: provider.artifactReady,
        score: provider.score,
        reviewScore: provider.reviewScore,
      })),
    },
    productionDecision,
    latestBakeoffPacket,
    scheduler: schedule,
    runs: {
      total: runs.length,
      latest: latestRun
        ? {
            id: latestRun.id,
            title: latestRun.title,
            status: latestRun.status,
            outputPath: latestRun.outputPath,
            outputExists: latestOutputExists,
            probe: latestOutputProbe,
            publicVideoPath: latestRun.publicVideoPath,
            publicOutputExists: latestPublicOutputExists,
          }
        : null,
      latestRendered: latestRenderedRun
        ? {
            id: latestRenderedRun.id,
            title: latestRenderedRun.title,
            status: latestRenderedRun.status,
            outputPath: latestRenderedRun.outputPath,
            outputExists: latestRenderedOutputExists,
            probe: latestRenderedOutputProbe,
            publicVideoPath: latestRenderedRun.publicVideoPath,
            publicOutputExists: latestRenderedPublicOutputExists,
          }
        : null,
      latestStoryboard: latestStoryboardRun
        ? {
            id: latestStoryboardRun.id,
            title: latestStoryboardRun.title,
            status: latestStoryboardRun.status,
            packetPath: latestStoryboardRun.packetPath,
            ready: latestStoryboardReady,
            packetReady: latestStoryboardReadiness?.ok ?? false,
            packetChecks: latestStoryboardReadiness?.checks,
            characterName: latestStoryboardRun.characterName,
          }
        : null,
    },
    smokeTests: {
      total: smokeTests.length,
      latest: smokeTests[0]
        ? {
            id: smokeTests[0].id,
            provider: smokeTests[0].provider,
            status: smokeTests[0].status,
            liveSpendConfirmed: smokeTests[0].liveSpendConfirmed,
            publicPath: smokeTests[0].publicPath,
          }
        : null,
    },
  };
}
