import fs from "node:fs/promises";
import path from "node:path";
import { buildCharacterReferencePack, characterCatalog, resolveCharacter } from "./characterReferencePack.js";
import { runRoutedModelTask, type ModelRouteResult } from "./modelRouter.js";
import { appendProductionMemory, listProductionMemory, recordAgentMessages, recordModelPerformance } from "./productionMemory.js";
import {
  validateProductionAgentMessages,
  validateProductionQc,
  validateProductionStoryPacket,
  type ProductionAgentMessage,
  type ProductionMode,
  type ProductionRunManifest,
  type ProductionStoryPacket,
} from "./productionSchemas.js";
import {
  buildStoryboardContactSheetSvg,
  buildStoryboardPanelMarkdown,
  buildStoryboardPanelPackage,
} from "./storyboardPanelAgent.js";
import type { StoryboardShot } from "./videoAgent.js";

export type ProductionRunInput = {
  mode?: ProductionMode;
  characterId?: string;
  brief?: string;
  confirmLiveSpend?: boolean;
};

export type ProductionRunSummary = {
  id: string;
  createdAt: string;
  mode: ProductionMode;
  status: ProductionRunManifest["status"];
  characterId: string;
  characterName: string;
  title: string;
  qcScore: number;
  packetDir: string;
  nextAction: string;
};

const productionRoot = path.resolve(process.cwd(), "out", "production-agent");

export async function createProductionRun(input: ProductionRunInput = {}) {
  const mode = input.mode ?? "local-qwen";
  const character = resolveCharacter(input.characterId) ?? characterCatalog.find((item) => item.status === "locked") ?? characterCatalog[0];
  const createdAt = new Date().toISOString();
  const id = `${createdAt.replace(/[:.]/g, "-")}-${mode}-${character.id}`;
  const packetDir = path.join(productionRoot, id);
  await fs.mkdir(packetDir, { recursive: true });

  const modelResults: ModelRouteResult[] = [];
  const story = await buildStoryPacketWithRouter({ id, mode, characterId: character.id, brief: input.brief, modelResults });
  const storyboard = await buildStoryboardWithRouter({ id, mode, story, modelResults });
  const referencePack = buildCharacterReferencePack(character);
  const panels = buildStoryboardPanelPackage({ packet: story, storyboard, referencePack });
  const messages = buildAgentMessages({ runId: id, story, packetDir, mode });
  const messageValidation = validateProductionAgentMessages(messages);
  const qc = validateProductionQc({ story, storyboard });
  const status = qc.ok && messageValidation.ok ? "storyboard-ready" : "needs-review";

  const paths = {
    story: path.join(packetDir, "story-packet.json"),
    storyboard: path.join(packetDir, "storyboard.json"),
    panels: path.join(packetDir, "storyboard-panels.json"),
    panelSheet: path.join(packetDir, "storyboard-panel-sheet.md"),
    contactSheet: path.join(packetDir, "storyboard-contact-sheet.svg"),
    messages: path.join(packetDir, "agent-messages.json"),
    qc: path.join(packetDir, "qc-report.json"),
    routing: path.join(packetDir, "model-routing.json"),
    manifest: path.join(packetDir, "manifest.json"),
  };

  await writeJson(paths.story, story);
  await writeJson(paths.storyboard, storyboard);
  await writeJson(paths.panels, panels);
  await fs.writeFile(paths.panelSheet, buildStoryboardPanelMarkdown(panels), "utf8");
  await fs.writeFile(paths.contactSheet, buildStoryboardContactSheetSvg(panels), "utf8");
  await writeJson(paths.messages, { ok: messageValidation.ok, checks: messageValidation.checks, messages });
  await writeJson(paths.qc, qc);
  await writeJson(paths.routing, modelResults);

  const manifest: ProductionRunManifest = {
    id,
    createdAt,
    updatedAt: new Date().toISOString(),
    mode,
    status,
    characterId: character.id,
    characterName: character.name,
    storyPacketPath: paths.story,
    storyboardPath: paths.storyboard,
    panelPackagePath: paths.panels,
    qcPath: paths.qc,
    messagesPath: paths.messages,
    modelRoutingPath: paths.routing,
    sourceOfTruth: Object.values(paths).filter((item) => item !== paths.manifest),
    nextAction:
      status === "storyboard-ready"
        ? "Review storyboard panels, then approve artwork generation or hand the panel sheet to the existing Video Agent."
        : "Fix QC blockers before sending artwork prompts to paid providers.",
  };
  await writeJson(paths.manifest, manifest);
  await recordAgentMessages(messages);
  await appendProductionMemory({
    id: `${id}-qc`,
    runId: id,
    type: "qc-result",
    summary: `Production QC ${qc.ok ? "passed" : "needs review"} at ${qc.score}/100`,
    payloadPath: paths.qc,
    score: qc.score,
    status,
    createdAt: new Date().toISOString(),
  });
  await appendProductionMemory({
    id: `${id}-artifact`,
    runId: id,
    type: "artifact",
    summary: `Production storyboard package created for ${story.characterName}`,
    payloadPath: paths.manifest,
    status,
    createdAt: new Date().toISOString(),
  });

  return {
    manifest,
    story,
    storyboard,
    panels,
    messages,
    qc,
    modelResults,
    packetDir,
  };
}

