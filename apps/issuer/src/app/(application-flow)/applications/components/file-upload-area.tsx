"use client";

import * as React from "react";
import { CheckCircleIcon, CloudArrowUpIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  issuerUploadDropzoneClassName,
  issuerUploadFileRowClassName,
} from "@/lib/issuer-input-chrome";
import { formLockedFileSurfaceClassName } from "@/app/(application-flow)/applications/components/form-control";

export interface FileMetadata {
  s3_key: string;
  file_name: string;
  file_size?: number;
  uploaded_at?: string;
}

export interface FileUploadAreaProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  uploadedFile?: FileMetadata | null;
  pendingFile?: File;
  onRemove?: () => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FileUploadArea({
  onFileSelect,
  isUploading,
  uploadedFile,
  pendingFile,
  onRemove,
  disabled,
}: FileUploadAreaProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (disabled || uploadedFile || pendingFile || isUploading) return;
    fileInputRef.current?.click();
  };

  const validateAndSelectPdf = (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Please select a PDF file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large (max 5MB)");
      return;
    }
    onFileSelect(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelectPdf(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSelectPdf(file);
  };

  if (uploadedFile || pendingFile) {
    const fileName = pendingFile?.name || uploadedFile?.file_name || "";
    const rawSize = pendingFile?.size ?? uploadedFile?.file_size;
    const fileSizeBytes = typeof rawSize === "number" && rawSize >= 0 ? rawSize : 0;
    const sizeDisplay = fileSizeBytes > 0 ? formatFileSize(fileSizeBytes) : "—";
    const isPending = !!pendingFile;

    return (
      <div
        className={cn(
          issuerUploadFileRowClassName,
          "px-4 py-3 flex items-center justify-between gap-3 min-h-11",
          disabled ? formLockedFileSurfaceClassName : "bg-card/50 text-foreground"
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
              disabled
                ? "border-input bg-background/50"
                : isPending
                  ? "border-transparent bg-yellow-500/10"
                  : "border-transparent bg-primary/10"
            )}
          >
            <CheckCircleIcon
              className={cn(
                "h-4 w-4",
                disabled ? "text-muted-foreground" : isPending ? "text-yellow-500" : "text-primary"
              )}
            />
          </div>
          <div className="min-w-0 flex-1" title={fileName}>
            <div className="text-sm font-medium truncate">{fileName}</div>
            <div className="text-xs text-muted-foreground">{sizeDisplay}</div>
          </div>
        </div>
        {!disabled && onRemove ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded-full transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Remove file"
          >
            <XMarkIcon className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      onClick={disabled ? undefined : handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        issuerUploadDropzoneClassName,
        "flex flex-col items-center justify-center gap-3 p-6",
        disabled ? "cursor-not-allowed bg-muted" : "cursor-pointer bg-card/50"
      )}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,application/pdf"
        className="hidden"
        disabled={disabled}
      />
      <div className="p-2 rounded-full bg-background border border-input shadow-sm">
        <CloudArrowUpIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-center">
        {disabled ? (
          <span className="text-sm text-muted-foreground">Locked</span>
        ) : (
          <>
            <span className="text-base font-semibold text-primary">
              {isUploading ? "Uploading..." : "Click to upload"}
            </span>
            {!isUploading && (
              <span className="text-base text-muted-foreground"> or drag and drop</span>
            )}
          </>
        )}
      </div>
      {!disabled && <div className="text-sm text-muted-foreground">PDF (max. 5MB)</div>}
    </div>
  );
}
