"use client";

import * as React from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

type ApplicationSummaryDownloadButtonProps = {
  applicationId: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
};

export function ApplicationSummaryDownloadButton({
  applicationId,
  className,
  size = "sm",
  variant = "outline",
}: ApplicationSummaryDownloadButtonProps) {
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(
    () => createApiClient(API_URL, getAccessToken),
    [getAccessToken]
  );
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async () => {
    if (!applicationId || downloading) return;
    setDownloading(true);
    try {
      const { blob, filename } = await apiClient.getApplicationSummaryPdfBlob(applicationId);
      triggerBlobDownload(blob, filename);
    } catch (error) {
      toast.error("Failed to download application summary", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-2 rounded-xl", className)}
      onClick={() => void handleDownload()}
      disabled={!applicationId || downloading}
    >
      <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
      {downloading ? "Downloading…" : "Download application summary"}
    </Button>
  );
}
