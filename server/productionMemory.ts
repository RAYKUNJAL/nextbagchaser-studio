import fs from "node:fs/promises";
import path from "node:path";
import type { ModelRouteResult } from "./modelRouter.js";
import type { ProductionAgentMessage } from "./productionSchemas.js";

export type ProductionMemoryEvent = {
  id: string;
  runId: string;
  type: "model-performance" | "agent-message" | "qc-result" | "lesson" | "artifact";
  summary: string;
  payloadPath?: string;
  model?: string;
  provider?: string;
  status?: string;
  score?: number;
  createdAt: string;
};

const memoryPath = path.resolve(process.cwd(), "data", "production-agent-memory.json");
const modelPerformancePath = path.resolve(process.cwd(), "data", "production-model-performance.json");

export async function listProductionMemory() {
  return {
    events: (await readJson<ProductionMemoryEvent[]>(memoryPath, [])).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    modelPerformance: (await readJson<ModelRouteResult[]>(modelPerformancePath, [])).sort(
      (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt),
    ),
  };
}

export async function recordModelPerformance(runId: string, result: ModelRouteResult) {
  const records = await readJson<ModelRouteResult[]>(modelPerformancePath, []);
  records.push(result);
  await writeJson(modelPerformancePath, records);
  await appendProductionMemory({
    id: `${runId}-${result.task}-${result.completedAt.replace(/[:.]/g, "-")}`,
    runId,
    type: "model-performance",
    summary: `${result.provider}/${result.model} ${result.status} for ${result.task}`,
    model: result.model,
    provider: result.provider,
    status: result.status,
    createdAt: result.completedAt,
  });
}

export async function recordAgentMessages(messages: ProductionAgentMessage[]) {
  for (const message of messages) {
    await appendProductionMemory({
        id: message.id,
        runId: message.runId,
        type: "agent-message",
        summary: `${message.fromAgent} -> ${message.toAgent}: ${message.summary}`,
        payloadPath: message.payloadPath,
        status: message.status,
        createdAt: message.createdAt,
    });
  }
}

export async function appendProductionMemory(event: ProductionMemoryEvent) {
  const events = await readJson<ProductionMemoryEvent[]>(memoryPath, []);
  events.push(event);
  await writeJson(memoryPath, events.slice(-1000));
  return event;
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    if (error instanceof SyntaxError) {
      const repaired = await readFirstJsonArray(filePath);
      if (repaired) return repaired as T;
    }
    throw error;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readFirstJsonArray(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  const start = raw.indexOf("[");
  if (start < 0) return null;
  let depth = 0;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (depth === 0) {
      try {
        return JSON.parse(raw.slice(start, index + 1)) as unknown[];
      } catch {
        return null;
      }
    }
  }
  return null;
}
