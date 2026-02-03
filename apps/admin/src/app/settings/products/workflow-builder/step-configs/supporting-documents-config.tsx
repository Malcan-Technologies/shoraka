"use client";

import * as React from "react";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { Button } from "../../../../../components/ui/button";
import { Skeleton } from "../../../../../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../components/ui/select";
import { DocumentIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useS3ViewUrl } from "../../../../../hooks/use-s3";
import { useProductDocumentTemplateUploadUrl } from "../../hooks/use-products";
import { uploadFileToS3 } from "../../../../../hooks/use-site-documents";
import { toast } from "sonner";

const CATEGORY_KEYS = ["financial_docs", "legal_docs", "compliance_docs", "others"] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORY_KEYS)[number], string> = {
  financial_docs: "Financial docs",
  legal_docs: "Legal docs",
  compliance_docs: "Compliance docs",
  others: "Others",
};

type CategoryKey = (typeof CATEGORY_KEYS)[number];

export interface SupportingDocItemShape {
  name: string;
  template?: { s3_key: string; file_name: string; file_size?: number };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCategoryList(config: unknown, key: CategoryKey): SupportingDocItemShape[] {
  const c = config as Record<string, unknown> | undefined;
  const raw = c?.[key];
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown> | undefined;
    const template = row?.template as { s3_key?: string; file_name?: string; filename?: string; file_size?: number } | undefined;
    const fileName = (template?.file_name ?? template?.filename) as string | undefined;
    return {
      name: (row?.name as string) ?? "",
      template:
        template?.s3_key != null
          ? {
              s3_key: template.s3_key,
              file_name: fileName ?? "",
              file_size: template.file_size as number | undefined,
            }
          : undefined,
    };
  });
}

const ENABLED_CATEGORIES_KEY = "enabled_categories";

function getEnabledCategories(config: unknown): CategoryKey[] {
  const c = config as Record<string, unknown> | undefined;
  const raw = c?.[ENABLED_CATEGORIES_KEY];
  if (Array.isArray(raw)) {
    return raw.filter((k): k is CategoryKey => CATEGORY_KEYS.includes(k as CategoryKey));
  }
  const base = c ?? {};
  return CATEGORY_KEYS.filter((k) => base[k] !== undefined);
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

const TEMPLATE_ACCEPT = "application/pdf";
const MAX_TEMPLATE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function SupportingDocumentsConfig({
  config,
  onChange,
  onPendingTemplateChange,
}: {
  config: unknown;
  onChange: (config: unknown) => void;
  onPendingTemplateChange?: (categoryKey: string, index: number, file: File | null) => void;
}) {
  const base = (config as Record<string, unknown>) ?? {};
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
    const nextEnabled = [...enabledCategories, key];
    setEnabledCategories(nextEnabled);
    persist(lists, nextEnabled);
  };

  const removeCategory = (key: CategoryKey) => {
    const nextEnabled = enabledCategories.filter((k) => k !== key);
    setEnabledCategories(nextEnabled);
    const nextLists = { ...lists, [key]: [] };
    setLists(nextLists);
    persist(nextLists, nextEnabled);
  };

  const addDoc = (key: CategoryKey) => {
    updateCategory(key, [...lists[key], { name: "" }]);
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
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }
    if (file.size > MAX_TEMPLATE_SIZE_BYTES) {
      toast.error("Template must be 5MB or less");
      return;
    }
    setPendingFiles((prev) => ({ ...prev, [slotKey(key, index)]: file }));
    onPendingTemplateChange?.(key, index, file);
  };

  const removeTemplate = (key: CategoryKey, index: number) => {
    const sk = slotKey(key, index);
    setPendingFiles((prev) => {
      const next = { ...prev };
      delete next[sk];
      return next;
    });
    onPendingTemplateChange?.(key, index, null);
    const item = lists[key][index];
    updateDoc(key, index, { ...item, template: undefined });
  };

  const availableToAdd = CATEGORY_KEYS.filter((k) => !enabledCategories.includes(k));
  const [addCategoryValue, setAddCategoryValue] = React.useState("");

  return (
    <div className="grid gap-4 pt-2">
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
          <SelectTrigger className="w-[200px] h-9">
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
        <p className="text-sm text-muted-foreground">Add a category to get started.</p>
      ) : (
        <div className="grid gap-4">
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
              templateAccept={TEMPLATE_ACCEPT}
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
  templateAccept,
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
  templateAccept: string;
  isUploadingTemplate: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-lg bg-muted/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-2">
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
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents in this category yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => (
            <DocRow
              key={index}
              item={item}
              index={index}
              pendingFile={pendingFiles[slotKeyFn(categoryKey, index)] ?? null}
              onUpdate={(updates) => onUpdate(index, updates)}
              onRemove={() => onRemove(index)}
              onTemplateSelect={(e) => onTemplateSelect(index, e)}
              onTemplateRemove={() => onTemplateRemove(index)}
              templateAccept={templateAccept}
              isUploadingTemplate={isUploadingTemplate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DocRow({
  item,
  index,
  pendingFile,
  onUpdate,
  onRemove,
  onTemplateSelect,
  onTemplateRemove,
  templateAccept,
  isUploadingTemplate,
}: {
  item: SupportingDocItemShape;
  index: number;
  pendingFile: File | null;
  onUpdate: (updates: Partial<SupportingDocItemShape>) => void;
  onRemove: () => void;
  onTemplateSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTemplateRemove: () => void;
  templateAccept: string;
  isUploadingTemplate: boolean;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const s3Key = item.template?.s3_key ?? "";
  const { data: viewUrl, isLoading: viewUrlLoading } = useS3ViewUrl(s3Key || null);
  const hasTemplate = !!item.template;
  const showPending = !hasTemplate && !!pendingFile;

  return (
    <li className="flex gap-3 py-2.5 px-0">
      <span className="flex h-8 w-6 shrink-0 items-center justify-center text-xs font-medium text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Input
            value={item.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Document name"
            className="text-sm h-8 min-w-0 flex-1"
          />
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
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Input
            ref={fileInputRef}
            type="file"
            accept={templateAccept}
            onChange={onTemplateSelect}
            disabled={isUploadingTemplate}
            className="sr-only"
            tabIndex={hasTemplate || showPending ? -1 : undefined}
          />
          <span className="shrink-0 text-xs">Optional template:</span>
          {hasTemplate ? (
            <>
              <span className="truncate max-w-[180px]" title={item.template!.file_name}>
                {item.template!.file_name}
                {item.template!.file_size != null && (
                  <span className="ml-1">({formatFileSize(item.template!.file_size)})</span>
                )}
              </span>
              {viewUrlLoading ? (
                <Skeleton className="h-4 w-10 shrink-0" />
              ) : viewUrl ? (
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-primary hover:underline"
                >
                  View
                </a>
              ) : null}
              <button type="button" onClick={onTemplateRemove} className="shrink-0 hover:text-destructive hover:underline">
                Remove
              </button>
            </>
          ) : showPending ? (
            <>
              <span className="truncate max-w-[180px]" title={pendingFile.name}>
                {pendingFile.name} ({formatFileSize(pendingFile.size)})
              </span>
              <button type="button" onClick={onTemplateRemove} className="shrink-0 hover:text-destructive hover:underline">
                Remove
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingTemplate}
              className="shrink-0 hover:text-foreground hover:underline"
            >
              {isUploadingTemplate ? "Uploading…" : "Upload"}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
