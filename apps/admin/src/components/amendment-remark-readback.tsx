"use client";

/**
 * SECTION: Parsed amendment remark text for admin readback
 * WHY: Same logical structure as issuer (lines + /n) without issuer primary/warning styling.
 * INPUT: raw remark strings from stored amendment metadata
 * OUTPUT: Easy-to-read bulleted list using admin neutrals
 * WHERE USED: ResubmitTabAmendmentNotesBar, supporting-doc comparison Remark popover
 */

import * as React from "react";

/** Split like issuer invoice/step helpers: newlines and literal /n become separate points. */
export function parseAmendmentRemarkLines(remarkTexts: string[]): string[] {
  return remarkTexts.flatMap((r) => {
    const raw = (r || "").trim();
    if (!raw) return [];
    return raw
      .split(/\r\n|\n|\/n/)
      .map((s) => s.trim())
      .filter(Boolean);
  });
}

export function AmendmentRemarkReadbackPanel({ remarkTexts }: { remarkTexts: string[] }) {
  const lines = React.useMemo(() => parseAmendmentRemarkLines(remarkTexts), [remarkTexts]);

  if (lines.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
      <ul className="list-disc space-y-2 pl-5 text-[15px] leading-7 text-foreground marker:text-muted-foreground">
        {lines.map((line, idx) => (
          <li key={idx} className="break-words">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
