"use client";

import * as React from "react";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { Textarea } from "../../../../../components/ui/textarea";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { useS3ViewUrl } from "../../../../../hooks/use-s3";
import { toast } from "sonner";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Image stored in config.image: S3 key, filename, optional size in bytes. */
export interface FinancingTypeImageShape {
  s3_key: string;
  filename: string;
  file_size?: number;
}

/** Financing type step config: category, name, description, image. Stored in workflow step config. */
export interface FinancingTypeConfigShape {
  category?: string;
  name?: string;
  description?: string;
  /** Nested image object. Legacy: top-level s3_key is still read for backward compat. */
  image?: FinancingTypeImageShape;
}

function getImage(c: Record<string, unknown> | undefined): FinancingTypeImageShape | null {
  const img = c?.image as { s3_key?: string; filename?: string; file_size?: number } | undefined;
  const s3_key = (img?.s3_key ?? c?.s3_key) as string | undefined;
  if (!s3_key?.trim()) return null;
  return {
    s3_key,
    filename: (img?.filename as string) ?? "",
    file_size: img?.file_size as number | undefined,
  };
}

function getConfig(config: unknown): FinancingTypeConfigShape & { imageData: FinancingTypeImageShape | null } {
  const c = config as Record<string, unknown> | undefined;
  const imageData = getImage(c);
  return {
    category: (c?.category as string) ?? "",
    name: (c?.name as string) ?? "",
    description: (c?.description as string) ?? "",
    image: imageData ? { s3_key: imageData.s3_key, filename: imageData.filename, file_size: imageData.file_size } : undefined,
    imageData,
  };
}

export function FinancingTypeConfig({
  config,
  onChange,
  onPendingImageChange,
}: {
  config: unknown;
  onChange: (config: unknown) => void;
  onPendingImageChange?: (file: File | null) => void;
}) {
  const current = getConfig(config);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const base = (config as Record<string, unknown>) ?? {};

  const imageData = current.imageData;
  const s3Key = imageData?.s3_key ?? "";
  const { data: viewUrl, isLoading: viewUrlLoading } = useS3ViewUrl(s3Key || null);
  const [imgError, setImgError] = React.useState(false);

  const hasPreview = pendingFile !== null || imageData !== null;

  // Preview: pending file → FileReader.readAsDataURL (data URL). Saved image → S3 view URL.
  React.useEffect(() => {
    if (!pendingFile) {
      setPreviewDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreviewDataUrl(reader.result as string);
    reader.readAsDataURL(pendingFile);
  }, [pendingFile]);

  React.useEffect(() => {
    setImgError(false);
  }, [s3Key]);

  const update = React.useCallback(
    (updates: Partial<FinancingTypeConfigShape>) => {
      const { imageData: _omit, ...rest } = current;
      const next = { ...base, ...rest, ...updates } as Record<string, unknown>;
      if ("image" in updates) {
        next.image = updates.image;
        delete next.s3_key;
      }
      onChange(next);
    },
    [config, onChange, current]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPendingFile(null);
      onPendingImageChange?.(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (e.g. PNG, JPG)");
      e.target.value = "";
      return;
    }
    setPendingFile(file);
    onPendingImageChange?.(file);
  };

  const handleRemove = () => {
    setPendingFile(null);
    onPendingImageChange?.(null);
    update({ image: undefined });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Pending file → data URL from FileReader. Else saved image (s3_key) → presigned view URL.
  const previewSrc = pendingFile && previewDataUrl ? previewDataUrl : viewUrl && !imgError ? viewUrl : null;
  const previewLoading = (pendingFile && !previewDataUrl) || (!pendingFile && viewUrlLoading);

  return (
    <div className="grid gap-4 pt-2">
      <div className="grid gap-2">
        <Label htmlFor="ft-category">Category</Label>
        <Input
          id="ft-category"
          value={current.category}
          onChange={(e) => update({ category: e.target.value })}
          placeholder="e.g. Invoice financing"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ft-name">Name</Label>
        <Input
          id="ft-name"
          value={current.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Account Receivable (AR) Financing"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ft-description">Description</Label>
        <Textarea
          id="ft-description"
          value={current.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Short description shown on the card"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ft-image">Image</Label>
        <div className="rounded-lg border border-border bg-background px-3 py-2.5 transition-colors duration-200">
          <Input
            ref={fileInputRef}
            id="ft-image"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className={hasPreview ? "sr-only" : "border-0 bg-transparent p-0 h-auto file:text-sm file:font-medium"}
            tabIndex={hasPreview ? -1 : undefined}
          />
          {hasPreview ? (
            <div className="flex items-center gap-4 animate-in fade-in-0 duration-200">
              <div className="w-14 h-14 shrink-0 rounded-md border border-border bg-background overflow-hidden flex items-center justify-center">
                {previewLoading ? (
                  <Skeleton className="w-full h-full" />
                ) : previewSrc ? (
                  <img
                    src={previewSrc}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <PhotoIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {(pendingFile || imageData?.filename || imageData?.file_size != null) && (
                  <p className="text-sm font-medium truncate">
                    {pendingFile
                      ? `${pendingFile.name} (${formatFileSize(pendingFile.size)})`
                      : `${imageData?.filename || "Image"}${imageData?.file_size != null ? ` (${formatFileSize(imageData.file_size)})` : ""}`}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="hover:underline focus:underline focus:outline-none"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="ml-2 text-muted-foreground hover:underline hover:text-destructive focus:underline focus:outline-none"
                  >
                    Remove
                  </button>
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
