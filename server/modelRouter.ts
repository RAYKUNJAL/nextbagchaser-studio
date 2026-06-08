import OpenAI from "openai";
import type { ProductionMode } from "./productionSchemas.js";

export type ModelTaskKind =
  | "story-packet"
  | "agent-planning"
  | "storyboard-planner"
  | "character-qc"
  | "prompt-polish"
  | "style-audit"
  | "memory-summary"
  | "blog-social";

export type RoutedModelProvider = "qwen-local" | "openrouter" | "openai";

export type ModelRouteRequest = {
  task: ModelTaskKind;
  mode: ProductionMode;
  prompt: string;
  json?: boolean;
  preferredEscalationProvider?: "openrouter" | "openai";
};

export type ModelRouteResult = {
  task: ModelTaskKind;
  mode: ProductionMode;
  provider: RoutedModelProvider;
  model: string;
  status: "completed" | "dry_run" | "failed";
  output?: string;
  prompt: string;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  error?: string;
};

export function resolveModelProvider({
  task,
  mode,
  preferredEscalationProvider,
}: Pick<ModelRouteRequest, "task" | "mode" | "preferredEscalationProvider">): RoutedModelProvider {
  if (mode === "local-qwen") return "qwen-local";
  if (mode === "production" && (task === "prompt-polish" || task === "style-audit")) {
    return preferredEscalationProvider ?? resolveEscalationProvider();
  }
  return "qwen-local";
}

export async function runRoutedModelTask(request: ModelRouteRequest): Promise<ModelRouteResult> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const provider = resolveModelProvider(request);
  try {
    const output =
      provider === "qwen-local"
        ? await runQwenLocal(request)
        : await runEscalationModel({ ...request, provider });
    return {
      task: request.task,
      mode: request.mode,
      provider,
      model: resolveModelName(provider),
      status: output ? "completed" : "dry_run",
      output,
      prompt: request.prompt,
      startedAt,
      completedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedMs,
    };
  } catch (error) {
    return {
      task: request.task,
      mode: request.mode,
      provider,
      model: resolveModelName(provider),
      status: "failed",
      prompt: request.prompt,
      startedAt,
      completedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedMs,
      error: error instanceof Error ? error.message : "Model task failed.",
    };
  }
}

export function resolveQwenConfig() {
  const provider = process.env.VIDEO_AGENT_LLM_PROVIDER ?? "ollama";
  return {
    provider,
    baseUrl:
      process.env.VIDEO_AGENT_LLM_BASE_URL ??
      process.env.BLOG_LLM_BASE_URL ??
      (provider === "openai-compatible" ? "http://localhost:1234/v1" : "http://localhost:11434"),
    model: process.env.VIDEO_AGENT_LLM_MODEL ?? process.env.BLOG_LLM_MODEL ?? "qwen3",
    apiKey: process.env.VIDEO_AGENT_LLM_API_KEY ?? "local",
  };
}

export function getModelRouterStatus() {
  const qwen = resolveQwenConfig();
  const escalationProvider = resolveEscalationProvider();
  return {
    defaultBrain: "qwen-local" as const,
    qwen,
    escalationProvider,
    escalationModel: resolveModelName(escalationProvider),
    modes: [
      {
        id: "local-qwen",
        label: "Local Qwen",
        behavior: "Qwen handles all text planning, validation attempts, reports, and memory updates.",
      },
      {
        id: "hybrid",
        label: "Hybrid",
        behavior: "Qwen handles the run; OpenRouter/OpenAI is available for failed JSON repair or prompt polish.",
      },
      {
        id: "production",
        label: "Production",
        behavior: "Qwen handles planning; cloud escalation polishes final prompts before paid media providers.",
      },
    ],
  };
}

function resolveEscalationProvider(): "openrouter" | "openai" {
  if (process.env.BRAIN_PROVIDER?.toLowerCase() === "openrouter" || process.env.OPENROUTER_API_KEY) return "openrouter";
  return "openai";
}

function resolveModelName(provider: RoutedModelProvider) {
  if (provider === "qwen-local") return resolveQwenConfig().model;
  if (provider === "openrouter") return process.env.OPENROUTER_MODEL ?? "moonshotai/kimi-k2";
  return process.env.OPENAI_MODEL ?? "gpt-5";
}

async function runQwenLocal(request: ModelRouteRequest) {
  const config = resolveQwenConfig();
  if (config.provider === "openai-compatible") {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: request.prompt }],
        response_format: request.json ? { type: "json_object" } : undefined,
        temperature: Number(process.env.VIDEO_AGENT_LLM_TEMPERATURE ?? process.env.BLOG_LLM_TEMPERATURE ?? 0.55),
      }),
    });
    if (!response.ok) throw new Error(`Qwen OpenAI-compatible server failed: ${response.status} ${await response.text()}`);
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  }

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      prompt: request.prompt,
      stream: false,
      format: request.json ? "json" : undefined,
      options: {
        temperature: Number(process.env.VIDEO_AGENT_LLM_TEMPERATURE ?? process.env.BLOG_LLM_TEMPERATURE ?? 0.55),
      },
    }),
  });
  if (!response.ok) throw new Error(`Qwen/Ollama failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { response?: string };
  return data.response ?? "";
}

async function runEscalationModel(request: ModelRouteRequest & { provider: "openrouter" | "openai" }) {
  if (request.provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) return "";
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? process.env.PUBLIC_SITE_URL ?? "https://opaija.com",
        "X-OpenRouter-Title": process.env.OPENROUTER_APP_NAME ?? "Opaija Command Center",
      },
    });
    const completion = await client.chat.completions.create({
      model: resolveModelName("openrouter"),
      messages: [{ role: "user", content: request.prompt }],
      temperature: 0.35,
      response_format: request.json ? { type: "json_object" } : undefined,
    });
    return completion.choices[0]?.message?.content ?? "";
  }

  if (!process.env.OPENAI_API_KEY) return "";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: resolveModelName("openai"),
    messages: [{ role: "user", content: request.prompt }],
    temperature: 0.35,
    response_format: request.json ? { type: "json_object" } : undefined,
  });
  return completion.choices[0]?.message?.content ?? "";
}
