import { ALL_HELP_ARTICLES } from "./generated/help-articles";

export type HelpPortal = "admin" | "issuer" | "investor";

export type HelpArticle = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  updated: string;
  order: number;
  content: string;
};

export type HelpArticleMeta = Omit<HelpArticle, "content">;

function articleMatchesPortal(slug: string, portal: HelpPortal): boolean {
  if (portal === "admin") return slug.startsWith("admin-");
  if (portal === "issuer") return slug.startsWith("issuer-");
  return slug.startsWith("investor-");
}

export function getHelpArticles(portal: HelpPortal): HelpArticleMeta[] {
  return ALL_HELP_ARTICLES.filter((a) => articleMatchesPortal(a.slug, portal)).map(
    ({ content: _c, ...article }) => ({
      ...article,
      tags: [...article.tags],
    })
  );
}

export function getHelpArticle(portal: HelpPortal, slug: string): HelpArticle | null {
  const article = ALL_HELP_ARTICLES.find((item) => item.slug === slug) ?? null;
  if (!article || !articleMatchesPortal(slug, portal)) return null;
  return { ...article, tags: [...article.tags] };
}

export function getHelpArticleParams(portal: HelpPortal): Array<{ slug: string }> {
  return ALL_HELP_ARTICLES.filter((a) => articleMatchesPortal(a.slug, portal)).map(
    (a) => ({ slug: a.slug })
  );
}
