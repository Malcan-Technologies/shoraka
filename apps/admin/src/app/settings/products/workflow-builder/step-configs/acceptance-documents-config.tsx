"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SECTION_GAP } from "../product-form-input-styles";
import { Button } from "../../../../../components/ui/button";
import { PlusIcon } from "@heroicons/react/24/outline";
import {
  parseWorkflowDocumentRowFromUnknown,
  validateOptionalWorkflowDocumentTemplateFile,
  WorkflowDocumentRowEditor,
  type WorkflowDocumentRowShape,
} from "./workflow-document-row-editor";
import {
  ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY,
  parseAcceptanceDocumentsConfig,
  writeAcceptanceDocumentsConfig,
  type AcceptanceDocumentRow,
} from "@cashsouk/types";

function toRowShape(row: AcceptanceDocumentRow): WorkflowDocumentRowShape {
  return parseWorkflowDocumentRowFromUnknown(row);
}

export function AcceptanceDocumentsConfig({
  config,
  onChange,
  onPendingTemplateChange,
}: {
  /** Financing-type step config (same object that holds signing_packages). */
  config: unknown;
  onChange: (nextFinancingConfig: Record<string, unknown>) => void;
  onPendingTemplateChange?: (
    index: number,
    file: File | null,
    previousS3Key?: string
  ) => void;
}) {
  const base = React.useMemo(() => (config as Record<string, unknown>) ?? {}, [config]);
  const [items, setItems] = React.useState<WorkflowDocumentRowShape[]>(() =>
    parseAcceptanceDocumentsConfig(config).map(toRowShape)
  );
  const [pendingFiles, setPendingFiles] = React.useState<Record<number, File>>({});

  React.useEffect(() => {
    setItems(parseAcceptanceDocumentsConfig(config).map(toRowShape));
  }, [config]);

  const persist = React.useCallback(
    (nextItems: WorkflowDocumentRowShape[]) => {
      onChange(writeAcceptanceDocumentsConfig(base, nextItems));
    },
    [base, onChange]
  );

  const addDoc = () => {
    const next = [
      ...items,
      { name: "", allow_multiple: false, allowed_types: ["pdf"] as string[] },
    ];
    setItems(next);
    persist(next);
  };

  const updateDoc = (index: number, updates: Partial<WorkflowDocumentRowShape>) => {
    const next = [...items];
    next[index] = { ...next[index], ...updates };
    setItems(next);
    persist(next);
  };

  const removeDoc = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    persist(next);
    setPendingFiles((prev) => {
      const out: Record<number, File> = {};
      for (const [k, v] of Object.entries(prev)) {
        const ki = Number(k);
        if (ki < index) out[ki] = v;
        else if (ki > index) out[ki - 1] = v;
      }
      return out;
    });
  };

  const handleTemplateSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!validateOptionalWorkflowDocumentTemplateFile(file)) return;
    setPendingFiles((prev) => ({ ...prev, [index]: file }));
    onPendingTemplateChange?.(index, file);
  };

  const removeTemplate = (index: number) => {
    const hadPending = Boolean(pendingFiles[index]);
    setPendingFiles((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    onPendingTemplateChange?.(index, null);
    if (hadPending) return;
    const item = items[index];
    updateDoc(index, { ...item, template: undefined });
  };

  return (
    <div className={cn("grid min-w-0", SECTION_GAP)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">Acceptance documents</h2>
        <p className="text-sm text-muted-foreground">
          Documents the issuer uploads when accepting an offer (for example a Board Resolution).
          They are reviewed by admin before signing — not part of supporting documents or the
          signing envelope.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addDoc} className="gap-1.5">
          <PlusIcon className="h-4 w-4 shrink-0" />
          Add document
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-6">
          No acceptance documents configured. Issuers will skip the upload step at offer time.
        </p>
      ) : (
        <ul className={cn("flex flex-col", SECTION_GAP)}>
          {items.map((item, index) => (
            <WorkflowDocumentRowEditor
              key={`${ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY}_${index}`}
              item={item}
              index={index}
              pendingFile={pendingFiles[index] ?? null}
              onUpdate={(updates) => updateDoc(index, updates)}
              onRemove={() => removeDoc(index)}
              onTemplateSelect={(e) => handleTemplateSelect(index, e)}
              onTemplateRemove={() => removeTemplate(index)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