export async function listProductionRuns(): Promise<ProductionRunSummary[]> {
  await fs.mkdir(productionRoot, { recursive: true });
  const entries = await fs.readdir(productionRoot, { withFileTypes: true });
  const runs = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          const packetDir = path.join(productionRoot, entry.name);
          const manifest = JSON.parse(await fs.readFile(path.join(packetDir, "manifest.json"), "utf8")) as ProductionRunManifest;
          const story = JSON.parse(await fs.readFile(manifest.storyPacketPath, "utf8")) as ProductionStoryPacket;
          const qc = JSON.parse(await fs.readFile(manifest.qcPath, "utf8")) as { score?: number };
          return {
            id: manifest.id,
            createdAt: manifest.createdAt,
            mode: manifest.mode,
            status: manifest.status,
            characterId: manifest.characterId,
            characterName: manifest.characterName,
            title: story.title,
            qcScore: Number(qc.score ?? 0),
            packetDir,
            nextAction: manifest.nextAction,
          };
        } catch {
          return null;
        }
      }),
  );
  return runs
    .filter((run): run is ProductionRunSummary => Boolean(run))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getProductionRun(id: string) {
  const safeRoot = productionRoot;
  const packetDir = path.resolve(productionRoot, id);
  if (!packetDir.startsWith(safeRoot)) throw new Error("Production run path is outside the production-agent output directory.");
  const manifest = JSON.parse(await fs.readFile(path.join(packetDir, "manifest.json"), "utf8")) as ProductionRunManifest;
  return {
    manifest,
    story: JSON.parse(await fs.readFile(manifest.storyPacketPath, "utf8")) as ProductionStoryPacket,
    storyboard: JSON.parse(await fs.readFile(manifest.storyboardPath, "utf8")) as StoryboardShot[],
    panels: JSON.parse(await fs.readFile(manifest.panelPackagePath, "utf8")),
    messages: JSON.parse(await fs.readFile(manifest.messagesPath, "utf8")),
    qc: JSON.parse(await fs.readFile(manifest.qcPath, "utf8")),
    modelResults: JSON.parse(await fs.readFile(manifest.modelRoutingPath, "utf8")) as ModelRouteResult[],
  };
}

export async function getProductionMemory() {
  return listProductionMemory();
}

