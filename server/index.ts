import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assetsRouter } from "./assets.js";
import { listAdminSecretStatuses, updateAdminSecrets } from "./adminSecrets.js";
import {
  getApprovedQueueSchedulerStatus,
  startApprovedQueueScheduler,
  updateApprovedQueueScheduleConfig,
  type ApprovedQueueScheduleConfig,
} from "./approvedQueueScheduler.js";
import { createAdminSession, getAdminAuthStatus, requireAdminSession } from "./adminAuth.js";
import { getBlogPostBySlug, listPublishedBlogPosts, publishBlogPost, type BlogPostInput } from "./blog.js";
import { createBookPacket, type BookPacketInput } from "./bookEngine.js";
import { listContentStorageItems } from "./contentStorage.js";
import {
  captureLead,
  createGrowthCampaign,
  getGrowthSummary,
  getLeaderboard,
  listLeads,
  trackReferralClick,
  type FanLeadInput,
  type GrowthCampaignInput,
} from "./growth.js";
import { createMerchDraft, type MerchProductInput } from "./merch.js";
import { getBrainModel, getBrainProvider, runBrainTask, type BrainTaskInput } from "./openaiBrain.js";
import { getModelRouterStatus } from "./modelRouter.js";
import {
  buildProjectWorldPack,
  createProject,
  getProject,
  listProjectContentStorage,
  listProjects,
  updateProject,
  uploadCharacterSheets,
  uploadStoryOutline,
  type ProjectCreateInput,
  type ProjectUpdateInput,
  type ProjectUploadInput,
} from "./projects.js";
import { createProductionRun, getProductionMemory, getProductionRun, listProductionRuns, type ProductionRunInput } from "./productionAgent.js";
import { getVideoAgentReadiness } from "./providerReadiness.js";
import { getProviderBakeoffPreflight } from "./providerBakeoffPreflight.js";
import {
  completeProviderSmokeTest,
  completeQueuedProviderSmokeTests,
  hasVerifiedProvider,
  listProviderSmokeTests,
  runProviderBakeoffSmokeTest,
  reviewProviderSmokeTest,
  runProviderSmokeTest,
  runStoryboardToSeedanceSmokeTest,
} from "./providerSmokeTests.js";
import {
  getVideoAgentSchedulerStatus,
  startVideoAgentScheduler,
  updateVideoAgentScheduleConfig,
  type VideoAgentScheduleConfig,
} from "./videoAgentScheduler.js";
import { getVideoAgentDoctor } from "./videoAgentDoctorCore.js";
import { getEpisodeOneStudio } from "./episodeOneStudio.js";
import { createPowerTeaserDryRun, getPowerTeaserStudio } from "./powerTeaserProduction.js";
import { getVideoProviderComparison } from "./videoProviderComparison.js";
import { getVideoWorkflowResearch } from "./videoWorkflowResearch.js";
import { applyVideoProductionWinner, getVideoProductionDecision } from "./videoProductionDecision.js";
import { getApprovedStoryboardQueueStatus, processApprovedStoryboardQueue } from "./videoApprovedQueue.js";
import { getVideoAgentJob, listVideoAgentJobs, startVideoAgentRun, type VideoAgentRunOptions } from "./videoAgentRunner.js";
import { getVideoRunArtifacts } from "./videoRunArtifacts.js";
import { approveLatestSeasonStoryboardBatch, getLatestSeasonStoryboardBatch, runSeasonStoryboardBatch } from "./videoSeasonStoryboardBatch.js";
import { runStoryboardQc } from "./storyboardQc.js";
import {
  createVideoJob,
  getFalJobResult,
  getFalJobStatus,
  getProvider,
  type VideoJobInput,
} from "./seedance.js";
import { getVideoRun, listVideoRuns, updateVideoRunReview } from "./videoRuns.js";
import { createVoiceover, getVoiceProvider, type VoiceJobInput } from "./voice.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json({ limit: "30mb" }));
app.use("/api/assets", assetsRouter);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "..", "dist");
const publicPath = path.resolve(__dirname, "..", "public");
startVideoAgentScheduler();
startApprovedQueueScheduler();

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    brainProvider: getBrainProvider(),
    brainModel: getBrainModel(),
    provider: getProvider(),
    voiceProvider: getVoiceProvider(),
    keys: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      fal: Boolean(process.env.FAL_KEY),
      elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
      resend: Boolean(process.env.RESEND_API_KEY && (process.env.RESEND_SEGMENT_ID || process.env.RESEND_AUDIENCE_ID)),
      printful: Boolean(process.env.PRINTFUL_API_KEY),
      printify: Boolean(process.env.PRINTIFY_API_KEY),
    },
    publicSiteUrl: process.env.PUBLIC_SITE_URL ?? "",
    email: {
      provider: "resend",
      configured: Boolean(process.env.RESEND_API_KEY && (process.env.RESEND_SEGMENT_ID || process.env.RESEND_AUDIENCE_ID)),
      from: process.env.RESEND_FROM_EMAIL ?? "",
    },
    seedance: getProvider() === "mock" ? "dry_run" : "configured",
  });
});

