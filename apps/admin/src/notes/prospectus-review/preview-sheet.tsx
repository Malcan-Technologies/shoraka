"use client";

import * as React from "react";
import { Skeleton } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PREVIEW_DOCUMENT_FRAME_CLASS,
  PREVIEW_IFRAME_CLASS,
  PREVIEW_SHEET_BODY_CLASS,
  PREVIEW_SHEET_CONTENT_CLASS,
  cleanProspectusPreviewHtml,
  type ProspectusPreviewPages,
} from "./preview-sheet-utils";

type PreviewPageKey = "page1" | "page2" | "page3";

const PAGE_LABELS: Record<PreviewPageKey, string> = {
  page1: "Page 1",
  page2: "Page 2",
  page3: "Page 3",
};

const PAGE_KEYS: PreviewPageKey[] = ["page1", "page2", "page3"];

export type ProspectusPreviewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusLabel: "Draft preview" | "Approved preview";
  /** True only for the initial load with no cached pages. */
  isLoading: boolean;
  /** True while refreshing; keep showing the last successful pages. */
  isFetching?: boolean;
  errorMessage?: string | null;
  html?: ProspectusPreviewPages | null;
};

function ProspectusPreviewSheetComponent(props: ProspectusPreviewSheetProps) {
  const [page, setPage] = React.useState<PreviewPageKey>("page1");
  const pageIndex = PAGE_KEYS.indexOf(page);

  React.useEffect(() => {
    if (props.open) setPage("page1");
  }, [props.open]);

  const cleanedHtml = React.useMemo(
    () => cleanProspectusPreviewHtml(props.html),
    [props.html?.page1, props.html?.page2, props.html?.page3]
  );

  const html = cleanedHtml?.[page] ?? "";
  const showInitialLoading = props.isLoading && !cleanedHtml;
  const showRefreshHint = Boolean(props.isFetching && cleanedHtml);

  const openInNewTab = React.useCallback(() => {
    if (!html) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }, [html]);

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className={PREVIEW_SHEET_CONTENT_CLASS}>
        <SheetHeader className="shrink-0 space-y-3 border-b px-6 py-4 text-left">
          <div className="pr-8">
            <SheetTitle>Prospectus Preview</SheetTitle>
            <SheetDescription>{props.statusLabel}</SheetDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PAGE_KEYS.map((key) => (
              <Button
                key={key}
                size="sm"
                variant={page === key ? "secondary" : "outline"}
                onClick={() => setPage(key)}
              >
                {PAGE_LABELS[key]}
              </Button>
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pageIndex <= 0}
                onClick={() => setPage(PAGE_KEYS[pageIndex - 1]!)}
              >
                Previous Page
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pageIndex >= PAGE_KEYS.length - 1}
                onClick={() => setPage(PAGE_KEYS[pageIndex + 1]!)}
              >
                Next Page
              </Button>
              <Button size="sm" variant="outline" disabled={!html} onClick={openInNewTab}>
                Open in New Tab
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className={PREVIEW_SHEET_BODY_CLASS}>
          {showInitialLoading ? (
            <Skeleton className="mx-auto h-full w-full max-w-[210mm]" />
          ) : null}
          {props.errorMessage && !cleanedHtml ? (
            <p className="text-sm text-destructive">{props.errorMessage}</p>
          ) : null}
          {html ? (
            <div className={PREVIEW_DOCUMENT_FRAME_CLASS}>
              <iframe
                title={`Prospectus ${PAGE_LABELS[page]}`}
                className={PREVIEW_IFRAME_CLASS}
                srcDoc={html}
              />
            </div>
          ) : null}
          {showRefreshHint ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2">
              <span className="rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
                Updating preview…
              </span>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export const ProspectusPreviewSheet = React.memo(ProspectusPreviewSheetComponent);
