import fs from "node:fs/promises";
import path from "node:path";

export type VideoPacketReadiness = {
  ok: boolean;
  packetDir: string;
  checks: Array<{
    id: string;
    ok: boolean;
    reason: string;
  }>;
};

type StoryboardQc = {
  ok?: boolean;
  score?: number;
};

type CharacterReferencePack = {
  id?: string;
  name?: string;
  identityLock?: string;
  seedanceContinuityPrompt?: string;
  referenceImages?: unknown[];
  forbiddenDrift?: unknown[];
};

type SceneManifest = {
  referencePacks?: {
    characterReferencePack?: unknown;
  };
  storyboard?: Array<{
    sceneId?: string;
    firstFrame?: string;
    lastFrame?: string;
    motionArc?: string;
    continuityLock?: string;
    videoPrompt?: string;
  }>;
  seedance?: {
    continuityPrompt?: string;
    sequencePrompt?: string;
  };
  storyboardPanels?: {
    panelCount?: number;
    panels?: unknown[];
  };
};

export async function validateVideoPacket(packetPath: string): Promise<VideoPacketReadiness> {
  const packetDir = path.dirname(packetPath);
  const safeRoot = path.resolve(process.cwd(), "out", "video-agent");
  const resolvedPacketDir = path.resolve(packetDir);
  const checks: VideoPacketReadiness["checks"] = [];

  checks.push({
    id: "safe-path",
    ok: resolvedPacketDir.startsWith(safeRoot),
    reason: "Packet path must stay inside out/video-agent.",
  });

  if (!resolvedPacketDir.startsWith(safeRoot)) {
    return { ok: false, packetDir: resolvedPacketDir, checks };
  }

  const requiredFiles = [
    "packet.json",
    "story.json",
    "reference-pack.json",
    "visual-lock.json",
    "storyboard.json",
    "storyboard-panels.json",
    "storyboard-panel-sheet.md",
    "storyboard-contact-sheet.svg",
    "storyboard-qc.json",
    "scene_manifest.json",
    "seedance-storyboard-prompt.txt",
  ];

  for (const fileName of requiredFiles) {
    checks.push({
      id: `file-${fileName}`,
      ok: await fileExists(path.join(resolvedPacketDir, fileName)),
      reason: `${fileName} must exist in the packet folder.`,
    });
  }

  const qc = await readJson<StoryboardQc>(path.join(resolvedPacketDir, "storyboard-qc.json"));
  checks.push({
    id: "storyboard-qc",
    ok: Boolean(qc?.ok && Number(qc.score ?? 0) >= 80),
    reason: "Storyboard QC must pass with score 80 or higher.",
  });

  const referencePack = await readJson<CharacterReferencePack>(path.join(resolvedPacketDir, "reference-pack.json"));
  checks.push({
    id: "reference-pack-identity",
    ok: Boolean(referencePack?.id && referencePack.name && referencePack.identityLock && referencePack.seedanceContinuityPrompt),
    reason: "Reference pack must include character id, name, identity lock, and Seedance continuity prompt.",
  });
  checks.push({
    id: "reference-pack-assets",
    ok: Boolean(referencePack?.referenceImages?.length && referencePack.forbiddenDrift?.length),
    reason: "Reference pack must include reference images and forbidden drift rules.",
  });

  const sceneManifest = await readJson<SceneManifest>(path.join(resolvedPacketDir, "scene_manifest.json"));
  const scenes = sceneManifest?.storyboard ?? [];
  const panelPackage = await readJson<{ panelCount?: number; panels?: unknown[] }>(path.join(resolvedPacketDir, "storyboard-panels.json"));
  checks.push({
    id: "scene-count",
    ok: scenes.length >= 5,
    reason: "Scene manifest must include at least five storyboard scenes.",
  });
  checks.push({
    id: "scene-motion-fields",
    ok: scenes.every((scene) => scene.firstFrame && scene.lastFrame && scene.motionArc && scene.continuityLock && scene.videoPrompt),
    reason: "Every scene must include first frame, last frame, motion arc, continuity lock, and video prompt.",
  });
  checks.push({
    id: "scene-reference-pack",
    ok: Boolean(sceneManifest?.referencePacks?.characterReferencePack && sceneManifest.seedance?.continuityPrompt),
    reason: "Scene manifest must embed the character reference pack and Seedance continuity prompt.",
  });
  checks.push({
    id: "storyboard-panel-package",
    ok: Boolean(panelPackage?.panels?.length && panelPackage.panelCount === panelPackage.panels.length),
    reason: "Storyboard panel agent must produce panel JSON with matching panel count.",
  });
  checks.push({
    id: "scene-panel-embed",
    ok: Boolean(sceneManifest?.storyboardPanels?.panels?.length),
    reason: "Scene manifest must embed the professional storyboard panel package.",
  });

  return {
    ok: checks.every((check) => check.ok),
    packetDir: resolvedPacketDir,
    checks,
  };
}

export function summarizePacketReadiness(readiness: VideoPacketReadiness) {
  return readiness.checks
    .filter((check) => !check.ok)
    .map((check) => check.reason)
    .join(" ");
}

async function readJson<T>(filePath: string) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function fileExists(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}