app.get("/api/admin/session", (request, response) => {
  response.json(getAdminAuthStatus(request));
});

app.post("/api/admin/session", (request, response) => {
  const input = request.body as { email?: string; password?: string };
  const result = createAdminSession({ email: input.email, password: String(input.password ?? "") });
  if (!result.authenticated) {
    response.status(401).json({ error: "Invalid admin password." });
    return;
  }
  response.json(result);
});

app.use("/api/video-agent", (request, response, next) => {
  if (!requireAdminSession(request, response)) return;
  next();
});

app.use("/api/production", (request, response, next) => {
  if (!requireAdminSession(request, response)) return;
  next();
});

app.use("/api/content-storage", (request, response, next) => {
  if (!requireAdminSession(request, response)) return;
  next();
});

app.use("/api/projects", (request, response, next) => {
  if (!requireAdminSession(request, response)) return;
  next();
});

app.use("/api/admin/secrets", (request, response, next) => {
  if (!requireAdminSession(request, response)) return;
  next();
});

app.get("/api/admin/secrets", (_request, response) => {
  response.json({ secrets: listAdminSecretStatuses() });
});

app.patch("/api/admin/secrets", async (request, response) => {
  try {
    response.json(await updateAdminSecrets(request.body as Record<string, unknown>));
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to update API keys.",
    });
  }
});

app.post("/api/brain/tasks", async (request, response) => {
  try {
    const result = await runBrainTask(request.body as BrainTaskInput);
    response.json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to run OpenAI brain task.",
    });
  }
});

app.get("/api/production/model-router", (_request, response) => {
  response.json(getModelRouterStatus());
});

app.get("/api/content-storage/items", async (_request, response) => {
  try {
    response.json(await listContentStorageItems());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to list content storage items.",
    });
  }
});

app.get("/api/projects", async (_request, response) => {
  try {
    response.json({ projects: await listProjects() });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to list projects." });
  }
});

app.post("/api/projects", async (request, response) => {
  try {
    response.status(201).json(await createProject(request.body as ProjectCreateInput));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to create project." });
  }
});

app.get("/api/projects/:projectId", async (request, response) => {
  try {
    response.json(await getProject(request.params.projectId));
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : "Unable to load project." });
  }
});

app.patch("/api/projects/:projectId", async (request, response) => {
  try {
    response.json(await updateProject(request.params.projectId, request.body as ProjectUpdateInput));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to update project." });
  }
});

app.post("/api/projects/:projectId/intake/story", async (request, response) => {
  try {
    response.status(201).json(await uploadStoryOutline(request.params.projectId, request.body as ProjectUploadInput));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to upload story outline." });
  }
});

