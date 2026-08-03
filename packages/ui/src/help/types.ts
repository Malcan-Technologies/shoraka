export type HelpArticleSummaryViewModel = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  updated: string;
};

export type HelpArticleViewModel = HelpArticleSummaryViewModel & {
  content: string;
};

export type HelpTocItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

export type HelpCategoryGroup = {
  category: string;
  articles: HelpArticleSummaryViewModel[];
};
