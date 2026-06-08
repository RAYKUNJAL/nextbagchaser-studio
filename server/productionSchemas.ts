import type { StoryboardShot, VideoPacket } from "./videoAgent.js";

export type ProductionMode = "local-qwen" | "hybrid" | "production";

export type ProductionAgentName =
  | "Qwen Showrunner"
  | "Qwen Agent Coordinator"
  | "Qwen Storyboard Planner"
  | "Character Continuity QC"
  | "Prompt Polisher"
  | "Artwork Provider"
  | "Seedance Agent"
  | "Voice Director"
  | "Remotion Editor"
  | "Archive Clerk";

export type ProductionStoryPacket = VideoPacket & {
  targetRuntimeSeconds: number;
  audience: "tiktok" | "reels" | "shorts" | "all";
  productionMode: ProductionMode;
  sourceModel: string;
};

export type ProductionAgentMessage = {
  id: string;
  runId: string;
  fromAgent: ProductionAgentName;
  toAgent: ProductionAgentName | "all";
  type: "task" | "result" | "blocker" | "insight" | "approval-needed";
  priority: "low" | "normal" | "high";
  summary: string;
  payloadPath?: string;
  createdAt: string;
  status: "open" | "in-progress" | "resolved";
};

export type ProductionQcReport = {
  ok: boolean;
  score: number;
  checkedAt: string;
  checks: Array<{
    id: string;
    ok: boolean;
    severity: "blocker" | "warning";
    message: string;
  }>;
};

export type ProductionRunManifest = {
  id: string;
  createdAt: string;
  updatedAt: string;
  mode: ProductionMode;
  status: "storyboard-ready" | "needs-review" | "failed";
  characterId: string;
  characterName: string;
  storyPacketPath: string;
  storyboardPath: string;
  panelPackagePath: string;
  qcPath: string;
  messagesPath: string;
  modelRoutingPath: string;
  sourceOfTruth: string[];
  nextAction: string;
};

export type ProductionStoryboardPacket = {
  story: ProductionStoryPacket;
  storyboard: StoryboardShot[];
};

export function validateProductionStoryPacket(packet: Partial<ProductionStoryPacket>) {
  const checks = [
    check("title", Boolean(packet.title?.trim()), "Story packet must include a title."),
    check("hook", Boolean(packet.hook?.trim()), "Story packet must include a hook."),
    check("narration", Boolean(packet.narration?.trim()), "Story packet must include narration."),
    check("character", Boolean(packet.characterId && packet.characterName && packet.characterImage), "Story packet must include locked character identity."),
    check("captionLines", Array.isArray(packet.captionLines) && packet.captionLines.length >= 3, "Story packet needs at least 3 caption lines."),
    check("hashtags", Array.isArray(packet.hashtags) && packet.hashtags.length > 0, "Story packet needs hashtags."),
    check(
      "runtime",
      typeof packet.targetRuntimeSeconds === "number" && packet.targetRuntimeSeconds >= 30 && packet.targetRuntimeSeconds <= 75,
      "Target runtime must stay between 30 and 75 seconds for the first vertical production run.",
    ),
  ];
  return validationResult(checks);
}

export function validateProductionAgentMessages(messages: ProductionAgentMessage[]) {
  const checks = [
    check("message-count", messages.length >= 6, "Production run should create at least 6 agent handoff messages."),
    check(
      "message-run-id",
      messages.every((message) => Boolean(message.runId && message.id && message.createdAt)),
      "Every message needs id, runId, and createdAt.",
    ),
    check(
      "archive-route",
      messages.some((message) => message.toAgent === "Archive Clerk" || message.fromAgent === "Archive Clerk"),
      "Archive Clerk must receive a memory/update handoff.",
    ),
  ];
  return validationResult(checks);
}

export function validateProductionQc({
  story,
  storyboard,
}: ProductionStoryboardPacket): ProductionQcReport {
  const combined = storyboard.map((shot) => `${shot.framePrompt} ${shot.seedancePrompt}`).join("\n").toLowerCase();
  const characterName = story.characterName?.toLowerCase() ?? "";
  const forbiddenTerms = ["model sheet", "character sheet", "turnaround", "grid", "labels", "text in image", "multiple poses"];
  const checks: ProductionQcReport["checks"] = [
    check("story-packet", validateProductionStoryPacket(story).ok, "Story packet passes required schema.", "blocker"),
    check("shot-count", storyboard.length >= 5 && storyboard.length <= 8, "Storyboard must contain 5-8 shots.", "blocker"),
    check(
      "character-lock",
      Boolean(characterName) && (combined.includes(characterName) || combined.includes("approved reference")),
      "Storyboard prompts must preserve the named character.",
      "blocker",
    ),
    check(
      "motion-detail",
      storyboard.every((shot) => Boolean(shot.firstFrame && shot.lastFrame && shot.motionArc && shot.seedancePrompt)),
      "Every shot must include first frame, last frame, motion arc, and Seedance prompt.",
      "warning",
    ),
    check(
      "clean-artwork-frame",
      storyboard.every((shot) => forbiddenTerms.every((term) => isForbiddenTermNegated(shot.framePrompt, term))),
      "Artwork prompts must avoid reference-sheet layouts, labels, grids, and multiple poses.",
      "blocker",
    ),
    check(
      "seedance-reference-language",
      storyboard.every((shot) => /preserve|same|identity|reference|character/i.test(shot.seedancePrompt)),
      "Seedance prompts must explicitly preserve reference identity.",
      "warning",
    ),
  ];
  const result = validationResult(checks);
  return {
    ok: result.ok,
    score: result.score,
    checkedAt: new Date().toISOString(),
    checks,
  };
}

function check(
  id: string,
  ok: boolean,
  message: string,
  severity: "blocker" | "warning" = "blocker",
) {
  return { id, ok, severity, message };
}

function validationResult(checks: Array<{ ok: boolean; severity: "blocker" | "warning" }>) {
  const blockers = checks.filter((item) => item.severity === "blocker" && !item.ok).length;
  const warnings = checks.filter((item) => item.severity === "warning" && !item.ok).length;
  return {
    ok: blockers === 0,
    score: Math.max(0, Math.round(100 - blockers * 25 - warnings * 8)),
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
