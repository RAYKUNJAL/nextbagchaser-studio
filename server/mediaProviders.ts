import fs from "node:fs/promises";
import path from "node:path";
import { createVideoJob, type VideoJobInput, type VideoJobResponse } from "./seedance.js";

export type ImageProviderResult = {
  provider: "mock" | "openai" | "gemini";
  status: "created" | "dry_run";
  prompt: string;
  outputPath?: string;
  publicPath?: string;
  responseId?: string;
};

export type VideoProviderResult = {
  provider: "mock" | "seedance" | "openai" | "openrouter";
  status: "queued" | "dry_run" | "completed";
  prompt: string;
  requestId: string;
  modelId: string;
  input: Record<string, unknown>;
  videoUrl?: string;
  outputPath?: string;
  publicPath?: string;
};

export async function createKeyframeImage({
  prompt,
  fileName,
  provider,
  referenceImagePaths,
}: {
  prompt: string;
  fileName: string;
  provider?: "mock" | "openai" | "gemini";
  referenceImagePaths?: string[];
}): Promise<ImageProviderResult> {
  const selectedProvider = provider ?? process.env.KEYFRAME_IMAGE_PROVIDER?.toLowerCase() ?? "mock";
  if (selectedProvider === "openai") return createOpenAiImage({ prompt, fileName, referenceImagePaths });
  if (selectedProvider === "gemini" || selectedProvider === "google") {
    return createGeminiImage({ prompt, fileName, referenceImagePaths });
  }

  return {
    provider: "mock",
    status: "dry_run",
    prompt,
  };
}

async function createGeminiImage({
  prompt,
  fileName,
  referenceImagePaths,
}: {
  prompt: string;
  fileName: string;
  referenceImagePaths?: string[];
}): Promise<ImageProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is required for KEYFRAME_IMAGE_PROVIDER=gemini.");

  const { GoogleGenAI, Modality } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3-pro-image";
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];

  for (const imagePath of (referenceImagePaths ?? []).filter(Boolean).slice(0, Number(process.env.GEMINI_IMAGE_REFERENCE_LIMIT ?? 6))) {
    const bytes = await fs.readFile(imagePath);
    parts.push({
      inlineData: {
        mimeType: imageMimeType(imagePath),
        data: bytes.toString("base64"),
      },
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });
  const responseData = response as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
    responseId?: string;
  };
  const imageData = responseData.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .find((part) => part.inlineData?.data)?.inlineData?.data;

  if (!imageData) throw new Error("Gemini image generation did not return image data.");

  const outputPath = await writeGeneratedImageOutput(fileName, Buffer.from(imageData, "base64"));
  return {
    provider: "gemini",
    status: "created",
    prompt,
    outputPath,
    publicPath: `/generated/keyframes/${path.basename(outputPath)}`,
    responseId: responseData.responseId,
  };
}

export async function createGeneratedVideoClip(input: VideoJobInput): Promise<VideoProviderResult> {
  const provider = process.env.VIDEO_CLIP_PROVIDER?.toLowerCase() ?? process.env.VIDEO_PROVIDER?.toLowerCase() ?? "mock";

  if (provider === "openai") return createOpenAiVideo(input);
  if (provider === "openrouter" || provider === "openrouter-seedance") return createOpenRouterVideo(input);
  if (provider === "fal" || provider === "seedance") return mapSeedanceJob(await createVideoJob(input), input.prompt);

  return {
    provider: "mock",
    status: "dry_run",
    prompt: input.prompt,
    requestId: `mock-clip-${Date.now()}`,
    modelId: "mock-video",
    input: input as Record<string, unknown>,
  };
}

export async function resolveGeneratedVideoClip({
  job,
  fileName,
}: {
  job: VideoProviderResult;
  fileName: string;
}): Promise<VideoProviderResult> {
  if (job.provider === "mock" || job.status === "dry_run") return job;

  if (job.provider === "seedance") {
    const result = await getSeedanceResult(job);
    const videoUrl = extractVideoUrl(result);
    if (!videoUrl) return { ...job, input: { ...job.input, result } };
    return downloadVideoResult({ job, videoUrl, fileName });
  }

  if (job.provider === "openai") {
    const videoUrl = await waitForOpenAiVideo(job.requestId);
    return downloadVideoResult({ job, videoUrl, fileName });
  }

  if (job.provider === "openrouter") {
    const videoUrl = await waitForOpenRouterVideo(job);
    return downloadVideoResult({ job, videoUrl, fileName });
  }

  return job;
}

