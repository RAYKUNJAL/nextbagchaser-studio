import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const outputDir = path.join(process.cwd(), "out", "video-agent-clip-test");
const propsPath = path.join(outputDir, "props.json");
const outputPath = path.join(outputDir, "clip-layer-test.mp4");

await mkdir(outputDir, { recursive: true });
await writeFile(
  propsPath,
  `${JSON.stringify(
    {
      title: "Provider Clip Layer",
      hook: "Generated motion now carries the scene.",
      captionLines: ["Seedance or Sora clip.", "Remotion captions.", "Opaija publish master."],
      characterImage: "assets/characters/kairo-kai-baptiste.png",
      generatedClipPath: "generated/videos/2026-05-30T11-24-30-137Z-what-is-the-gayelle.mp4",
      audioPath: "",
      category: "CLIP TEST",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

await runCommand(process.platform === "win32" ? "npx.cmd" : "npx", [
  "remotion",
  "render",
  "video/index.ts",
  "OpaijaShort",
  outputPath,
  "--props",
  propsPath,
  "--width",
  "360",
  "--height",
  "640",
  "--duration",
  "90",
  "--overwrite",
]);

console.log(JSON.stringify({ ok: true, outputPath, propsPath }, null, 2));

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}
