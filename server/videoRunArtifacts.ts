import fs from "node:fs/promises";
import path from "node:path";
import { getVideoRun } from "./videoRuns.js";

export async function getVideoRunArtifacts(id: string) {
  const run = await getVideoRun(id);
  if (!run) return null;

  const packetDir = path.dirname(run.packetPath);
  const safeRoot = path.resolve(process.cwd(), "out", "video-agent");
  const resolvedPacketDir = path.resolve(packetDir);
  if (!resolvedPacketDir.startsWith(safeRoot)) {
    throw new Error("Video run packet path is outside the video-agent output directory.");
  }

  return {
    id: run.id,
    title: run.title,
    characterId: run.characterId,
    characterName: run.characterName,
    project: await readJson(path.join(resolvedPacketDir, "project.json")),
    story: await readJson(path.join(resolvedPacketDir, "story.json")),
    referencePack: await readJson(path.join(resolvedPacketDir, "reference-pack.json")),
    visualLock: await readJson(path.join(resolvedPacketDir, "visual-lock.json")),
    storyboard: await readJson(path.join(resolvedPacketDir, "storyboard.json")),
    storyboardPanels: await readJson(path.join(resolvedPacketDir, "storyboard-panels.json")),
    storyboardPanelSheet: await readText(path.join(resolvedPacketDir, "storyboard-panel-sheet.md")),
    storyboardContactSheet: await readText(path.join(resolvedPacketDir, "storyboard-contact-sheet.svg")),
    storyboardQc: await readJson(path.join(resolvedPacketDir, "storyboard-qc.json")),
    storyboardFrames: await readJson(path.join(resolvedPacketDir, "storyboard-frames.json")),
    sceneManifest: await readJson(path.join(resolvedPacketDir, "scene_manifest.json")),
    seedanceStoryboardPrompt: await readText(path.join(resolvedPacketDir, "seedance-storyboard-prompt.txt")),
  };
}

async function readJson(filePath: string) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function readText(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}
