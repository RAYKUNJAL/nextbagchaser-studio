import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { createGeneratedVideoClip, createKeyframeImage, resolveGeneratedVideoClip, type VideoProviderResult } from "./mediaProviders.js";
import { createVideoJob, getFalJobResult, getFalJobStatus } from "./seedance.js";
import { absolutePublicUrl, resolveReferenceAssetUrl } from "./referenceAssets.js";
import { getProviderBakeoffPreflight } from "./providerBakeoffPreflight.js";
import { recordProviderBakeoffPacket } from "./providerBakeoffPackets.js";

dotenv.config();

export type ProviderSmokeTestProvider =
  | "openai-keyframe"
  | "openai-storyboard-frame"
  | "openai-sora-reference-clip"
  | "seedance-clip"
  | "seedance-reference-clip";
export type ProviderSmokeTestStatus = "dry_run" | "configured" | "queued" | "created" | "completed" | "failed";

export type ProviderSmokeTestRecord = {
  id: string;
  provider: ProviderSmokeTestProvider;
  status: ProviderSmokeTestStatus;
  createdAt: string;
  updatedAt: string;
  liveSpendConfirmed: boolean;
  requestId?: string;
  modelId?: string;
  videoUrl?: string;
  outputPath?: string;
  publicPath?: string;
  providerStatus?: unknown;
  review?: ProviderSmokeTestReview;
  error?: string;
};

export type ProviderSmokeTestReview = {
  characterConsistency: number;
  motionQuality: number;
  artifactControl: number;
  storyClarity: number;
  costScore: number;
  speedScore: number;
  note?: string;
  reviewedAt: string;
};

const smokeTestsPath = path.resolve(process.cwd(), "data", "provider-smoke-tests.json");

export async function listProviderSmokeTests() {
  const tests = await readProviderSmokeTests();
  return tests.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function hasVerifiedProvider(provider: ProviderSmokeTestProvider) {
  const tests = await readProviderSmokeTests();
  return tests.some((test) => test.provider === provider && ["created", "completed"].includes(test.status));
}

export async function reviewProviderSmokeTest({
  id,
  review,
}: {
  id: string;
  review: Omit<ProviderSmokeTestReview, "reviewedAt">;
}) {
  const tests = await readProviderSmokeTests();
  const index = tests.findIndex((test) => test.id === id);
  if (index < 0) return null;
  tests[index] = {
    ...tests[index],
    updatedAt: new Date().toISOString(),
    review: {
      ...review,
      characterConsistency: clampScore(review.characterConsistency),
      motionQuality: clampScore(review.motionQuality),
      artifactControl: clampScore(review.artifactControl),
      storyClarity: clampScore(review.storyClarity),
      costScore: clampScore(review.costScore),
      speedScore: clampScore(review.speedScore),
      reviewedAt: new Date().toISOString(),
    },
  };
  await writeProviderSmokeTests(tests);
  return tests[index];
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10, Math.round(value)));
}

export async function completeProviderSmokeTest(id: string) {
  const tests = await readProviderSmokeTests();
  const record = tests.find((test) => test.id === id);
  if (!record) return null;

  let updated: ProviderSmokeTestRecord = { ...record, updatedAt: new Date().toISOString() };
  try {
    if (
      record.provider !== "seedance-clip" &&
      record.provider !== "seedance-reference-clip" &&
      record.provider !== "openai-sora-reference-clip"
    ) {
      throw new Error("Only video smoke tests need completion polling.");
    }
    if (!record.modelId || !record.requestId) {
      throw new Error("Video smoke test is missing modelId or requestId.");
    }

    if (record.provider === "openai-sora-reference-clip") {
      const completed = await resolveGeneratedVideoClip({
        job: {
          provider: "openai",
          status: "queued",
          prompt: String((record.providerStatus as { prompt?: string } | undefined)?.prompt ?? "Opaija Sora reference smoke test."),
          requestId: record.requestId,
          modelId: record.modelId,
          input: (record.providerStatus as { input?: Record<string, unknown> } | undefined)?.input ?? {},
        },
        fileName: `${record.id}.mp4`,
      });
      updated = {
        ...updated,
        status: completed.status === "completed" ? "completed" : "queued",
        videoUrl: completed.videoUrl,
        outputPath: completed.outputPath,
        publicPath: completed.publicPath,
        providerStatus: completed,
      };
      await upsertProviderSmokeTest(updated);
      return updated;
    }

    const status = await getFalJobStatus(record.modelId, record.requestId);
    updated = { ...updated, providerStatus: status };
    const statusText = String((status as { status?: string }).status ?? "").toUpperCase();
    if (statusText && !["COMPLETED", "SUCCEEDED", "SUCCESS"].includes(statusText)) {
      await upsertProviderSmokeTest(updated);
      return updated;
    }

    const result = await getFalJobResult(record.modelId, record.requestId);
    const videoUrl = extractVideoUrl(result);
    if (!videoUrl) {
      throw new Error("Seedance smoke test completed but no video URL was returned.");
    }

    const downloaded = await downloadSmokeVideo({
      id: record.id,
      videoUrl,
    });
    updated = {
      ...updated,
      status: "completed",
      videoUrl,
      outputPath: downloaded.outputPath,
      publicPath: downloaded.publicPath,
      providerStatus: result,
    };
  } catch (error) {
    updated = {
      ...updated,
      status: "failed",
      error: error instanceof Error ? error.message : "Unable to complete provider smoke test.",
    };
  }

  await upsertProviderSmokeTest(updated);
  return updated;
}

