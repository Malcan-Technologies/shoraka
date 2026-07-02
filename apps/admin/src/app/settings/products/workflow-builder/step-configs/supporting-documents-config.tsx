"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SECTION_GAP, SELECT_TRIGGER_CLASS, SECTION_HEADER_CLASS, SECTION_HEADER_DIVIDER_CLASS } from "../product-form-input-styles";
import { Button } from "../../../../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../components/ui/select";
import { PlusIcon } from "@heroicons/react/24/outline";
import {
  parseWorkflowDocumentRowFromUnknown,
  validateOptionalWorkflowDocumentTemplateFile,
  WorkflowDocumentRowEditor,
  type WorkflowDocumentRowShape,
} from "./workflow-document-row-editor";

const CATEGORY_KEYS = ["financial_docs", "legal_docs", "compliance_docs", "others"] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORY_KEYS)[number], string> = {
  financial_docs: "Financial Docs",
  legal_docs: "Legal Docs",
  compliance_docs: "Compliance Docs",
  others: "Others",
};

type CategoryKey = (typeof CATEGORY_KEYS)[number];

export type SupportingDocItemShape = WorkflowDocumentRowShape;

function getCategoryList(config: unknown, key: CategoryKey): SupportingDocItemShape[] {
  const c = config as Record<string, unknown> | undefined;
  const raw = c?.[key];
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => parseWorkflowDocumentRowFromUnknown(item));
}

const ENABLED_CATEGORIES_KEY = "enabled_categories";
const OTHERS_KEY: CategoryKey = "others";

/** Return categories with "others" moved to the end. Other categories keep their order. */
function ensureOthersLast(cats: CategoryKey[]): CategoryKey[] {
  const rest = cats.filter((k) => k !== OTHERS_KEY);
  const hasOthers = cats.includes(OTHERS_KEY);
  return hasOthers ? [...rest, OTHERS_KEY] : rest;
}

function getEnabledCategories(config: unknown): CategoryKey[] {
  const c = config as Record<string, unknown> | undefined;
  const raw = c?.[ENABLED_CATEGORIES_KEY];
  if (Array.isArray(raw)) {
    const filtered = raw.filter((k): k is CategoryKey => CATEGORY_KEYS.includes(k as CategoryKey));
    return ensureOthersLast(filtered);
  }
  const base = c ?? {};
  const categorySet = new Set(CATEGORY_KEYS);
  const derived = (Object.keys(base) as CategoryKey[]).filter((k) => categorySet.has(k));
  return ensureOthersLast(derived);
}

function getConfig(config: unknown): Record<CategoryKey, SupportingDocItemShape[]> {
  const c = config as Record<string, unknown> | undefined;
  const base = c ?? {};
  return {
    financial_docs: getCategoryList(base, "financial_docs"),
    legal_docs: getCategoryList(base, "legal_docs"),
    compliance_docs: getCategoryList(base, "compliance_docs"),
    others: getCategoryList(base, "others"),
  };
}