app.post("/api/projects/:projectId/intake/character-sheets", async (request, response) => {
  try {
    response.status(201).json(await uploadCharacterSheets(request.params.projectId, request.body as { files?: ProjectUploadInput[] }));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to upload character sheets." });
  }
});

app.post("/api/projects/:projectId/world-pack", async (request, response) => {
  try {
    response.status(201).json(await buildProjectWorldPack(request.params.projectId));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to build world pack." });
  }
});

app.get("/api/projects/:projectId/content-storage", async (request, response) => {
  try {
    response.json({ items: await listProjectContentStorage(request.params.projectId) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to load project content storage." });
  }
});

app.get("/api/production/memory", async (_request, response) => {
  try {
    response.json(await getProductionMemory());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to load production memory.",
    });
  }
});

app.get("/api/production/runs", async (_request, response) => {
  try {
    response.json(await listProductionRuns());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to list production runs.",
    });
  }
});

app.post("/api/production/runs", async (request, response) => {
  try {
    const input = request.body as ProductionRunInput;
    if (input.mode === "production" && !input.confirmLiveSpend) {
      response.status(400).json({ error: "Production mode requires live provider spend confirmation." });
      return;
    }
    const run = await createProductionRun(input);
    response.status(201).json({
      id: run.manifest.id,
      status: run.manifest.status,
      mode: run.manifest.mode,
      characterId: run.manifest.characterId,
      characterName: run.manifest.characterName,
      title: run.story.title,
      qcScore: run.qc.score,
      packetDir: run.packetDir,
      nextAction: run.manifest.nextAction,
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to start production run.",
    });
  }
});

app.get("/api/production/runs/:id", async (request, response) => {
  try {
    response.json(await getProductionRun(request.params.id));
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to load production run.",
    });
  }
});

app.get("/api/blog/posts", async (_request, response) => {
  try {
    response.json(await listPublishedBlogPosts());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to list blog posts.",
    });
  }
});

app.get("/api/video-agent/runs", async (_request, response) => {
  try {
    response.json(await listVideoRuns());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to list video agent runs.",
    });
  }
});

app.get("/api/video-agent/jobs", (_request, response) => {
  response.json(listVideoAgentJobs());
});

app.get("/api/video-agent/jobs/:id", (request, response) => {
  const job = getVideoAgentJob(request.params.id);
  if (!job) {
    response.status(404).json({ error: "Video agent job not found." });
    return;
  }
  response.json(job);
});

app.get("/api/video-agent/readiness", async (_request, response) => {
  response.json(
    getVideoAgentReadiness({
      liveGenerationVerified:
        (await hasVerifiedProvider("openai-storyboard-frame")) && (await hasVerifiedProvider("seedance-reference-clip")),
    }),
  );
});

app.get("/api/video-agent/workflow-research", (_request, response) => {
  response.json(getVideoWorkflowResearch());
});

app.get("/api/video-agent/schedule", (_request, response) => {
  response.json(getVideoAgentSchedulerStatus());
});

app.patch("/api/video-agent/schedule", (request, response) => {
  try {
    response.json(updateVideoAgentScheduleConfig(request.body as VideoAgentScheduleConfig));
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to update video agent schedule.",
    });
  }
});

app.get("/api/video-agent/approved-queue/schedule", (_request, response) => {
  response.json(getApprovedQueueSchedulerStatus());
});

app.patch("/api/video-agent/approved-queue/schedule", async (request, response) => {
  try {
    const input = request.body as ApprovedQueueScheduleConfig;
    const decision = await getVideoProductionDecision();
    if (isLiveApprovedQueueSchedule(input) && !decision) {
      response.status(400).json({
        error: "Apply a reviewed provider bakeoff winner before enabling live approved-queue production rendering.",
      });
      return;
    }
    if (isLiveApprovedQueueSchedule(input) && decision && input.clipProvider && input.clipProvider !== decision.clipProvider) {
      response.status(400).json({
        error: `Approved-queue production rendering must use applied winner ${decision.clipProvider}.`,
      });
      return;
    }
    response.json(updateApprovedQueueScheduleConfig(input));
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to update approved queue schedule.",
    });
  }
});

