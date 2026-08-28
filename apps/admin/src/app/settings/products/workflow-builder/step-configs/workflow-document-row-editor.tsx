"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "../../../../../components/ui/input";
import { Skeleton } from "../../../../../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../components/ui/select";
import { Button } from "../../../../../components/ui/button";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useS3ViewUrl } from "../../../../../hooks/use-s3";
import { toast } from "sonner";
import {
  getGeneratedDocumentType,
  listGeneratedDocumentTypesForContext,
  parseWorkflowDocumentRow,
  type GeneratedDocumentContext,
  type GeneratedDocumentTypeKey,
  type WorkflowDocumentRow,
} from "@cashsouk/types";
import { INPUT_CLASS, SELECT_TRIGGER_CLASS, WORKFLOW_ICON_DELETE_BUTTON_CLASS } from "../product-form-input-styles";

export type WorkflowDocumentRowShape = WorkflowDocumentRow;

export type WorkflowDocumentTemplateSource = "none" | "upload" | "generated";

export const MAX_WORKFLOW_DOCUMENT_TEMPLATE_BYTES = 5 * 1024 * 1024;

/** Issuer upload allows PDF or Excel per row; optional admin template always allows PDF and Excel. */
export const ADMIN_OPTIONAL_TEMPLATE_ACCEPT = ".pdf,.xlsx,.xls";

export function resolveWorkflowDocumentRowRequired(row: { required?: boolean }): boolean {
  return row.required !== false;
}

export function formatWorkflowDocumentFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function resolveWorkflowDocumentAllowedTypes(row: { allowed_types?: string[] }): string[] {
  const raw = row.allowed_types;
  if (!Array.isArray(raw) || raw.length === 0) return ["pdf"];
  const filtered = raw
    .filter((x): x is string => typeof x === "string")
    .filter((t) => t === "pdf" || t === "excel");
  if (filtered.length === 0) return ["pdf"];
  const first = filtered[0];
  return first === "excel" ? ["excel"] : ["pdf"];
}

export function adminOptionalTemplateMatches(file: File): boolean {
  const lower = file.name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot + 1) : "";
  return ext === "pdf" || ext === "xlsx" || ext === "xls";
}

export function parseWorkflowDocumentRowFromUnknown(raw: unknown): WorkflowDocumentRowShape {
  return parseWorkflowDocumentRow(raw);
}

export function resolveWorkflowDocumentTemplateSource(
  row: WorkflowDocumentRowShape
): WorkflowDocumentTemplateSource {
  if (row.generated_document_type) return "generated";
  if (row.template?.s3_key?.trim()) return "upload";
  return "none";
}

export function workflowDocumentRowHasValidAllowedTypes(row: unknown): boolean {
  if (!row || typeof row !== "object") return true;
  const at = (row as Record<string, unknown>).allowed_types;
  if (at === undefined) return true;
  if (!Array.isArray(at)) return false;
  if (at.length === 0) return false;
  const tokens = at
    .filter((x): x is string => typeof x === "string")
    .filter((t) => t === "pdf" || t === "excel");
  const unique = [...new Set(tokens)];
  if (unique.length !== 1) return false;
  return true;
}

export interface WorkflowDocumentRowEditorProps {
  item: WorkflowDocumentRowShape;
  index: number;
  pendingFile: File | null;
  onUpdate: (updates: Partial<WorkflowDocumentRowShape>) => void;
  onRemove?: () => void;
  onTemplateSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTemplateRemove: () => void;
  isUploadingTemplate?: boolean;
  showRemove?: boolean;
  /** When set, renders each row as a nested card (acceptance documents list). */
  variant?: "plain" | "card";
  /** Enables Generated template source when the catalog has types for this context. */
  generatedDocumentContext?: GeneratedDocumentContext;
}

