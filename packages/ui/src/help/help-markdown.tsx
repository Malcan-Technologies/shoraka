import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { MermaidDiagram } from "../components/mermaid-diagram";
import { cn } from "../lib/utils";
import type { HelpTocItem } from "./types";
import { extractHelpToc, getReactNodeText, slugifyHeading } from "./utils";

type HelpMarkdownProps = {
  content: string;
  className?: string;
};

type MarkdownCodeProps = ComponentPropsWithoutRef<"code"> & {
  inline?: boolean;
  children?: ReactNode;
};

type MarkdownLinkProps = ComponentPropsWithoutRef<"a"> & {
  href?: string;
};

function createHeadingIdAssigner(toc: HelpTocItem[]) {
  let cursor = 0;
  return (fallbackText: string): string => {
    const fromToc = toc[cursor]?.id;
    cursor += 1;
    if (fromToc) return fromToc;
    return slugifyHeading(fallbackText) || `heading-${cursor}`;
  };
}

export function HelpMarkdown({ content, className }: HelpMarkdownProps) {
  const toc = extractHelpToc(content);
  const nextHeadingId = createHeadingIdAssigner(toc);

  return (
    <div id="help-doc-article" className={cn("space-y-6", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ className: headingClassName, ...props }) => (
            <h1
              className={cn(
                "text-3xl font-semibold tracking-tight text-foreground",
                headingClassName
              )}
              {...props}
            />
          ),
          h2: ({ className: headingClassName, children, ...props }) => {
            const text = getReactNodeText(children);
            const id = nextHeadingId(text);
            return (
              <h2
                id={id}
                className={cn(
                  "mt-10 scroll-mt-24 border-b border-border pb-3 text-2xl font-semibold tracking-tight text-foreground first:mt-0",
                  headingClassName
                )}
                {...props}
              >
                {children}
              </h2>
            );
          },
          h3: ({ className: headingClassName, children, ...props }) => {
            const text = getReactNodeText(children);
            const id = nextHeadingId(text);
            return (
              <h3
                id={id}
                className={cn(
                  "mt-8 scroll-mt-24 text-xl font-semibold tracking-tight text-foreground",
                  headingClassName
                )}
                {...props}
              >
                {children}
              </h3>
            );
          },
          p: ({ className: paragraphClassName, ...props }) => (
            <div
              role="paragraph"
              className={cn(
                "text-body text-foreground/95 [&:not(:first-child)]:mt-4",
                paragraphClassName
              )}
              {...props}
            />
          ),
          strong: ({ className: strongClassName, ...props }) => (
            <strong className={cn("font-semibold text-foreground", strongClassName)} {...props} />
          ),
          ul: ({ className: listClassName, ...props }) => (
            <ul
              className={cn(
                "my-4 ml-6 list-disc space-y-2 text-body text-foreground/95",
                listClassName
              )}
              {...props}
            />
          ),
          ol: ({ className: listClassName, ...props }) => (
            <ol
              className={cn(
                "my-4 ml-6 list-decimal space-y-2 text-body text-foreground/95",
                listClassName
              )}
              {...props}
            />
          ),
          li: ({ className: itemClassName, ...props }) => (
            <li className={cn("pl-1", itemClassName)} {...props} />
          ),
          blockquote: ({ className: quoteClassName, ...props }) => (
            <blockquote
              className={cn(
                "my-6 rounded-lg border border-border bg-muted/60 px-5 py-4 text-body text-muted-foreground",
                quoteClassName
              )}
              {...props}
            />
          ),
          hr: ({ className: hrClassName, ...props }) => (
            <hr className={cn("my-8 border-border", hrClassName)} {...props} />
          ),
          table: ({ className: tableClassName, ...props }) => (
            <div className="my-6 overflow-x-auto rounded-xl border border-border">
              <table className={cn("min-w-full border-collapse text-sm", tableClassName)} {...props} />
            </div>
          ),
          thead: ({ className: tableClassName, ...props }) => (
            <thead className={cn("bg-muted text-left", tableClassName)} {...props} />
          ),
          th: ({ className: tableClassName, ...props }) => (
            <th
              className={cn(
                "border-b border-border px-4 py-3 font-medium text-foreground",
                tableClassName
              )}
              {...props}
            />
          ),
          td: ({ className: tableClassName, ...props }) => (
            <td
              className={cn(
                "border-t border-border px-4 py-3 align-top text-muted-foreground",
                tableClassName
              )}
              {...props}
            />
          ),
          a: ({ href, className: anchorClassName, children, ...props }: MarkdownLinkProps) => {
            const external = Boolean(href && /^https?:\/\//.test(href));
            return (
              <a
                href={href}
                className={cn(
                  "font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-80",
                  anchorClassName
                )}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer noopener" : undefined}
                {...props}
              >
                {children}
              </a>
            );
          },
          pre: ({ children }) => <>{children}</>,
          code: ({ className: codeClassName, inline, children, ...props }: MarkdownCodeProps) => {
            const value = String(children ?? "").replace(/\n$/, "");
            const language = /language-(\w+)/.exec(codeClassName ?? "")?.[1];
            const isBlock = Boolean(language) || (!inline && value.includes("\n"));

            if (!inline && language === "mermaid") {
              return <MermaidDiagram chart={value} />;
            }

            if (inline || !isBlock) {
              return (
                <code
                  className={cn(
                    "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]",
                    codeClassName
                  )}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <div className="my-6 overflow-x-auto rounded-xl border border-border bg-card">
                <code
                  className={cn("block min-w-full p-4 font-mono text-sm text-foreground", codeClassName)}
                  {...props}
                >
                  {value}
                </code>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