function isLiveApprovedQueueSchedule(input: ApprovedQueueScheduleConfig) {
  const enabled = "enabled" in input ? Boolean(input.enabled) : true;
  return Boolean(
    enabled &&
      input.confirmLiveSpend &&
      ([input.keyframeProvider, input.clipProvider, input.voiceProvider, input.storyboardFrameProvider].some(
        (provider) => typeof provider === "string" && provider !== "mock",
      ) ||
        input.waitForClip),
  );
}

app.get("/api/video-agent/doctor", async (_request, response) => {
  response.json(await getVideoAgentDoctor());
});

app.get("/api/video-agent/episode-one/studio", async (_request, response) => {
  try {
    response.json(await getEpisodeOneStudio());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to load Episode 1 studio.",
    });
  }
});

app.get("/api/video-agent/power-teasers/studio", async (_request, response) => {
  try {
    response.json(await getPowerTeaserStudio());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to load power teaser studio.",
    });
  }
});

app.post("/api/video-agent/power-teasers/dry-run", async (request, response) => {
  try {
    const { characterId } = request.body as { characterId?: string };
    response.status(201).json(await createPowerTeaserDryRun(characterId ?? "kairo"));
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to create power teaser dry run.",
    });
  }
});

app.get("/api/video-agent/provider-smoke-tests", async (_request, response) => {
  response.json(await listProviderSmokeTests());
});

app.get("/api/video-agent/provider-comparison", async (_request, response) => {
  response.json(await getVideoProviderComparison());
});

app.get("/api/video-agent/provider-bakeoff/preflight", async (_request, response) => {
  response.json(await getProviderBakeoffPreflight());
});

app.get("/api/video-agent/production-decision", async (_request, response) => {
  response.json(await getVideoProductionDecision());
});

app.post("/api/video-agent/production-decision/apply-winner", async (_request, response) => {
  try {
    response.json(await applyVideoProductionWinner());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to apply production provider winner.",
    });
  }
});

app.post("/api/video-agent/provider-smoke-tests", async (request, response) => {
  try {
    const { provider, confirmLiveSpend } = request.body as {
      provider?:
        | "openai-keyframe"
        | "openai-storyboard-frame"
        | "openai-sora-reference-clip"
        | "seedance-clip"
        | "seedance-reference-clip";
      confirmLiveSpend?: boolean;
    };
    if (
      provider !== "openai-keyframe" &&
      provider !== "openai-storyboard-frame" &&
      provider !== "openai-sora-reference-clip" &&
      provider !== "seedance-clip" &&
      provider !== "seedance-reference-clip"
    ) {
      response.status(400).json({
        error:
          "provider must be openai-keyframe, openai-storyboard-frame, openai-sora-reference-clip, seedance-clip, or seedance-reference-clip.",
      });
      return;
    }
    const record = await runProviderSmokeTest({ provider, confirmLiveSpend });
    response.status(record.status === "failed" ? 400 : 201).json(record);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to run provider smoke test.",
    });
  }
});

app.post("/api/video-agent/provider-smoke-tests/:id/complete", async (request, response) => {
  try {
    const record = await completeProviderSmokeTest(request.params.id);
    if (!record) {
      response.status(404).json({ error: "Provider smoke test not found." });
      return;
    }
    response.status(record.status === "failed" ? 400 : 200).json(record);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to complete provider smoke test.",
    });
  }
});

app.post("/api/video-agent/provider-smoke-tests/complete-queued", async (_request, response) => {
  try {
    response.json(await completeQueuedProviderSmokeTests());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to complete queued provider smoke tests.",
    });
  }
});

