"use client";

import * as React from "react";
import { ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Input } from "./components/input";
import { Button } from "./components/button";
import { cn } from "./lib/utils";

interface CopyableFieldProps {
  value: string;
  placeholder?: string;
  className?: string;
}

export function CopyableField({ value, placeholder = "", className }: CopyableFieldProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Input value={value} readOnly className="bg-muted font-mono" placeholder={placeholder} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="shrink-0"
      >
        {copied ? (
          <>
            <CheckIcon className="h-4 w-4 text-green-600" />
            <span className="ml-1.5 text-green-600">Copied</span>
          </>
        ) : (
          <>
            <ClipboardDocumentIcon className="h-4 w-4" />
            <span className="ml-1.5">Copy</span>
          </>
        )}
      </Button>
    </div>
  );
}