export async function completeQueuedProviderSmokeTests() {
  const tests = await readProviderSmokeTests();
  const queued = tests.filter((test) => test.status === "queued");
  const completed: ProviderSmokeTestRecord[] = [];
  const failed: ProviderSmokeTestRecord[] = [];
  const stillQueued: ProviderSmokeTestRecord[] = [];

  for (const test of queued) {
    const record = await completeProviderSmokeTest(test.id);
    if (!record) continue;
    if (record.status === "completed") completed.push(record);
    else if (record.status === "failed") failed.push(record);
    else stillQueued.push(record);
  }

  return {
    checked: queued.length,
    completed,
    failed,
    stillQueued,
  };
}

export async function runProviderSmokeTest({
  provider,
  confirmLiveSpend,
}: {
  provider: ProviderSmokeTestProvider;
  confirmLiveSpend?: boolean;
}) {
  const createdAt = new Date().toISOString();
  const id = `${createdAt.replace(/[:.]/g, "-")}-${provider}`;
  let record: ProviderSmokeTestRecord = {
    id,
    provider,
    status: "dry_run",
    createdAt,
    updatedAt: createdAt,
    liveSpendConfirmed: Boolean(confirmLiveSpend),
  };

  try {
    if (
      (provider === "openai-keyframe" ||
        provider === "openai-storyboard-frame" ||
        provider === "openai-sora-reference-clip") &&
      !process.env.OPENAI_API_KEY
    ) {
      throw new Error("OPENAI_API_KEY is required for an OpenAI smoke test.");
    }
    if ((provider === "seedance-clip" || provider === "seedance-reference-clip") && !process.env.FAL_KEY) {
      throw new Error("FAL_KEY is required for a Seedance smoke test.");
    }

    if (!confirmLiveSpend) {
      record = { ...record, status: "configured", updatedAt: new Date().toISOString() };
      await upsertProviderSmokeTest(record);
      return record;
    }

    if (provider === "seedance-reference-clip" || provider === "openai-sora-reference-clip") {
      const preflight = await getProviderBakeoffPreflight();
      if (!preflight.ok) {
        throw new Error(`Reference-video preflight failed: ${preflight.checks.filter((check) => !check.ok).map((check) => check.detail).join(" ")}`);
      }
    }

    if (provider === "openai-keyframe" || provider === "openai-storyboard-frame") {
      const previousProvider = process.env.KEYFRAME_IMAGE_PROVIDER;
      let image: Awaited<ReturnType<typeof createKeyframeImage>>;
      try {
        process.env.KEYFRAME_IMAGE_PROVIDER = "openai";
        image = await createKeyframeImage({
          fileName: `${id}.png`,
          prompt:
            provider === "openai-storyboard-frame"
              ? "Storyboard frame for Opaija Season 1, Kairo Kai Baptiste enters a Trinidad gayelle circle holding The Listening Bois, 2D Caribbean anime, clean cinematic production frame, single pose, no text, no labels, no grid, vertical 9:16."
              : "Opaija Caribbean anime production keyframe smoke test, original teenage stick-fighter hero silhouette, no text, clean model-sheet-safe art.",
        });
      } finally {
        if (previousProvider === undefined) delete process.env.KEYFRAME_IMAGE_PROVIDER;
        else process.env.KEYFRAME_IMAGE_PROVIDER = previousProvider;
      }
      record = {
        ...record,
        status: "created",
        updatedAt: new Date().toISOString(),
        requestId: image.responseId,
        outputPath: image.outputPath,
        publicPath: image.publicPath,
      };
    } else if (provider === "openai-sora-reference-clip") {
      const previousProvider = process.env.VIDEO_CLIP_PROVIDER;
      let job: VideoProviderResult;
      const referenceImageUrl = await findLatestOpenAiStoryboardFramePublicUrl();
      const prompt =
        "Animate @Image1 as a short Sora 2 A/B test. Preserve Kairo Kai Baptiste identity, face, hair, wardrobe, The Listening Bois, and vertical framing from the referenced Opaija storyboard frame. Slow push-in, dust drift, subtle drum-energy pulse, no text.";
      try {
        process.env.VIDEO_CLIP_PROVIDER = "openai";
        job = await createGeneratedVideoClip({
          mode: "image-to-video",
          imageUrl: referenceImageUrl,
          prompt,
          duration: "4",
          resolution: "720p",
          aspectRatio: "9:16",
          generateAudio: false,
          fast: true,
        });
      } finally {
        if (previousProvider === undefined) delete process.env.VIDEO_CLIP_PROVIDER;
        else process.env.VIDEO_CLIP_PROVIDER = previousProvider;
      }
      record = {
        ...record,
        status: "queued",
        updatedAt: new Date().toISOString(),
        requestId: job.requestId,
        modelId: job.modelId,
        publicPath: referenceImageUrl,
        providerStatus: {
          prompt,
          input: job.input,
        },
      };
    } else {
      const previousProvider = process.env.VIDEO_PROVIDER;
      let job: Awaited<ReturnType<typeof createVideoJob>>;
      let referenceImageUrl: string | undefined;
      try {
        process.env.VIDEO_PROVIDER = "fal";
        referenceImageUrl =
          provider === "seedance-reference-clip" ? await findLatestOpenAiStoryboardFramePublicUrl() : undefined;
        job = await createVideoJob({
          mode: referenceImageUrl ? "reference-to-video" : "text-to-video",
          prompt: referenceImageUrl
            ? "Animate @Image1 as a short 2D Caribbean anime motion test. Preserve Kairo Kai Baptiste identity, face, hair, wardrobe, The Listening Bois, and vertical framing from the referenced Opaija storyboard frame. Slow push-in, dust drift, subtle drum-energy pulse, no text."
            : "Opaija Caribbean anime smoke test, original hero training in a moonlit gayelle, dynamic camera, no text.",
          referenceImageUrls: referenceImageUrl ? [referenceImageUrl] : undefined,
          duration: "5",
          resolution: "480p",
          aspectRatio: "9:16",
          generateAudio: false,
          fast: true,
        });
      } finally {
        if (previousProvider === undefined) delete process.env.VIDEO_PROVIDER;
        else process.env.VIDEO_PROVIDER = previousProvider;
      }
      record = {
        ...record,
        status: "queued",
        updatedAt: new Date().toISOString(),
        requestId: job.requestId,
        modelId: job.modelId,
        publicPath: referenceImageUrl,
      };
    }
  } catch (error) {
    record = {
      ...record,
      status: "failed",
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Provider smoke test failed.",
    };
  }

  await upsertProviderSmokeTest(record);
  return record;
}

