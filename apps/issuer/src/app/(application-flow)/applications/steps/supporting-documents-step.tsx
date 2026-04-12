"use client";

/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Item unlock logic for supporting documents (scope_key match)
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  ChevronDownIcon,
  CloudArrowUpIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  DocumentIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApplication } from "@/hooks/use-applications";
import { useAuthToken } from "@cashsouk/config";
import { SupportingDocumentsSkeleton } from "@/app/(application-flow)/applications/components/supporting-documents-skeleton";
import { FileDisplayBadge } from "@/app/(application-flow)/applications/components/file-display-badge";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { applicationFlowAmendmentTargetTableRowClassName } from "@/app/(application-flow)/applications/components/form-control";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** One line per action; column wide enough so labels do not wrap awkwardly. */
const supportingDocActionLink =
  "inline-flex items-center justify-start gap-1.5 text-sm font-medium leading-tight whitespace-nowrap rounded-md px-0.5 py-1 -mx-0.5 w-full min-w-0";
/** Download template = secondary (muted); upload / add = brand primary — easier to scan. */
const supportingDocTemplateOn =
  "text-muted-foreground hover:text-foreground cursor-pointer";
const supportingDocUploadOn =
  "text-primary hover:opacity-80 cursor-pointer";
const supportingDocActionOff =
  "text-muted-foreground cursor-not-allowed select-none";

function resolveIssuerAllowedTypes(doc: { allowed_types?: unknown }): string[] {
  const raw = doc?.allowed_types;
  if (!Array.isArray(raw) || raw.length === 0) return ["pdf"];
  return raw.filter((x): x is string => typeof x === "string");
}

function buildAcceptAttr(types: string[]): string {
  const parts: string[] = [];
  if (types.includes("pdf")) parts.push(".pdf");
  if (types.includes("excel")) {
    parts.push(".xlsx", ".xls");
  }
  return parts.join(",");
}

function issuerFileMatchesAllowedTypes(file: File, types: string[]): boolean {
  const lower = file.name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot + 1) : "";
  if (types.includes("pdf") && ext === "pdf") return true;
  if (types.includes("excel") && (ext === "xlsx" || ext === "xls")) return true;
  return false;
}

function parseSlotKey(key: string): { categoryIndex: number; documentIndex: number } | null {
  const i = key.lastIndexOf("-");
  if (i <= 0) return null;
  const a = Number(key.slice(0, i));
  const b = Number(key.slice(i + 1));
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return null;
  return { categoryIndex: a, documentIndex: b };
}

type UploadMode = "single" | "multiple";
type UploadRecord = {
  name: string;
  size?: number;
  uploadedAt?: string;
  s3_key?: string;
  clientId?: string;
};
type PendingUpload = { file: File; clientId: string };

const makeClientId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const INITIAL_VISIBLE_FILES = 2;

function parseRemarkLines(text: string): string[] {
  return (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function sortUploadRecordsNewestFirst(list: UploadRecord[]): UploadRecord[] {
  return [...list].sort((a, b) => {
    const ta = Date.parse(a.uploadedAt ?? "") || 0;
    const tb = Date.parse(b.uploadedAt ?? "") || 0;
    if (tb !== ta) return tb - ta;
    return (b.name ?? "").localeCompare(a.name ?? "");
  });
}

/**
 * Matches API scope_key to a document row when slug suffixes differ between admin UI and issuer config.
 * Accepts exact keys and prefix forms: supporting_documents:doc:{group}:{index}:… or supporting_documents:{group}:{index}:…
 */
function supportingDocScopeKeyMatchesRow(
  scopeKey: string,
  groupKey: string,
  documentIndex: number,
  slug: string
): boolean {
  const sk = scopeKey.trim().toLowerCase();
  const g = groupKey.trim().toLowerCase();
  const exact = [
    `supporting_documents:${groupKey}:${documentIndex}:${slug}`,
    `supporting_documents:doc:${groupKey}:${documentIndex}:${slug}`,
  ];
  if (exact.some((e) => e.toLowerCase() === sk)) return true;
  const prefixes = [
    `supporting_documents:doc:${g}:${documentIndex}:`,
    `supporting_documents:${g}:${documentIndex}:`,
  ];
  return prefixes.some((p) => sk.startsWith(p));
}

function collectS3KeysBySlot(files: Record<string, UploadRecord[]>): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const [slot, list] of Object.entries(files)) {
    const keys = new Set<string>();
    for (const item of list) {
      const key = item.s3_key?.trim();
      if (key) keys.add(key);
    }
    result.set(slot, keys);
  }
  return result;
}

