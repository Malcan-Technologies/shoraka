"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { sanitizeDeclarationHtml } from "./sanitize";

export interface DeclarationHtmlContentProps {
  html: string;
  className?: string;
}

/**
 * Renders sanitized declaration HTML (bold, lists) with issuer-appropriate typography.
 */
export function DeclarationHtmlContent({ html, className }: DeclarationHtmlContentProps) {
  const safe = React.useMemo(() => sanitizeDeclarationHtml(html), [html]);

  return (
    <div
      className={cn(
        "min-w-0 text-sm md:text-base leading-6 text-foreground",
        "[&_p]:mb-2 last:[&_p]:mb-0",
        "[&_strong]:font-semibold [&_b]:font-semibold",
        "[&_em]:italic [&_i]:italic",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
        "[&_li]:pl-0.5",
        className
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
