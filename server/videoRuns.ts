import fs from "node:fs/promises";
import path from "node:path";

export type VideoRunStatus = "planned" | "rendered" | "queued" | "failed" | "approved" | "rejected";

export type VideoRunRecord = {
  id: string;
  title: string;
  status: VideoRunStatus;
  createdAt: string;
  updatedAt: string;
  category: string;
  outputPath?: string;
  packetPath: string;
  publicVideoPath?: string;
  sourceRunId?: string;
  characterId?: string;
  characterName?: string;
  characterImage?: string;
  socialCaption: string;
  hashtags: string[];
  reviewNote?: string;
  reviewedAt?: string;
};

const runsPath = path.resolve(process.cwd(), "data", "video-runs.json");

export async function listVideoRuns() {
  const runs = await readVideoRuns();
  return runs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getVideoRun(id: string) {
  const runs = await readVideoRuns();
  return runs.find((run) => run.id === id) ?? null;
}

export async function upsertVideoRun(record: VideoRunRecord) {
  const runs = await readVideoRuns();
  const index = runs.findIndex((run) => run.id === record.id);
  if (index >= 0) runs[index] = record;
  else runs.push(record);
  await writeVideoRuns(runs);
  return record;
}

export async function updateVideoRunReview({
  id,
  status,
  reviewNote,
}: {
  id: string;
  status: Extract<VideoRunStatus, "approved" | "rejected">;
  reviewNote?: string;
}) {
  const runs = await readVideoRuns();
  const index = runs.findIndex((run) => run.id === id);
  if (index < 0) return null;
  runs[index] = {
    ...runs[index],
    status,
    reviewNote,
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeVideoRuns(runs);
  return runs[index];
}

async function readVideoRuns(): Promise<VideoRunRecord[]> {
  try {
    const raw = await fs.readFile(runsPath, "utf8");
    return JSON.parse(raw) as VideoRunRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeVideoRuns(runs: VideoRunRecord[]) {
  await fs.mkdir(path.dirname(runsPath), { recursive: true });
  await fs.writeFile(runsPath, `${JSON.stringify(runs, null, 2)}\n`, "utf8");
}