function computeRemovedS3Keys(
  initialFiles: Record<string, UploadRecord[]>,
  currentFiles: Record<string, UploadRecord[]>
): string[] {
  const initialBySlot = collectS3KeysBySlot(initialFiles);
  const currentBySlot = collectS3KeysBySlot(currentFiles);
  const removed = new Set<string>();

  for (const [slot, initialKeys] of initialBySlot.entries()) {
    const currentKeys = currentBySlot.get(slot) ?? new Set<string>();
    for (const key of initialKeys) {
      if (!currentKeys.has(key)) removed.add(key);
    }
  }
  return Array.from(removed);
}

export function SupportingDocumentsStep({
  applicationId,
  stepConfig,
  onDataChange,
  readOnly = false,
  amendmentRemarks = [],
  isAmendmentMode: _isAmendmentMode = false,
  flaggedSections: _flaggedSections,
  flaggedItems,
}: {
  applicationId: string;
  stepConfig?: any;
  onDataChange?: (data: any) => void;
  readOnly?: boolean;
  amendmentRemarks?: { scope?: string; scope_key?: string; remark?: string }[];
  isAmendmentMode?: boolean;
  flaggedSections?: Set<string>;
  flaggedItems?: Map<string, Set<string>>;
}) {
  const devTools = useDevTools();
  const { getAccessToken } = useAuthToken();
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);

  /**
   * SUPPORTING DOCUMENTS CONFIG ADAPTER
   *
   * WHY THIS EXISTS:
   * The UI was originally built to consume a `categories[]` structure.
   * The workflow config has since changed to a grouped-object structure.
   *
   * Instead of rewriting the UI (risky),
   * we adapt the new config into the old shape.
   *
   * --------------------------------------------------
   * OLD CONFIG SHAPE (what the UI was built for)
   *
   * categories: [
   *   {
   *     name: "Financial Docs",
   *     documents: [
   *       {
   *         title: "Latest Management Account",
   *         template: { s3_key: "templates/management.pdf" }
   *       }
   *     ]
   *   }
   * ]
   *
   * --------------------------------------------------
   * NEW CONFIG SHAPE (from workflow config)
   *
   * config: {
   *   financial_docs: [
   *     {
   *       name: "Latest Management Account",
   *       template: { s3_key: "templates/management.pdf" }
   *     }
   *   ],
   *   legal_docs: [
   *     {
   *       name: "Deed of Assignment"
   *     }
   *   ]
   * }
   *
   * --------------------------------------------------
   * RESULTING UI SHAPE (what this adapter returns)
   *
   * [
   *   {
   *     name: "Financial Docs",
   *     documents: [
   *       {
   *         title: "Latest Management Account",
   *         template: { s3_key: "templates/management.pdf" }
   *       }
   *     ]
   *   },
   *   {
   *     name: "Legal Docs",
   *     documents: [
   *       {
   *         title: "Deed of Assignment"
   *       }
   *     ]
   *   }
   * ]
   *
   * --------------------------------------------------
   * STRATEGY:
   * - Convert object groups into categories
   * - Keep UI unchanged
   * - Safely support future workflow changes
   */
  /** Item set for supporting_documents tab (scope_key starts with supporting_documents:). Drives row highlight + remarks. */
  const supportingDocItemSet = React.useMemo(() => {
    return flaggedItems?.get("supporting_documents") ?? new Set<string>();
  }, [flaggedItems]);

  /** Map scope_key -> remark for item-level amendment text. Supports both rawKey and rawKeyWithDoc formats. */
  const flaggedDocRemarks = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of amendmentRemarks) {
      const rem = r as { scope?: string; scope_key?: string; remark?: string };
      if (rem.scope !== "item" || !rem.scope_key?.startsWith("supporting_documents:")) continue;
      const text = (rem.remark || "").trim();
      if (text) map.set(rem.scope_key, text);
    }
    return map;
  }, [amendmentRemarks]);

  const categories = React.useMemo(() => {
    const config = stepConfig?.config;

    // Guard: no config or invalid shape
    if (!config || typeof config !== "object") return [];

    return Object.entries(config)
      .filter(([key, value]) => key !== "enabled_categories" && Array.isArray(value))
      .map(([groupKey, docs]) => ({
        groupKey,
        name: groupKey
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),

        documents: (docs as any[]).map((doc) => ({
          title: doc?.name ?? "—",
          allowMultiple: doc?.allow_multiple === true,
          template: doc?.template,
          allowedTypes: resolveIssuerAllowedTypes(doc ?? {}),
          required: doc?.required !== false,
        })),
      }));
  }, [stepConfig]);


  const [uploadedFiles, setUploadedFiles] = React.useState<Record<string, UploadRecord[]>>({});
  const [selectedFiles, setSelectedFiles] = React.useState<Record<string, PendingUpload[]>>({});
  const [expandedCategories, setExpandedCategories] = React.useState<Record<number, boolean>>({});
  /** Per document slot: when true, show all files; when false, show first two only. */
  const [expandedFileLists, setExpandedFileLists] = React.useState<Record<string, boolean>>({});
  const [feedbackDialog, setFeedbackDialog] = React.useState<{
    open: boolean;
    documentTitle: string;
    remark: string;
  }>({ open: false, documentTitle: "", remark: "" });
  const [uploadingKeys, setUploadingKeys] = React.useState<Set<string>>(new Set());
  const [initialUploadedFiles, setInitialUploadedFiles] = React.useState<Record<string, UploadRecord[]>>({});

  const getUploadMode = React.useCallback(
    (categoryIndex: number, documentIndex: number): UploadMode => {
      const mode = categories?.[categoryIndex]?.documents?.[documentIndex]?.allowMultiple;
      return mode ? "multiple" : "single";
    },
    [categories]
  );


  /** Canonical file structure: file_name, file_size, s3_key, uploaded_at (ISO string). */
  const buildDataToSave = (
    files: Record<string, UploadRecord[]>,
    uploadResults: Map<
      string,
      { clientId: string; s3_key: string; file_name: string; file_size: number; uploaded_at: string }[]
    > = new Map()
  ) => {
    return {
      categories: categories.map((category: any, categoryIndex: number) => ({
        name: category.name,
        documents: category.documents.map((document: any, documentIndex: number) => {
          const key = `${categoryIndex}-${documentIndex}`;
          const mode = getUploadMode(categoryIndex, documentIndex);
          const existingFiles = files[key] ?? [];
          const uploadedFromSave = uploadResults.get(key) ?? [];
          const normalized = existingFiles
            .map((f) => {
              const uploadResult = uploadedFromSave.find((r) => r.clientId === f.clientId);
              const s3_key = uploadResult?.s3_key ?? f.s3_key;
              const fileName = uploadResult?.file_name ?? f.name;
              if (!s3_key || !fileName) return null;
              return {
                file_name: fileName,
                file_size: uploadResult?.file_size ?? f.size ?? 0,
                s3_key,
                uploaded_at:
                  uploadResult?.uploaded_at ??
                  f.uploadedAt ??
                  new Date().toISOString(),
              };
            })
            .filter(Boolean) as Array<{
            file_name: string;
            file_size: number;
            s3_key: string;
            uploaded_at: string;
          }>;

          const base = {
            title: document.title,
            allow_multiple: mode === "multiple",
          } as Record<string, unknown>;

          if (normalized.length === 0) {
            return base;
          }

          if (mode === "multiple") {
            return {
              ...base,
              files: normalized,
            };
          }

          return {
            ...base,
            file: normalized[0],
          };
        }),
      })),
    };
  };

  React.useEffect(() => {
    const allExpanded: Record<number, boolean> = {};
    categories.forEach((_: any, index: number) => {
      allExpanded[index] = true;
    });
    setExpandedCategories(allExpanded);
  }, [categories]);

  React.useEffect(() => {
    if (!application?.supporting_documents || categories.length === 0) {
      setUploadedFiles({});
      setSelectedFiles({});
      setInitialUploadedFiles({});
      return;
    }

    let data = application.supporting_documents;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    if (data?.supporting_documents) {
      data = data.supporting_documents;
    }

    if (!data?.categories) {
      return;
    }

    const loadedFiles: Record<string, UploadRecord[]> = {};

    data.categories.forEach((savedCategory: any) => {
      const categoryIndex = categories.findIndex(
        (cat: any) => cat.name === savedCategory.name
      );
      if (categoryIndex === -1) return;

      savedCategory.documents.forEach(
        (savedDocument: any, documentIndex: number) => {

          const key = `${categoryIndex}-${documentIndex}`;

          const list = Array.isArray(savedDocument.files)
            ? savedDocument.files
            : savedDocument.file
              ? [savedDocument.file]
              : [];
          const normalized = list
            .filter(
              (f: any) => typeof f?.s3_key === "string" && typeof f?.file_name === "string"
            )
            .map((f: any) => ({
              name: f.file_name,
              size: f.file_size ?? 0,
              uploadedAt: f.uploaded_at ?? new Date().toISOString(),
              s3_key: f.s3_key,
            }));
          if (normalized.length > 0) {
            loadedFiles[key] = sortUploadRecordsNewestFirst(normalized);
          }
        }
      );
    });


    setUploadedFiles(loadedFiles);
    setSelectedFiles({});
    setInitialUploadedFiles(loadedFiles);
  }, [application, categories]);

  const handleFileChange = (categoryIndex: number, documentIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const key = `${categoryIndex}-${documentIndex}`;
    const mode = getUploadMode(categoryIndex, documentIndex);
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;
    event.target.value = "";

    const types = categories?.[categoryIndex]?.documents?.[documentIndex]?.allowedTypes ?? ["pdf"];
    for (const file of selected) {
      if (!issuerFileMatchesAllowedTypes(file, types)) {
        console.log("Rejected file for allowedTypes:", types, "name:", file.name);
        toast.error("File type not allowed for this document");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File is too large (max 5MB)");
        return;
      }
    }

    const pending = selected.map((file) => ({ file, clientId: makeClientId() }));
    const previews: UploadRecord[] = pending.map(({ file, clientId }) => ({
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      clientId,
    }));

    setSelectedFiles((prev: any) => ({
      ...prev,
      [key]:
        mode === "multiple"
          ? [...pending, ...(prev[key] ?? [])]
          : pending,
    }));
    setUploadedFiles((prev: any) => {
      const current = (prev[key] ?? []) as UploadRecord[];
      return {
        ...prev,
        [key]:
          mode === "multiple"
            ? sortUploadRecordsNewestFirst([...previews, ...current])
            : previews,
      };
    });

    toast.success(
      selected.length > 1 ? `${selected.length} files added` : "File added"
    );
  };

  const uploadFilesToS3 = React.useCallback(async () => {
    if (!applicationId) return null;

    const uploadResults = new Map<
      string,
      { clientId: string; s3_key: string; file_name: string; file_size: number; uploaded_at: string }[]
    >();
    const token = await getAccessToken();

    for (const [key, pendingUploads] of Object.entries(selectedFiles) as [string, PendingUpload[]][]) {
      if (pendingUploads.length === 0) continue;
      try {
        setUploadingKeys((prev) => new Set(prev).add(key));
        const savedUploads: {
          clientId: string;
          s3_key: string;
          file_name: string;
          file_size: number;
          uploaded_at: string;
        }[] = [];

        const slot = parseSlotKey(key);
        if (!slot) {
          throw new Error("Invalid upload slot");
        }
        const slotCategory = categories[slot.categoryIndex];
        if (!slotCategory) {
          throw new Error("Invalid category for upload");
        }

        for (const pending of pendingUploads) {
          const typedFile = pending.file;
          const urlResponse = await fetch(`${API_URL}/v1/applications/${applicationId}/upload-document-url`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileName: typedFile.name,
              contentType: typedFile.type || "application/octet-stream",
              fileSize: typedFile.size,
              supportingDocCategoryKey: slotCategory.groupKey,
              supportingDocIndex: slot.documentIndex,
            }),
          });

          const urlResult = await urlResponse.json();
          if (!urlResult.success) {
            const msg =
              typeof urlResult?.error?.message === "string"
                ? urlResult.error.message
                : "Failed to get upload URL";
            console.log("Upload URL error:", msg, urlResult);
            throw new Error(msg);
          }

          const { uploadUrl, s3Key } = urlResult.data;

          const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            body: typedFile,
            headers: {
              "Content-Type": typedFile.type,
            },
          });

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload file");
          }

          savedUploads.push({
            clientId: pending.clientId,
            s3_key: s3Key,
            file_name: typedFile.name,
            file_size: typedFile.size,
            uploaded_at: new Date().toISOString(),
          });
        }

        uploadResults.set(key, savedUploads);
      } finally {
        setUploadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }

    const updatedFiles: Record<string, UploadRecord[]> = { ...uploadedFiles };
    uploadResults.forEach((results, key) => {
      const current = [...(updatedFiles[key] ?? [])];
      const normalized = current.map((f) => {
        const uploaded = results.find((r) => r.clientId === f.clientId);
        if (!uploaded) return f;
        return {
          ...f,
          name: uploaded.file_name,
          size: uploaded.file_size,
          uploadedAt: uploaded.uploaded_at,
          s3_key: uploaded.s3_key,
        };
      });
      updatedFiles[key] = sortUploadRecordsNewestFirst(normalized);
    });

    const removedS3Keys = computeRemovedS3Keys(initialUploadedFiles, updatedFiles);
    for (const s3Key of removedS3Keys) {
      const response = await fetch(`${API_URL}/v1/applications/${applicationId}/document`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ s3Key }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        const message =
          typeof result?.error?.message === "string"
            ? result.error.message
            : "Failed to delete removed document from storage";
        throw new Error(message);
      }
    }

    setSelectedFiles({});
    setUploadedFiles(updatedFiles);
    setInitialUploadedFiles(updatedFiles);

    const dataToSave = buildDataToSave(updatedFiles, uploadResults);

    if (onDataChange) {
      onDataChange({
        supporting_documents: dataToSave,
        _uploadFiles: uploadFilesRef.current,
      });
    }

    return dataToSave;
  }, [
    applicationId,
    selectedFiles,
    uploadedFiles,
    initialUploadedFiles,
    getAccessToken,
    onDataChange,
    buildDataToSave,
    categories,
  ]);

  const uploadFilesRef = React.useRef(uploadFilesToS3);
  React.useEffect(() => {
    uploadFilesRef.current = uploadFilesToS3;
  }, [uploadFilesToS3]);

  const hasDocumentFile = (categoryIndex: number, documentIndex: number) => {
    const key = `${categoryIndex}-${documentIndex}`;
    return (uploadedFiles[key] ?? []).length > 0;
  };

  const areAllFilesUploaded = React.useMemo(() => {
    if (categories.length === 0) return true;
    for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex++) {
      for (let documentIndex = 0; documentIndex < categories[categoryIndex].documents.length; documentIndex++) {
        const docRequired = categories[categoryIndex].documents[documentIndex]?.required !== false;
        if (docRequired && !hasDocumentFile(categoryIndex, documentIndex)) {
          return false;
        }
      }
    }
    return true;
  }, [categories, uploadedFiles]);

  const hasRemovedFiles = React.useMemo(() => {
    const initialKeys = Object.keys(initialUploadedFiles);
    const currentKeys = Object.keys(uploadedFiles);
    if (initialKeys.some((key) => !currentKeys.includes(key))) {
      return true;
    }
    return Object.keys(uploadedFiles).some((key) => {
      const initialCount = (initialUploadedFiles[key] ?? []).filter((f) => f.s3_key).length;
      const currentCount = (uploadedFiles[key] ?? []).filter((f) => f.s3_key).length;
      return currentCount < initialCount;
    });
  }, [uploadedFiles, initialUploadedFiles]);

  React.useEffect(() => {
    if (!onDataChange) return;

    const dataToSave = buildDataToSave(uploadedFiles);
    const hasPendingChanges = Object.keys(selectedFiles).length > 0 || hasRemovedFiles;

    onDataChange({
      hasPendingChanges: hasPendingChanges,
      saveFunction: uploadFilesToS3,
      areAllFilesUploaded: areAllFilesUploaded,
      supporting_documents: dataToSave,
      _uploadFiles: uploadFilesRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles, hasRemovedFiles, uploadFilesToS3, areAllFilesUploaded, uploadedFiles, categories, applicationId]);

  const handleRemoveFile = (categoryIndex: number, documentIndex: number, fileIndex: number) => {
    const key = `${categoryIndex}-${documentIndex}`;

    setUploadedFiles((prev: any) => {
      const newFiles = { ...prev };
      const nextList = [...(newFiles[key] ?? [])];
      nextList.splice(fileIndex, 1);
      if (nextList.length === 0) {
        delete newFiles[key];
      } else {
        newFiles[key] = nextList;
      }
      return newFiles;
    });
    setSelectedFiles((prev: any) => {
      const newFiles = { ...prev };
      const nextList = [...(newFiles[key] ?? [])];
      const fileToRemove = (uploadedFiles[key] ?? [])[fileIndex];
      if (fileToRemove?.clientId) {
        const pendingIndex = nextList.findIndex(
          (f: PendingUpload) => f.clientId === fileToRemove.clientId
        );
        if (pendingIndex >= 0) {
          nextList.splice(pendingIndex, 1);
        }
      }
      if (nextList.length === 0) {
        delete newFiles[key];
      } else {
        newFiles[key] = nextList;
      }
      return newFiles;
    });
  };

  if (categories.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-center py-8">No documents required for this application.</p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6 px-3 w-full max-w-[1200px] mx-auto">
      {isLoadingApp || !stepConfig || devTools?.showSkeletonDebug ? (
        <SupportingDocumentsSkeleton />
      ) : (
        <>
          {categories.map((category: any, categoryIndex: number) => {
            const isExpanded = expandedCategories[categoryIndex] ?? true;
            const requiredInCategory = category.documents.filter(
              (d: { required?: boolean }) => d.required !== false
            ).length;
            let requiredDone = 0;
            category.documents.forEach((doc: { required?: boolean }, di: number) => {
              if (doc.required !== false && hasDocumentFile(categoryIndex, di)) {
                requiredDone += 1;
              }
            });

            return (
              <section
                key={categoryIndex}
                className="w-full max-w-[1200px] mx-auto rounded-xl border border-border bg-background overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedCategories((prev: Record<number, boolean>) => ({
                      ...prev,
                      [categoryIndex]: !isExpanded,
                    }))
                  }
                  className="w-full flex flex-wrap items-center justify-between gap-2 sm:gap-4 text-left px-4 py-3 sm:px-5 sm:py-3.5 bg-muted/15 hover:bg-muted/25 transition-colors border-b border-border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ChevronDownIcon
                      className={cn(
                        "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                      aria-hidden
                    />
                    <h2 className="text-base md:text-[17px] font-semibold text-foreground leading-7 truncate">
                      {category.name}
                    </h2>
                  </div>
                  {requiredInCategory > 0 ? (
                    <span className="text-sm text-muted-foreground shrink-0 tabular-nums">
                      {requiredDone}/{requiredInCategory} required completed
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground shrink-0">Optional only</span>
                  )}
                </button>

                {isExpanded ? (
                  <div className="divide-y divide-border bg-background">
                    {category.documents.map((document: any, documentIndex: number) => {
                      const key = `${categoryIndex}-${documentIndex}`;
                      const mode = getUploadMode(categoryIndex, documentIndex);
                      const isUploaded = hasDocumentFile(categoryIndex, documentIndex);
                      const fileIsUploading = uploadingKeys.has(key);
                      const fileList = uploadedFiles[key] ?? [];
                      const hasFiles = fileList.length > 0;
                      const templateS3Key = document.template?.s3_key;
                      const groupKey =
                        (category as { groupKey?: string }).groupKey ??
                        Object.keys(stepConfig?.config || {})[categoryIndex] ??
                        "";
                      const slug =
                        String(document.title ?? "doc")
                          .replace(/[^a-z0-9]/gi, "_")
                          .slice(0, 32) || "doc";
                      const acceptAttr = buildAcceptAttr(document.allowedTypes ?? ["pdf"]);
                      const rawKey = `supporting_documents:${groupKey}:${documentIndex}:${slug}`;
                      const rawKeyWithDoc = `supporting_documents:doc:${groupKey}:${documentIndex}:${slug}`;
                      const isItemFlagged = [...supportingDocItemSet].some((key) =>
                        supportingDocScopeKeyMatchesRow(key, groupKey, documentIndex, slug)
                      );
                      const itemRemark =
                        [...flaggedDocRemarks.entries()].find(([k]) =>
                          supportingDocScopeKeyMatchesRow(k, groupKey, documentIndex, slug)
                        )?.[1] ??
                        flaggedDocRemarks.get(rawKey) ??
                        flaggedDocRemarks.get(rawKeyWithDoc);
                      /** Step-level readOnly (e.g. view-only amendment tab) is the only lock; item flags only drive highlights. */
                      const isEditable = !readOnly;
                      const isRequired = document.required !== false;

                      const listExpanded = expandedFileLists[key] ?? false;
                      const filesToShow =
                        listExpanded || fileList.length <= INITIAL_VISIBLE_FILES
                          ? fileList
                          : fileList.slice(0, INITIAL_VISIBLE_FILES);
                      const remainingCount =
                        !listExpanded && fileList.length > INITIAL_VISIBLE_FILES
                          ? fileList.length - INITIAL_VISIBLE_FILES
                          : 0;

                      const renderFileRow = (file: UploadRecord, fileIndex: number) => {
                        const rowKey = file.clientId ?? `${file.name}-${fileIndex}`;
                        return (
                          <FileDisplayBadge
                            key={rowKey}
                            fileName={file.name}
                            truncate
                            inlineChip
                            size="sm"
                            className={cn(
                              "min-h-8 w-full",
                              isItemFlagged
                                ? "border-primary/30 bg-primary/[0.07]"
                                : !isEditable
                                  ? "bg-muted border-border"
                                  : "bg-background border-border"
                            )}
                            trailing={
                              <button
                                type="button"
                                disabled={!isEditable}
                                onClick={() =>
                                  handleRemoveFile(categoryIndex, documentIndex, fileIndex)
                                }
                                className={cn(
                                  "shrink-0 p-0.5",
                                  isEditable
                                    ? "text-muted-foreground hover:text-foreground cursor-pointer"
                                    : "text-muted-foreground opacity-50 cursor-not-allowed"
                                )}
                                aria-label={`Remove ${file.name}`}
                              >
                                <XMarkIcon className="h-3 w-3" />
                              </button>
                            }
                          />
                        );
                      };

                      return (
                        <div
                          key={documentIndex}
                          className={cn(
                            "px-4 py-3.5 sm:px-5 sm:py-4",
                            isItemFlagged && applicationFlowAmendmentTargetTableRowClassName
                          )}
                        >
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-x-4 lg:items-start">
                            <div className="min-w-0 space-y-1.5">
                              <div>
                                <h3 className="text-base md:text-[17px] leading-snug font-semibold text-foreground">
                                  {document.title}
                                  {isRequired ? (
                                    <>
                                      <span className="text-primary font-semibold" aria-hidden="true">
                                        *
                                      </span>
                                      <span className="sr-only">Required</span>
                                    </>
                                  ) : null}
                                </h3>
                                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                  {mode === "multiple" ? (
                                    <>
                                      <DocumentDuplicateIcon
                                        className="h-3 w-3 shrink-0 opacity-80"
                                        aria-hidden
                                      />
                                      <span>Multiple files allowed</span>
                                    </>
                                  ) : (
                                    <>
                                      <DocumentIcon
                                        className="h-3 w-3 shrink-0 opacity-80"
                                        aria-hidden
                                      />
                                      <span>One file only</span>
                                    </>
                                  )}
                                </p>
                              </div>
                              {isItemFlagged && itemRemark ? (
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  <ExclamationTriangleIcon
                                    className="h-3.5 w-3.5 shrink-0 text-primary"
                                    aria-hidden
                                  />
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                                    onClick={() =>
                                      setFeedbackDialog({
                                        open: true,
                                        documentTitle: String(document.title ?? ""),
                                        remark: itemRemark,
                                      })
                                    }
                                  >
                                    View feedback
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:gap-3 lg:items-start">
                              <div className="min-w-0 flex-1 flex flex-col gap-2 max-w-[min(100%,26rem)] lg:max-w-[min(100%,28rem)]">
                              {fileIsUploading ? (
                                <p className="text-sm text-muted-foreground">Uploading…</p>
                              ) : hasFiles ? (
                                <>
                                  <div className="flex flex-col gap-2 w-full">
                                    {filesToShow.map((file, idx) => renderFileRow(file, idx))}
                                  </div>
                                  {remainingCount > 0 ? (
                                    <button
                                      type="button"
                                      className="text-left text-sm font-medium text-foreground underline-offset-2 hover:underline w-fit"
                                      onClick={() =>
                                        setExpandedFileLists((prev) => ({ ...prev, [key]: true }))
                                      }
                                    >
                                      {remainingCount === 1
                                        ? "Show 1 more file"
                                        : `Show ${remainingCount} more files`}
                                    </button>
                                  ) : null}
                                  {listExpanded && fileList.length > INITIAL_VISIBLE_FILES ? (
                                    <button
                                      type="button"
                                      className="text-left text-sm font-medium text-muted-foreground hover:text-foreground w-fit"
                                      onClick={() =>
                                        setExpandedFileLists((prev) => ({ ...prev, [key]: false }))
                                      }
                                    >
                                      Show less
                                    </button>
                                  ) : null}
                                </>
                              ) : !isEditable && !isUploaded ? (
                                <span className="text-sm text-muted-foreground">—</span>
                              ) : isEditable && !hasFiles && !fileIsUploading ? (
                                <span className="text-sm text-muted-foreground">No file uploaded</span>
                              ) : null}
                              </div>

                            <div className="flex flex-col gap-1 w-full min-w-0 border-t border-border pt-3 lg:self-start lg:border-t-0 lg:pt-0 lg:min-w-[12rem] lg:w-[12rem] lg:shrink-0 lg:border-l lg:border-border lg:pl-3">
                              {templateS3Key ? (
                                <button
                                  type="button"
                                  disabled={!isEditable}
                                  className={cn(
                                    supportingDocActionLink,
                                    isEditable ? supportingDocTemplateOn : supportingDocActionOff
                                  )}
                                  onClick={async () => {
                                    if (!isEditable) return;
                                    const token = await getAccessToken();
                                    const resp = await fetch(`${API_URL}/v1/s3/download-url`, {
                                      method: "POST",
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({ s3Key: templateS3Key }),
                                    });
                                    const j = await resp.json();
                                    if (j?.success && j.data?.downloadUrl) {
                                      window.open(j.data.downloadUrl, "_blank");
                                    }
                                  }}
                                >
                                  <ArrowDownTrayIcon className="h-3.5 w-3.5 shrink-0" />
                                  Download template
                                </button>
                              ) : null}

                              {fileIsUploading && !hasFiles ? (
                                <span
                                  className={cn(supportingDocActionLink, supportingDocActionOff)}
                                >
                                  <CloudArrowUpIcon className="h-3.5 w-3.5 shrink-0" />
                                  Uploading…
                                </span>
                              ) : !hasFiles ? (
                                isEditable ? (
                                  <label
                                    htmlFor={`file-${key}`}
                                    className={cn(
                                      supportingDocActionLink,
                                      supportingDocUploadOn
                                    )}
                                  >
                                    <CloudArrowUpIcon className="h-3.5 w-3.5 shrink-0" />
                                    {mode === "multiple" ? "Upload files" : "Upload file"}
                                    <Input
                                      id={`file-${key}`}
                                      type="file"
                                      accept={acceptAttr}
                                      multiple={mode === "multiple"}
                                      onChange={(e) =>
                                        handleFileChange(categoryIndex, documentIndex, e)
                                      }
                                      className="hidden"
                                    />
                                  </label>
                                ) : (
                                  <span
                                    className={cn(supportingDocActionLink, supportingDocActionOff)}
                                  >
                                    <CloudArrowUpIcon className="h-3.5 w-3.5 shrink-0" />
                                    {mode === "multiple" ? "Upload files" : "Upload file"}
                                  </span>
                                )
                              ) : null}

                              {mode === "multiple" && hasFiles ? (
                                fileIsUploading ? (
                                  <span
                                    className={cn(supportingDocActionLink, supportingDocActionOff)}
                                  >
                                    <CloudArrowUpIcon className="h-3.5 w-3.5 shrink-0" />
                                    Uploading…
                                  </span>
                                ) : isEditable ? (
                                  <label
                                    htmlFor={`file-${key}-add`}
                                    className={cn(
                                      supportingDocActionLink,
                                      supportingDocUploadOn
                                    )}
                                  >
                                    <CloudArrowUpIcon className="h-3.5 w-3.5 shrink-0" />
                                    Add files
                                    <Input
                                      id={`file-${key}-add`}
                                      type="file"
                                      accept={acceptAttr}
                                      multiple
                                      onChange={(e) =>
                                        handleFileChange(categoryIndex, documentIndex, e)
                                      }
                                      className="hidden"
                                    />
                                  </label>
                                ) : (
                                  <span
                                    className={cn(supportingDocActionLink, supportingDocActionOff)}
                                  >
                                    <CloudArrowUpIcon className="h-3.5 w-3.5 shrink-0" />
                                    Add files
                                  </span>
                                )
                              ) : null}
                            </div>
                          </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </>
      )}
    </div>
    <Dialog
      open={feedbackDialog.open}
      onOpenChange={(open) => setFeedbackDialog((s) => ({ ...s, open }))}
    >
      <DialogContent className="rounded-xl sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 border border-primary/45">
              <ExclamationTriangleIcon className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-left">
              <DialogTitle className="text-primary">Reviewer feedback</DialogTitle>
              <DialogDescription className="text-left">
                {feedbackDialog.documentTitle
                  ? `Document: ${feedbackDialog.documentTitle}`
                  : "Amendment note from the reviewer."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="text-[15px] leading-7 text-foreground">
          {(() => {
            const lines = parseRemarkLines(feedbackDialog.remark);
            if (lines.length === 0) {
              return (
                <p className="text-muted-foreground">No details provided.</p>
              );
            }
            if (lines.length === 1) {
              return (
                <p className="whitespace-pre-wrap break-words">{lines[0]}</p>
              );
            }
            return (
              <ul className="list-disc space-y-1.5 pl-4">
                {lines.map((line, idx) => (
                  <li key={idx} className="break-words">
                    {line}
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => setFeedbackDialog((s) => ({ ...s, open: false }))}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );

}


