"use client";

import * as React from "react";
import { ClipboardDocumentIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { stringifyAuditMetadata } from "./audit-presentation";

export function AuditMetadataView({
  value,
  title = "Raw metadata",
  defaultOpen = false,
}: {
  value: unknown;
  title?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [copied, setCopied] = React.useState(false);
  const pretty = stringifyAuditMetadata(value);
  if (!pretty) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pretty);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-ui">
            <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            {title}
          </Button>
        </CollapsibleTrigger>
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => void handleCopy()}>
          <ClipboardDocumentIcon className="h-4 w-4" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <CollapsibleContent>
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg border bg-muted/30 p-3 text-meta">
          {pretty}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
