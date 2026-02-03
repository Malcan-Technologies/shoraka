"use client";

import * as React from "react";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { Button } from "../../../../../components/ui/button";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { Textarea } from "../../../../../components/ui/textarea";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { useS3ViewUrl } from "../../../../../hooks/use-s3";
import { useProductImageUploadUrl } from "../../hooks/use-products";
import { uploadFileToS3 } from "../../../../../hooks/use-site-documents";
import { toast } from "sonner";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Image stored in config.image: S3 key and original filename. */
export interface FinancingTypeImageShape {
  s3_key: string;
  filename: string;
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
  const img = c?.image as { s3_key?: string; filename?: string } | undefined;
  const s3_key = (img?.s3_key ?? c?.s3_key) as string | undefined;
  if (!s3_key?.trim()) return null;
  return {
    s3_key,
    filename: (img?.filename as string) ?? "",
  };
}

function getConfig(config: unknown): FinancingTypeConfigShape & { imageData: FinancingTypeImageShape | null } {
  const c = config as Record<string, unknown> | undefined;
  const imageData = getImage(c);
  return {
    category: (c?.category as string) ?? "",
    name: (c?.name as string) ?? "",
    description: (c?.description as string) ?? "",
    image: imageData ? { s3_key: imageData.s3_key, filename: imageData.filename } : undefined,
    imageData,
  };
}

export function FinancingTypeConfig({
  config,
  onChange,
}: {
  config: unknown;
  onChange: (config: unknown) => void;
}) {
  const current = getConfig(config);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const base = (config as Record<string, unknown>) ?? {};

  const requestUploadUrl = useProductImageUploadUrl();
  const imageData = current.imageData;
  const s3Key = imageData?.s3_key ?? "";
  const { data: viewUrl, isLoading: viewUrlLoading } = useS3ViewUrl(s3Key || null);
  const uploading = requestUploadUrl.isPending;
  const [imgError, setImgError] = React.useState(false);

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

  React.useEffect(() => {
    setImgError(false);
  }, [s3Key]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (e.g. PNG, JPG)");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
    try {
      const { uploadUrl, s3Key: newKey } = await requestUploadUrl.mutateAsync({
        fileName: file.name,
        contentType: file.type,
      });
      await uploadFileToS3(uploadUrl, file);
      update({ image: { s3_key: newKey, filename: file.name } });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setSelectedFile(null);
    }
  };

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
        <Input
          ref={fileInputRef}
          id="ft-image"
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading}
        />
        {selectedFile && (
          <p className="text-sm text-muted-foreground">
            {selectedFile.name} ({formatFileSize(selectedFile.size)})
            {uploading ? " — Uploading…" : ""}
          </p>
        )}
        {imageData && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground">
              Current image {imageData.filename ? `— ${imageData.filename}` : ""}
            </p>
            <div className="flex items-start gap-4">
              <div className="w-28 h-28 shrink-0 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden">
                {viewUrlLoading ? (
                  <Skeleton className="w-full h-full" />
                ) : viewUrl && !imgError ? (
                  <img
                    src={viewUrl}
                    alt=""
                    className="w-full h-full object-contain"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                    <PhotoIcon className="h-10 w-10" />
                    <span className="text-[10px]">Preview</span>
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground shrink-0"
                onClick={() => update({ image: undefined })}
              >
                Remove
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
