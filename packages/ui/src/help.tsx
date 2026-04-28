import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeftIcon, BookOpenIcon } from "@heroicons/react/24/outline";

import { Badge } from "./components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/card";
import { MermaidDiagram } from "./components/mermaid-diagram";
import { Separator } from "./components/separator";
import { cn } from "./lib/utils";

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

type HelpIndexViewProps = {
  articles: HelpArticleSummaryViewModel[];
  portalLabel: string;
  basePath?: string;
};

type HelpArticleViewProps = {
  article: HelpArticleViewModel;
  backHref?: string;
};

const markdownComponents: Components = {
  h1: ({ className, ...props }) => (
    <h1 className={cn("mt-10 text-3xl font-bold tracking-tight text-foreground", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "mt-10 border-b border-border pb-3 text-2xl font-bold tracking-tight text-foreground first:mt-0",
        className
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mt-8 text-xl font-semibold text-foreground", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("mt-4 text-[17px] leading-7 text-foreground/80", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn("font-medium text-primary underline-offset-4 hover:underline", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("mt-4 list-disc space-y-2 pl-6 text-[17px] leading-7", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("mt-4 list-decimal space-y-2 pl-6 text-[17px] leading-7", className)} {...props} />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("pl-1 text-foreground/80 marker:text-primary", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "mt-6 rounded-2xl border-l-4 border-primary bg-muted/60 px-5 py-4 text-foreground/80",
        className
      )}
      {...props}
    />
  ),
  code: ({ className, children, ...props }) => {
    const code = String(children).replace(/\n$/, "");
    const language = /language-(\w+)/.exec(className ?? "")?.[1];
    const isBlock = Boolean(language) || code.includes("\n");

    if (language === "mermaid") {
      return <MermaidDiagram chart={code} />;
    }

    if (isBlock) {
      return (
        <pre className="mt-6 overflow-x-auto rounded-2xl border bg-muted/60 p-5 text-sm leading-6 text-foreground">
          <code className={cn("font-mono", className)} {...props}>
            {code}
          </code>
        </pre>
      );
    }

    return (
      <code
        className={cn(
          "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  table: ({ className, ...props }) => (
    <div className="mt-6 overflow-x-auto rounded-2xl border">
      <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th className={cn("border-b bg-muted px-4 py-3 font-semibold text-foreground", className)} {...props} />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border-b px-4 py-3 align-top text-foreground/80", className)} {...props} />
  ),
  hr: ({ className, ...props }) => <Separator className={cn("my-8", className)} {...props} />,
};

export function HelpIndexView({ articles, portalLabel, basePath = "/help" }: HelpIndexViewProps) {
  return (
    <div className="flex-1 px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8">
          <div className="flex max-w-3xl flex-col gap-4">
            <Badge className="w-fit bg-secondary text-secondary-foreground hover:bg-secondary">
              Knowledge Base
            </Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {portalLabel} Help Center
              </h1>
              <p className="text-[17px] leading-7 text-muted-foreground">
                Practical guides for common workflows, review steps, and portal tasks.
              </p>
            </div>
          </div>
        </section>

        {articles.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2">
            {articles.map((article) => (
              <a key={article.slug} href={`${basePath}/${article.slug}`} className="group block">
                <Card className="h-full rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                  <CardHeader className="gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <BookOpenIcon className="size-5" />
                      </span>
                      <Badge variant="outline" className="border-border bg-background text-muted-foreground">
                        {article.category}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="text-xl group-hover:text-primary">{article.title}</CardTitle>
                      <CardDescription className="text-[15px] leading-6">
                        {article.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </a>
            ))}
          </section>
        ) : (
          <Card className="rounded-2xl border bg-card">
            <CardContent className="p-8 text-[17px] leading-7 text-muted-foreground">
              No help articles are available for this portal yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export function HelpArticleView({ article, backHref = "/help" }: HelpArticleViewProps) {
  return (
    <div className="flex-1 px-6 py-8 md:px-8 md:py-10">
      <article className="mx-auto w-full max-w-4xl">
        <a
          href={backHref}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-primary"
        >
          <ArrowLeftIcon className="size-4" />
          Back to help center
        </a>

        <div className="rounded-3xl border bg-card p-6 shadow-sm md:p-8">
          <header className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary">
                {article.category}
              </Badge>
              {article.updated ? (
                <span className="text-sm text-muted-foreground">Updated {article.updated}</span>
              ) : null}
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {article.title}
              </h1>
              <p className="text-[17px] leading-7 text-muted-foreground">{article.description}</p>
            </div>
          </header>

          <Separator className="my-8" />

          <div className="max-w-[70ch]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {article.content}
            </ReactMarkdown>
          </div>
        </div>
      </article>
    </div>
  );
}
