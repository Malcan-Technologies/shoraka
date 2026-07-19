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

type PreviewPageKey = "page1" | "page2" | "page3";

const PAGE_LABELS: Record<PreviewPageKey, string> = {
  page1: "Page 1",
  page2: "Page 2",
  page3: "Page 3",
};

function stripPreviewBanner(html: string): string {
  return html.replace(
    /<div[^>]*data-prospectus-preview-banner[^>]*>[\s\S]*?<\/div>/i,
    ""
  );
}

export function ProspectusPreviewSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusLabel: "Draft preview" | "Approved preview";
  isLoading: boolean;
  errorMessage?: string | null;
  html?: { page1: string; page2: string; page3: string } | null;
}) {
  const [page, setPage] = React.useState<PreviewPageKey>("page1");
  const pages: PreviewPageKey[] = ["page1", "page2", "page3"];
  const pageIndex = pages.indexOf(page);

  React.useEffect(() => {
    if (props.open) setPage("page1");
  }, [props.open]);

  const rawHtml = props.html?.[page] ?? "";
  const html = stripPreviewBanner(rawHtml);

  const openInNewTab = () => {
    if (!html) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(56rem,96vw)]"
      >
        <SheetHeader className="shrink-0 space-y-3 border-b px-6 py-4 text-left">
          <div className="pr-8">
            <SheetTitle>Prospectus Preview</SheetTitle>
            <SheetDescription>{props.statusLabel}</SheetDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pages.map((key) => (
              <Button
                key={key}
                size="sm"
                variant={page === key ? "secondary" : "outline"}
                onClick={() => setPage(key)}
              >
                {PAGE_LABELS[key]}
              </Button>
            ))}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pageIndex <= 0}
                onClick={() => setPage(pages[pageIndex - 1]!)}
              >
                Previous Page
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pageIndex >= pages.length - 1}
                onClick={() => setPage(pages[pageIndex + 1]!)}
              >
                Next Page
              </Button>
              <Button size="sm" variant="outline" disabled={!html} onClick={openInNewTab}>
                Open in New Tab
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-hidden bg-muted/40 p-4 md:p-6">
          {props.isLoading ? (
            <Skeleton className="mx-auto h-full w-full max-w-[210mm]" />
          ) : null}
          {props.errorMessage ? (
            <p className="text-sm text-destructive">{props.errorMessage}</p>
          ) : null}
          {!props.isLoading && !props.errorMessage && html ? (
            <div className="mx-auto h-full w-full max-w-[210mm] overflow-auto rounded-xl border bg-white shadow-sm">
              <iframe
                title={`Prospectus ${PAGE_LABELS[page]}`}
                className="h-full min-h-full w-full border-0 bg-white"
                srcDoc={html}
              />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