app.patch("/api/video-agent/provider-smoke-tests/:id/review", async (request, response) => {
  try {
    const record = await reviewProviderSmokeTest({
      id: request.params.id,
      review: request.body as Parameters<typeof reviewProviderSmokeTest>[0]["review"],
    });
    if (!record) {
      response.status(404).json({ error: "Provider smoke test not found." });
      return;
    }
    response.json(record);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to review provider smoke test.",
    });
  }
});

app.post("/api/video-agent/provider-smoke-tests/storyboard-to-seedance", async (request, response) => {
  try {
    const { confirmLiveSpend } = request.body as { confirmLiveSpend?: boolean };
    const result = await runStoryboardToSeedanceSmokeTest({
      confirmLiveSpend,
      pollAttempts: Number(process.env.WORKFLOW_SMOKE_POLL_ATTEMPTS ?? 6),
      pollDelayMs: Number(process.env.WORKFLOW_SMOKE_POLL_DELAY_MS ?? 10000),
    });
    response.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to run storyboard-to-Seedance smoke test.",
    });
  }
});

app.post("/api/video-agent/provider-smoke-tests/bakeoff", async (request, response) => {
  try {
    const { confirmLiveSpend } = request.body as { confirmLiveSpend?: boolean };
    const result = await runProviderBakeoffSmokeTest({
      confirmLiveSpend,
      pollAttempts: Number(process.env.WORKFLOW_SMOKE_POLL_ATTEMPTS ?? 6),
      pollDelayMs: Number(process.env.WORKFLOW_SMOKE_POLL_DELAY_MS ?? 10000),
    });
    response.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to run provider bakeoff.",
    });
  }
});

app.get("/api/video-agent/runs/:id", async (request, response) => {
  try {
    const run = await getVideoRun(request.params.id);
    if (!run) {
      response.status(404).json({ error: "Video run not found." });
      return;
    }
    response.json(run);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to load video agent run.",
    });
  }
});

app.get("/api/video-agent/runs/:id/artifacts", async (request, response) => {
  try {
    const artifacts = await getVideoRunArtifacts(request.params.id);
    if (!artifacts) {
      response.status(404).json({ error: "Video run not found." });
      return;
    }
    response.json(artifacts);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to load video run artifacts.",
    });
  }
});

app.post("/api/video-agent/runs", async (request, response) => {
  try {
    const options = request.body as VideoAgentRunOptions & { confirmLiveSpend?: boolean };
    const guard = await guardVideoAgentLiveRun(options);
    if (guard) {
      response.status(400).json({ error: guard });
      return;
    }
    const started = startVideoAgentRun(options);
    response.status(202).json({ ok: true, status: "queued", pid: started.pid, jobId: started.jobId });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to start video agent.",
    });
  }
});

app.post("/api/video-agent/season-storyboards", async (request, response) => {
  try {
    const { characterIds } = request.body as { characterIds?: string[] };
    const result = await runSeasonStoryboardBatch(characterIds);
    response.status(result.ok ? 201 : 400).json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to build Season 1 storyboards.",
    });
  }
});

app.get("/api/video-agent/season-storyboards", async (_request, response) => {
  try {
    response.json(await getLatestSeasonStoryboardBatch());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to load Season 1 storyboard batch.",
    });
  }
});

app.post("/api/video-agent/season-storyboards/approve", async (_request, response) => {
  try {
    const result = await approveLatestSeasonStoryboardBatch();
    response.status(result.approved.length ? 200 : 400).json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to approve Season 1 storyboard batch.",
    });
  }
});