async function createOpenRouterVideo(input: VideoJobInput): Promise<VideoProviderResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for VIDEO_CLIP_PROVIDER=openrouter.");

  const model = process.env.OPENROUTER_VIDEO_MODEL ?? "bytedance/seedance-2.0-fast";
  const duration = clampVideoDuration(Number(input.duration ?? 4), Number(process.env.OPENROUTER_VIDEO_MAX_DURATION_SEC ?? 15));
  const payload: Record<string, unknown> = {
    model,
    prompt: input.prompt,
    duration,
    resolution: process.env.OPENROUTER_VIDEO_RESOLUTION ?? input.resolution ?? "480p",
    aspect_ratio: input.aspectRatio ?? "9:16",
    generate_audio: input.generateAudio ?? false,
  };

  if (input.imageUrl) {
    payload.frame_images = [
      {
        type: "image_url",
        image_url: { url: await normalizeOpenRouterImageUrl(input.imageUrl) },
        frame_type: "first_frame",
      },
    ];
  }

  const response = await fetch("https://openrouter.ai/api/v1/videos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://opaija.com",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Opaija Command Center",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`OpenRouter video generation failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as {
    id?: string;
    polling_url?: string;
    status?: string;
    generation_id?: string;
    error?: string;
  };
  if (!data.id) throw new Error(`OpenRouter video generation did not return a job id: ${JSON.stringify(data)}`);

  return {
    provider: "openrouter",
    status: "queued",
    prompt: input.prompt,
    requestId: data.id,
    modelId: model,
    input: {
      ...sanitizeOpenRouterPayload(payload),
      pollingUrl: data.polling_url,
      status: data.status,
      generationId: data.generation_id,
      error: data.error,
    },
  };
}

function clampVideoDuration(duration: number, maxDuration: number) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 4;
  const safeMax = Number.isFinite(maxDuration) && maxDuration > 0 ? maxDuration : 15;
  return Math.max(1, Math.min(safeMax, Math.round(safeDuration)));
}

function sanitizeOpenRouterPayload(payload: Record<string, unknown>) {
  return {
    ...payload,
    frame_images: Array.isArray(payload.frame_images)
      ? payload.frame_images.map((frame) => ({
          ...(typeof frame === "object" && frame ? frame : {}),
          image_url: { url: "[inline-or-private-image-reference]" },
        }))
      : undefined,
  };
}

async function normalizeOpenRouterImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:")) return imageUrl;
  const localPath = localPublicPathFromUrl(imageUrl);
  if (!localPath) return imageUrl;
  const bytes = await fs.readFile(localPath);
  return `data:${imageMimeType(localPath)};base64,${bytes.toString("base64")}`;
}

function localPublicPathFromUrl(imageUrl: string) {
  const publicUrl = imageUrl.startsWith("/") ? imageUrl : tryReadLocalUrlPath(imageUrl);
  if (!publicUrl) return undefined;
  const cleanPath = decodeURIComponent(publicUrl.split("?")[0].replace(/^\/+/, ""));
  if (!cleanPath || cleanPath.includes("..")) return undefined;
  return path.resolve(process.cwd(), "public", cleanPath);
}

function tryReadLocalUrlPath(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    const publicSiteUrl = process.env.PUBLIC_SITE_URL ? new URL(process.env.PUBLIC_SITE_URL) : undefined;
    const isLocal = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    const isConfiguredSite = publicSiteUrl && url.origin === publicSiteUrl.origin;
    if (!isLocal && !isConfiguredSite) return undefined;
    return url.pathname;
  } catch {
    return undefined;
  }
}

