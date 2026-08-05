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
  DEFAULT_ACCEPTANCE_DEADLINE,
  parseAcceptanceDocumentsConfig,
  parseAcceptanceDeadlineConfig,
  writeAcceptanceDocumentsConfig,
  writeAcceptanceDeadlineConfig,
  type AcceptanceDocumentRow,
  type PhaseDeadlineConfig,
} from "@cashsouk/types";
import { PhaseDeadlineConfigEditor } from "./phase-deadline-config-editor";

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
  const [deadline, setDeadline] = React.useState<PhaseDeadlineConfig>(
    () => parseAcceptanceDeadlineConfig(config) ?? DEFAULT_ACCEPTANCE_DEADLINE
  );

  React.useEffect(() => {
    setItems(parseAcceptanceDocumentsConfig(config).map(toRowShape));
    setDeadline(parseAcceptanceDeadlineConfig(config) ?? DEFAULT_ACCEPTANCE_DEADLINE);
  }, [config]);

  const persist = React.useCallback(
    (nextItems: WorkflowDocumentRowShape[], nextDeadline: PhaseDeadlineConfig = deadline) => {
      onChange(
        writeAcceptanceDeadlineConfig(
          writeAcceptanceDocumentsConfig(base, nextItems),
          nextDeadline
        )
      );
    },
    [base, deadline, onChange]
  );

  const persistDeadline = React.useCallback(
    (nextDeadline: PhaseDeadlineConfig) => {
      setDeadline(nextDeadline);
      persist(items, nextDeadline);
    },
    [items, persist]
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

    // Reindex local pending files and mirror into the parent map so Save
    // does not upload stale acceptance_documents_${index} slots.
    const reindexed: Record<number, File> = {};
    for (const [k, v] of Object.entries(pendingFiles)) {
      const ki = Number(k);
      if (ki < index) reindexed[ki] = v;
      else if (ki > index) reindexed[ki - 1] = v;
    }
    for (const ki of Object.keys(pendingFiles).map(Number)) {
      onPendingTemplateChange?.(ki, null);
    }
    for (const [k, v] of Object.entries(reindexed)) {
      onPendingTemplateChange?.(Number(k), v);
    }
    setPendingFiles(reindexed);
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
      <PhaseDeadlineConfigEditor
        title="Acceptance deadline"
        description="Clock starts when admin sends the offer. Issuer must upload acceptance documents before it lapses."
        value={deadline}
        onChange={persistDeadline}
      />

      <div
        className={cn(
          "grid rounded-xl border border-border bg-card p-4 text-sm leading-6",
          SECTION_GAP
        )}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Acceptance documents</h3>
          <p className="text-sm text-muted-foreground">
            Documents the issuer must upload when accepting an offer. Leave empty to skip the
            upload step at offer time.
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={addDoc} className="gap-1.5">
            <PlusIcon className="h-4 w-4 shrink-0" />
            Add document
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground leading-6">
            No acceptance documents configured yet.
          </p>
        ) : (
          <ul className="grid gap-4">
            {items.map((item, index) => (
              <WorkflowDocumentRowEditor
                key={`${ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY}_${index}`}
                item={item}
                index={index}
                variant="card"
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
    </div>
  );
}