export async function runStoryboardToSeedanceSmokeTest({
  confirmLiveSpend,
  pollAttempts = 6,
  pollDelayMs = 10000,
}: {
  confirmLiveSpend?: boolean;
  pollAttempts?: number;
  pollDelayMs?: number;
}) {
  const openaiFrame = await runProviderSmokeTest({
    provider: "openai-storyboard-frame",
    confirmLiveSpend,
  });

  if (openaiFrame.status === "failed" || (!confirmLiveSpend && openaiFrame.status !== "configured")) {
    return {
      ok: false,
      stage: "openai-storyboard-frame",
      openaiFrame,
      seedanceReference: null,
    };
  }

  const seedanceReference = await runProviderSmokeTest({
    provider: "seedance-reference-clip",
    confirmLiveSpend,
  });

  let completedSeedanceReference = seedanceReference;
  if (confirmLiveSpend && seedanceReference.status === "queued") {
    for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
      completedSeedanceReference = (await completeProviderSmokeTest(seedanceReference.id)) ?? completedSeedanceReference;
      if (completedSeedanceReference.status === "completed" || completedSeedanceReference.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
    }
  }

  return {
    ok: confirmLiveSpend
      ? openaiFrame.status === "created" && completedSeedanceReference.status === "completed"
      : openaiFrame.status === "configured" && completedSeedanceReference.status === "configured",
    stage: completedSeedanceReference.status === "completed" || completedSeedanceReference.status === "configured"
      ? "complete"
      : "seedance-reference-clip",
    openaiFrame,
    seedanceReference: completedSeedanceReference,
  };
}

