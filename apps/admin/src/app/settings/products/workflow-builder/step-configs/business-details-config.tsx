"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "../../../../../components/ui/input";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { useS3ViewUrl } from "../../../../../hooks/use-s3";
import { toast } from "sonner";

const ADMIN_GUARANTOR_TEMPLATE_ACCEPT = "application/pdf,.pdf";

const MAX_TEMPLATE_SIZE_BYTES = 5 * 1024 * 1024;

/** Same as supporting-documents-config optional template links (muted, underline on hover). */
const templateLinkClass = "shrink-0 hover:underline focus:outline-none";
const templateRemoveClass = "shrink-0 hover:text-destructive hover:underline focus:outline-none";
const templateUploadClass =
  "shrink-0 self-start hover:text-foreground hover:underline focus:outline-none";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isPdfFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot + 1) : "";
  if (ext !== "pdf") return false;
  const t = file.type?.trim();
  if (!t) return true;
  return t === "application/pdf";
}

type GuarantorAgreementTemplate = { s3_key?: string; file_name?: string; file_size?: number };

export interface BusinessDetailsConfigProps {
  config: unknown;
  onChange: (config: unknown) => void;
  onPendingTemplateChange?: (categoryKey: string, index: number, file: File | null) => void;
}

function readTemplate(config: unknown): GuarantorAgreementTemplate {
  const c = config as Record<string, unknown> | undefined;
  const raw = c?.guarantor_agreement_template as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return {};
  const s3 = typeof raw.s3_key === "string" ? raw.s3_key : "";
  const file_name = String(raw.file_name ?? raw.filename ?? "");
  const file_size = typeof raw.file_size === "number" ? raw.file_size : undefined;
  return { s3_key: s3 || undefined, file_name, file_size };
}

export function BusinessDetailsConfig({ config, onChange, onPendingTemplateChange }: BusinessDetailsConfigProps) {
  const c = (config as Record<string, unknown>) ?? {};
  const template = readTemplate(config);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);

  const s3Key = template.s3_key?.trim() || null;
  const { data: viewUrl, isLoading: viewUrlLoading } = useS3ViewUrl(s3Key);
  const hasTemplate = Boolean(s3Key);
  const isUploadingTemplate = false;

  React.useEffect(() => {
    if (template.s3_key?.trim()) {
      setPendingFile(null);
    }
  }, [template.s3_key]);

  const setTemplate = (next: GuarantorAgreementTemplate | null) => {
    const nextConfig = { ...c };
    if (next == null || !next.s3_key) {
      delete nextConfig.guarantor_agreement_template;
    } else {
      nextConfig.guarantor_agreement_template = {
        s3_key: next.s3_key,
        file_name: next.file_name ?? "",
        ...(typeof next.file_size === "number" ? { file_size: next.file_size } : {}),
      };
    }
    onChange(nextConfig);
  };

  const clearParentPending = () => onPendingTemplateChange?.("guarantor_agreement", 0, null);

  const onTemplateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    if (!isPdfFile(file)) {
      toast.error("Template must be a PDF file (.pdf)");
      return;
    }
    if (file.size > MAX_TEMPLATE_SIZE_BYTES) {
      toast.error("Template must be 5MB or less");
      return;
    }
    setPendingFile(file);
    onPendingTemplateChange?.("guarantor_agreement", 0, file);
  };

  const onTemplateRemove = () => {
    clearParentPending();
    setPendingFile(null);
    if (template.s3_key) {
      setTemplate(null);
    }
  };

  return (
    <div className="min-w-0 text-sm leading-6">
      <Input
        ref={fileInputRef}
        type="file"
        accept={ADMIN_GUARANTOR_TEMPLATE_ACCEPT}
        onChange={onTemplateSelect}
        disabled={isUploadingTemplate}
        className="sr-only"
        tabIndex={hasTemplate || pendingFile ? -1 : undefined}
      />

      <div className="font-medium text-foreground">Guarantor agreement</div>

      <div className="mt-1 flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1 text-muted-foreground">
        <span className="shrink-0">Optional template:</span>
        <div className="flex min-w-0 flex-1 basis-[200px] flex-col gap-0.5">
          {hasTemplate ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                <span
                  className="truncate min-w-0 max-w-full sm:max-w-[280px] text-foreground"
                  title={template.file_name}
                >
                  {template.file_name || "template.pdf"}
                </span>
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 shrink-0">
                  {viewUrlLoading ? (
                    <Skeleton className="h-4 w-10 shrink-0" />
                  ) : viewUrl ? (
                    <a
                      href={viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={templateLinkClass}
                    >
                      View
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingTemplate}
                    className={templateLinkClass}
                  >
                    Change
                  </button>
                  <button type="button" onClick={onTemplateRemove} className={templateRemoveClass}>
                    Remove
                  </button>
                </span>
              </div>
              {template.file_size != null ? (
                <p className="m-0 text-xs text-muted-foreground tabular-nums">
                  {formatFileSize(template.file_size)}
                </p>
              ) : null}
            </>
          ) : pendingFile ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                <span
                  className="truncate min-w-0 max-w-full sm:max-w-[280px] text-foreground"
                  title={pendingFile.name}
                >
                  {pendingFile.name}
                </span>
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingTemplate}
                    className={templateLinkClass}
                  >
                    Change
                  </button>
                  <button type="button" onClick={onTemplateRemove} className={templateRemoveClass}>
                    Remove
                  </button>
                </span>
              </div>
              <p className="m-0 text-xs text-muted-foreground tabular-nums">
                {formatFileSize(pendingFile.size)}
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingTemplate}
              className={cn(templateUploadClass, "text-left font-normal p-0 h-auto")}
            >
              {isUploadingTemplate ? "Uploading…" : "Upload"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
