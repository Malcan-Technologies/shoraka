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
import { INPUT_CLASS, SELECT_TRIGGER_CLASS } from "../product-form-input-styles";

export type WorkflowDocumentRowShape = {
  name: string;
  allow_multiple?: boolean;
  /** Omitted or true → required (backward compatible); false → optional */
  required?: boolean;
  /** One entry: ["pdf"] or ["excel"]. Omitted or empty → treat as ["pdf"] at runtime */
  allowed_types?: string[];
  template?: { s3_key: string; file_name: string; file_size?: number };
};

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
  const row = raw as Record<string, unknown> | undefined;
  const template = row?.template as
    | { s3_key?: string; file_name?: string; filename?: string; file_size?: number }
    | undefined;
  const fileName = (template?.file_name ?? template?.filename) as string | undefined;
  const at = row?.allowed_types;
  let allowed_types: string[] | undefined;
  if (Array.isArray(at)) {
    const f = at
      .filter((x): x is string => typeof x === "string")
      .filter((t) => t === "pdf" || t === "excel");
    if (f.length > 0) {
      const first = f[0];
      allowed_types = [first === "excel" ? "excel" : "pdf"];
    }
  }
  const rq = row?.required;
  return {
    name: (row?.name as string) ?? "",
    allow_multiple: row?.allow_multiple === true,
    ...(typeof rq === "boolean" ? { required: rq } : {}),
    ...(allowed_types !== undefined && allowed_types.length > 0 ? { allowed_types } : {}),
    template:
      template?.s3_key != null
        ? {
            s3_key: template.s3_key,
            file_name: fileName ?? "",
            file_size: template.file_size as number | undefined,
          }
        : undefined,
  };
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
}: WorkflowDocumentRowEditorProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const issuerTypeIsExcel = resolveWorkflowDocumentAllowedTypes(item).includes("excel");
  const s3Key = item.template?.s3_key?.trim() ?? "";
  const { data: viewUrl, isLoading: viewUrlLoading } = useS3ViewUrl(s3Key || null);
  const hasTemplate = Boolean(s3Key);
  // Pending selection replaces the saved template in the UI until Save (including "Change" on existing templates).
  const showPending = Boolean(pendingFile);
  const showSavedTemplate = hasTemplate && !showPending;

  return (
    <li className="flex gap-2 py-3 px-0 min-w-0 sm:gap-3">
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
          >
            <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, "h-8 w-[170px] shrink-0")}>
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
              className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
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
                  onChange={() => onUpdate({ allowed_types: ["pdf"] })}
                />
                PDF
              </label>
              <label className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                  checked={issuerTypeIsExcel}
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

        <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1 text-sm leading-6 text-muted-foreground">
          <Input
            ref={fileInputRef}
            type="file"
            accept={ADMIN_OPTIONAL_TEMPLATE_ACCEPT}
            onChange={onTemplateSelect}
            disabled={isUploadingTemplate}
            className="sr-only"
            tabIndex={hasTemplate || showPending ? -1 : undefined}
          />
          <span className="shrink-0">Optional template:</span>
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