export async function runProviderBakeoffSmokeTest({
  confirmLiveSpend,
  pollAttempts = 6,
  pollDelayMs = 10000,
}: {
  confirmLiveSpend?: boolean;
  pollAttempts?: number;
  pollDelayMs?: number;
}) {
  if (confirmLiveSpend) {
    const preflight = await getProviderBakeoffPreflight();
    if (!preflight.ok) {
      return recordProviderBakeoffPacket({
        ok: false,
        stage: "preflight",
        liveSpendConfirmed: Boolean(confirmLiveSpend),
        preflight,
        openaiFrame: null,
        seedanceReference: null,
        soraReference: null,
      });
    }
  }

  const openaiFrame = await runProviderSmokeTest({
    provider: "openai-storyboard-frame",
    confirmLiveSpend,
  });

  if (openaiFrame.status === "failed" || (!confirmLiveSpend && openaiFrame.status !== "configured")) {
    return recordProviderBakeoffPacket({
      ok: false,
      stage: "openai-storyboard-frame",
      liveSpendConfirmed: Boolean(confirmLiveSpend),
      openaiFrame,
      seedanceReference: null,
      soraReference: null,
    });
  }

  const seedanceReference = await runProviderSmokeTest({
    provider: "seedance-reference-clip",
    confirmLiveSpend,
  });
  const soraReference = await runProviderSmokeTest({
    provider: "openai-sora-reference-clip",
    confirmLiveSpend,
  });

  const completedSeedanceReference =
    confirmLiveSpend && seedanceReference.status === "queued"
      ? await pollProviderSmokeTest(seedanceReference.id, pollAttempts, pollDelayMs)
      : seedanceReference;
  const completedSoraReference =
    confirmLiveSpend && soraReference.status === "queued"
      ? await pollProviderSmokeTest(soraReference.id, pollAttempts, pollDelayMs)
      : soraReference;

  return recordProviderBakeoffPacket({
    ok: confirmLiveSpend
      ? openaiFrame.status === "created" &&
        completedSeedanceReference.status === "completed" &&
        completedSoraReference.status === "completed"
      : openaiFrame.status === "configured" &&
        completedSeedanceReference.status === "configured" &&
        completedSoraReference.status === "configured",
    stage:
      completedSeedanceReference.status === "failed"
        ? "seedance-reference-clip"
        : completedSoraReference.status === "failed"
          ? "openai-sora-reference-clip"
          : "complete",
    liveSpendConfirmed: Boolean(confirmLiveSpend),
    openaiFrame,
    seedanceReference: completedSeedanceReference,
    soraReference: completedSoraReference,
  });
}

async function pollProviderSmokeTest(id: string, pollAttempts: number, pollDelayMs: number) {
  let record = (await completeProviderSmokeTest(id)) ?? (await listProviderSmokeTests()).find((test) => test.id === id);
  for (let attempt = 1; record?.status === "queued" && attempt < pollAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
    record = (await completeProviderSmokeTest(id)) ?? record;
  }
  if (!record) throw new Error(`Provider smoke test ${id} was not found during polling.`);
  return record;
}

async function findLatestOpenAiStoryboardFramePublicUrl() {
  const tests = await listProviderSmokeTests();
  const frame = tests.find(
    (test) => test.provider === "openai-storyboard-frame" && test.status === "created" && test.publicPath,
  );
  if (!frame?.publicPath) {
    throw new Error("Run a live OpenAI storyboard frame test before the Seedance reference clip test.");
  }
  return (
    (await resolveReferenceAssetUrl({
      outputPath: frame.outputPath,
      publicPath: frame.publicPath,
    })) ?? absolutePublicUrl(frame.publicPath)
  );
}

function extractVideoUrl(result: unknown): string | undefined {
  const data = result as {
    data?: { video?: { url?: string }; videos?: Array<{ url?: string }> };
    video?: { url?: string };
    videos?: Array<{ url?: string }>;
  };

  return data.data?.video?.url ?? data.data?.videos?.[0]?.url ?? data.video?.url ?? data.videos?.[0]?.url;
}

async function downloadSmokeVideo({ id, videoUrl }: { id: string; videoUrl: string }) {
  const outputDir = path.join(process.cwd(), "public", "generated", "provider-smoke-tests");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${id}.mp4`);
  const response = await fetch(videoUrl);
  if (!response.ok) throw new Error(`Unable to download Seedance smoke test video: ${response.status}`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  return {
    outputPath,
    publicPath: `/generated/provider-smoke-tests/${path.basename(outputPath)}`,
  };
}

async function upsertProviderSmokeTest(record: ProviderSmokeTestRecord) {
  const tests = await readProviderSmokeTests();
  const index = tests.findIndex((test) => test.id === record.id);
  if (index >= 0) tests[index] = record;
  else tests.push(record);
  await writeProviderSmokeTests(tests);
}

async function readProviderSmokeTests(): Promise<ProviderSmokeTestRecord[]> {
  try {
    const raw = await fs.readFile(smokeTestsPath, "utf8");
    return JSON.parse(raw) as ProviderSmokeTestRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeProviderSmokeTests(tests: ProviderSmokeTestRecord[]) {
  await fs.mkdir(path.dirname(smokeTestsPath), { recursive: true });
  await fs.writeFile(smokeTestsPath, `${JSON.stringify(tests, null, 2)}\n`, "utf8");
}
