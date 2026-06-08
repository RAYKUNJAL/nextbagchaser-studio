import dotenv from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createVoiceover } from "./voice.js";
import { slugify } from "./blog.js";
import {
  createGeneratedVideoClip,
  createKeyframeImage,
  resolveGeneratedVideoClip,
  type ImageProviderResult,
  type VideoProviderResult,
} from "./mediaProviders.js";
import { directStoryboardWithOpenAi } from "./storyboardDirector.js";
import { runStoryboardQc } from "./storyboardQc.js";
import { upsertVideoRun } from "./videoRuns.js";
import { resolveReferenceAssetUrl } from "./referenceAssets.js";
import { buildCharacterReferencePack, characterCatalog, resolveCharacter as resolveCatalogCharacter } from "./characterReferencePack.js";
import {
  buildStoryboardContactSheetSvg,
  buildStoryboardPanelMarkdown,
  buildStoryboardPanelPackage,
  type StoryboardPanelPackage,
} from "./storyboardPanelAgent.js";

dotenv.config();

export type VideoPacket = {
  title: string;
  hook: string;
  category: string;
  narration: string;
  captionLines: string[];
  characterId?: string;
  characterName?: string;
  characterImage: string;
  storyBeat?: string;
  visualPrompt?: string;
  videoPrompt?: string;
  qcChecklist?: string[];
  socialCaption: string;
  hashtags: string[];
};

export type StoryboardShot = {
  shotNumber: number;
  durationSeconds: number;
  shotType: string;
  camera: string;
  action: string;
  narrationBeat: string;
  framePrompt: string;
  seedancePrompt: string;
  firstFrame?: string;
  lastFrame?: string;
  motionArc?: string;
  continuityLock?: string;
};

type RenderManifest = VideoPacket & {
  id: string;
  createdAt: string;
  audioPath?: string;
  outputPath: string;
  packetPath: string;
  propsPath: string;
  publicVideoPath?: string;
  storyboard: StoryboardShot[];
  storyboardPanels: StoryboardPanelPackage;
  storyboardFrames: Array<ImageProviderResult & { shotNumber: number }>;
  storyboardQc: ReturnType<typeof runStoryboardQc>;
  keyframe?: ImageProviderResult;
  clipJob?: VideoProviderResult;
};

type SceneManifest = {
  projectId: string;
  concept: string;
  format: "9:16";
  durationSec: number;
  visualStyle: {
    look: string;
    lighting: string;
    palette: string[];
  };
  referencePacks: {
    characters: string[];
    locations: string[];
    style: string[];
    characterReferencePack?: ReturnType<typeof buildCharacterReferencePack>;
  };
  storyboard: Array<{
    sceneId: string;
    startSec: number;
    durationSec: number;
    goal: string;
    inputImage?: string;
    imagePrompt: string;
    videoPrompt: string;
    camera: string;
    firstFrame?: string;
    lastFrame?: string;
    motionArc?: string;
    continuityLock?: string;
    continuityTags: string[];
  }>;
  storyboardPanels: StoryboardPanelPackage;
  seedance: {
    model: string;
    fps: number;
    motionStrength: "medium";
    styleLock: boolean;
    sequencePrompt: string;
    continuityPrompt?: string;
  };
};

const fallbackPackets: VideoPacket[] = [
  {
    title: "Every Island Has a Warrior",
    hook: "The rhythm is not background. It is the weapon.",
    category: "OPAIJA LORE",
    narration:
      "Every island has a warrior. Every rhythm has a weapon. In Opaija, the stick carries memory, the fighter carries spirit, and the gayelle binds them together. This is not just a fight story. This is the Caribbean remembering its power.",
    captionLines: ["A stick has memory.", "A fighter has spirit.", "The gayelle binds them together."],
    characterImage: "assets/characters/kairo-kai-baptiste.png",
    socialCaption:
      "Every island has a warrior. Follow Opaija for Caribbean anime lore, character drops, and story shorts.",
    hashtags: ["#Opaija", "#CaribbeanAnime", "#AnimeShorts", "#TrinidadAndTobago"],
  },
  {
    title: "What Is the Gayelle?",
    hook: "A circle. A stage. A battlefield with memory.",
    category: "WORLD GUIDE",
    narration:
      "The gayelle is more than a place to fight. In Opaija, it is where rhythm, memory, spirit, and command meet. When the drums rise, the circle listens. When the fighter enters, the old stories move again.",
    captionLines: ["The circle listens.", "The drums remember.", "The warrior answers."],
    characterImage: "assets/characters/mother-lall.png",
    socialCaption: "What is the gayelle in Opaija? A battlefield where rhythm and memory wake up.",
    hashtags: ["#Opaija", "#CaribbeanFolklore", "#Worldbuilding", "#AnimeLore"],
  },
];

