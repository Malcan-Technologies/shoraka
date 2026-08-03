import type {
  HelpArticleSummaryViewModel,
  HelpCategoryGroup,
  HelpTocItem,
} from "./types";

export function groupHelpArticlesByCategory(
  articles: HelpArticleSummaryViewModel[]
): HelpCategoryGroup[] {
  const order: string[] = [];
  const map = new Map<string, HelpArticleSummaryViewModel[]>();

  for (const article of articles) {
    const key = article.category || "Guides";
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(article);
  }

  return order.map((category) => ({
    category,
    articles: map.get(category) ?? [],
  }));
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/&[^;]+;/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function extractHelpToc(source: string): HelpTocItem[] {
  const items: HelpTocItem[] = [];
  const seen = new Map<string, number>();
  const lines = source.replace(/\r/g, "").split("\n");
  let inFence = false;

  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!match) continue;

    const level = match[1].length as 2 | 3;
    const text = stripInlineMd(match[2].replace(/\s+#*$/, "").trim());
    if (!text) continue;

    let id = slugifyHeading(text);
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}-${count + 1}`;
    items.push({ id, text, level });
  }

  return items;
}

export function getReactNodeText(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getReactNodeText).join("");
  if (typeof node === "object" && node !== null && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return getReactNodeText(props?.children);
  }
  return "";
}

function stripInlineMd(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}
