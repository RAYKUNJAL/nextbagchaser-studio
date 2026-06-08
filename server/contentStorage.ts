import fs from "node:fs/promises";
import path from "node:path";

export type ContentStorageAsset = {
  type: "video" | "audio" | "image" | "clip" | "manifest" | "props" | "source" | "timing";
  label: string;
  publicPath?: string;
  filePath?: string;
};

export type ContentStorageItem = {
  id: string;
  title: string;
  category: "episode" | "storyboard" | "clip" | "voice" | "reference" | "social";
  status: "draft" | "needs_review" | "approved" | "rejected";
  style: string;
  createdAt: string;
  updatedAt: string;
  buildId?: string;
  episode?: string;
  notes: string[];
  assets: ContentStorageAsset[];
};

const dataDir = path.resolve(process.cwd(), "data");
const storagePath = path.join(dataDir, "content-storage.json");

export async function listContentStorageItems(): Promise<ContentStorageItem[]> {
  const items = await readStorage();
  return items.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function upsertContentStorageItem(item: ContentStorageItem) {
  const items = await readStorage();
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index >= 0) items[index] = item;
  else items.push(item);
  await writeStorage(items);
  return item;
}

export async function registerEpisodeBuildContent({
  id,
  title,
  buildId,
  episode,
  status,
  style,
  notes,
  assets,
}: {
  id: string;
  title: string;
  buildId: string;
  episode: string;
  status: ContentStorageItem["status"];
  style: string;
  notes: string[];
  assets: ContentStorageAsset[];
}) {
  const existing = (await readStorage()).find((item) => item.id === id);
  return upsertContentStorageItem({
    id,
    title,
    category: "episode",
    status,
    style,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    buildId,
    episode,
    notes,
    assets,
  });
}

async function readStorage(): Promise<ContentStorageItem[]> {
  try {
    return JSON.parse(await fs.readFile(storagePath, "utf8")) as ContentStorageItem[];
  } catch {
    return [];
  }
}

async function writeStorage(items: ContentStorageItem[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(storagePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}