async function buildStoryPacketWithRouter({
  id,
  mode,
  characterId,
  brief,
  modelResults,
}: {
  id: string;
  mode: ProductionMode;
  characterId: string;
  brief?: string;
  modelResults: ModelRouteResult[];
}) {
  const character = resolveCharacter(characterId) ?? characterCatalog[0];
  const prompt = [
    "You are Qwen Showrunner for OPAIJA: Staff of Battle.",
    "Return valid JSON only. No markdown.",
    "Create one 30-60 second vertical anime teaser story packet.",
    "JSON shape: {\"title\":\"\",\"hook\":\"\",\"category\":\"\",\"storyBeat\":\"\",\"visualPrompt\":\"\",\"videoPrompt\":\"\",\"narration\":\"55-90 words\",\"captionLines\":[\"\",\"\",\"\"],\"characterId\":\"\",\"characterName\":\"\",\"characterImage\":\"\",\"qcChecklist\":[\"\"],\"socialCaption\":\"\",\"hashtags\":[\"\"],\"targetRuntimeSeconds\":45,\"audience\":\"all\"}",
    `Locked character: ${JSON.stringify(character)}`,
    brief ? `Operator brief: ${brief}` : "",
    await readProductionCanon(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const attempts: ModelRouteResult[] = [];
  for (let index = 0; index < 2; index += 1) {
    const result = await runRoutedModelTask({ task: "story-packet", mode, prompt, json: true });
    attempts.push(result);
    modelResults.push(result);
    await recordModelPerformance(id, result);
    const parsed = parseJsonObject<Partial<ProductionStoryPacket>>(result.output);
    const normalized = parsed ? normalizeStoryPacket(parsed, mode, result.model, characterId) : null;
    if (normalized && validateProductionStoryPacket(normalized).ok) return normalized;
  }

  if (mode !== "local-qwen") {
    const repairPrompt = [
      "Repair this Opaija story packet into the required JSON schema. Return JSON only.",
      `Required character: ${JSON.stringify(character)}`,
      `Failed attempts: ${JSON.stringify(attempts.map((attempt) => ({ provider: attempt.provider, status: attempt.status, output: attempt.output, error: attempt.error })).slice(-2))}`,
    ].join("\n\n");
    const result = await runRoutedModelTask({ task: "prompt-polish", mode: "production", prompt: repairPrompt, json: true });
    modelResults.push(result);
    await recordModelPerformance(id, result);
    const parsed = parseJsonObject<Partial<ProductionStoryPacket>>(result.output);
    const normalized = parsed ? normalizeStoryPacket(parsed, mode, result.model, characterId) : null;
    if (normalized && validateProductionStoryPacket(normalized).ok) return normalized;
  }

  return buildFallbackStoryPacket({ characterId, mode, sourceModel: attempts[0]?.model ?? "qwen-fallback" });
}

async function buildStoryboardWithRouter({
  id,
  mode,
  story,
  modelResults,
}: {
  id: string;
  mode: ProductionMode;
  story: ProductionStoryPacket;
  modelResults: ModelRouteResult[];
}) {
  const fallback = buildProductionStoryboard(story);
  const prompt = [
    "You are Qwen Storyboard Planner for Opaija.",
    "Return JSON only: {\"shots\":[...]}",
    "Create 5-7 shots with shotNumber, durationSeconds, shotType, camera, action, narrationBeat, framePrompt, seedancePrompt, firstFrame, lastFrame, motionArc, continuityLock.",
    "Every framePrompt must be a clean cinematic storyboard production frame, not a model sheet, not a grid, no labels, no image text, no multiple poses.",
    "Every seedancePrompt must preserve exact character face, hair, skin tone, outfit, weapon, proportions, and symbols from the approved reference.",
    `Story packet: ${JSON.stringify(story)}`,
    await readProductionCanon(),
  ].join("\n\n");

  for (let index = 0; index < 2; index += 1) {
    const result = await runRoutedModelTask({ task: "storyboard-planner", mode, prompt, json: true });
    modelResults.push(result);
    await recordModelPerformance(id, result);
    const parsed = parseJsonObject<{ shots?: Partial<StoryboardShot>[] }>(result.output);
    const storyboard = parsed?.shots?.map(normalizeShot).filter((shot): shot is StoryboardShot => Boolean(shot)).slice(0, 8);
    if (storyboard?.length) {
      const qc = validateProductionQc({ story, storyboard });
      if (qc.ok || qc.score >= 78) return storyboard;
    }
  }

  if (mode === "production") {
    const result = await runRoutedModelTask({
      task: "prompt-polish",
      mode,
      json: true,
      prompt: [
        "Polish this Opaija storyboard JSON for production. Keep the same story and character. Return JSON only.",
        `Story: ${JSON.stringify(story)}`,
        `Storyboard: ${JSON.stringify(fallback)}`,
      ].join("\n\n"),
    });
    modelResults.push(result);
    await recordModelPerformance(id, result);
    const parsed = parseJsonObject<{ shots?: Partial<StoryboardShot>[] }>(result.output);
    const storyboard = parsed?.shots?.map(normalizeShot).filter((shot): shot is StoryboardShot => Boolean(shot)).slice(0, 8);
    if (storyboard?.length && validateProductionQc({ story, storyboard }).score >= 78) return storyboard;
  }

  return fallback;
}

function buildAgentMessages({
  runId,
  story,
  packetDir,
  mode,
}: {
  runId: string;
  story: ProductionStoryPacket;
  packetDir: string;
  mode: ProductionMode;
}): ProductionAgentMessage[] {
  const createdAt = new Date().toISOString();
  const base = { runId, createdAt, status: "resolved" as const, priority: "normal" as const };
  return [
    {
      ...base,
      id: `${runId}-showrunner`,
      fromAgent: "Qwen Showrunner",
      toAgent: "Qwen Agent Coordinator",
      type: "result",
      summary: `Story packet created for ${story.characterName} in ${mode} mode.`,
      payloadPath: path.join(packetDir, "story-packet.json"),
    },
    {
      ...base,
      id: `${runId}-coordinator`,
      fromAgent: "Qwen Agent Coordinator",
      toAgent: "Qwen Storyboard Planner",
      type: "task",
      summary: "Build shot list, action movement, panel structure, narration timing, FX, and Seedance notes.",
      payloadPath: path.join(packetDir, "storyboard.json"),
    },
    {
      ...base,
      id: `${runId}-continuity`,
      fromAgent: "Qwen Storyboard Planner",
      toAgent: "Character Continuity QC",
      type: "approval-needed",
      priority: "high",
      summary: "Validate character lock, style lock, forbidden drift, and clean production-frame prompts.",
      payloadPath: path.join(packetDir, "qc-report.json"),
    },
    {
      ...base,
      id: `${runId}-polish`,
      fromAgent: "Character Continuity QC",
      toAgent: "Prompt Polisher",
      type: "task",
      summary: "Polish final artwork and Seedance prompts only if QC or production mode requires escalation.",
      payloadPath: path.join(packetDir, "model-routing.json"),
    },
    {
      ...base,
      id: `${runId}-seedance`,
      fromAgent: "Prompt Polisher",
      toAgent: "Seedance Agent",
      type: "task",
      summary: "Use approved storyboard frames as ordered references before animation.",
      payloadPath: path.join(packetDir, "storyboard-panel-sheet.md"),
    },
    {
      ...base,
      id: `${runId}-archive`,
      fromAgent: "Archive Clerk",
      toAgent: "all",
      type: "insight",
      summary: "Archive run artifacts, model performance, QC score, and lessons for the next production pass.",
      payloadPath: path.join(packetDir, "manifest.json"),
    },
  ];
}

function buildFallbackStoryPacket({
  characterId,
  mode,
  sourceModel,
}: {
  characterId: string;
  mode: ProductionMode;
  sourceModel: string;
}): ProductionStoryPacket {
  const character = resolveCharacter(characterId) ?? characterCatalog[0];
  return {
    title: `Season 1 Production Teaser: ${character.shortName} Answers the Rhythm`,
    hook: `${character.shortName} does not enter the gayelle alone. The rhythm enters with them.`,
    category: "SEASON 1 PRODUCTION",
    narration: [
      `${character.name} steps into the gayelle with ${character.weapon}.`,
      `The circle tests the body, the drum tests the spirit, and every shadow waits for one mistake.`,
      `But ${character.shortName} holds the line, letting ${character.power.toLowerCase()} rise without losing control.`,
      "This is Opaija waking up.",
    ].join(" "),
    captionLines: [`${character.shortName} enters the gayelle.`, `${character.power} wakes up.`, "Join the founder list."],
    characterId: character.id,
    characterName: character.name,
    characterImage: character.image,
    storyBeat: `${character.shortName} gets a production-ready vertical teaser built from the character bible and Season 1 rules.`,
    visualPrompt: `${character.name}, approved Opaija reference identity, 2D Caribbean anime, gold orange red teal cream palette.`,
    videoPrompt: `Animate ${character.name} through a clean Season 1 gayelle teaser with exact character continuity.`,
    qcChecklist: [
      `Face and outfit match ${character.name}`,
      `${character.weapon} remains readable`,
      "No extra limbs, no costume drift, no model-sheet/grid layout",
      "Opaija effects never hide the eyes or silhouette",
    ],
    socialCaption: `${character.name} answers the rhythm. Follow Opaija for Season 1 Caribbean anime drops.`,
    hashtags: ["#Opaija", "#CaribbeanAnime", "#AnimeShorts", "#SeasonOne"],
    targetRuntimeSeconds: 45,
    audience: "all",
    productionMode: mode,
    sourceModel,
  };
}

function buildProductionStoryboard(story: ProductionStoryPacket): StoryboardShot[] {
  const character = resolveCharacter(story.characterId) ?? characterCatalog[0];
  const referencePack = buildCharacterReferencePack(character);
  const beats = [
    ["wide establishing shot", "slow push through gayelle entrance", `${story.characterName} enters the circle as dust floats in late afternoon light.`],
    ["medium hero shot", "low-angle push-in", `${story.characterName} grips ${character.weapon} and listens for the drum pattern.`],
    ["close-up power beat", "rack focus from hands to eyes", `${character.power} gathers as small rhythm particles shimmer around the body.`],
    ["action load shot", "side tracking move", `${story.characterName} loads one controlled rhythm-command strike with readable silhouette.`],
    ["impact shot", "fast lateral whip then settle", `${story.characterName} releases one clean impact wave without spinning or costume drift.`],
    ["CTA hero frame", "locked poster frame", `${story.characterName} holds the final legendary pose with top title space and bottom CTA space.`],
  ] as const;
  return beats.map(([shotType, camera, action], index) => ({
    shotNumber: index + 1,
    durationSeconds: index === beats.length - 1 ? 5 : 8,
    shotType,
    camera,
    action,
    narrationBeat: story.captionLines[index % story.captionLines.length] ?? story.hook,
    firstFrame: `${story.characterName} begins in a clear pose with approved face, hair, skin tone, wardrobe, and ${character.weapon}.`,
    lastFrame: `${story.characterName} ends in a stronger readable pose with identical face, outfit, weapon, and proportions.`,
    motionArc: `${action} Keep motion simple, powerful, and readable for Seedance reference-to-video.`,
    continuityLock: referencePack.seedanceContinuityPrompt,
    framePrompt: [
      `Storyboard frame ${index + 1} for ${story.title}.`,
      referencePack.identityLock,
      shotType,
      camera,
      action,
      "Single cinematic production frame, vertical 9:16, no text, no labels, no grid, not a model sheet, no multiple poses.",
      "2D Caribbean anime, clean black ink linework, gold orange red teal cream palette.",
    ].join(" "),
    seedancePrompt: [
      `Animate storyboard shot ${index + 1}.`,
      referencePack.seedanceContinuityPrompt,
      action,
      `${camera}.`,
      "Preserve exact character identity from the storyboard/reference frame. No subtitles, no logo text, no extra characters, no costume drift, no broken hands.",
    ].join(" "),
  }));
}

function normalizeStoryPacket(
  packet: Partial<ProductionStoryPacket>,
  mode: ProductionMode,
  sourceModel: string,
  fallbackCharacterId: string,
): ProductionStoryPacket {
  const character = resolveCharacter(packet.characterId) ?? resolveCharacter(fallbackCharacterId) ?? characterCatalog[0];
  return {
    ...buildFallbackStoryPacket({ characterId: character.id, mode, sourceModel }),
    ...packet,
    characterId: character.id,
    characterName: character.name,
    characterImage: character.image,
    captionLines: Array.isArray(packet.captionLines) ? packet.captionLines.slice(0, 5).map(String) : [],
    hashtags: Array.isArray(packet.hashtags) ? packet.hashtags.slice(0, 8).map(String) : ["#Opaija"],
    targetRuntimeSeconds: Number(packet.targetRuntimeSeconds ?? 45),
    audience: packet.audience ?? "all",
    productionMode: mode,
    sourceModel,
  };
}

function normalizeShot(shot: Partial<StoryboardShot>, index: number): StoryboardShot | null {
  if (!shot.action || !shot.framePrompt || !shot.seedancePrompt) return null;
  return {
    shotNumber: Number(shot.shotNumber ?? index + 1),
    durationSeconds: Number(shot.durationSeconds ?? 6),
    shotType: String(shot.shotType ?? "cinematic shot"),
    camera: String(shot.camera ?? "controlled camera move"),
    action: String(shot.action),
    narrationBeat: String(shot.narrationBeat ?? shot.action),
    framePrompt: String(shot.framePrompt),
    seedancePrompt: String(shot.seedancePrompt),
    firstFrame: String(shot.firstFrame ?? "Clear first pose with character identity preserved."),
    lastFrame: String(shot.lastFrame ?? "Clear final pose with character identity preserved."),
    motionArc: String(shot.motionArc ?? shot.action),
    continuityLock: String(shot.continuityLock ?? "Preserve exact approved Opaija character identity."),
  };
}

function parseJsonObject<T>(raw?: string): T | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

async function readProductionCanon() {
  const files = [
    "master file everything.txt",
    "ops/memory/shared-memory.json",
    "ops/memory/opaija-style-god-memory.json",
    "ops/memory/story-format-writer-memory.json",
    "ops/memory/action-choreography-memory.json",
    "ops/workflows/seedance-reference-pack.md",
  ];
  const chunks = await Promise.all(
    files.map(async (file) => {
      try {
        return `SOURCE: ${file}\n${await fs.readFile(path.resolve(process.cwd(), file), "utf8")}`;
      } catch {
        return "";
      }
    }),
  );
  return chunks.filter(Boolean).join("\n\n").slice(0, 28000);
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