app.post("/api/video-agent/approved-queue", async (request, response) => {
  try {
    const input = request.body as Parameters<typeof processApprovedStoryboardQueue>[0];
    const decision = await getVideoProductionDecision();
    if (input && isLiveApprovedQueueSchedule(input) && !decision) {
      response.status(400).json({
        error: "Apply a reviewed provider bakeoff winner before running live approved-queue production rendering.",
      });
      return;
    }
    if (input && isLiveApprovedQueueSchedule(input) && decision && input.clipProvider && input.clipProvider !== decision.clipProvider) {
      response.status(400).json({
        error: `Approved-queue production rendering must use applied winner ${decision.clipProvider}.`,
      });
      return;
    }
    const result = await processApprovedStoryboardQueue(input);
    response.status(202).json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to process approved storyboard queue.",
    });
  }
});

app.get("/api/video-agent/approved-queue", async (_request, response) => {
  try {
    response.json(await getApprovedStoryboardQueueStatus());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to load approved storyboard queue.",
    });
  }
});

app.patch("/api/video-agent/runs/:id/review", async (request, response) => {
  try {
    const { status, reviewNote } = request.body as { status?: string; reviewNote?: string };
    if (status !== "approved" && status !== "rejected") {
      response.status(400).json({ error: "Review status must be approved or rejected." });
      return;
    }
    const run = await updateVideoRunReview({
      id: request.params.id,
      status,
      reviewNote,
    });
    if (!run) {
      response.status(404).json({ error: "Video run not found." });
      return;
    }
    response.json(run);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to update video run review.",
    });
  }
});

app.get("/api/blog/posts/:slug", async (request, response) => {
  try {
    const post = await getBlogPostBySlug(request.params.slug);
    if (!post) {
      response.status(404).json({ error: "Blog post not found." });
      return;
    }
    response.json(post);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to load blog post.",
    });
  }
});

app.post("/api/blog/posts", async (request, response) => {
  try {
    if (!process.env.BLOG_PUBLISH_TOKEN || request.header("x-blog-token") !== process.env.BLOG_PUBLISH_TOKEN) {
      response.status(401).json({ error: "Invalid blog publish token." });
      return;
    }

    const post = await publishBlogPost(request.body as BlogPostInput);
    response.status(201).json(post);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to publish blog post.",
    });
  }
});

app.post("/api/voice/jobs", async (request, response) => {
  try {
    const result = await createVoiceover(request.body as VoiceJobInput);
    response.status(result.status === "dry_run" ? 200 : 201).json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to create voiceover.",
    });
  }
});

app.post("/api/books/packets", (request, response) => {
  try {
    const packet = createBookPacket(request.body as BookPacketInput);
    response.json(packet);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to create book packet.",
    });
  }
});

app.post("/api/merch/drafts", (request, response) => {
  try {
    const draft = createMerchDraft(request.body as MerchProductInput);
    response.json(draft);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to create merch draft.",
    });
  }
});

app.post("/api/growth/leads", async (request, response) => {
  try {
    const lead = await captureLead(request.body as FanLeadInput);
    response.status(201).json(lead);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to capture lead.",
    });
  }
});

app.get("/api/growth/leads", async (_request, response) => {
  try {
    response.json(await listLeads());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to list leads.",
    });
  }
});

app.get("/api/growth/summary", async (_request, response) => {
  try {
    response.json(await getGrowthSummary());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to load growth summary.",
    });
  }
});

app.get("/api/growth/leaderboard", async (_request, response) => {
  try {
    response.json(await getLeaderboard());
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to load leaderboard.",
    });
  }
});

app.post("/api/growth/referrals/:code/click", async (request, response) => {
  try {
    response.json(await trackReferralClick(request.params.code));
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to track referral click.",
    });
  }
});

app.post("/api/growth/campaigns", (request, response) => {
  try {
    const campaign = createGrowthCampaign(request.body as GrowthCampaignInput);
    response.json(campaign);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to create growth campaign.",
    });
  }
});

