"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SECTION_GAP } from "../product-form-input-styles";
import {
  parseWorkflowDocumentRowFromUnknown,
  validateOptionalWorkflowDocumentTemplateFile,
  WorkflowDocumentRowEditor,
  type WorkflowDocumentRowShape,
} from "./workflow-document-row-editor";

const DEFAULT_GUARANTOR_AGREEMENT_ROW: WorkflowDocumentRowShape = {
  name: "Guarantor agreement",
  allow_multiple: false,
  allowed_types: ["pdf"],
  required: false,
};

function readGuarantorAgreementRow(config: unknown): WorkflowDocumentRowShape {
  const c = config as Record<string, unknown> | undefined;
  const row = c?.guarantor_agreement;
  if (row && typeof row === "object") {
    const parsed = parseWorkflowDocumentRowFromUnknown(row);
    return {
      ...DEFAULT_GUARANTOR_AGREEMENT_ROW,
      ...parsed,
      name: parsed.name.trim() || DEFAULT_GUARANTOR_AGREEMENT_ROW.name,
    };
  }

  const legacy = c?.guarantor_agreement_template as Record<string, unknown> | undefined;
  if (legacy && typeof legacy === "object") {
    const s3 = typeof legacy.s3_key === "string" ? legacy.s3_key.trim() : "";
    const file_name = String(legacy.file_name ?? legacy.filename ?? "");
    const file_size = typeof legacy.file_size === "number" ? legacy.file_size : undefined;
    return {
      ...DEFAULT_GUARANTOR_AGREEMENT_ROW,
      required: Boolean(s3),
      ...(s3
        ? {
            template: {
              s3_key: s3,
              file_name: file_name || "template.pdf",
              ...(typeof file_size === "number" ? { file_size } : {}),
            },
          }
        : {}),
    };
  }

  return { ...DEFAULT_GUARANTOR_AGREEMENT_ROW };
}

function serializeGuarantorAgreementRow(row: WorkflowDocumentRowShape): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: row.name.trim() || DEFAULT_GUARANTOR_AGREEMENT_ROW.name,
    allow_multiple: row.allow_multiple === true,
    allowed_types: row.allowed_types?.length ? row.allowed_types : ["pdf"],
    required: row.required !== false,
  };
  if (row.template?.s3_key?.trim()) {
    payload.template = {
      s3_key: row.template.s3_key.trim(),
      file_name: row.template.file_name || "template.pdf",
      ...(typeof row.template.file_size === "number" ? { file_size: row.template.file_size } : {}),
    };
  }
  return payload;
}

export interface BusinessDetailsConfigProps {
  config: unknown;
  onChange: (config: unknown) => void;
  onPendingTemplateChange?: (categoryKey: string, index: number, file: File | null) => void;
  /** Parent-owned pending file (survives step card collapse/remount). */
  pendingTemplateFile?: File | null;
}

export function BusinessDetailsConfig({
  config,
  onChange,
  onPendingTemplateChange,
  pendingTemplateFile = null,
}: BusinessDetailsConfigProps) {
  const [row, setRow] = React.useState<WorkflowDocumentRowShape>(() => readGuarantorAgreementRow(config));

  React.useEffect(() => {
    setRow(readGuarantorAgreementRow(config));
  }, [config]);

  const effectivePendingFile = pendingTemplateFile;

  const persist = React.useCallback(
    (nextRow: WorkflowDocumentRowShape) => {
      const base = (config as Record<string, unknown> | undefined) ?? {};
      const nextConfig = { ...base };
      delete nextConfig.guarantor_agreement_template;
      nextConfig.guarantor_agreement = serializeGuarantorAgreementRow(nextRow);
      onChange(nextConfig);
    },
    [config, onChange]
  );

  const updateRow = (updates: Partial<WorkflowDocumentRowShape>) => {
    const next = { ...row, ...updates };
    setRow(next);
    persist(next);
  };

  const clearParentPending = () => onPendingTemplateChange?.("guarantor_agreement", 0, null);

  const onTemplateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    if (!validateOptionalWorkflowDocumentTemplateFile(file)) return;
    onPendingTemplateChange?.("guarantor_agreement", 0, file);
    // Keep row settings in step config so Save merges template onto the full row shape.
    persist(row);
  };

  const onTemplateRemove = () => {
    if (effectivePendingFile) {
      clearParentPending();
      return;
    }
    updateRow({ template: undefined });
  };

  return (
    <div className={cn("min-w-0 pt-2 text-sm leading-6", SECTION_GAP)}>
      <ul className={cn("flex flex-col", SECTION_GAP)}>
        <WorkflowDocumentRowEditor
          item={row}
          index={0}
          pendingFile={effectivePendingFile}
          onUpdate={updateRow}
          onTemplateSelect={onTemplateSelect}
          onTemplateRemove={onTemplateRemove}
          showRemove={false}
          showUploadTiming={false}
        />
      </ul>
    </div>
  );
}
