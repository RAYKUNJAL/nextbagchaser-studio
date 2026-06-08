import fs from "node:fs/promises";
import path from "node:path";

export type AnimeTimingPanel = {
  panelId: string;
  title: string;
  narration: string;
  wordCount: number;
  targetWpm: number;
  narrationDurationSec: number;
  preActionHoldSec: number;
  impactHoldSec: number;
  transitionBufferSec: number;
  finalClipDurationSec: number;
  actionBeat: string;
};

export type AnimeTimingSheet = {
  version: 1;
  status: "ready" | "timing_failed";
  targetWpm: number;
  wordsPerSecond: number;
  maxAudioVideoDriftSec: number;
  createdAt: string;
  source: string;
  audioDurationSec?: number;
  timingSyncScale?: number;
  totals: {
    panels: number;
    words: number;
    narrationDurationSec: number;
    finalClipDurationSec: number;
  };
  panels: AnimeTimingPanel[];
};

export type TimingReference = {
  panelId: string;
  title: string;
  durationSec?: number;
  motion?: string;
};

export type TimingActionPanel = {
  panelId: string;
  actionStart?: string;
  actionImpact?: string;
  actionEnd?: string;
};

export const defaultAnimeTiming = {
  targetWpm: 155,
  preActionHoldSec: 0.35,
  impactHoldSec: 0.55,
  transitionBufferSec: 0.35,
  maxAudioVideoDriftSec: 0.5,
};

export function createAnimeTimingSheet({
  references,
  voiceover,
  actionPanels = [],
  source,
  targetWpm = defaultAnimeTiming.targetWpm,
}: {
  references: TimingReference[];
  voiceover: string[];
  actionPanels?: TimingActionPanel[];
  source: string;
  targetWpm?: number;
}): AnimeTimingSheet {
  const wordsPerSecond = targetWpm / 60;
  const narrationByPanel = splitNarrationAcrossPanels(voiceover.join(" "), references);
  const actionByPanel = new Map(actionPanels.map((panel) => [panel.panelId, panel]));
  const panels = references.map((reference, index) => {
    const narration = narrationByPanel[index] ?? reference.title;
    const wordCount = countWords(narration);
    const action = actionByPanel.get(reference.panelId);
    const actionBeat = [action?.actionStart, action?.actionImpact, action?.actionEnd].filter(Boolean).join(" ");
    const narrationDurationSec = roundSeconds(wordCount / wordsPerSecond);
    const finalClipDurationSec = roundSeconds(
      narrationDurationSec +
        defaultAnimeTiming.preActionHoldSec +
        defaultAnimeTiming.impactHoldSec +
        defaultAnimeTiming.transitionBufferSec,
    );

    return {
      panelId: reference.panelId,
      title: reference.title,
      narration,
      wordCount,
      targetWpm,
      narrationDurationSec,
      preActionHoldSec: defaultAnimeTiming.preActionHoldSec,
      impactHoldSec: defaultAnimeTiming.impactHoldSec,
      transitionBufferSec: defaultAnimeTiming.transitionBufferSec,
      finalClipDurationSec,
      actionBeat: actionBeat || reference.motion || reference.title,
    };
  });

  return withTotals({
    version: 1,
    status: "ready",
    targetWpm,
    wordsPerSecond: roundSeconds(wordsPerSecond),
    maxAudioVideoDriftSec: defaultAnimeTiming.maxAudioVideoDriftSec,
    createdAt: new Date().toISOString(),
    source,
    totals: {
      panels: 0,
      words: 0,
      narrationDurationSec: 0,
      finalClipDurationSec: 0,
    },
    panels,
  });
}

export function syncTimingSheetToAudioDuration(sheet: AnimeTimingSheet, audioDurationSec: number): AnimeTimingSheet {
  if (!Number.isFinite(audioDurationSec) || audioDurationSec <= 0) return sheet;
  const currentDuration = sheet.totals.finalClipDurationSec;
  if (!currentDuration) return sheet;
  const scale = audioDurationSec / currentDuration;
  const panels = sheet.panels.map((panel) => ({
    ...panel,
    finalClipDurationSec: roundSeconds(panel.finalClipDurationSec * scale),
  }));
  return withTotals({
    ...sheet,
    audioDurationSec: roundSeconds(audioDurationSec),
    timingSyncScale: roundSeconds(scale),
    panels,
  });
}

export function assertTimingSheetComplete(sheet: AnimeTimingSheet, panelIds: string[]) {
  const timingByPanel = new Map(sheet.panels.map((panel) => [panel.panelId, panel]));
  const missing = panelIds.filter((panelId) => !timingByPanel.has(panelId));
  const incomplete = sheet.panels.filter(
    (panel) =>
      !panel.panelId ||
      !panel.narration ||
      panel.wordCount <= 0 ||
      panel.narrationDurationSec <= 0 ||
      panel.finalClipDurationSec <= 0 ||
      !panel.actionBeat,
  );

  if (missing.length || incomplete.length) {
    throw new Error(
      `Anime timing sheet gate failed. Missing panels: ${missing.join(", ") || "none"}. Incomplete panels: ${
        incomplete.map((panel) => panel.panelId).join(", ") || "none"
      }.`,
    );
  }
}

export function getTimingForPanel(sheet: AnimeTimingSheet | undefined, panelId: string) {
  return sheet?.panels.find((panel) => panel.panelId === panelId);
}

export async function readTimingSheet(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as AnimeTimingSheet;
}

export async function writeTimingSheet(filePath: string, sheet: AnimeTimingSheet) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(sheet, null, 2)}\n`, "utf8");
}

function splitNarrationAcrossPanels(narration: string, references: TimingReference[]) {
  const words = narration.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)?/g) ?? [];
  if (!references.length) return [];
  if (!words.length) return references.map((reference) => reference.title);

  const totalWeight = references.reduce((sum, reference) => sum + Math.max(1, reference.durationSec ?? 1), 0);
  let cursor = 0;
  return references.map((reference, index) => {
    const remainingPanels = references.length - index;
    const remainingWords = words.length - cursor;
    const weightedCount = Math.round((words.length * Math.max(1, reference.durationSec ?? 1)) / totalWeight);
    const count = index === references.length - 1 ? remainingWords : Math.max(1, Math.min(remainingWords - remainingPanels + 1, weightedCount));
    const chunk = words.slice(cursor, cursor + count).join(" ");
    cursor += count;
    return chunk || reference.title;
  });
}

function withTotals(sheet: AnimeTimingSheet): AnimeTimingSheet {
  return {
    ...sheet,
    totals: {
      panels: sheet.panels.length,
      words: sheet.panels.reduce((sum, panel) => sum + panel.wordCount, 0),
      narrationDurationSec: roundSeconds(sheet.panels.reduce((sum, panel) => sum + panel.narrationDurationSec, 0)),
      finalClipDurationSec: roundSeconds(sheet.panels.reduce((sum, panel) => sum + panel.finalClipDurationSec, 0)),
    },
  };
}

export function countWords(value: string) {
  return value.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)?/g)?.length ?? 0;
}

function roundSeconds(value: number) {
  return Math.round(value * 100) / 100;
}
