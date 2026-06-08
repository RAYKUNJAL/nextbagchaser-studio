import fs from "node:fs/promises";
import path from "node:path";
import { listContentStorageItems, upsertContentStorageItem } from "./contentStorage.js";

export type ProjectStatus =
  | "story_intake"
  | "bible_review"
  | "character_review"
  | "season_review"
  | "teaser_ready"
  | "production_ready"
  | "publishing"
  | "paused";

export type StudioProject = {
  id: string;
  title: string;
  slug: string;
  genre: string;
  audience: string;
  tone: string;
  runtimeGoal: string;
  visualStyleNotes: string;
  publicDomain?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  counts: {
    storyOutlines: number;
    characterSheets: number;
  };
  latestWorldPackPath?: string;
};

export type ProjectCreateInput = {
  title?: string;
  genre?: string;
  audience?: string;
  tone?: string;
  runtimeGoal?: string;
  visualStyleNotes?: string;
  publicDomain?: string;
};

export type ProjectUpdateInput = Partial<ProjectCreateInput> & {
  status?: ProjectStatus;
};

export type ProjectUploadInput = {
  fileName?: string;
  contentType?: string;
  dataBase64?: string;
  text?: string;
};

type WorldPack = {
  projectId: string;
  title: string;
  status: "bible_review";
  createdAt: string;
  sourceFiles: {
    storyOutlines: string[];
    characterSheets: string[];
  };
  storyBible: {
    premise: string;
    audiencePromise: string;
    tone: string;
    verticalFormat: string;
  };
  characterBible: {
    sourceSheets: string[];
    reviewNeeded: string[];
  };
  seasonOne: {
    format: string;
    episodes: Array<{
      episode: number;
      title: string;
      hook: string;
      cliffhanger: string;
    }>;
  };
  powerTeasers: Array<{
    target: string;
    runtimeSec: string;
    purpose: string;
  }>;
  agentTeam: Array<{
    name: string;
    lane: "goose" | "paperclip" | "qc";
    mission: string;
    output: string;
  }>;
  productionReadiness: string[];
};

const dataDir = path.resolve(process.cwd(), "data");
const projectsPath = path.join(dataDir, "projects.json");
const opsProjectsRoot = path.resolve(process.cwd(), "ops", "projects");
const outProjectsRoot = path.resolve(process.cwd(), "out", "projects");

export async function listProjects() {
  const projects = await readProjects();
  if (!projects.some((project) => project.id === "opaija")) {
    const seeded = await seedOpaijaProject(projects);
    return seeded.sort(sortProjects);
  }
  return projects.sort(sortProjects);
}

export async function createProject(input: ProjectCreateInput) {
  const title = requiredText(input.title, "Project title is required.");
  const slug = uniqueSlug(slugify(title), await readProjects());
  const now = new Date().toISOString();
  const project: StudioProject = {
    id: slug,
    title,
    slug,
    genre: input.genre?.trim() || "Vertical animated micro-series",
    audience: input.audience?.trim() || "Mobile-first anime and short-drama fans",
    tone: input.tone?.trim() || "Fast, emotional, cliffhanger-driven",
    runtimeGoal: input.runtimeGoal?.trim() || "20-35s teasers and 60-90s episodes",
    visualStyleNotes: input.visualStyleNotes?.trim() || "Upload character sheets and style references before production.",
    publicDomain: input.publicDomain?.trim(),
    status: "story_intake",
    createdAt: now,
    updatedAt: now,
    counts: { storyOutlines: 0, characterSheets: 0 },
  };
  const projects = await readProjects();
  projects.push(project);
  await writeProjects(projects);
  await ensureProjectFolders(project.id);
  return project;
}

export async function getProject(projectId: string) {
  const project = (await listProjects()).find((candidate) => candidate.id === projectId);
  if (!project) throw new Error("Project not found.");
  return project;
}

export async function updateProject(projectId: string, input: ProjectUpdateInput) {
  const projects = await readProjects();
  const index = projects.findIndex((project) => project.id === projectId);
  if (index < 0) throw new Error("Project not found.");
  projects[index] = {
    ...projects[index],
    ...pickDefined({
      title: input.title?.trim(),
      genre: input.genre?.trim(),
      audience: input.audience?.trim(),
      tone: input.tone?.trim(),
      runtimeGoal: input.runtimeGoal?.trim(),
      visualStyleNotes: input.visualStyleNotes?.trim(),
      publicDomain: input.publicDomain?.trim(),
      status: input.status,
    }),
    updatedAt: new Date().toISOString(),
  };
  await writeProjects(projects);
  return projects[index];
}

