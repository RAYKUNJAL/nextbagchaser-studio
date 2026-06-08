import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

export type VideoProbeResult = {
  valid: boolean;
  width?: number;
  height?: number;
  frames?: string;
  duration: number;
  size: number;
};

export async function fileExists(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

export async function probeVideo(filePath: string): Promise<VideoProbeResult> {
  const require = createRequire(import.meta.url);
  const ffprobe = require("ffprobe-static") as { path: string };
  const raw = await runProcess(ffprobe.path, [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,width,height,nb_frames:format=duration,size",
    "-of",
    "json",
    filePath,
  ]);
  const data = JSON.parse(raw) as {
    streams?: Array<{ codec_type?: string; width?: number; height?: number; nb_frames?: string }>;
    format?: { duration?: string; size?: string };
  };
  const videoStream = data.streams?.find((stream) => stream.codec_type === "video");
  const duration = Number(data.format?.duration ?? 0);
  const size = Number(data.format?.size ?? 0);
  return {
    valid: Boolean(videoStream && duration > 0 && size > 0),
    width: videoStream?.width,
    height: videoStream?.height,
    frames: videoStream?.nb_frames,
    duration,
    size,
  };
}

export async function probeMediaDuration(filePath: string): Promise<number> {
  const require = createRequire(import.meta.url);
  const ffprobe = require("ffprobe-static") as { path: string };
  const raw = await runProcess(ffprobe.path, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath,
  ]);
  const data = JSON.parse(raw) as { format?: { duration?: string } };
  return Number(data.format?.duration ?? 0);
}

function runProcess(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString("utf8"));
      else reject(new Error(`${command} exited with ${code}: ${Buffer.concat(stderr).toString("utf8")}`));
    });
  });
}
