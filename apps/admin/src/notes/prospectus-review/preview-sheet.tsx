"use client";

import * as React from "react";
import { Skeleton, Tabs, TabsList, TabsTrigger } from "@cashsouk/ui";
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
  PREVIEW_DOCUMENT_INNER_CLASS,
  PREVIEW_IFRAME_CLASS,
  PREVIEW_IFRAME_STYLE,
  PREVIEW_SHEET_BODY_CLASS,
  PREVIEW_SHEET_CONTENT_CLASS,
  cleanProspectusPreviewHtml,
  withAdminPreviewScrollLock,
  type ProspectusPreviewPages,
} from "./preview-sheet-utils";
import {
  PROSPECTUS_PREVIEW_TAB_LABELS,
  PROSPECTUS_PREVIEW_TABS,
  prospectusPreviewIframeTitle,
  resolveOpenInNewTabHtml,
  resolvePreviewPageForStep,
  type ProspectusPreviewTab,
} from "./preview-page";
import type { ProspectusWorkflowStepId } from "./labels";

export type ProspectusPreviewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active workflow step — used to pick Page 1/2/3 when the sheet opens. */
  workflowStep: ProspectusWorkflowStepId;
  statusLabel: "Draft preview" | "Approved preview" | "Live preview";
  /** True only for the initial load with no cached pages. */
  isLoading: boolean;
  /** True while refreshing; keep showing the last successful pages. */
  isFetching?: boolean;
  errorMessage?: string | null;
  html?: ProspectusPreviewPages | null;
};

function ProspectusPreviewSheetComponent(props: ProspectusPreviewSheetProps) {
  const [tab, setTab] = React.useState<ProspectusPreviewTab>("page1");
  const lastViewedTabRef = React.useRef<ProspectusPreviewTab | null>(null);

  React.useEffect(() => {
    if (!props.open) return;
    setTab(resolvePreviewPageForStep(props.workflowStep, lastViewedTabRef.current));
  }, [props.open, props.workflowStep]);

  React.useEffect(() => {
    if (!props.open) return;
    lastViewedTabRef.current = tab;
  }, [tab, props.open]);

  const cleanedHtml = React.useMemo(
    () => cleanProspectusPreviewHtml(props.html),
    [props.html]
  );

  const html = cleanedHtml ? resolveOpenInNewTabHtml(cleanedHtml, tab) : "";
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
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as ProspectusPreviewTab)}
            >
              <TabsList className="flex h-auto w-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                {PROSPECTUS_PREVIEW_TABS.map((key) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm data-[state=active]:border-transparent data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-none"
                  >
                    {PROSPECTUS_PREVIEW_TAB_LABELS[key]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="ml-auto flex flex-wrap items-center gap-2">
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
              <div className={PREVIEW_DOCUMENT_INNER_CLASS}>
                <iframe
                  title={prospectusPreviewIframeTitle(tab)}
                  className={PREVIEW_IFRAME_CLASS}
                  style={PREVIEW_IFRAME_STYLE}
                  srcDoc={withAdminPreviewScrollLock(html)}
                />
              </div>
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