export async function uploadStoryOutline(projectId: string, input: ProjectUploadInput) {
  await getProject(projectId);
  const saved = await saveUpload(projectId, "story-outline", input, ["txt", "md", "pdf", "docx"]);
  await refreshProjectCounts(projectId);
  return saved;
}

export async function uploadCharacterSheets(projectId: string, input: { files?: ProjectUploadInput[] }) {
  await getProject(projectId);
  const files = input.files ?? [];
  if (!files.length) throw new Error("At least one character sheet file is required.");
  const saved = [];
  for (const file of files) saved.push(await saveUpload(projectId, "character-sheets", file, ["png", "jpg", "jpeg", "webp"]));
  await refreshProjectCounts(projectId);
  return { files: saved };
}

export async function buildProjectWorldPack(projectId: string) {
  const project = await getProject(projectId);
  const storyOutlines = await listProjectFiles(projectId, "story-outline");
  const characterSheets = await listProjectFiles(projectId, "character-sheets");
  if (!storyOutlines.length) throw new Error("Upload a story outline before building a world pack.");
  if (!characterSheets.length) throw new Error("Upload at least one character sheet before building a world pack.");

  const storyText = await readStoryPreview(storyOutlines[0].absolutePath);
  const now = new Date().toISOString();
  const worldPack: WorldPack = {
    projectId,
    title: project.title,
    status: "bible_review",
    createdAt: now,
    sourceFiles: {
      storyOutlines: storyOutlines.map((file) => file.relativePath),
      characterSheets: characterSheets.map((file) => file.relativePath),
    },
    storyBible: {
      premise: storyText || `${project.title} is ready for story development from the uploaded outline.`,
      audiencePromise: `${project.audience}. The show should feel ${project.tone.toLowerCase()} and built for repeat vertical viewing.`,
      tone: project.tone,
      verticalFormat: project.runtimeGoal,
    },
    characterBible: {
      sourceSheets: characterSheets.map((file) => file.relativePath),
      reviewNeeded: [
        "Name each uploaded character sheet.",
        "Confirm protagonist, antagonist, powers, relationships, and visual locks.",
        "Approve no-drift rules before paid image/video generation.",
      ],
    },
    seasonOne: {
      format: "60-90 second vertical chapters with hard cliffhangers.",
      episodes: Array.from({ length: 10 }, (_, index) => ({
        episode: index + 1,
        title: `Chapter ${index + 1}`,
        hook: index === 0 ? "Open with the strongest visual conflict from the uploaded premise." : "Escalate the previous cliffhanger immediately.",
        cliffhanger: "End on a reveal, betrayal, power unlock, or unanswered danger.",
      })),
    },
    powerTeasers: characterSheets.slice(0, 6).map((file, index) => ({
      target: `Uploaded character sheet ${index + 1}: ${path.basename(file.relativePath)}`,
      runtimeSec: "20-35",
      purpose: "Show the character identity, signature power, and threat hook before full episode production.",
    })),
    agentTeam: [
      {
        name: "Intake Agent",
        lane: "paperclip",
        mission: "Organize uploaded story outlines and character sheets into a clean project source packet.",
        output: "source inventory and missing-input checklist",
      },
      {
        name: "Showrunner Agent",
        lane: "goose",
        mission: "Turn the base story into a bingeable vertical micro-series with season stakes and cliffhangers.",
        output: "story bible and Season 1 arc",
      },
      {
        name: "Character Bible Agent",
        lane: "goose",
        mission: "Extract character roles, powers, relationships, and visual identity locks from uploaded sheets.",
        output: "character bible review packet",
      },
      {
        name: "Style Lock Agent",
        lane: "qc",
        mission: "Create project-specific style memory, negative prompts, and no-drift rules before paid generation.",
        output: "style-memory.json",
      },
      {
        name: "Episode Agent",
        lane: "goose",
        mission: "Build 60-90 second vertical episode outlines with hard cliffhangers.",
        output: "episode list and script queue",
      },
      {
        name: "Power Teaser Agent",
        lane: "goose",
        mission: "Create 20-35 second character power teaser plans with audio-action beat sheets.",
        output: "teaser plan and storyboard prep",
      },
      {
        name: "Review Gate Agent",
        lane: "qc",
        mission: "Block paid production until story bible, character bible, and style memory are approved.",
        output: "production readiness decision",
      },
    ],
    productionReadiness: [
      "Owner must approve story bible.",
      "Owner must approve character bible.",
      "Owner must approve style memory and negative prompts.",
      "Run dry storyboard and audio-action beat sheet before paid animation.",
    ],
  };

  const projectRoot = await ensureProjectFolders(projectId);
  const worldPackPath = path.join(projectRoot, "world-pack.json");
  const styleMemoryPath = path.join(projectRoot, "memory", "style-memory.json");
  await fs.writeFile(worldPackPath, `${JSON.stringify(worldPack, null, 2)}\n`, "utf8");
  await fs.writeFile(
    styleMemoryPath,
    `${JSON.stringify(
      {
        projectId,
        title: project.title,
        visualStyleNotes: project.visualStyleNotes,
        characterSheets: characterSheets.map((file) => file.relativePath),
        negativeRules: ["No text baked into artwork", "No character drift", "No unapproved style changes", "No paid animation before bible approval"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await updateProject(projectId, { status: "bible_review" });
  await setLatestWorldPack(projectId, worldPackPath);
  await upsertContentStorageItem({
    id: `${projectId}-world-pack`,
    title: `${project.title} World Pack`,
    category: "storyboard",
    status: "needs_review",
    style: project.visualStyleNotes,
    createdAt: now,
    updatedAt: now,
    buildId: `${projectId}-world-pack`,
    episode: "World Intake",
    notes: ["Dry-run world pack generated from uploaded story outline and character sheets.", "No paid providers were used."],
    assets: [
      { type: "manifest", label: "World pack", filePath: worldPackPath },
      { type: "source", label: "Style memory", filePath: styleMemoryPath },
      ...characterSheets.map((file, index) => ({ type: "image" as const, label: `Character sheet ${index + 1}`, filePath: file.absolutePath })),
    ],
  });

  return { worldPack, files: { worldPackPath, styleMemoryPath } };
}

export async function listProjectContentStorage(projectId: string) {
  const items = await listContentStorageItems();
  return items.filter((item) => item.id.startsWith(`${projectId}-`) || item.buildId?.startsWith(`${projectId}-`));
}

async function saveUpload(projectId: string, folder: "story-outline" | "character-sheets", input: ProjectUploadInput, allowedExtensions: string[]) {
  const fileName = sanitizeFileName(input.fileName || (folder === "story-outline" ? "story-outline.txt" : "character-sheet.png"));
  const extension = path.extname(fileName).replace(".", "").toLowerCase();
  if (!allowedExtensions.includes(extension)) throw new Error(`.${extension || "file"} is not allowed for ${folder}.`);
  const projectRoot = await ensureProjectFolders(projectId);
  const outputDir = path.join(projectRoot, folder);
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, uniqueFileName(fileName));
  const data = input.dataBase64 ? Buffer.from(stripDataUrl(input.dataBase64), "base64") : Buffer.from(input.text ?? "", "utf8");
  if (!data.length) throw new Error("Uploaded file is empty.");
  if (data.length > 25 * 1024 * 1024) throw new Error("Uploaded file is larger than 25MB.");
  await fs.writeFile(outputPath, data);
  return {
    fileName: path.basename(outputPath),
    filePath: outputPath,
    relativePath: toPosix(path.relative(path.resolve(process.cwd()), outputPath)),
    size: data.length,
  };
}

async function refreshProjectCounts(projectId: string) {
  const [storyOutlines, characterSheets] = await Promise.all([
    listProjectFiles(projectId, "story-outline"),
    listProjectFiles(projectId, "character-sheets"),
  ]);
  const projects = await readProjects();
  const index = projects.findIndex((project) => project.id === projectId);
  if (index >= 0) {
    projects[index].counts = { storyOutlines: storyOutlines.length, characterSheets: characterSheets.length };
    projects[index].updatedAt = new Date().toISOString();
    await writeProjects(projects);
  }
}

async function setLatestWorldPack(projectId: string, worldPackPath: string) {
  const projects = await readProjects();
  const index = projects.findIndex((project) => project.id === projectId);
  if (index >= 0) {
    projects[index].latestWorldPackPath = worldPackPath;
    projects[index].updatedAt = new Date().toISOString();
    await writeProjects(projects);
  }
}

async function listProjectFiles(projectId: string, folder: "story-outline" | "character-sheets") {
  const projectRoot = await ensureProjectFolders(projectId);
  const dir = path.join(projectRoot, folder);
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  return Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const absolutePath = path.join(dir, entry.name);
        return {
          absolutePath,
          relativePath: toPosix(path.relative(path.resolve(process.cwd()), absolutePath)),
        };
      }),
  );
}

async function readStoryPreview(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension !== ".txt" && extension !== ".md") {
    return `Story outline uploaded as ${path.basename(filePath)}. Text extraction for this file type will be added in the next parser pass.`;
  }
  const raw = await fs.readFile(filePath, "utf8");
  return raw.replace(/\s+/g, " ").trim().slice(0, 1400);
}

async function seedOpaijaProject(projects: StudioProject[]) {
  const now = new Date().toISOString();
  const opaija: StudioProject = {
    id: "opaija",
    title: "OPAIJA: Staff of Battle",
    slug: "opaija",
    genre: "2D Caribbean anime vertical franchise",
    audience: "Anime fans, Caribbean diaspora, Black global animation audience, mobile-first short-drama viewers",
    tone: "Fast action, spiritual rhythm power, cliffhanger-driven, franchise-scale",
    runtimeGoal: "20-35s power teasers and 60-90s vertical episodes",
    visualStyleNotes: "Locked 2D Trini anime bible-sheet style with premium orange/gold action-trailer finish.",
    publicDomain: "opaija.com",
    status: "teaser_ready",
    createdAt: now,
    updatedAt: now,
    counts: { storyOutlines: 0, characterSheets: 10 },
    latestWorldPackPath: path.resolve(process.cwd(), "ops", "memory", "season-one-franchise-bible.json"),
  };
  const next = [opaija, ...projects];
  await writeProjects(next);
  await ensureProjectFolders("opaija");
  return next;
}

async function ensureProjectFolders(projectId: string) {
  const safeId = slugify(projectId);
  const projectRoot = path.join(opsProjectsRoot, safeId);
  await fs.mkdir(path.join(projectRoot, "story-outline"), { recursive: true });
  await fs.mkdir(path.join(projectRoot, "character-sheets"), { recursive: true });
  await fs.mkdir(path.join(projectRoot, "memory"), { recursive: true });
  await fs.mkdir(path.join(projectRoot, "production"), { recursive: true });
  await fs.mkdir(path.join(outProjectsRoot, safeId), { recursive: true });
  return projectRoot;
}

async function readProjects(): Promise<StudioProject[]> {
  try {
    return JSON.parse(await fs.readFile(projectsPath, "utf8")) as StudioProject[];
  } catch {
    return [];
  }
}

async function writeProjects(projects: StudioProject[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(projectsPath, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
}

function sortProjects(left: StudioProject, right: StudioProject) {
  if (left.id === "opaija") return -1;
  if (right.id === "opaija") return 1;
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function requiredText(value: string | undefined, message: string) {
  const text = value?.trim();
  if (!text) throw new Error(message);
  return text;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "project";
}

function uniqueSlug(baseSlug: string, projects: StudioProject[]) {
  const existing = new Set(projects.map((project) => project.id));
  if (!existing.has(baseSlug)) return baseSlug;
  let index = 2;
  while (existing.has(`${baseSlug}-${index}`)) index += 1;
  return `${baseSlug}-${index}`;
}

function sanitizeFileName(value: string) {
  const base = path.basename(value).replace(/[^a-zA-Z0-9._ -]/g, "-").trim();
  return base || "upload.txt";
}

function uniqueFileName(fileName: string) {
  const parsed = path.parse(fileName);
  return `${slugify(parsed.name)}-${Date.now()}${parsed.ext.toLowerCase()}`;
}

function stripDataUrl(value: string) {
  return value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
}

function pickDefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== "")) as Partial<T>;
}

function toPosix(value: string) {
  return value.split(path.sep).join("/");
}
