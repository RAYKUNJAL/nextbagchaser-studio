import fs from "node:fs/promises";
import path from "node:path";
import { assertTimingSheetComplete, createAnimeTimingSheet, writeTimingSheet, type TimingActionPanel, type TimingReference } from "./animeTiming.js";

type SeedanceHandoff = {
  orderedReferences: TimingReference[];
  voiceover: string[];
};

type ActionBoard = {
  panels: TimingActionPanel[];
};

const sourceDir = path.resolve(process.cwd(), "ops", "production", "season-one", "episode-01-the-first-pulse");
const outputPath = path.join(sourceDir, "timing-sheet.json");

async function main() {
  const seedance = await readJson<SeedanceHandoff>(path.join(sourceDir, "seedance-handoff.json"));
  const actionBoard = await readJson<ActionBoard>(path.join(sourceDir, "storyboard-action-board.json"));
  const sheet = createAnimeTimingSheet({
    references: seedance.orderedReferences,
    voiceover: seedance.voiceover,
    actionPanels: actionBoard.panels,
    source: "ops/production/season-one/episode-01-the-first-pulse/seedance-handoff.json",
  });
  assertTimingSheetComplete(sheet, seedance.orderedReferences.map((reference) => reference.panelId));
  await writeTimingSheet(outputPath, sheet);
  console.log(JSON.stringify({ ok: true, outputPath, panels: sheet.totals.panels, durationSec: sheet.totals.finalClipDurationSec }, null, 2));
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
