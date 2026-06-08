import { readFile } from "node:fs/promises";
import path from "node:path";
import type { StoryboardShot, VideoPacket } from "./videoAgent.js";

type StoryboardDirectorInput = {
  packet: VideoPacket;
  characterCatalog: unknown[];
  fallbackStoryboard: StoryboardShot[];
};

export async function directStoryboardWithOpenAi({
  packet,
  characterCatalog,
  fallbackStoryboard,
}: StoryboardDirectorInput): Promise<StoryboardShot[]> {
  if (process.env.STORYBOARD_DIRECTOR_PROVIDER !== "openai") return fallbackStoryboard;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (process.env.STORYBOARD_DIRECTOR_REQUIRE_LIVE === "true") {
      throw new Error("OPENAI_API_KEY is required for STORYBOARD_DIRECTOR_PROVIDER=openai.");
    }
    return fallbackStoryboard;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.STORYBOARD_DIRECTOR_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5",
      input: buildStoryboardPrompt({ packet, characterCatalog, canonNotes: await readStoryboardCanon() }),
      text: {
        format: {
          type: "json_schema",
          name: "opaija_storyboard",
          schema: storyboardSchema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    if (process.env.STORYBOARD_DIRECTOR_REQUIRE_LIVE === "true") {
      throw new Error(`OpenAI storyboard director failed: ${response.status} ${await response.text()}`);
    }
    return fallbackStoryboard;
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  const raw = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).find((item) => item.text)?.text;
  if (!raw) return fallbackStoryboard;
  const parsed = JSON.parse(raw) as { shots?: Partial<StoryboardShot>[] };
  const shots = parsed.shots?.map(normalizeShot).filter(Boolean) as StoryboardShot[] | undefined;
  return shots?.length ? shots.slice(0, 8) : fallbackStoryboard;
}

function normalizeShot(shot: Partial<StoryboardShot>, index: number): StoryboardShot | null {
  if (!shot.action || !shot.framePrompt || !shot.seedancePrompt) return null;
  return {
    shotNumber: Number(shot.shotNumber ?? index + 1),
    durationSeconds: Number(shot.durationSeconds ?? 4),
    shotType: String(shot.shotType ?? "cinematic shot"),
    camera: String(shot.camera ?? "controlled camera move"),
    action: String(shot.action),
    narrationBeat: String(shot.narrationBeat ?? shot.action),
    framePrompt: String(shot.framePrompt),
    seedancePrompt: String(shot.seedancePrompt),
    firstFrame: shot.firstFrame ? String(shot.firstFrame) : undefined,
    lastFrame: shot.lastFrame ? String(shot.lastFrame) : undefined,
    motionArc: shot.motionArc ? String(shot.motionArc) : undefined,
    continuityLock: shot.continuityLock ? String(shot.continuityLock) : undefined,
  };
}

async function readStoryboardCanon() {
  const files = [
    "master file everything.txt",
    "ops/memory/opaija-style-god-memory.json",
    "ops/memory/story-format-writer-memory.json",
    "ops/memory/shared-memory.json",
    "ops/workflows/seedance-reference-pack.md",
  ];
  const chunks = await Promise.all(
    files.map(async (file) => {
      try {
        return `SOURCE: ${file}\n${await readFile(path.resolve(process.cwd(), file), "utf8")}`;
      } catch {
        return "";
      }
    }),
  );
  return chunks.filter(Boolean).join("\n\n").slice(0, 26000);
}

function buildStoryboardPrompt({
  packet,
  characterCatalog,
  canonNotes,
}: {
  packet: VideoPacket;
  characterCatalog: unknown[];
  canonNotes: string;
}) {
  return [
    "You are the OPAIJA Season 1 Storyboard Director.",
    "Build a production storyboard for a vertical social video from the provided packet.",
    "The goal is exact-character continuity for Seedance 2.0 video generation.",
    "Create 5-7 shots with full action movement, first-frame pose, last-frame pose, motion arc, camera direction, timing, narration beats, storyboard image prompts, and Seedance motion prompts.",
    "Do not change character identity, wardrobe, weapons, power rules, island logic, or Season 1 canon.",
    "Every framePrompt must describe a clean cinematic storyboard frame, not a character bible sheet, not a grid, not multiple poses, no labels, no text in image.",
    "Every seedancePrompt must preserve the exact character from the storyboard/reference frame and describe motion clearly.",
    `VIDEO PACKET: ${JSON.stringify(packet)}`,
    `LOCKED CHARACTER CATALOG: ${JSON.stringify(characterCatalog)}`,
    canonNotes,
  ].join("\n\n");
}

const storyboardSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    shots: {
      type: "array",
      minItems: 5,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          shotNumber: { type: "number" },
          durationSeconds: { type: "number" },
          shotType: { type: "string" },
          camera: { type: "string" },
          action: { type: "string" },
          narrationBeat: { type: "string" },
          framePrompt: { type: "string" },
          seedancePrompt: { type: "string" },
          firstFrame: { type: "string" },
          lastFrame: { type: "string" },
          motionArc: { type: "string" },
          continuityLock: { type: "string" },
        },
        required: [
          "shotNumber",
          "durationSeconds",
          "shotType",
          "camera",
          "action",
          "narrationBeat",
          "framePrompt",
          "seedancePrompt",
          "firstFrame",
          "lastFrame",
          "motionArc",
          "continuityLock",
        ],
      },
    },
  },
  required: ["shots"],
};