export function WorkflowDocumentRowEditor({
  item,
  index,
  pendingFile,
  onUpdate,
  onRemove,
  onTemplateSelect,
  onTemplateRemove,
  isUploadingTemplate = false,
  showRemove = true,
  variant = "plain",
  generatedDocumentContext,
}: WorkflowDocumentRowEditorProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const catalogTypes = generatedDocumentContext
    ? listGeneratedDocumentTypesForContext(generatedDocumentContext)
    : [];
  const canUseGenerated = catalogTypes.length > 0;
  const resolvedTemplateSource = resolveWorkflowDocumentTemplateSource(item);
  const [uploadModeActive, setUploadModeActive] = React.useState(false);
  const templateSource: WorkflowDocumentTemplateSource =
    resolvedTemplateSource !== "none"
      ? resolvedTemplateSource
      : uploadModeActive
        ? "upload"
        : "none";

  React.useEffect(() => {
    if (resolvedTemplateSource === "generated" || resolvedTemplateSource === "upload") {
      setUploadModeActive(false);
    }
  }, [resolvedTemplateSource]);

  const isGeneratedMode = templateSource === "generated";
  const issuerTypeIsExcel = resolveWorkflowDocumentAllowedTypes(item).includes("excel");
  const s3Key = item.template?.s3_key?.trim() ?? "";
  const { data: viewUrl, isLoading: viewUrlLoading } = useS3ViewUrl(s3Key || null);
  const hasTemplate = Boolean(s3Key);
  const showPending = Boolean(pendingFile);
  const showSavedTemplate = hasTemplate && !showPending && templateSource === "upload";

  const clearUploadState = () => {
    if (hasTemplate || showPending) {
      onTemplateRemove();
    }
  };

  const handleTemplateSourceChange = (source: WorkflowDocumentTemplateSource) => {
    if (source === templateSource) return;

    if (source === "none") {
      setUploadModeActive(false);
      clearUploadState();
      onUpdate({ template: undefined, generated_document_type: undefined });
      return;
    }

    if (source === "upload") {
      setUploadModeActive(true);
      clearUploadState();
      onUpdate({ generated_document_type: undefined, template: undefined });
      return;
    }

    setUploadModeActive(false);
    const defaultType = catalogTypes[0]?.key;
    if (!defaultType) return;

    clearUploadState();
    const typeDef = getGeneratedDocumentType(defaultType);
    onUpdate({
      template: undefined,
      generated_document_type: defaultType,
      allow_multiple: false,
      allowed_types: ["pdf"],
      name: item.name.trim() || typeDef?.label || item.name,
    });
  };

  const handleGeneratedTypeChange = (typeKey: GeneratedDocumentTypeKey) => {
    const typeDef = getGeneratedDocumentType(typeKey);
    onUpdate({
      generated_document_type: typeKey,
      allow_multiple: false,
      allowed_types: ["pdf"],
      template: undefined,
      name: item.name.trim() || typeDef?.label || item.name,
    });
  };

  return (
    <li
      className={cn(
        "flex min-w-0 gap-2 sm:gap-3",
        variant === "card"
          ? "rounded-lg border border-border bg-muted/15 p-4"
          : "px-0 py-3"
      )}
    >
      <span className="flex h-8 w-6 shrink-0 items-start justify-center pt-1.5 text-sm font-medium text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Input
            value={item.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Document name"
            maxLength={200}
            className={cn(INPUT_CLASS, "h-8 min-w-0 flex-1 basis-[160px]")}
          />
          <Select
            value={item.allow_multiple ? "multiple" : "single"}
            onValueChange={(value) => onUpdate({ allow_multiple: value === "multiple" })}
            disabled={isGeneratedMode}
          >
            <SelectTrigger
              className={cn(SELECT_TRIGGER_CLASS, "h-8 w-[170px] shrink-0")}
              disabled={isGeneratedMode}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single file</SelectItem>
              <SelectItem value="multiple">Multiple files</SelectItem>
            </SelectContent>
          </Select>
          {showRemove && onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={WORKFLOW_ICON_DELETE_BUTTON_CLASS}
              onClick={onRemove}
              aria-label="Remove document"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-2 pl-0.5">
          <fieldset className="m-0 min-w-0 flex-none border-0 p-0">
            <legend className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Allowed file types
            </legend>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground">
              <label className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                  checked={!issuerTypeIsExcel}
                  disabled={isGeneratedMode}
                  onChange={() => onUpdate({ allowed_types: ["pdf"] })}
                />
                PDF
              </label>
              <label className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                  checked={issuerTypeIsExcel}
                  disabled={isGeneratedMode}
                  onChange={() => onUpdate({ allowed_types: ["excel"] })}
                />
                Excel
              </label>
            </div>
          </fieldset>

          <fieldset className="m-0 min-w-0 flex-none border-0 p-0 sm:border-l sm:border-border sm:pl-8">
            <legend className="mb-1.5 block text-xs font-medium text-muted-foreground">Issuer</legend>
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                checked={resolveWorkflowDocumentRowRequired(item)}
                onChange={(e) => onUpdate({ required: e.target.checked })}
              />
              Required to upload
            </label>
          </fieldset>
        </div>

        <div className="flex min-w-0 flex-col gap-2 text-sm leading-6 text-muted-foreground">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="shrink-0">Template source:</span>
            <Select value={templateSource} onValueChange={handleTemplateSourceChange}>
              <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, "h-8 w-[180px] shrink-0")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="upload">Upload</SelectItem>
                {canUseGenerated ? <SelectItem value="generated">Generated</SelectItem> : null}
              </SelectContent>
            </Select>
          </div>

          {templateSource === "generated" ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="shrink-0">Generated type:</span>
                <Select
                  value={item.generated_document_type ?? catalogTypes[0]?.key ?? ""}
                  onValueChange={(value) =>
                    handleGeneratedTypeChange(value as GeneratedDocumentTypeKey)
                  }
                >
                  <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, "h-8 min-w-[220px] max-w-full")}>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogTypes.map((type) => (
                      <SelectItem key={type.key} value={type.key}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {item.generated_document_type ? (
                <p className="m-0 text-xs text-muted-foreground">
                  {getGeneratedDocumentType(item.generated_document_type)?.description}
                </p>
              ) : null}
            </div>
          ) : null}

          {templateSource === "upload" ? (
            <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
              <Input
                ref={fileInputRef}
                type="file"
                accept={ADMIN_OPTIONAL_TEMPLATE_ACCEPT}
                onChange={onTemplateSelect}
                disabled={isUploadingTemplate}
                className="sr-only"
                tabIndex={hasTemplate || showPending ? -1 : undefined}
              />
              <span className="shrink-0">Template file:</span>
              <div className="flex min-w-0 flex-1 basis-[200px] flex-col gap-0.5">
                {showSavedTemplate ? (
                  <>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                      <span
                        className="truncate min-w-0 max-w-full sm:max-w-[280px] text-foreground"
                        title={item.template!.file_name}
                      >
                        {item.template!.file_name}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 shrink-0">
                        {viewUrlLoading ? (
                          <Skeleton className="h-4 w-10 shrink-0" />
                        ) : viewUrl ? (
                          <a
                            href={viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 hover:underline focus:outline-none"
                          >
                            View
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingTemplate}
                          className="shrink-0 hover:underline focus:outline-none"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={onTemplateRemove}
                          className="shrink-0 hover:text-destructive hover:underline focus:outline-none"
                        >
                          Remove
                        </button>
                      </span>
                    </div>
                    {item.template!.file_size != null ? (
                      <p className="m-0 text-xs text-muted-foreground tabular-nums">
                        {formatWorkflowDocumentFileSize(item.template!.file_size)}
                      </p>
                    ) : null}
                  </>
                ) : showPending && pendingFile ? (
                  <>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                      <span
                        className="truncate min-w-0 max-w-full sm:max-w-[280px] text-foreground"
                        title={pendingFile.name}
                      >
                        {pendingFile.name}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingTemplate}
                          className="shrink-0 hover:underline focus:outline-none"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={onTemplateRemove}
                          className="shrink-0 hover:text-destructive hover:underline focus:outline-none"
                        >
                          Remove
                        </button>
                      </span>
                    </div>
                    <p className="m-0 text-xs text-muted-foreground tabular-nums">
                      {formatWorkflowDocumentFileSize(pendingFile.size)}
                    </p>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingTemplate}
                    className="shrink-0 self-start hover:text-foreground hover:underline focus:outline-none"
                  >
                    {isUploadingTemplate ? "Uploading…" : "Upload"}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function validateOptionalWorkflowDocumentTemplateFile(file: File): boolean {
  if (!adminOptionalTemplateMatches(file)) {
    toast.error("Template must be a PDF or Excel file (.pdf, .xlsx, .xls)");
    return false;
  }
  if (file.size > MAX_WORKFLOW_DOCUMENT_TEMPLATE_BYTES) {
    toast.error("Template must be 5MB or less");
    return false;
  }
  return true;
}