export function SupportingDocumentsConfig({
  config,
  onChange,
  onPendingTemplateChange,
}: {
  config: unknown;
  onChange: (config: unknown) => void;
  /** When file is null (template removed), pass previousS3Key so the next upload for this slot can use v2, v3, etc. */
  onPendingTemplateChange?: (
    categoryKey: string,
    index: number,
    file: File | null,
    previousS3Key?: string
  ) => void;
}) {
  const base = React.useMemo(() => (config as Record<string, unknown>) ?? {}, [config]);
  const [lists, setLists] = React.useState<Record<CategoryKey, SupportingDocItemShape[]>>(() =>
    getConfig(config)
  );
  const [enabledCategories, setEnabledCategories] = React.useState<CategoryKey[]>(() =>
    getEnabledCategories(config)
  );
  const [pendingFiles, setPendingFiles] = React.useState<Record<string, File>>({});

  React.useEffect(() => {
    setLists(getConfig(config));
    setEnabledCategories(getEnabledCategories(config));
  }, [config]);

  const persist = React.useCallback(
    (nextLists: Record<CategoryKey, SupportingDocItemShape[]>, nextEnabled?: CategoryKey[]) => {
      const payload: Record<string, unknown> = { ...base };
      delete payload[ENABLED_CATEGORIES_KEY];
      const enabled = nextEnabled ?? enabledCategories;
      CATEGORY_KEYS.forEach((key) => {
        if (enabled.includes(key)) payload[key] = nextLists[key];
        else delete payload[key];
      });
      onChange(payload);
    },
    [base, onChange, enabledCategories]
  );

  const updateCategory = (key: CategoryKey, items: SupportingDocItemShape[]) => {
    const next = { ...lists, [key]: items };
    setLists(next);
    persist(next);
  };

  const addCategory = (key: CategoryKey) => {
    if (enabledCategories.includes(key)) return;
    const nextEnabled = ensureOthersLast([...enabledCategories, key]);
    const nextLists = { ...lists, [key]: [{ name: "", allow_multiple: false, allowed_types: ["pdf"] }] };
    setLists(nextLists);
    setEnabledCategories(nextEnabled);
    persist(nextLists, nextEnabled);
  };

  const removeCategory = (key: CategoryKey) => {
    const nextEnabled = enabledCategories.filter((k) => k !== key);
    setEnabledCategories(nextEnabled);
    const nextLists = { ...lists, [key]: [] };
    setLists(nextLists);
    persist(nextLists, nextEnabled);
  };

  const addDoc = (key: CategoryKey) => {
    updateCategory(key, [...lists[key], { name: "", allow_multiple: false, allowed_types: ["pdf"] }]);
  };

  const updateDoc = (key: CategoryKey, index: number, updates: Partial<SupportingDocItemShape>) => {
    const items = [...lists[key]];
    items[index] = { ...items[index], ...updates };
    updateCategory(key, items);
  };

  const removeDoc = (key: CategoryKey, index: number) => {
    updateCategory(
      key,
      lists[key].filter((_, i) => i !== index)
    );
  };

  const slotKey = (key: CategoryKey, index: number) => `${key}_${index}`;

  const handleTemplateSelect = (key: CategoryKey, index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!validateOptionalWorkflowDocumentTemplateFile(file)) return;
    setPendingFiles((prev) => ({ ...prev, [slotKey(key, index)]: file }));
    onPendingTemplateChange?.(key, index, file);
  };

  const removeTemplate = (key: CategoryKey, index: number) => {
    const sk = slotKey(key, index);
    const hadPending = Boolean(pendingFiles[sk]);
    setPendingFiles((prev) => {
      const next = { ...prev };
      delete next[sk];
      return next;
    });
    onPendingTemplateChange?.(key, index, null);
    if (hadPending) return;
    const item = lists[key][index];
    updateDoc(key, index, { ...item, template: undefined });
  };

  const availableToAdd = CATEGORY_KEYS.filter((k) => !enabledCategories.includes(k));
  const [addCategoryValue, setAddCategoryValue] = React.useState("");

  return (
    <div className={cn("grid pt-2 text-sm leading-6 min-w-0", SECTION_GAP)}>
      {availableToAdd.length > 0 && (
        <Select
          key={enabledCategories.join(",")}
          value={addCategoryValue || undefined}
          onValueChange={(value) => {
            if (value) {
              addCategory(value as CategoryKey);
              setAddCategoryValue("");
            }
          }}
        >
          <SelectTrigger className={cn("w-full max-w-[200px]", SELECT_TRIGGER_CLASS)}>
            <SelectValue placeholder="Add category" />
          </SelectTrigger>
          <SelectContent>
            {availableToAdd.map((key) => (
              <SelectItem key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {enabledCategories.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-6">Add a category to get started.</p>
      ) : (
        <div className={cn("grid min-w-0", SECTION_GAP)}>
          {enabledCategories.map((key) => (
            <CategorySection
              key={key}
              categoryKey={key}
              label={CATEGORY_LABELS[key]}
              items={lists[key]}
              pendingFiles={pendingFiles}
              slotKey={slotKey}
              onAdd={() => addDoc(key)}
              onUpdate={(index, updates) => updateDoc(key, index, updates)}
              onRemove={(index) => removeDoc(key, index)}
              onTemplateSelect={(index, e) => handleTemplateSelect(key, index, e)}
              onTemplateRemove={(index) => removeTemplate(key, index)}
              onRemoveCategory={() => removeCategory(key)}
              isUploadingTemplate={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySection({
  categoryKey,
  label,
  items,
  pendingFiles,
  slotKey: slotKeyFn,
  onAdd,
  onUpdate,
  onRemove,
  onTemplateSelect,
  onTemplateRemove,
  onRemoveCategory,
  isUploadingTemplate,
}: {
  categoryKey: CategoryKey;
  label: string;
  items: SupportingDocItemShape[];
  pendingFiles: Record<string, File>;
  slotKey: (key: CategoryKey, index: number) => string;
  onAdd: () => void;
  onUpdate: (index: number, updates: Partial<SupportingDocItemShape>) => void;
  onRemove: (index: number) => void;
  onTemplateSelect: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onTemplateRemove: (index: number) => void;
  onRemoveCategory: () => void;
  isUploadingTemplate: boolean;
}) {
  return (
    <div className={cn("grid rounded-lg bg-muted/5 p-3 text-sm leading-6 min-w-0 sm:p-4", SECTION_GAP)}>
      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className={SECTION_HEADER_CLASS}>{label}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onAdd} className="gap-1.5">
              <PlusIcon className="h-4 w-4 shrink-0" />
              Add document
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={onRemoveCategory}
            >
              Remove category
            </Button>
          </div>
        </div>
        <div className={SECTION_HEADER_DIVIDER_CLASS} />
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-6">No documents in this category yet.</p>
      ) : (
        <ul className={cn("flex flex-col", SECTION_GAP)}>
          {items.map((item, index) => (
            <WorkflowDocumentRowEditor
              key={index}
              item={item}
              index={index}
              pendingFile={pendingFiles[slotKeyFn(categoryKey, index)] ?? null}
              onUpdate={(updates) => onUpdate(index, updates)}
              onRemove={() => onRemove(index)}
              onTemplateSelect={(e) => onTemplateSelect(index, e)}
              onTemplateRemove={() => onTemplateRemove(index)}
              isUploadingTemplate={isUploadingTemplate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