async function createOpenAiImage({
  prompt,
  fileName,
  referenceImagePaths,
}: {
  prompt: string;
  fileName: string;
  referenceImagePaths?: string[];
}): Promise<ImageProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for KEYFRAME_IMAGE_PROVIDER=openai.");

  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  const useReferenceImageEdits = process.env.OPENAI_IMAGE_USE_REFERENCE_EDITS === "true";
  let response = useReferenceImageEdits && referenceImagePaths?.length
    ? await createOpenAiImageEdit({ apiKey, model, prompt, referenceImagePaths })
    : await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      size: process.env.OPENAI_IMAGE_SIZE ?? "1024x1536",
      n: 1,
    }),
  });

  if (!response.ok && model === "gpt-image-2") {
    const errorText = await response.text();
    if (
      response.status !== 403 &&
      response.status !== 404 &&
      !errorText.includes("model_not_found") &&
      !errorText.includes("invalid_input_fidelity_model")
    ) {
      throw new Error(`OpenAI image generation failed: ${response.status} ${errorText}`);
    }
    response = useReferenceImageEdits && referenceImagePaths?.length
      ? await createOpenAiImageEdit({ apiKey, model: "gpt-image-1", prompt, referenceImagePaths })
      : await createOpenAiImageGeneration({ apiKey, model: "gpt-image-1", prompt });
  }

  if (!response.ok && useReferenceImageEdits && referenceImagePaths?.length) {
    response = await createOpenAiImageGeneration({
      apiKey,
      model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
      prompt: `${prompt}\n\nReference-image editing was unavailable, so follow the written OPAIJA bible locks with extra strictness. Preserve the named characters exactly from their model-sheet descriptions.`,
    });
  }

  if (!response.ok) throw new Error(`OpenAI image generation failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }>; id?: string };
  const image = data.data?.[0];
  if (!image?.b64_json && !image?.url) throw new Error("OpenAI image generation did not return image data.");

  if (image.b64_json) {
    const outputPath = await writeGeneratedImageOutput(fileName, Buffer.from(image.b64_json, "base64"));
    return {
      provider: "openai",
      status: "created",
      prompt,
      outputPath,
      publicPath: `/generated/keyframes/${path.basename(outputPath)}`,
      responseId: data.id,
    };
  } else if (image.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) throw new Error(`Unable to download OpenAI image URL: ${imageResponse.status}`);
    const outputPath = await writeGeneratedImageOutput(fileName, Buffer.from(await imageResponse.arrayBuffer()));
    return {
      provider: "openai",
      status: "created",
      prompt,
      outputPath,
      publicPath: `/generated/keyframes/${path.basename(outputPath)}`,
      responseId: data.id,
    };
  }

  throw new Error("OpenAI image generation did not return image data.");
}

async function writeGeneratedImageOutput(fileName: string, bytes: Buffer) {
  const outputDir = path.join(process.cwd(), "public", "generated", "keyframes");
  await fs.mkdir(outputDir, { recursive: true });
  const safeName = fileName.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  const outputPath = path.join(outputDir, safeName.endsWith(".png") ? safeName : `${safeName}.png`);
  await fs.writeFile(outputPath, bytes);
  return outputPath;
}

function createOpenAiImageGeneration({ apiKey, model, prompt }: { apiKey: string; model: string; prompt: string }) {
  return fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size: process.env.OPENAI_IMAGE_SIZE ?? "1024x1536",
        n: 1,
      }),
  });
}

async function createOpenAiImageEdit({
  apiKey,
  model,
  prompt,
  referenceImagePaths,
}: {
  apiKey: string;
  model: string;
  prompt: string;
  referenceImagePaths: string[];
}) {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", process.env.OPENAI_IMAGE_SIZE ?? "1024x1536");
  form.append("n", "1");
  if (model === "gpt-image-1") form.append("input_fidelity", "high");

  for (const imagePath of referenceImagePaths.slice(0, 5)) {
    const bytes = await fs.readFile(imagePath);
    form.append("image[]", new Blob([bytes], { type: imageMimeType(imagePath) }), path.basename(imagePath));
  }

  return fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });
}

function imageMimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "image/png";
}

async function createOpenAiVideo(input: VideoJobInput): Promise<VideoProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for VIDEO_CLIP_PROVIDER=openai.");

  const response = await fetch("https://api.openai.com/v1/videos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VIDEO_MODEL ?? "sora-2",
      prompt: input.prompt,
      seconds: Number(input.duration ?? 4),
      size: process.env.OPENAI_VIDEO_SIZE ?? "720x1280",
      ...(input.imageUrl?.startsWith("http")
        ? {
            input_reference: {
              image_url: input.imageUrl,
            },
          }
        : {}),
    }),
  });

  if (!response.ok) throw new Error(`OpenAI video generation failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { id?: string; model?: string; status?: string };
  return {
    provider: "openai",
    status: "queued",
    prompt: input.prompt,
    requestId: data.id ?? `openai-video-${Date.now()}`,
    modelId: data.model ?? process.env.OPENAI_VIDEO_MODEL ?? "sora-2",
    input: {
      prompt: input.prompt,
      status: data.status,
      duration: input.duration,
      aspectRatio: input.aspectRatio,
    },
  };
}

