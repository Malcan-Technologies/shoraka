#!/usr/bin/env tsx
/**
 * Publish local Markdown help articles to a Plain Help Center.
 *
 * Usage:
 *   pnpm --filter api plain:publish-help-articles -- --dry-run
 *   pnpm --filter api plain:publish-help-articles
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const PLAIN_GRAPHQL_URL = "https://core-api.uk.plain.com/graphql/v1";
const DEFAULT_HELP_CENTER_ID = "hc_01M1KAJMZ5MYD7WEJQRBG779FZ";
const REPO_ROOT = path.resolve(__dirname, "../../..");
const GROUPS = {
  issuer: { name: "For Issuers", slug: "for-issuers" },
  investor: { name: "For Investors", slug: "for-investors" },
} as const;

type SupportedPrefix = keyof typeof GROUPS;
type ArticleStatus = "PUBLISHED" | string;

interface Options {
  dryRun: boolean;
  directory: string;
  prefixes: SupportedPrefix[];
  helpCenterId: string;
}

interface HelpArticle {
  slug: string;
  prefix: SupportedPrefix;
  title: string;
  description: string;
  category: string;
  tags: string[];
  order: number;
  updated: string;
  contentHtml: string;
}

interface ArticleGroup {
  id: string;
  name: string;
  slug: string;
}

interface ExistingArticle {
  id: string;
  slug: string;
  title: string;
  status: ArticleStatus;
  articleGroup: { id: string } | null;
}

interface MutationFieldError {
  field: string;
  message: string;
  type: string;
}

interface MutationError {
  message: string;
  code: string;
  fields: MutationFieldError[];
}

interface GraphQLError {
  message: string;
  extensions?: { code?: string };
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

interface ExistingContentResponse {
  helpCenter: {
    id: string;
    articleGroups: { edges: Array<{ node: ArticleGroup }> };
    articles: { edges: Array<{ node: ExistingArticle }> };
  } | null;
}

interface CreateGroupResponse {
  createHelpCenterArticleGroup: {
    helpCenterArticleGroup: ArticleGroup | null;
    error: MutationError | null;
  };
}

interface UpsertArticleResponse {
  upsertHelpCenterArticle: {
    helpCenterArticle: Pick<ExistingArticle, "id" | "slug" | "status"> | null;
    error: MutationError | null;
  };
}

function parseOptions(args: string[]): Options {
  let dryRun = false;
  let directory = path.resolve(REPO_ROOT, "packages/help-content/markdown");
  let helpCenterId = DEFAULT_HELP_CENTER_ID;
  const prefixes: SupportedPrefix[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") {
      continue;
    } else if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument === "--dir") {
      directory = path.resolve(REPO_ROOT, requireFlagValue(args, ++index, argument));
    } else if (argument === "--prefix") {
      prefixes.push(parsePrefix(requireFlagValue(args, ++index, argument)));
    } else if (argument === "--help-center-id") {
      helpCenterId = requireFlagValue(args, ++index, argument);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return {
    dryRun,
    directory,
    prefixes: prefixes.length > 0 ? [...new Set(prefixes)] : ["issuer", "investor"],
    helpCenterId,
  };
}

function requireFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parsePrefix(value: string): SupportedPrefix {
  if (value === "issuer" || value === "investor") {
    return value;
  }
  throw new Error(`Unsupported prefix "${value}". Expected issuer or investor.`);
}

function requireString(data: Record<string, unknown>, field: string, fileName: string): string {
  const value = data[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fileName}: frontmatter "${field}" must be a non-empty string`);
  }
  return value.trim();
}

function parseTags(value: unknown, fileName: string): string[] {
  if (!Array.isArray(value) || !value.every((tag) => typeof tag === "string")) {
    throw new Error(`${fileName}: frontmatter "tags" must be a string array`);
  }
  return value.map((tag) => tag.trim()).filter(Boolean);
}

function parseOrder(value: unknown, fileName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fileName}: frontmatter "order" must be a number`);
  }
  return value;
}

function parseUpdated(value: unknown, fileName: string): string {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  throw new Error(`${fileName}: frontmatter "updated" must be a YYYY-MM-DD date`);
}

function stripDuplicateTitle(content: string, title: string): string {
  const trimmed = content.trimStart();
  const heading = trimmed.match(/^#\s+(.+?)(?:\r?\n|$)/);
  if (!heading || heading[1].trim() !== title) {
    return trimmed;
  }
  return trimmed.slice(heading[0].length).trimStart();
}

async function renderMarkdown(content: string, title: string, fileName: string): Promise<string> {
  if (/```[ \t]*mermaid\b/i.test(content)) {
    throw new Error(`${fileName}: Mermaid code block remains`);
  }
  const { marked } = await import("marked");
  return marked(stripDuplicateTitle(content, title), { async: false, gfm: true });
}

async function readArticles(options: Options): Promise<HelpArticle[]> {
  const fileNames = (await fs.readdir(options.directory))
    .filter((fileName) => options.prefixes.some((prefix) => fileName.startsWith(`${prefix}-`)))
    .filter((fileName) => fileName.endsWith(".md"));

  const articles = await Promise.all(
    fileNames.map(async (fileName) => {
      const prefix = options.prefixes.find((item) => fileName.startsWith(`${item}-`));
      if (!prefix) throw new Error(`${fileName}: cannot determine article prefix`);
      const source = await fs.readFile(path.join(options.directory, fileName), "utf8");
      const parsed = matter(source);
      const data: Record<string, unknown> = parsed.data;
      const title = requireString(data, "title", fileName);
      return {
        slug: fileName.slice(0, -3).toLowerCase(),
        prefix,
        title,
        description: requireString(data, "description", fileName),
        category: requireString(data, "category", fileName),
        tags: parseTags(data.tags, fileName),
        order: parseOrder(data.order, fileName),
        updated: parseUpdated(data.updated, fileName),
        contentHtml: await renderMarkdown(parsed.content, title, fileName),
      };
    })
  );

  return articles.sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
}

async function graphql<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const response = await fetch(PLAIN_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = (await response.json()) as GraphQLResponse<T>;
  if (!response.ok || payload.errors?.length) {
    const details = payload.errors?.map((error) => error.message).join("; ") ?? response.statusText;
    throw new Error(`Plain GraphQL request failed (${response.status}): ${details}`);
  }
  if (!payload.data) throw new Error("Plain GraphQL response did not include data");
  return payload.data;
}

async function loadExistingContent(
  apiKey: string,
  helpCenterId: string
): Promise<{ groups: ArticleGroup[]; articles: ExistingArticle[] }> {
  const query = `
    query ExistingHelpContent($id: ID!) {
      helpCenter(id: $id) {
        id
        articleGroups(first: 100) { edges { node { id name slug } } }
        articles(first: 100) {
          edges { node { id slug title status articleGroup { id } } }
        }
      }
    }
  `;
  const data = await graphql<ExistingContentResponse>(apiKey, query, { id: helpCenterId });
  if (!data.helpCenter) throw new Error(`Plain Help Center ${helpCenterId} was not found`);
  return {
    groups: data.helpCenter.articleGroups.edges.map((edge) => edge.node),
    articles: data.helpCenter.articles.edges.map((edge) => edge.node),
  };
}

function formatMutationError(error: MutationError): string {
  const fields = error.fields
    .map((field) => `${field.field}: ${field.message} (${field.type})`)
    .join(", ");
  return `${error.message} [${error.code}]${fields ? ` ${fields}` : ""}`;
}

async function createGroup(
  apiKey: string,
  helpCenterId: string,
  prefix: SupportedPrefix
): Promise<ArticleGroup> {
  const query = `
    mutation CreateArticleGroup($input: CreateHelpCenterArticleGroupInput!) {
      createHelpCenterArticleGroup(input: $input) {
        helpCenterArticleGroup { id name slug }
        error { message code fields { field message type } }
      }
    }
  `;
  const group = GROUPS[prefix];
  const data = await graphql<CreateGroupResponse>(apiKey, query, {
    input: { helpCenterId, name: group.name, slug: group.slug },
  });
  const result = data.createHelpCenterArticleGroup;
  if (result.error) throw new Error(`Could not create group ${group.name}: ${formatMutationError(result.error)}`);
  if (!result.helpCenterArticleGroup) throw new Error(`Plain did not return the created group ${group.name}`);
  return result.helpCenterArticleGroup;
}

async function ensureGroups(
  apiKey: string,
  options: Options,
  existingGroups: ArticleGroup[]
): Promise<Map<SupportedPrefix, ArticleGroup | null>> {
  const groups = new Map<SupportedPrefix, ArticleGroup | null>();
  for (const prefix of options.prefixes) {
    const expected = GROUPS[prefix];
    const existing = existingGroups.find(
      (group) => group.slug.toLowerCase() === expected.slug || group.name === expected.name
    );
    if (existing) {
      groups.set(prefix, existing);
    } else if (options.dryRun) {
      console.log(`[dry-run] group=${expected.name} action=create`);
      groups.set(prefix, null);
    } else {
      const created = await createGroup(apiKey, options.helpCenterId, prefix);
      console.log(`group=${created.name} action=created id=${created.id}`);
      groups.set(prefix, created);
    }
  }
  return groups;
}

async function upsertArticle(
  apiKey: string,
  helpCenterId: string,
  article: HelpArticle,
  groupId: string,
  existingId?: string
): Promise<Pick<ExistingArticle, "id" | "slug" | "status">> {
  const query = `
    mutation UpsertArticle($input: UpsertHelpCenterArticleInput!) {
      upsertHelpCenterArticle(input: $input) {
        helpCenterArticle { id slug status }
        error { message code fields { field message type } }
      }
    }
  `;
  const input = {
    helpCenterId,
    helpCenterArticleId: existingId,
    helpCenterArticleGroupId: groupId,
    slug: article.slug,
    title: article.title,
    description: article.description,
    contentHtml: article.contentHtml,
    status: "PUBLISHED",
  };
  const data = await graphql<UpsertArticleResponse>(apiKey, query, { input });
  const result = data.upsertHelpCenterArticle;
  if (result.error) throw new Error(`Could not publish ${article.slug}: ${formatMutationError(result.error)}`);
  if (!result.helpCenterArticle) throw new Error(`Plain did not return article ${article.slug}`);
  return result.helpCenterArticle;
}

async function publishArticles(
  apiKey: string,
  options: Options,
  articles: HelpArticle[],
  existingArticles: ExistingArticle[],
  groups: Map<SupportedPrefix, ArticleGroup | null>
): Promise<void> {
  const existingBySlug = new Map(existingArticles.map((article) => [article.slug.toLowerCase(), article]));
  for (const article of articles) {
    const existing = existingBySlug.get(article.slug);
    const action = existing ? "updated" : "created";
    if (options.dryRun) {
      console.log(`${article.slug} action=${action} status=PUBLISHED group=${GROUPS[article.prefix].name}`);
      continue;
    }
    const group = groups.get(article.prefix);
    if (!group) throw new Error(`Group ${GROUPS[article.prefix].name} is unavailable`);
    const published = await upsertArticle(
      apiKey,
      options.helpCenterId,
      article,
      group.id,
      existing?.id
    );
    console.log(`${published.slug} action=${action} id=${published.id} status=${published.status}`);
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const apiKey = process.env.PLAIN_API_KEY;
  if (!apiKey) throw new Error("PLAIN_API_KEY is required");
  const articles = await readArticles(options);
  if (articles.length === 0) throw new Error(`No matching Markdown articles found in ${options.directory}`);
  const existing = await loadExistingContent(apiKey, options.helpCenterId);
  const groups = await ensureGroups(apiKey, options, existing.groups);
  await publishArticles(apiKey, options, articles, existing.articles, groups);
  console.log(`${options.dryRun ? "Dry run complete" : "Publish complete"}: ${articles.length} article(s).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
