import fs from "node:fs/promises";
import path from "node:path";
import type { BakeoffPreflightReport } from "./providerBakeoffPreflight.js";
import type { ProviderSmokeTestRecord } from "./providerSmokeTests.js";

export type ProviderBakeoffPacket = {
  id: string;
  createdAt: string;
  liveSpendConfirmed: boolean;
  ok: boolean;
  stage: string;
  preflight?: BakeoffPreflightReport;
  openaiFrame: ProviderSmokeTestRecord | null;
  seedanceReference: ProviderSmokeTestRecord | null;
  soraReference: ProviderSmokeTestRecord | null;
};

const packetsPath = path.resolve(process.cwd(), "data", "provider-bakeoff-packets.json");

export async function listProviderBakeoffPackets() {
  const packets = await readPackets();
  return packets.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getLatestProviderBakeoffPacket() {
  return (await listProviderBakeoffPackets())[0] ?? null;
}

export async function recordProviderBakeoffPacket(packet: Omit<ProviderBakeoffPacket, "id" | "createdAt">) {
  const createdAt = new Date().toISOString();
  const next: ProviderBakeoffPacket = {
    id: `${createdAt.replace(/[:.]/g, "-")}-provider-bakeoff`,
    createdAt,
    ...packet,
  };
  const packets = await readPackets();
  packets.push(next);
  await fs.mkdir(path.dirname(packetsPath), { recursive: true });
  await fs.writeFile(packetsPath, `${JSON.stringify(packets, null, 2)}\n`, "utf8");
  return next;
}

async function readPackets(): Promise<ProviderBakeoffPacket[]> {
  try {
    return JSON.parse(await fs.readFile(packetsPath, "utf8")) as ProviderBakeoffPacket[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
