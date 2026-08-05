"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

import { Button } from "../components/button";
import { cn } from "../lib/utils";
import { HelpMarkdown } from "./help-markdown";
import { ACTIVE_NAV, HelpShell } from "./help-shell";
import type { HelpArticleSummaryViewModel, HelpArticleViewModel, HelpTocItem } from "./types";
import { extractHelpToc } from "./utils";

type HelpArticleViewProps = {
  article: HelpArticleViewModel;
  articles?: HelpArticleSummaryViewModel[];
  portalLabel?: string;
  backHref?: string;
};

function TocNav({
  toc,
  activeId,
  onSelect,
  className,
}: {
  toc: HelpTocItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <nav className={cn("space-y-0.5", className)}>
      {toc.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "block w-full rounded-md px-2.5 py-2 text-left text-sm leading-snug transition-colors",
              item.level === 3 && "pl-5 text-[13px]",
              isActive
                ? ACTIVE_NAV
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {item.text}
          </button>
        );
      })}
    </nav>
  );
}

export function HelpArticleView({
  article,
  articles = [],
  backHref = "/help",
}: HelpArticleViewProps) {
  const mainRef = useRef<HTMLElement>(null);
  const spyPausedUntilRef = useRef(0);
  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const navArticles = articles.length > 0 ? articles : [article];
  const toc = useMemo(() => extractHelpToc(article.content), [article.content]);

  const index = navArticles.findIndex((item) => item.slug === article.slug);
  const prev = index > 0 ? navArticles[index - 1] : null;
  const next =
    index >= 0 && index < navArticles.length - 1 ? navArticles[index + 1] : null;

  useEffect(() => {
    setActiveTocId(toc[0]?.id ?? null);
  }, [toc, article.slug]);

  useEffect(() => {
    const root = mainRef.current;
    if (!root || toc.length === 0) return;

    const updateActive = () => {
      // Keep the clicked heading highlighted while smooth-scroll finishes, and
      // when the page can't scroll far enough for late headings to hit the offset.
      if (Date.now() < spyPausedUntilRef.current) return;

      const offset = 112;
      const distanceFromBottom =
        root.scrollHeight - (root.scrollTop + root.clientHeight);
      if (distanceFromBottom <= 4) {
        setActiveTocId(toc[toc.length - 1]?.id ?? null);
        return;
      }

      let current = toc[0]?.id ?? null;
      for (const item of toc) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        const top =
          el.getBoundingClientRect().top - root.getBoundingClientRect().top;
        if (top <= offset) current = item.id;
        else break;
      }
      setActiveTocId(current);
    };

    updateActive();
    root.addEventListener("scroll", updateActive, { passive: true });
    return () => root.removeEventListener("scroll", updateActive);
  }, [toc, article.slug]);

  const scrollToHeading = (id: string) => {
    const root = mainRef.current;
    const el = document.getElementById(id);
    if (!root || !el) return;

    setActiveTocId(id);
    // Pause spy so end-of-page scroll limits don't immediately overwrite the click.
    spyPausedUntilRef.current = Date.now() + 900;

    const top =
      el.getBoundingClientRect().top -
      root.getBoundingClientRect().top +
      root.scrollTop -
      96;
    root.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  return (
    <HelpShell articles={navArticles} activeSlug={article.slug} basePath={backHref}>
      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto scroll-pt-24">
        <div className="w-full min-w-0 p-4 pb-32 sm:p-6 sm:pb-40 lg:p-8 lg:pb-48">
          <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
                <a href={backHref}>
                  <ArrowLeftIcon className="size-4" />
                  All topics
                </a>
              </Button>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <a href={backHref} className="shrink-0 hover:text-foreground">
                  Help
                </a>
                <ChevronRightIcon className="size-3.5 shrink-0" />
                <span className="shrink-0">{article.category}</span>
                <ChevronRightIcon className="size-3.5 shrink-0" />
                <span className="truncate font-medium text-foreground">{article.title}</span>
              </div>
            </div>
          </div>

          <div className="flex w-full items-start gap-8 xl:gap-12">
            <div className="min-w-0 flex-1">
              {toc.length > 0 ? (
                <details className="group mb-6 rounded-lg border border-border bg-card shadow-sm xl:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
                    On this page
                    <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="border-t border-border px-4 pb-3 pt-2">
                    <TocNav toc={toc} activeId={activeTocId} onSelect={scrollToHeading} />
                  </div>
                </details>
              ) : null}

              <article className="help-article max-w-none rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6 lg:p-8">
                <header className="mb-8 space-y-3 border-b border-border pb-6">
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                    {article.title}
                  </h1>
                  {article.description ? (
                    <p className="text-[17px] leading-7 text-muted-foreground">
                      {article.description}
                    </p>
                  ) : null}
                  {article.updated ? (
                    <p className="text-sm text-muted-foreground">Updated {article.updated}</p>
                  ) : null}
                </header>
                <HelpMarkdown content={article.content} />
              </article>

              <div className="mt-12 flex items-stretch justify-between gap-4 border-t border-border pt-6">
                {prev ? (
                  <Button variant="ghost" className="flex h-auto max-w-[48%] flex-col items-start gap-0.5 px-3 py-3" asChild>
                    <a href={`${backHref}/${prev.slug}`}>
                      <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                        <ChevronRightIcon className="size-3 rotate-180" />
                        Previous
                      </span>
                      <span className="w-full truncate text-left text-sm font-medium">
                        {prev.title}
                      </span>
                    </a>
                  </Button>
                ) : (
                  <div />
                )}
                {next ? (
                  <Button
                    variant="ghost"
                    className="ml-auto flex h-auto max-w-[48%] flex-col items-end gap-0.5 px-3 py-3"
                    asChild
                  >
                    <a href={`${backHref}/${next.slug}`}>
                      <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                        Next
                        <ChevronRightIcon className="size-3" />
                      </span>
                      <span className="w-full truncate text-right text-sm font-medium">
                        {next.title}
                      </span>
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            {toc.length > 0 ? (
              <aside className="sticky top-20 hidden max-h-[calc(100dvh-8rem)] w-72 shrink-0 self-start overflow-y-auto xl:block 2xl:w-80">
                <p className="mb-3 text-sm font-semibold text-foreground">On this page</p>
                <div className="border-l border-border pl-1">
                  <TocNav toc={toc} activeId={activeTocId} onSelect={scrollToHeading} />
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </main>
    </HelpShell>
  );
}
