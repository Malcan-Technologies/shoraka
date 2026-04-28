import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const helpPortals = ["admin", "issuer", "investor"] as const;

export type HelpPortal = (typeof helpPortals)[number];

export type HelpArticleSummary = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  updated: string;
  order: number;
};

export type HelpArticle = HelpArticleSummary & {
  content: string;
};

type HelpFrontmatter = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  tags?: unknown;
  updated?: unknown;
  order?: unknown;
};

const HELP_DIRECTORY = ["docs", "help"];

function getWorkspaceRoot() {
  let current = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return process.cwd();
}

function getHelpDirectory() {
  const candidates = [
    path.join(getWorkspaceRoot(), ...HELP_DIRECTORY),
    path.join(process.cwd(), ...HELP_DIRECTORY),
    path.join(process.cwd(), "..", ...HELP_DIRECTORY),
    path.join(process.cwd(), "..", "..", ...HELP_DIRECTORY),
  ];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (fs.existsSync(resolved)) return resolved;
  }

  return path.resolve(candidates[0] ?? path.join(process.cwd(), ...HELP_DIRECTORY));
}

function parseTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }

  return [];
}

function parseOrder(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 100;
}

function parseUpdated(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return typeof value === "string" ? value : "";
}

function normalizeArticle(slug: string, data: HelpFrontmatter, content: string): HelpArticle {
  const title = typeof data.title === "string" ? data.title : slug;
  const description = typeof data.description === "string" ? data.description : "";
  const category = typeof data.category === "string" ? data.category : "Help";
  const tags = parseTags(data.tags);

  return {
    slug,
    title,
    description,
    category,
    tags,
    updated: parseUpdated(data.updated),
    order: parseOrder(data.order),
    content,
  };
}

function readHelpArticles() {
  const directory = getHelpDirectory();

  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, "");
      const source = fs.readFileSync(path.join(directory, fileName), "utf8");
      const parsed = matter(source);

      return normalizeArticle(slug, parsed.data, parsed.content.trim());
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function isVisibleToPortal(article: HelpArticleSummary, portal: HelpPortal) {
  return article.tags.includes("all") || article.tags.includes(portal);
}

export function getHelpArticles(portal: HelpPortal): HelpArticleSummary[] {
  return readHelpArticles()
    .filter((article) => isVisibleToPortal(article, portal))
    .map((article) => ({
      slug: article.slug,
      title: article.title,
      description: article.description,
      category: article.category,
      tags: article.tags,
      updated: article.updated,
      order: article.order,
    }));
}

export function getHelpArticle(portal: HelpPortal, slug: string): HelpArticle | null {
  const article = readHelpArticles().find((item) => item.slug === slug);

  if (!article || !isVisibleToPortal(article, portal)) {
    return null;
  }

  return article;
}

export function getHelpArticleParams(portal: HelpPortal) {
  return getHelpArticles(portal).map((article) => ({ slug: article.slug }));
}