async function main() {
  const packet = await createVideoPacket();
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(packet.title)}`;
  const sourceRunId = process.env.VIDEO_AGENT_SOURCE_RUN_ID?.trim() || undefined;
  const packetDir = path.join(process.cwd(), "out", "video-agent", id);
  await mkdir(packetDir, { recursive: true });

  const voice = await createVoiceover({
    text: packet.narration,
    fileName: `${id}.mp3`,
  });

  const audioPath = voice.path?.replace(/^\//, "");
  const outputPath = path.join(packetDir, "final.mp4");
  const packetPath = path.join(packetDir, "packet.json");
  const propsPath = path.join(packetDir, "props.json");
  const thumbnailPath = path.join(packetDir, "thumbnail.jpg");
  const publicVideoPath = `/generated/videos/${id}.mp4`;
  const storyboard = await createStoryboard(packet);
  const storyboardQc = runStoryboardQc(packet, storyboard);
  const referencePack = buildCharacterReferencePack(resolveCharacter(packet));
  const storyboardPanels = buildStoryboardPanelPackage({ packet, storyboard, referencePack });
  const storyboardFrames = await createStoryboardFrames({ id, storyboard });
  const keyframe = await createKeyframeImage({
    prompt: buildKeyframePrompt(packet, storyboard[0]),
    fileName: `${id}-keyframe.png`,
  });
  const storyboardFrameUrls = (
    await Promise.all(
      storyboardFrames.map((frame) =>
        resolveReferenceAssetUrl({
          outputPath: frame.outputPath,
          publicPath: frame.publicPath,
        }),
      ),
    )
  ).filter((url): url is string => Boolean(url && url.startsWith("http")));
  const keyframeReferenceUrl = await resolveReferenceAssetUrl({
    outputPath: keyframe.outputPath,
    publicPath: keyframe.publicPath,
  });
  const videoMode = storyboardFrameUrls.length > 1 ? "reference-to-video" : keyframe.publicPath ? "image-to-video" : "text-to-video";
  const clipPrompt =
    videoMode === "reference-to-video" ? buildReferenceVideoPrompt(packet, storyboard, storyboardFrameUrls.length) : packet.videoPrompt ?? buildVideoPrompt(packet, storyboard);
  const storyboardOnly = process.env.VIDEO_AGENT_STORYBOARD_ONLY === "true";
  const clipJob = storyboardOnly
    ? undefined
    : await createGeneratedVideoClip({
        mode: videoMode,
        imageUrl: videoMode === "image-to-video" ? keyframeReferenceUrl : undefined,
        referenceImageUrls: videoMode === "reference-to-video" ? storyboardFrameUrls : undefined,
        prompt: clipPrompt,
        duration: "5",
        resolution: "720p",
        aspectRatio: "9:16",
        generateAudio: false,
        fast: true,
      });
  const resolvedClipJob =
    clipJob && process.env.VIDEO_AGENT_WAIT_FOR_CLIP === "true"
      ? await resolveGeneratedVideoClip({ job: clipJob, fileName: `${id}-clip.mp4` })
      : clipJob;
  const manifest: RenderManifest = {
    ...packet,
    id,
    createdAt: new Date().toISOString(),
    audioPath,
    outputPath,
    packetPath,
    propsPath,
    publicVideoPath,
    storyboard,
    storyboardPanels,
    storyboardFrames,
    storyboardQc,
    keyframe,
    clipJob: resolvedClipJob,
  };

  await writePacketFiles(packetDir, manifest);
  await writeFile(packetPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  if (storyboardOnly) {
    await upsertVideoRun({
      id,
      title: packet.title,
      status: "planned",
      createdAt: manifest.createdAt,
      updatedAt: new Date().toISOString(),
      category: packet.category,
      packetPath,
      sourceRunId,
      characterId: packet.characterId,
      characterName: packet.characterName,
      characterImage: packet.characterImage,
      socialCaption: packet.socialCaption,
      hashtags: packet.hashtags,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          id,
          packetPath,
          mode: "storyboard_only",
          storyboardScenes: storyboard.length,
          storyboardFrameProvider: process.env.STORYBOARD_FRAME_PROVIDER ?? "mock",
          socialCaption: packet.socialCaption,
          hashtags: packet.hashtags,
        },
        null,
        2,
      ),
    );
    return;
  }
  await renderShort(manifest);
  await renderThumbnail(manifest, thumbnailPath);
  await copyPublicVideo(outputPath, publicVideoPath);
  await upsertVideoRun({
    id,
    title: packet.title,
    status: "rendered",
    createdAt: manifest.createdAt,
    updatedAt: new Date().toISOString(),
    category: packet.category,
    outputPath,
    packetPath,
    publicVideoPath,
    sourceRunId,
    characterId: packet.characterId,
    characterName: packet.characterName,
    characterImage: packet.characterImage,
    socialCaption: packet.socialCaption,
    hashtags: packet.hashtags,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        id,
        outputPath,
        packetPath,
        publicVideoPath,
        voiceStatus: voice.status,
        keyframeStatus: keyframe.status,
        clipStatus: clipJob?.status ?? "skipped",
        clipProvider: resolvedClipJob?.provider ?? "none",
        clipPath: resolvedClipJob?.publicPath,
        socialCaption: packet.socialCaption,
        hashtags: packet.hashtags,
      },
      null,
      2,
    ),
  );
}

async function createVideoPacket() {
  const packetPath = process.env.VIDEO_AGENT_PACKET_PATH?.trim();
  if (packetPath) return normalizePacket(parsePacket(await readFile(path.resolve(process.cwd(), packetPath), "utf8")));

  const packetOverride = process.env.VIDEO_AGENT_PACKET_JSON?.trim();
  if (packetOverride) return normalizePacket(parsePacket(packetOverride));

  try {
    const raw = await generateWithLocalModel(buildPrompt(await readCanonNotes()));
    return normalizePacket(parsePacket(raw));
  } catch (error) {
    if (process.env.VIDEO_AGENT_REQUIRE_LLM === "true") throw error;
    return normalizePacket(fallbackPackets[new Date().getHours() % fallbackPackets.length]);
  }
}

async function readCanonNotes() {
  const files = [
    "ops/memory/opaija-style-god-memory.json",
    "ops/memory/story-format-writer-memory.json",
    "docs/VOICE_AND_EDITING_STACK.md",
    "docs/CINEMATIC_FX_ENGINE.md",
  ];

  const notes = await Promise.all(
    files.map(async (file) => {
      try {
        return `SOURCE: ${file}\n${await readFile(path.resolve(process.cwd(), file), "utf8")}`;
      } catch {
        return "";
      }
    }),
  );

  return notes.filter(Boolean).join("\n\n").slice(0, 22000);
}

function buildPrompt(canonNotes: string) {
  const preferredCharacter = resolveCharacter({ characterId: process.env.VIDEO_AGENT_CHARACTER_ID });
  const brief = process.env.VIDEO_AGENT_BRIEF?.trim();
  return [
    "You are the OPAIJA Video Agent.",
    "Create one 30-second vertical short packet for opaija.com social growth.",
    "Return valid JSON only. No markdown fence.",
    "JSON shape: {\"title\":\"\",\"hook\":\"\",\"category\":\"\",\"storyBeat\":\"\",\"visualPrompt\":\"\",\"videoPrompt\":\"\",\"narration\":\"\",\"captionLines\":[\"\",\"\",\"\"],\"characterId\":\"kairo\",\"characterName\":\"Kairo Kai Baptiste\",\"characterImage\":\"assets/characters/kairo-kai-baptiste.png\",\"qcChecklist\":[\"\"],\"socialCaption\":\"\",\"hashtags\":[\"\"]}",
    `Use exactly one character from this catalog: ${JSON.stringify(characterCatalog)}.`,
    `Preferred character for this run: ${JSON.stringify(preferredCharacter)}.`,
    "Narration must be 55-80 words. Caption lines must be punchy and fit a phone screen.",
    "Use Caribbean anime, Opaija lore, rhythm, roots, resistance, gayelle, stick memory, and founder-list energy.",
    brief ? `Specific brief for this run: ${brief}` : "",
    "No generic fantasy. No fake publication claims. No AI disclaimers.",
    canonNotes,
  ].filter(Boolean).join("\n\n");
}

async function generateWithLocalModel(prompt: string) {
  const provider = process.env.VIDEO_AGENT_LLM_PROVIDER ?? "ollama";
  if (provider === "openai-compatible") return generateOpenAiCompatible(prompt);
  return generateOllama(prompt);
}

function normalizePacket(packet: VideoPacket): VideoPacket {
  const character = resolveCharacter({ ...packet, characterId: process.env.VIDEO_AGENT_CHARACTER_ID ?? packet.characterId });
  return {
    ...packet,
    characterId: character.id,
    characterName: character.name,
    characterImage: character.image,
  };
}

function resolveCharacter(packet: Partial<VideoPacket>) {
  const requested =
    packet.characterId?.toLowerCase() ??
    packet.characterName?.toLowerCase() ??
    packet.characterImage?.replace(/^\//, "").toLowerCase();
  return (
    resolveCatalogCharacter(requested) ??
    characterCatalog.find((character) => {
      return (
        requested === character.id ||
        requested === character.name.toLowerCase() ||
        requested === character.shortName.toLowerCase() ||
        requested === character.image.toLowerCase()
      );
    }) ?? characterCatalog[new Date().getHours() % characterCatalog.length]
  );
}

async function createStoryboard(packet: VideoPacket) {
  const storyboardPath = process.env.VIDEO_AGENT_STORYBOARD_PATH?.trim();
  if (storyboardPath) return parseStoryboard(await readFile(path.resolve(process.cwd(), storyboardPath), "utf8"));

  const storyboardOverride = process.env.VIDEO_AGENT_STORYBOARD_JSON?.trim();
  if (storyboardOverride) return parseStoryboard(storyboardOverride);

  const fallbackStoryboard = buildStoryboard(packet);
  return directStoryboardWithOpenAi({
    packet,
    characterCatalog,
    fallbackStoryboard,
  });
}

function parseStoryboard(raw: string): StoryboardShot[] {
  const parsed = JSON.parse(raw) as Partial<StoryboardShot>[];
  const shots = parsed
    .map((shot, index) => ({
      shotNumber: Number(shot.shotNumber ?? index + 1),
      durationSeconds: Number(shot.durationSeconds ?? 4),
      shotType: String(shot.shotType ?? `Shot ${index + 1}`),
      camera: String(shot.camera ?? "controlled cinematic camera move"),
      action: String(shot.action ?? shot.narrationBeat ?? `Storyboard shot ${index + 1}`),
      narrationBeat: String(shot.narrationBeat ?? ""),
      framePrompt: String(shot.framePrompt ?? ""),
      seedancePrompt: String(shot.seedancePrompt ?? ""),
      firstFrame: shot.firstFrame ? String(shot.firstFrame) : undefined,
      lastFrame: shot.lastFrame ? String(shot.lastFrame) : undefined,
      motionArc: shot.motionArc ? String(shot.motionArc) : undefined,
      continuityLock: shot.continuityLock ? String(shot.continuityLock) : undefined,
    }))
    .filter((shot) => shot.framePrompt && shot.seedancePrompt);
  if (!shots.length) throw new Error("VIDEO_AGENT_STORYBOARD_PATH did not contain usable storyboard shots.");
  return shots;
}

async function createStoryboardFrames({ id, storyboard }: { id: string; storyboard: StoryboardShot[] }) {
  const provider = process.env.STORYBOARD_FRAME_PROVIDER === "openai" ? "openai" : "mock";
  const frames: Array<ImageProviderResult & { shotNumber: number }> = [];
  for (const shot of storyboard) {
    const frame = await createKeyframeImage({
      provider,
      prompt: shot.framePrompt,
      fileName: `${id}-storyboard-${String(shot.shotNumber).padStart(2, "0")}.png`,
    });
    frames.push({ ...frame, shotNumber: shot.shotNumber });
  }
  return frames;
}

async function generateOllama(prompt: string) {
  const baseUrl = process.env.VIDEO_AGENT_LLM_BASE_URL ?? process.env.BLOG_LLM_BASE_URL ?? "http://localhost:11434";
  const model = process.env.VIDEO_AGENT_LLM_MODEL ?? process.env.BLOG_LLM_MODEL ?? "llama3.1";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false, format: "json" }),
  });

  if (!response.ok) throw new Error(`Video local model failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { response?: string };
  return data.response ?? "";
}

