import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getHelpArticle, getHelpArticleParams } from "@cashsouk/help-content";
import { HelpArticleView } from "@cashsouk/ui";

type HelpArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getHelpArticleParams("investor");
}

export async function generateMetadata({ params }: HelpArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getHelpArticle("investor", slug);

  if (!article) {
    return {
      title: "Help Article | CashSouk Investor",
    };
  }

  return {
    title: `${article.title} | CashSouk Investor Help`,
    description: article.description,
  };
}

export default async function HelpArticlePage({ params }: HelpArticlePageProps) {
  const { slug } = await params;
  const article = getHelpArticle("investor", slug);

  if (!article) {
    notFound();
  }

  return <HelpArticleView article={article} />;
}