function mapSeedanceJob(job: VideoJobResponse, prompt: string): VideoProviderResult {
  return {
    provider: "seedance",
    status: job.status,
    prompt,
    requestId: job.requestId,
    modelId: job.modelId,
    input: job.input,
  };
}

async function getSeedanceResult(job: VideoProviderResult) {
  const { getFalJobResult } = await import("./seedance.js");
  return getFalJobResult(job.modelId, job.requestId);
}

function extractVideoUrl(result: unknown): string | undefined {
  const data = result as {
    data?: { video?: { url?: string }; videos?: Array<{ url?: string }> };
    video?: { url?: string };
    videos?: Array<{ url?: string }>;
  };

  return data.data?.video?.url ?? data.data?.videos?.[0]?.url ?? data.video?.url ?? data.videos?.[0]?.url;
}

async function waitForOpenAiVideo(videoId: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required to download OpenAI video output.");
  const attempts = Number(process.env.OPENAI_VIDEO_POLL_ATTEMPTS ?? 30);
  const delayMs = Number(process.env.OPENAI_VIDEO_POLL_DELAY_MS ?? 10000);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(`OpenAI video status failed: ${response.status} ${await response.text()}`);
    const data = (await response.json()) as { status?: string };
    if (data.status === "completed" || data.status === "succeeded") {
      return `https://api.openai.com/v1/videos/${videoId}/content`;
    }
    if (data.status === "failed" || data.status === "cancelled") {
      throw new Error(`OpenAI video job ended with status ${data.status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`OpenAI video job ${videoId} did not complete within polling limit.`);
}

async function waitForOpenRouterVideo(job: VideoProviderResult) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required to download OpenRouter video output.");
  const attempts = Number(process.env.OPENROUTER_VIDEO_POLL_ATTEMPTS ?? 30);
  const delayMs = Number(process.env.OPENROUTER_VIDEO_POLL_DELAY_MS ?? 15000);
  const pollingUrl = typeof job.input.pollingUrl === "string"
    ? job.input.pollingUrl
    : `https://openrouter.ai/api/v1/videos/${job.requestId}`;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(pollingUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(`OpenRouter video status failed: ${response.status} ${await response.text()}`);
    const data = (await response.json()) as {
      status?: string;
      error?: string;
      unsigned_urls?: string[];
      usage?: unknown;
    };
    job.input = { ...job.input, providerStatus: data };
    if (data.status === "completed") {
      return data.unsigned_urls?.[0] ?? `https://openrouter.ai/api/v1/videos/${job.requestId}/content?index=0`;
    }
    if (data.status === "failed" || data.status === "cancelled" || data.status === "expired") {
      throw new Error(`OpenRouter video job ended with status ${data.status}: ${data.error ?? "No error detail returned."}`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`OpenRouter video job ${job.requestId} did not complete within polling limit.`);
}

async function downloadVideoResult({
  job,
  videoUrl,
  fileName,
}: {
  job: VideoProviderResult;
  videoUrl: string;
  fileName: string;
}): Promise<VideoProviderResult> {
  const outputDir = path.join(process.cwd(), "public", "generated", "clips");
  await fs.mkdir(outputDir, { recursive: true });
  const safeName = fileName.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  const outputPath = path.join(outputDir, safeName.endsWith(".mp4") ? safeName : `${safeName}.mp4`);
  const headers: HeadersInit =
    job.provider === "openai"
      ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}` }
      : job.provider === "openrouter"
        ? { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ""}` }
        : {};
  const response = await fetch(videoUrl, { headers });
  if (!response.ok) throw new Error(`Unable to download generated video: ${response.status} ${await response.text()}`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));

  return {
    ...job,
    status: "completed",
    videoUrl,
    outputPath,
    publicPath: `/generated/clips/${path.basename(outputPath)}`,
  };
}