async function generateOpenAiCompatible(prompt: string) {
  const baseUrl = process.env.VIDEO_AGENT_LLM_BASE_URL ?? "http://localhost:1234/v1";
  const model = process.env.VIDEO_AGENT_LLM_MODEL ?? "local-model";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VIDEO_AGENT_LLM_API_KEY ?? "local"}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.72,
    }),
  });

  if (!response.ok) throw new Error(`Video OpenAI-compatible model failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

function parsePacket(raw: string): VideoPacket {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Video model did not return JSON.");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<VideoPacket>;

  if (!parsed.title || !parsed.hook || !parsed.narration) {
    throw new Error("Video model returned an incomplete packet.");
  }

  return {
    title: parsed.title,
    hook: parsed.hook,
    category: parsed.category || "OPAIJA SHORT",
    narration: parsed.narration,
    captionLines: Array.isArray(parsed.captionLines) && parsed.captionLines.length
      ? parsed.captionLines.slice(0, 3).map(String)
      : ["A stick has memory.", "A fighter has spirit.", "The gayelle binds them together."],
    characterId: parsed.characterId,
    characterName: parsed.characterName,
    characterImage: parsed.characterImage || "assets/characters/kairo-kai-baptiste.png",
    storyBeat: parsed.storyBeat,
    visualPrompt: parsed.visualPrompt,
    videoPrompt: parsed.videoPrompt,
    qcChecklist: Array.isArray(parsed.qcChecklist)
      ? parsed.qcChecklist.map(String).slice(0, 8)
      : ["Face matches approved character sheet", "No extra fingers or broken staff geometry", "Caption text does not cover faces", "Opaija palette stays gold, orange, red, teal, cream"],
    socialCaption: parsed.socialCaption || parsed.hook,
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String).slice(0, 8) : ["#Opaija"],
  };
}

async function writePacketFiles(packetDir: string, manifest: RenderManifest) {
  const sceneManifest = buildSceneManifest(manifest);
  const referencePack = buildCharacterReferencePack(resolveCharacter(manifest));
  await writeFile(
    path.join(packetDir, "project.json"),
    `${JSON.stringify(
      {
        projectId: manifest.id,
        concept: manifest.title,
        characterId: manifest.characterId,
        characterName: manifest.characterName,
        format: "9:16",
        durationSec: sceneManifest.durationSec,
        sourceOfTruth: [
          "story.json",
          "reference-pack.json",
          "visual-lock.json",
          "storyboard.json",
          "storyboard-panels.json",
          "storyboard-panel-sheet.md",
          "storyboard-contact-sheet.svg",
          "scene_manifest.json",
        ],
        status: "storyboard-ready",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(path.join(packetDir, "reference-pack.json"), `${JSON.stringify(referencePack, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(packetDir, "story.json"),
    `${JSON.stringify(
      {
        title: manifest.title,
        hook: manifest.hook,
        category: manifest.category,
        storyBeat: manifest.storyBeat ?? manifest.narration,
        narration: manifest.narration,
        characterId: manifest.characterId,
        characterName: manifest.characterName,
        storyboard: manifest.storyboard.map((shot) => ({
          shotNumber: shot.shotNumber,
          durationSeconds: shot.durationSeconds,
          action: shot.action,
          narrationBeat: shot.narrationBeat,
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(path.join(packetDir, "storyboard.json"), `${JSON.stringify(manifest.storyboard, null, 2)}\n`, "utf8");
  await writeFile(path.join(packetDir, "storyboard-panels.json"), `${JSON.stringify(manifest.storyboardPanels, null, 2)}\n`, "utf8");
  await writeFile(path.join(packetDir, "storyboard-panel-sheet.md"), buildStoryboardPanelMarkdown(manifest.storyboardPanels), "utf8");
  await writeFile(path.join(packetDir, "storyboard-contact-sheet.svg"), buildStoryboardContactSheetSvg(manifest.storyboardPanels), "utf8");
  await writeFile(path.join(packetDir, "storyboard-qc.json"), `${JSON.stringify(manifest.storyboardQc, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(packetDir, "storyboard-frames.json"),
    `${JSON.stringify(manifest.storyboardFrames, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(packetDir, "scene_manifest.json"), `${JSON.stringify(sceneManifest, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(packetDir, "seedance-storyboard-prompt.txt"),
    buildVideoPrompt(manifest, manifest.storyboard),
    "utf8",
  );
  await writeFile(
    path.join(packetDir, "visual-lock.json"),
    `${JSON.stringify(
      {
        characterImage: manifest.characterImage,
        characterId: manifest.characterId,
        characterName: manifest.characterName,
        visualPrompt: manifest.visualPrompt ?? buildKeyframePrompt(manifest, manifest.storyboard[0]),
        styleRules: [
          referencePack.identityLock,
          "2D Caribbean anime model-sheet style",
          "rounded chins, full lips, broad African/Caribbean nose structures, warm expressive eyes",
          "gold, orange, red, teal, cream palette",
          "no generic fantasy armor, no washed-out palette, no V-shaped anime chins",
        ],
        referencePack,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(path.join(packetDir, "keyframes.json"), `${JSON.stringify(manifest.keyframe, null, 2)}\n`, "utf8");
  await writeFile(path.join(packetDir, "seedance-jobs.json"), `${JSON.stringify(manifest.clipJob, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(packetDir, "clips.json"),
    `${JSON.stringify(
      [
        {
          source: manifest.clipJob?.provider ?? "mock",
          status: manifest.clipJob?.status ?? "dry_run",
          requestId: manifest.clipJob?.requestId,
          modelId: manifest.clipJob?.modelId,
          prompt: manifest.clipJob?.prompt,
          characterId: manifest.characterId,
          characterName: manifest.characterName,
        },
      ],
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(path.join(packetDir, "captions.srt"), buildSrt(manifest.captionLines), "utf8");
  await writeFile(
    path.join(packetDir, "render-manifest.json"),
    `${JSON.stringify(
      {
        composition: "OpaijaShort",
        outputPath: manifest.outputPath,
        publicVideoPath: manifest.publicVideoPath,
        generatedClipPath: manifest.clipJob?.publicPath,
        characterId: manifest.characterId,
        characterName: manifest.characterName,
        propsPath: manifest.propsPath,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    path.join(packetDir, "publish-copy.json"),
    `${JSON.stringify({ socialCaption: manifest.socialCaption, hashtags: manifest.hashtags }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(packetDir, "qc-report.json"),
    `${JSON.stringify(
      {
        status: "needs-human-review",
        checks: (manifest.qcChecklist ?? []).map((check) => ({
          check,
          result: "pending",
        })),
        automatedChecks: [
          {
            check: "Packet contains title, hook, narration, captions, visual lock, render manifest, and publish copy",
            result: "passed",
          },
          {
            check: "Provider outputs are recorded, even when dry-run providers are used",
            result: "passed",
          },
        ],
        nextAction: "Review final.mp4 and thumbnail.jpg before publishing.",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function buildSceneManifest(manifest: RenderManifest): SceneManifest {
  const referencePack = buildCharacterReferencePack(resolveCharacter(manifest));
  let startSec = 0;
  const storyboard = manifest.storyboard.map((shot) => {
    const frame = manifest.storyboardFrames.find((candidate) => candidate.shotNumber === shot.shotNumber);
    const scene = {
      sceneId: `s${String(shot.shotNumber).padStart(2, "0")}`,
      startSec,
      durationSec: shot.durationSeconds,
      goal: shot.action,
      inputImage: frame?.publicPath,
      imagePrompt: shot.framePrompt,
      videoPrompt: shot.seedancePrompt,
      camera: shot.camera,
      firstFrame: shot.firstFrame,
      lastFrame: shot.lastFrame,
      motionArc: shot.motionArc,
      continuityLock: shot.continuityLock ?? referencePack.seedanceContinuityPrompt,
      continuityTags: [
        manifest.characterId ?? "selected-character",
        "opaija-season-1",
        "2.5d-caribbean-anime",
        shot.shotType.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      ],
    };
    startSec += shot.durationSeconds;
    return scene;
  });

  return {
    projectId: manifest.id,
    concept: manifest.title,
    format: "9:16",
    durationSec: startSec,
    visualStyle: {
      look: "2D Caribbean anime with clean black ink and animated-series clarity",
      lighting: "cinematic gold dust, warm island contrast, teal shadow accents",
      palette: ["black", "gold", "orange", "red", "teal", "cream"],
    },
    referencePacks: {
      characters: referencePack.referenceImages,
      locations: ["gayelle circle", "Trinidad street/courtyard energy", "Opaija Season 1 arena language"],
      style: [
        "ops/memory/opaija-style-god-memory.json",
        "ops/workflows/seedance-reference-pack.md",
      ],
      characterReferencePack: referencePack,
    },
    storyboard,
    storyboardPanels: manifest.storyboardPanels,
    seedance: {
      model: process.env.SEEDANCE_DEFAULT_MODEL ?? "bytedance/seedance-2.0/fast/image-to-video",
      fps: 24,
      motionStrength: "medium",
      styleLock: true,
      sequencePrompt: buildVideoPrompt(manifest, manifest.storyboard),
      continuityPrompt: referencePack.seedanceContinuityPrompt,
    },
  };
}

function buildStoryboard(packet: VideoPacket): StoryboardShot[] {
  const characterName = packet.characterName ?? "the selected Opaija character";
  const referencePack = buildCharacterReferencePack(resolveCharacter(packet));
  const characterLock = referencePack.seedanceContinuityPrompt;
  const beats = [
    {
      shotType: "wide establishing shot",
      camera: "slow push through the gayelle circle",
      action: `${characterName} steps into the circle as dust and drum energy rise.`,
      narrationBeat: packet.captionLines[0] ?? packet.hook,
    },
    {
      shotType: "medium hero shot",
      camera: "low-angle push-in with subtle handheld rhythm",
      action: `${characterName} grips the signature weapon or power focus and locks eyes with the unseen challenger.`,
      narrationBeat: packet.hook,
    },
    {
      shotType: "close-up power beat",
      camera: "tight close-up, quick rack focus to hands and eyes",
      action: `Opaija pulse energy gathers around ${characterName}, matching the rhythm of the drums.`,
      narrationBeat: packet.captionLines[1] ?? packet.narration,
    },
    {
      shotType: "action impact shot",
      camera: "fast lateral move with clean motion blur",
      action: `${characterName} releases one controlled strike or voice/pulse command without changing costume or face.`,
      narrationBeat: packet.captionLines[2] ?? packet.hook,
    },
    {
      shotType: "CTA end-card shot",
      camera: "controlled settle into poster frame",
      action: `${characterName} holds a final iconic pose as the Opaija mark energy frames the scene.`,
      narrationBeat: "Join the founder list at opaija.com.",
    },
  ];

  return beats.map((beat, index) => {
    const framePrompt = [
      `Storyboard frame ${index + 1} for "${packet.title}".`,
      characterLock,
      beat.shotType,
      beat.camera,
      beat.action,
      "Single cinematic production frame, not a character sheet, not a grid, no labels, no text, no multiple poses.",
      "2D Caribbean anime, gold/orange/red/teal/cream palette, clean black ink linework, vertical 9:16.",
    ].join(" ");
    return {
      shotNumber: index + 1,
      durationSeconds: index === beats.length - 1 ? 3 : 4,
      shotType: beat.shotType,
      camera: beat.camera,
      action: beat.action,
      narrationBeat: beat.narrationBeat,
      firstFrame: `${characterName} begins in a readable key pose for ${beat.shotType}; face, wardrobe, and approved-reference identity are clear.`,
      lastFrame: `${characterName} ends in a stronger poster-readable pose that preserves the same face, wardrobe, weapon, and power logic.`,
      motionArc: `${beat.action} The body path must be simple, readable, and motivated by drum rhythm.`,
      continuityLock: referencePack.seedanceContinuityPrompt,
      framePrompt,
      seedancePrompt: [
        `Animate storyboard shot ${index + 1} for "${packet.title}".`,
        characterLock,
        beat.action,
        referencePack.motionLanguage.join(" "),
        `${beat.camera}.`,
        "Preserve exact character identity from the storyboard/reference frame. No subtitles. No logo text. No extra characters unless explicitly visible in the reference. Keep hands, weapon, and face stable.",
      ].join(" "),
    };
  });
}

function buildKeyframePrompt(packet: VideoPacket, shot?: StoryboardShot) {
  return (
    packet.visualPrompt ??
    shot?.framePrompt ??
    `${packet.title}. OPAIJA 2D Caribbean anime production keyframe, ${packet.hook}. Keep the approved character identity from ${packet.characterImage}. Single cinematic frame, not a model sheet, not a reference grid, no text, vertical 9:16, gold/orange/red/teal/cream palette, clean black ink linework.`
  );
}

function buildVideoPrompt(packet: VideoPacket, storyboard?: StoryboardShot[]) {
  const shotPlan = storyboard?.length
    ? storyboard
        .map((shot) =>
          [
            `Shot ${shot.shotNumber} (${shot.durationSeconds}s): ${shot.seedancePrompt}`,
            shot.firstFrame ? `First frame: ${shot.firstFrame}` : "",
            shot.motionArc ? `Motion arc: ${shot.motionArc}` : "",
            shot.lastFrame ? `Last frame: ${shot.lastFrame}` : "",
            shot.continuityLock ? `Continuity lock: ${shot.continuityLock}` : "",
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join("\n")
    : "";
  return (
    packet.videoPrompt ??
    [
      `${packet.title}. ${packet.hook}`,
      `Animate ${packet.characterName ?? "the selected Opaija character"} as a 2D Caribbean anime short with controlled camera movement, drum-rhythm energy, gold dust, and clean character consistency. Preserve flat cel-shaded animated-series style; avoid pseudo-3D, painterly, glossy, or photoreal output.`,
      "Use the storyboard frames as the sequence reference, following the full board as one coherent video sequence rather than a raw character bible sheet.",
      shotPlan,
      "No subtitles, no logo text, no reference-sheet layout, no character drift.",
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function buildReferenceVideoPrompt(packet: VideoPacket, storyboard: StoryboardShot[], referenceCount: number) {
  const imageRefs = storyboard
    .slice(0, referenceCount)
    .map((shot, index) => `@Image${index + 1} = Shot ${shot.shotNumber}: ${shot.action} Camera: ${shot.camera}`)
    .join("\n");
  const shotPlan = storyboard
    .slice(0, referenceCount)
    .map((shot, index) =>
      [
        `Use @Image${index + 1} for shot ${shot.shotNumber} (${shot.durationSeconds}s). Motion: ${shot.seedancePrompt}`,
        shot.firstFrame ? `Start: ${shot.firstFrame}` : "",
        shot.motionArc ? `Arc: ${shot.motionArc}` : "",
        shot.lastFrame ? `End: ${shot.lastFrame}` : "",
        shot.continuityLock ? `Continuity: ${shot.continuityLock}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join("\n");

  return [
    `${packet.title}. ${packet.hook}`,
    `Use the referenced storyboard frames as the exact visual sequence. ${imageRefs}`,
    `Animate ${packet.characterName ?? "the selected Opaija character"} as a 2D Caribbean anime short with controlled action, readable silhouettes, Caribbean rhythm, and cinematic camera movement. Preserve flat cel-shaded animated-series style; avoid pseudo-3D, painterly, glossy, or photoreal output.`,
    "Preserve exact character identity, face, hair, wardrobe, skin tone, weapon, proportions, and symbols from every storyboard reference.",
    shotPlan,
    "No subtitles, no logo text, no reference-sheet layout, no character sheet grid, no extra labels, no character drift.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSrt(lines: string[]) {
  return lines
    .slice(0, 3)
    .map((line, index) => {
      const start = 3 + index * 7;
      const end = start + 5;
      return `${index + 1}\n00:00:${String(start).padStart(2, "0")},000 --> 00:00:${String(end).padStart(2, "0")},000\n${line}\n`;
    })
    .join("\n");
}

async function copyPublicVideo(outputPath: string, publicVideoPath: string) {
  const outputDir = path.join(process.cwd(), "public", path.dirname(publicVideoPath));
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, path.basename(publicVideoPath)), await readFile(outputPath));
}

async function renderShort(manifest: RenderManifest) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const props = {
    title: manifest.title,
    hook: manifest.hook,
    captionLines: manifest.captionLines,
    characterImage: manifest.characterImage,
    generatedClipPath: manifest.clipJob?.publicPath?.replace(/^\//, "") ?? "",
    audioPath: manifest.audioPath ?? "",
    category: manifest.category,
  };
  await writeFile(manifest.propsPath, `${JSON.stringify(props, null, 2)}\n`, "utf8");

  const args = [
    "remotion",
    "render",
    "video/index.ts",
    "OpaijaShort",
    manifest.outputPath,
    "--props",
    manifest.propsPath,
  ];
  if (process.env.VIDEO_AGENT_RENDER_WIDTH) args.push("--width", process.env.VIDEO_AGENT_RENDER_WIDTH);
  if (process.env.VIDEO_AGENT_RENDER_HEIGHT) args.push("--height", process.env.VIDEO_AGENT_RENDER_HEIGHT);
  if (process.env.VIDEO_AGENT_RENDER_DURATION_FRAMES) args.push("--duration", process.env.VIDEO_AGENT_RENDER_DURATION_FRAMES);
  await runCommand(npx, args);
}

async function renderThumbnail(manifest: RenderManifest, thumbnailPath: string) {
  const requestedDuration = Number(process.env.VIDEO_AGENT_RENDER_DURATION_FRAMES ?? 900);
  const thumbnailFrame = String(Math.min(120, Math.max(0, requestedDuration - 1)));
  await runCommand(process.platform === "win32" ? "npx.cmd" : "npx", [
    "remotion",
    "still",
    "video/index.ts",
    "OpaijaShort",
    thumbnailPath,
    "--props",
    manifest.propsPath,
    "--frame",
    thumbnailFrame,
  ]);
}

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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
