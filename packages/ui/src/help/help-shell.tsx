"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bars3Icon,
  BookOpenIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

import { Button } from "../components/button";
import { Input } from "../components/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/sheet";
import { cn } from "../lib/utils";
import { helpCategoryIcon } from "./category-icons";
import type { HelpArticleSummaryViewModel } from "./types";
import { groupHelpArticlesByCategory } from "./utils";

/** Match portal sidebar active chrome (`bg-accent`), not a heavy primary wash. */
const ACTIVE_NAV = "bg-accent font-medium text-accent-foreground hover:bg-accent";

type HelpShellProps = {
  articles: HelpArticleSummaryViewModel[];
  activeSlug?: string;
  basePath?: string;
  children: ReactNode;
};

function CategoryNavList({
  articles,
  activeSlug,
  basePath,
  onNavigate,
}: {
  articles: HelpArticleSummaryViewModel[];
  activeSlug?: string;
  basePath: string;
  onNavigate?: () => void;
}) {
  const groups = groupHelpArticlesByCategory(articles);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(groups.map((group) => group.category))
  );

  const toggle = (category: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <ul className="space-y-1">
      {groups.map((group) => {
        const Icon = helpCategoryIcon(group.category);
        const isOpen = expanded.has(group.category);
        return (
          <li key={group.category}>
            <button
              type="button"
              onClick={() => toggle(group.category)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{group.category}</span>
              </span>
              <ChevronRightIcon
                className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-90")}
              />
            </button>
            {isOpen ? (
              <ul className="ml-2">
                {group.articles.map((article, index) => {
                  const isActive = article.slug === activeSlug;
                  return (
                    <li key={article.slug}>
                      <a
                        href={`${basePath}/${article.slug}`}
                        onClick={onNavigate}
                        className={cn(
                          "flex w-full items-baseline gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          isActive
                            ? ACTIVE_NAV
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <span className="shrink-0 tabular-nums text-muted-foreground/70">
                          {index + 1}.
                        </span>
                        <span className="min-w-0 truncate">{article.title}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Portal shells use overflow-x-hidden, which breaks CSS sticky — lock page scroll and pin columns via a split pane instead. */
function useHelpPageScrollLock() {
  useEffect(() => {
    const html = document.documentElement;
    const { body } = document;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);
}

export function HelpShell({
  articles,
  activeSlug,
  basePath = "/help",
  children,
}: HelpShellProps) {
  useHelpPageScrollLock();
  const [searchQuery, setSearchQuery] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (article) =>
        article.title.toLowerCase().includes(q) ||
        article.description.toLowerCase().includes(q) ||
        article.category.toLowerCase().includes(q)
    );
  }, [articles, searchQuery]);

  const renderSidebarNav = (onNavigate?: () => void) => (
    <>
      <div className="shrink-0 border-b border-border p-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <BookOpenIcon className="size-5 text-muted-foreground" />
          Help Center
        </h2>
        <div className="relative mt-3">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search documentation..."
            className="pl-10"
          />
        </div>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredArticles.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No documentation found</div>
        ) : (
          <CategoryNavList
            articles={filteredArticles}
            activeSlug={activeSlug}
            basePath={basePath}
            onNavigate={onNavigate}
          />
        )}
      </nav>
    </>
  );

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full overflow-hidden">
      <div className="fixed bottom-6 right-6 z-50 lg:hidden">
        <Sheet open={browseOpen} onOpenChange={setBrowseOpen}>
          <SheetTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="size-12 rounded-full shadow-lg"
              aria-label="Browse help topics"
            >
              <Bars3Icon className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="flex h-[85vh] flex-col p-0">
            <SheetHeader className="border-b border-border px-4 pb-2 pt-4 text-left">
              <SheetTitle className="flex items-center gap-2">
                <BookOpenIcon className="size-4 text-muted-foreground" />
                Browse topics
              </SheetTitle>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col">
              {renderSidebarNav(() => setBrowseOpen(false))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Outside the scrolling main — stays pinned without CSS sticky */}
      <aside className="hidden h-full w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-muted/40 lg:flex">
        {renderSidebarNav()}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

export { ACTIVE_NAV };
