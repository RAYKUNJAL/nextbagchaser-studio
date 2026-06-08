import fs from "node:fs/promises";
import path from "node:path";

export type BlogPostStatus = "draft" | "published";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  keywords: string[];
  status: BlogPostStatus;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  heroImage?: string;
  markdown: string;
  html: string;
  sources: Array<{
    title: string;
    url: string;
  }>;
};

export type BlogPostInput = Omit<BlogPost, "id" | "slug" | "updatedAt" | "readingMinutes" | "html"> & {
  slug?: string;
};

const blogDataPath = path.resolve(process.cwd(), "data", "blog-posts.json");

export async function listBlogPosts() {
  const posts = await readBlogPosts();
  return posts.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export async function listPublishedBlogPosts() {
  const posts = await listBlogPosts();
  return posts.filter((post) => post.status === "published");
}

export async function getBlogPostBySlug(slug: string) {
  const posts = await readBlogPosts();
  return posts.find((post) => post.slug === slug && post.status === "published") ?? null;
}

export async function publishBlogPost(input: BlogPostInput) {
  const now = new Date().toISOString();
  const slug = uniqueSlug(input.slug ?? slugify(input.title), await readBlogPosts());
  const markdown = input.markdown.trim();
  const post: BlogPost = {
    ...input,
    id: crypto.randomUUID(),
    slug,
    status: input.status ?? "published",
    publishedAt: input.publishedAt || now,
    updatedAt: now,
    readingMinutes: estimateReadingMinutes(markdown),
    markdown,
    html: markdownToHtml(markdown),
    sources: input.sources ?? [],
  };

  const posts = await readBlogPosts();
  posts.push(post);
  await writeBlogPosts(posts);
  return post;
}

async function readBlogPosts(): Promise<BlogPost[]> {
  try {
    const raw = await fs.readFile(blogDataPath, "utf8");
    return JSON.parse(raw) as BlogPost[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeBlogPosts(posts: BlogPost[]) {
  await fs.mkdir(path.dirname(blogDataPath), { recursive: true });
  await fs.writeFile(blogDataPath, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}

function uniqueSlug(baseSlug: string, posts: BlogPost[]) {
  const existing = new Set(posts.map((post) => post.slug));
  let slug = baseSlug || "opaija-story-blog";
  let suffix = 2;

  while (existing.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 86);
}

function estimateReadingMinutes(markdown: string) {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function markdownToHtml(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    html.push(`<ul>${listItems.join("")}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      html.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      html.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushList();
      html.push(`<h1>${inlineMarkdown(trimmed.slice(2))}</h1>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`);
      continue;
    }

    flushList();
    html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }

  flushList();
  return html.join("\n");
}

function inlineMarkdown(value: string) {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