app.post("/api/video-agent/runs/:id/render", async (request, response) => {
  try {
    const run = await getVideoRun(request.params.id);
    if (!run) {
      response.status(404).json({ error: "Video run not found." });
      return;
    }
    const packetDir = path.dirname(run.packetPath);
    const safeRoot = path.resolve(process.cwd(), "out", "video-agent");
    const resolvedPacketDir = path.resolve(packetDir);
    if (!resolvedPacketDir.startsWith(safeRoot)) {
      response.status(400).json({ error: "Video run packet path is outside the video-agent output directory." });
      return;
    }
    const storyboardPath = path.join(resolvedPacketDir, "storyboard.json");
    await fs.access(run.packetPath);
    await fs.access(storyboardPath);
    const packet = JSON.parse(await fs.readFile(run.packetPath, "utf8"));
    const storyboard = JSON.parse(await fs.readFile(storyboardPath, "utf8"));
    const qc = runStoryboardQc(packet, storyboard);
    if (!qc.ok) {
      response.status(400).json({ error: "Storyboard QC failed. Fix or regenerate the board before rendering.", qc });
      return;
    }
    const options = request.body as VideoAgentRunOptions;
    const guard = await guardVideoAgentLiveRun({ ...options, storyboardOnly: false });
    if (guard) {
      response.status(400).json({ error: guard });
      return;
    }
    const started = startVideoAgentRun({
      keyframeProvider: options.keyframeProvider ?? "mock",
      clipProvider: options.clipProvider ?? "mock",
      voiceProvider: options.voiceProvider ?? "mock",
      storyboardFrameProvider: options.storyboardFrameProvider ?? "mock",
      packetPath: run.packetPath,
      storyboardPath,
      sourceRunId: run.id,
      waitForClip: options.waitForClip ?? false,
      requireLlm: false,
      storyboardOnly: false,
    });
    response.status(202).json({ ok: true, status: "queued", pid: started.pid, jobId: started.jobId, sourceRunId: run.id });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to render from storyboard.",
    });
  }
});

async function guardVideoAgentLiveRun(options: VideoAgentRunOptions & { confirmLiveSpend?: boolean }) {
  if (usesLiveVideoAgentProviders(options) && !options.confirmLiveSpend) {
    return "Enable live provider spend before using non-mock video providers.";
  }
  if (usesProductionClipProvider(options)) {
    const decision = await getVideoProductionDecision();
    if (!decision) return "Apply a reviewed provider bakeoff winner before live production clip rendering.";
    if (options.clipProvider && options.clipProvider !== decision.clipProvider) {
      return `Production clip rendering must use applied winner ${decision.clipProvider}.`;
    }
  }
  return null;
}

function usesLiveVideoAgentProviders(options: VideoAgentRunOptions) {
  return [options.keyframeProvider, options.clipProvider, options.voiceProvider, options.storyboardFrameProvider].some(
    (provider) => typeof provider === "string" && provider !== "mock",
  );
}

function usesProductionClipProvider(options: VideoAgentRunOptions) {
  return Boolean(!options.storyboardOnly && options.clipProvider && options.clipProvider !== "mock");
}

app.post("/api/video/jobs", async (request, response) => {
  try {
    const job = await createVideoJob(request.body as VideoJobInput);
    response.status(job.status === "dry_run" ? 200 : 202).json(job);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to create video job.",
    });
  }
});

app.get("/api/video/jobs/:requestId/status", async (request, response) => {
  try {
    const modelId = requireModelId(request.query.modelId);
    const status = await getFalJobStatus(modelId, request.params.requestId);
    response.json(status);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to fetch video status.",
    });
  }
});

app.get("/api/video/jobs/:requestId/result", async (request, response) => {
  try {
    const modelId = requireModelId(request.query.modelId);
    const result = await getFalJobResult(modelId, request.params.requestId);
    response.json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to fetch video result.",
    });
  }
});

app.use(express.static(publicPath));
app.use(express.static(distPath));

app.get("*", (_request, response) => {
  response.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Opaija API listening on http://localhost:${port}`);
});

function requireModelId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("modelId query parameter is required.");
  }
  return value;
}
