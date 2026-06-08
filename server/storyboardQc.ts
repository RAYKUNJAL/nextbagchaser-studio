import type { StoryboardShot, VideoPacket } from "./videoAgent.js";

export type StoryboardQcReport = {
  ok: boolean;
  score: number;
  checks: Array<{
    id: string;
    ok: boolean;
    severity: "blocker" | "warning";
    message: string;
    shotNumber?: number;
  }>;
};

const forbiddenFrameTerms = [
  "model sheet",
  "character sheet",
  "turnaround",
  "grid",
  "labels",
  "text in image",
  "multiple poses",
];

export function runStoryboardQc(packet: VideoPacket, storyboard: StoryboardShot[]): StoryboardQcReport {
  const checks: StoryboardQcReport["checks"] = [];
  const characterName = packet.characterName?.trim();
  const characterImage = packet.characterImage?.trim();

  checks.push({
    id: "scene-count",
    ok: storyboard.length >= 5 && storyboard.length <= 8,
    severity: "blocker",
    message: `Storyboard should have 5-8 shots; found ${storyboard.length}.`,
  });

  checks.push({
    id: "character-lock",
    ok: Boolean(characterName && characterImage),
    severity: "blocker",
    message: "Run must include a locked character name and model-sheet image path.",
  });

  storyboard.forEach((shot) => {
    const combined = `${shot.framePrompt} ${shot.seedancePrompt}`.toLowerCase();
    const mentionsCharacter =
      !characterName || combined.includes(characterName.toLowerCase()) || combined.includes("approved model sheet");
    checks.push({
      id: "shot-character-identity",
      ok: mentionsCharacter,
      severity: "blocker",
      shotNumber: shot.shotNumber,
      message: `Shot ${shot.shotNumber} must explicitly preserve the selected character identity.`,
    });

    checks.push({
      id: "shot-camera-motion",
      ok:
        Boolean(shot.camera.trim()) &&
        /push|dolly|pan|tilt|orbit|rack|handheld|slide|zoom|macro|overhead|low|high|lateral|settle|track|truck/i.test(
          shot.camera,
        ),
      severity: "warning",
      shotNumber: shot.shotNumber,
      message: `Shot ${shot.shotNumber} should include a concrete camera move or lens direction.`,
    });

    checks.push({
      id: "shot-action-motion",
      ok:
        /animate|motion|move|lift|step|strike|pulse|drift|push|turn|freeze|expand|flow|ripple|snap|hold/i.test(
          shot.seedancePrompt,
        ) && Boolean(shot.firstFrame && shot.lastFrame && shot.motionArc),
      severity: "warning",
      shotNumber: shot.shotNumber,
      message: `Shot ${shot.shotNumber} should describe visible Seedance motion, first frame, last frame, and motion arc.`,
    });

    checks.push({
      id: "shot-clean-frame",
      ok: forbiddenFrameTerms.every((term) => isForbiddenTermNegated(shot.framePrompt, term)),
      severity: "blocker",
      shotNumber: shot.shotNumber,
      message: `Shot ${shot.shotNumber} frame prompt must avoid model sheets, grids, labels, text, and multiple poses.`,
    });
  });

  const blockers = checks.filter((check) => check.severity === "blocker" && !check.ok).length;
  const warnings = checks.filter((check) => check.severity === "warning" && !check.ok).length;
  const score = Math.max(0, Math.round(100 - blockers * 25 - warnings * 8));

  return {
    ok: blockers === 0,
    score,
    checks,
  };
}

function isForbiddenTermNegated(prompt: string, term: string) {
  const lowerPrompt = prompt.toLowerCase();
  let cursor = 0;
  while (cursor < lowerPrompt.length) {
    const termIndex = lowerPrompt.indexOf(term, cursor);
    if (termIndex < 0) return true;
    const prefix = lowerPrompt.slice(Math.max(0, termIndex - 40), termIndex);
    if (!/(not|no|without|avoid|forbid|exclude)\W+(\w+\W+){0,4}$/.test(prefix)) return false;
    cursor = termIndex + term.length;
  }
  return true;
}
