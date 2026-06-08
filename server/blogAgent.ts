import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { listBlogPosts, publishBlogPost, slugify } from "./blog.js";

dotenv.config();

type AgentPost = {
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  keywords: string[];
  markdown: string;
  sources: Array<{
    title: string;
    url: string;
  }>;
};

const seedTopics = [
  "Every Island Has a Warrior",
  "Meet Kai Baptiste",
  "Why Doubles Matter in Opaija",
  "What Is the Gayelle?",
  "Nia and the Power of Lavway",
  "The Rootbreaker Rival",
  "Mother Lall Knows More Than She Says",
  "Tidewatch Comes From Tobago",
  "The False One Drum",
  "Noise Is Weakness: Selah Vale",
  "How We Build the 2.5D Caribbean Anime Style",
  "Join the Founder Art Drop",
];

const categoryCycle = ["Characters", "Lore", "Behind the Art", "Action and FX", "The Story So Far", "Books and Collectibles"];

async function main() {
  const existingPosts = await listBlogPosts();
  const topic = pickTopic(existingPosts.map((post) => post.title));
  const research = await buildResearchBrief(topic);
  const generated = await generatePost(topic, research);
  const post = await publishBlogPost({
    ...generated,
    status: "published",
    publishedAt: new Date().toISOString(),
    slug: slugify(generated.title),
    heroImage: "/assets/video/opaija-hero-kai-strike-poster.jpg",
  });

  console.log(JSON.stringify({ ok: true, title: post.title, slug: post.slug, url: `/blog/${post.slug}` }, null, 2));
}

function pickTopic(existingTitles: string[]) {
  const existing = new Set(existingTitles.map((title) => title.toLowerCase()));
  return seedTopics.find((topic) => !existing.has(topic.toLowerCase())) ?? `${seedTopics[new Date().getHours() % seedTopics.length]}: ${new Date().toISOString().slice(0, 10)}`;
}

async function buildResearchBrief(topic: string) {
  const localFiles = [
    "docs/STORY_BLOG_AND_LEAD_MAGNET_PLAN.md",
    "docs/TRIBE_GROWTH_ENGINE.md",
    "docs/OPAIJA_STYLE_GUIDE.md",
    "docs/OPAIJA_COMMAND_CENTER_BLUEPRINT.md",
  ];

  const localNotes = await Promise.all(
    localFiles.map(async (file) => {
      try {
        return `SOURCE: ${file}\n${await fs.readFile(path.resolve(process.cwd(), file), "utf8")}`;
      } catch {
        return "";
      }
    }),
  );

  const remoteNotes = await fetchResearchUrls();
  return [
    `TOPIC: ${topic}`,
    "LOCAL CANON AND STRATEGY NOTES:",
    ...localNotes.filter(Boolean),
    "OPTIONAL WEB RESEARCH NOTES:",
    ...remoteNotes,
  ].join("\n\n").slice(0, 28000);
}

async function fetchResearchUrls() {
  const urls = (process.env.BLOG_RESEARCH_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 6);

  const results: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "OpaijaBlogAgent/1.0" } });
      if (!response.ok) continue;
      const text = await response.text();
      results.push(`SOURCE: ${url}\n${stripHtml(text).slice(0, 4500)}`);
    } catch {
      continue;
    }
  }

  return results;
}

async function generatePost(topic: string, research: string): Promise<AgentPost> {
  const prompt = buildPrompt(topic, research);
  const provider = process.env.BLOG_LLM_PROVIDER ?? "ollama";
  const raw = provider === "openai-compatible" ? await generateWithOpenAiCompatible(prompt) : await generateWithOllama(prompt);
  return parseAgentPost(raw);
}

function buildPrompt(topic: string, research: string) {
  return [
    "You are the OPAIJA Story Blog Agent.",
    "Write one SEO-focused blog post for opaija.com that builds search traffic and turns readers into founder-list subscribers.",
    "Use canon carefully. Opaija is a Caribbean anime story world rooted first in Trinidad and Tobago, then the wider Caribbean.",
    "Use 'enslaved Africans' for historical references. Do not invent real-world claims that are not in the research notes.",
    "Write in a vivid but clean commercial voice. No generic fantasy language. No AI disclaimers.",
    "Return valid JSON only. No markdown fence.",
    "JSON shape: {\"title\":\"\",\"excerpt\":\"\",\"category\":\"\",\"tags\":[\"\"],\"keywords\":[\"\"],\"markdown\":\"\",\"sources\":[{\"title\":\"\",\"url\":\"\"}]}",
    "Markdown must include an H1, 3-5 H2 sections, a short founder-list call to action, and 800-1200 words.",
    `Allowed categories: ${categoryCycle.join(", ")}`,
    `Topic: ${topic}`,
    research,
  ].join("\n\n");
}

async function generateWithOllama(prompt: string) {
  const baseUrl = process.env.BLOG_LLM_BASE_URL ?? "http://localhost:11434";
  const model = process.env.BLOG_LLM_MODEL ?? "llama3.1";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: Number(process.env.BLOG_LLM_TEMPERATURE ?? 0.65),
      },
    }),
  });

  if (!response.ok) throw new Error(`Local Ollama request failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { response?: string };
  return data.response ?? "";
}

async function generateWithOpenAiCompatible(prompt: string) {
  const baseUrl = process.env.BLOG_LLM_BASE_URL ?? "http://localhost:1234/v1";
  const model = process.env.BLOG_LLM_MODEL ?? "local-model";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.BLOG_LLM_API_KEY ?? "local"}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: Number(process.env.BLOG_LLM_TEMPERATURE ?? 0.65),
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) throw new Error(`Local OpenAI-compatible request failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

function parseAgentPost(raw: string): AgentPost {
  const parsed = JSON.parse(extractJson(raw)) as Partial<AgentPost>;
  if (!parsed.title || !parsed.excerpt || !parsed.markdown) {
    throw new Error("Blog model returned incomplete JSON.");
  }

  return {
    title: parsed.title,
    excerpt: parsed.excerpt,
    category: parsed.category || "Lore",
    tags: cleanList(parsed.tags, ["Opaija", "Caribbean anime"]),
    keywords: cleanList(parsed.keywords, ["Opaija", "Caribbean anime", parsed.title]),
    markdown: parsed.markdown,
    sources: Array.isArray(parsed.sources) ? parsed.sources.filter((source) => source.title && source.url) : [],
  };
}

function extractJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Blog model did not return JSON.");
  return raw.slice(start, end + 1);
}

function cleanList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8);
  return cleaned.length ? cleaned : fallback;
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
