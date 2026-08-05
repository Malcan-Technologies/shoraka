"use client";

import { DocumentTextIcon } from "@heroicons/react/24/outline";

import { helpCategoryIcon } from "./category-icons";
import { HelpShell } from "./help-shell";
import type { HelpArticleSummaryViewModel } from "./types";
import { groupHelpArticlesByCategory } from "./utils";

type HelpIndexViewProps = {
  articles: HelpArticleSummaryViewModel[];
  portalLabel: string;
  basePath?: string;
};

export function HelpIndexView({
  articles,
  portalLabel,
  basePath = "/help",
}: HelpIndexViewProps) {
  const groups = groupHelpArticlesByCategory(articles);

  return (
    <HelpShell articles={articles} basePath={basePath}>
      <main className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
        <div className="w-full">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">{portalLabel} Help Center</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Guides organised by topic — pick a section to find what you need.
            </p>
          </div>

          {groups.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => {
                const Icon = helpCategoryIcon(group.category);
                return (
                  <section
                    key={group.category}
                    className="rounded-lg border border-border bg-card p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-md bg-muted p-2">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold">{group.category}</h2>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {group.articles.length === 1
                            ? "1 article"
                            : `${group.articles.length} articles`}
                        </p>
                        <ul className="mt-3 space-y-0.5">
                          {group.articles.map((article) => (
                            <li key={article.slug}>
                              <a
                                href={`${basePath}/${article.slug}`}
                                className="flex w-full items-center gap-2 rounded-md py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                              >
                                <DocumentTextIcon className="size-3.5 shrink-0 text-muted-foreground/40" />
                                <span className="truncate">{article.title}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No documentation available.</p>
          )}
        </div>
      </main>
    </HelpShell>
  );
}
