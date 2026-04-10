"use client";

/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Item unlock logic for supporting documents (scope_key match)
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { XMarkIcon, ChevronDownIcon, CloudArrowUpIcon, ArrowDownTrayIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApplication } from "@/hooks/use-applications";
import { useAuthToken } from "@cashsouk/config";
import { SupportingDocumentsSkeleton } from "@/app/(application-flow)/applications/components/supporting-documents-skeleton";
import { FileDisplayBadge } from "@/app/(application-flow)/applications/components/file-display-badge";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
  isAmendmentMode = false,
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
  /** Item set for supporting_documents tab only (scope_key starts with supporting_documents:). STRICT mode uses this. */
  const supportingDocItemSet = React.useMemo(() => {
    return flaggedItems?.get("supporting_documents") ?? new Set<string>();
  }, [flaggedItems]);

  /** If tab has ANY item-level amendment remark → STRICT single-item editing mode. */
  const hasItemLevelAmendment =
    isAmendmentMode && supportingDocItemSet.size > 0;

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
  const [expandedFileLists, setExpandedFileLists] = React.useState<Record<string, boolean>>({});
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
            loadedFiles[key] = normalized;
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

    const today = new Date().toISOString().split("T")[0];
    const pending = selected.map((file) => ({ file, clientId: makeClientId() }));
    const previews: UploadRecord[] = pending.map(({ file, clientId }) => ({
      name: file.name,
      size: file.size,
      uploadedAt: today,
      clientId,
    }));

    setSelectedFiles((prev: any) => ({
      ...prev,
      [key]:
        mode === "multiple"
          ? [...(prev[key] ?? []), ...pending]
          : pending,
    }));
    setUploadedFiles((prev: any) => {
      const current = (prev[key] ?? []) as UploadRecord[];
      return {
        ...prev,
        [key]:
          mode === "multiple"
            ? [...current, ...previews]
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
      updatedFiles[key] = normalized;
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
    <div className="space-y-10 px-3">
      {isLoadingApp || !stepConfig || devTools?.showSkeletonDebug ? (
        <SupportingDocumentsSkeleton />
      ) : (
        <>
          {categories.map((category: any, categoryIndex: number) => {
        const isExpanded = expandedCategories[categoryIndex] ?? true;

        return (
          <section key={categoryIndex} className="space-y-3">
            {/* Section header */}
            <div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedCategories((prev: any) => ({
                      ...prev,
                      [categoryIndex]: !isExpanded,
                    }))
                  }
                  className="w-full flex items-center justify-between cursor-pointer text-left"
                >
                  {/* Left side: chevron + title */}
                  <div className="flex items-center gap-3 min-w-0 py-2">
                    <ChevronDownIcon
                      className={`h-5 w-5 text-foreground transition-transform duration-200 ${expandedCategories[categoryIndex] ? "rotate-180" : ""}`}
                    />
                    <h2 className="text-base font-semibold text-foreground truncate">
                      {category.name}
                    </h2>
                  </div>

                  <span />
                </button>
              </div>

              <div className="border-b border-border" />
            </div>

            {/* Section content */}
            {isExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 px-3">
                {category.documents.map(
                  (document: any, documentIndex: number) => {
                    const key = `${categoryIndex}-${documentIndex}`;
                    const mode = getUploadMode(categoryIndex, documentIndex);
                    const isUploaded = hasDocumentFile(
                      categoryIndex,
                      documentIndex
                    );
                    const fileIsUploading = uploadingKeys.has(key);
                    const fileList = uploadedFiles[key] ?? [];
                    const hasFiles = fileList.length > 0;
                    const showAllFiles = expandedFileLists[key] ?? false;
                    const visibleFiles = showAllFiles ? fileList : fileList.slice(0, 1);
                    const hiddenFileCount = Math.max(fileList.length - visibleFiles.length, 0);
                    const templateS3Key = document.template?.s3_key;
                    const groupKey = (category as any).groupKey ?? Object.keys(stepConfig?.config || {})[categoryIndex] ?? "";
                    const slug = String(document.title ?? "doc").replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
                    const acceptAttr = buildAcceptAttr(document.allowedTypes ?? ["pdf"]);
                    const rawKey = `supporting_documents:${groupKey}:${documentIndex}:${slug}`;
                    const rawKeyWithDoc = `supporting_documents:doc:${groupKey}:${documentIndex}:${slug}`;
                    const isItemFlagged =
                      supportingDocItemSet.has(rawKey) ||
                      supportingDocItemSet.has(rawKeyWithDoc);
                    const itemRemark =
                      flaggedDocRemarks.get(rawKey) ||
                      flaggedDocRemarks.get(rawKeyWithDoc);
                    let isEditable = true;
                    if (isAmendmentMode) {
                      if (hasItemLevelAmendment) {
                        isEditable = isItemFlagged;
                      } else {
                        isEditable = true;
                      }
                    }
                    isEditable = isEditable && !readOnly;


                    return (
                      <div
                        key={documentIndex}
                        className="col-span-2 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,22rem)_auto] gap-x-3 gap-y-2 items-start"
                      >
                        <div className="min-w-0 space-y-2">
                          <div className="text-[16px] leading-[22px] text-foreground">
                            {document.title}
                            {document.required !== false ? (
                              <span className="text-destructive"> *</span>
                            ) : (
                              <span className="text-muted-foreground font-normal"> (Optional)</span>
                            )}
                          </div>

                          {isItemFlagged && itemRemark ? (
                            <div className="inline-flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 max-w-[24rem]">
                              <ExclamationTriangleIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <p className="text-sm text-foreground leading-snug">
                                {itemRemark.split("\n")[0]}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div className="min-w-0 sm:justify-self-end">
                          {hasFiles && !fileIsUploading ? (
                            <div className="flex flex-col gap-2">
                              {visibleFiles.map((file, fileIndex) => {
                                const originalIndex = showAllFiles ? fileIndex : fileList.indexOf(file);
                                return isItemFlagged ? (
                                  <div
                                    key={file.clientId ?? `${file.name}-${fileIndex}`}
                                    className="flex w-full max-w-[22rem] items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 min-h-9"
                                  >
                                    <span
                                      title={file.name}
                                      className="text-sm font-medium truncate min-w-0 flex-1"
                                    >
                                      {file.name}
                                    </span>
                                    {isEditable && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveFile(categoryIndex, documentIndex, originalIndex)
                                        }
                                        className="text-muted-foreground hover:text-foreground shrink-0"
                                      >
                                        <XMarkIcon className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <FileDisplayBadge
                                    key={file.clientId ?? `${file.name}-${fileIndex}`}
                                    fileName={file.name}
                                    truncate
                                    className="w-full max-w-[22rem]"
                                    trailing={
                                      isEditable ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveFile(categoryIndex, documentIndex, originalIndex)
                                          }
                                          className="text-muted-foreground hover:text-foreground shrink-0"
                                        >
                                          <XMarkIcon className="h-3.5 w-3.5" />
                                        </button>
                                      ) : undefined
                                    }
                                  />
                                );
                              })}
                            </div>
                          ) : !isEditable && !isUploaded ? (
                            <span className="text-[14px] text-muted-foreground">—</span>
                          ) : null}
                        </div>

                        <div
                          className={cn(
                            "flex flex-col items-start gap-1.5 pt-0.5 shrink-0",
                            !isEditable && "pointer-events-none opacity-60 cursor-not-allowed"
                          )}
                        >
                          {templateS3Key && (
                            <button
                              type="button"
                              disabled={!isEditable}
                              className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground hover:text-foreground whitespace-nowrap h-6 disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={async () => {
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
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              <span>Download template</span>
                            </button>
                          )}

                          {hasFiles && !fileIsUploading ? (
                            <>
                              {mode === "multiple" && isEditable && (
                                <label
                                  htmlFor={`file-${key}`}
                                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-primary whitespace-nowrap cursor-pointer hover:opacity-80 h-6"
                                >
                                  <CloudArrowUpIcon className="h-4 w-4 shrink-0" />
                                  <span>Add files</span>
                                  <Input
                                    id={`file-${key}`}
                                    type="file"
                                    accept={acceptAttr}
                                    multiple
                                    onChange={(e) =>
                                      handleFileChange(categoryIndex, documentIndex, e)
                                    }
                                    className="hidden"
                                    disabled={fileIsUploading || !isEditable}
                                  />
                                </label>
                              )}
                              {hiddenFileCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedFileLists((prev) => ({ ...prev, [key]: true }))
                                  }
                                  className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                  +{hiddenFileCount} more
                                </button>
                              )}
                              {showAllFiles && fileList.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedFileLists((prev) => ({ ...prev, [key]: false }))
                                  }
                                  className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                  Show less
                                </button>
                              )}
                            </>
                          ) : !isEditable && !isUploaded ? null : (
                            <label
                              htmlFor={isEditable ? `file-${key}` : undefined}
                              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-primary whitespace-nowrap cursor-pointer hover:opacity-80 h-6"
                            >
                              <CloudArrowUpIcon className="h-4 w-4 shrink-0" />
                              <span>
                                {fileIsUploading
                                  ? "Uploading…"
                                  : mode === "multiple"
                                    ? "Upload files"
                                    : "Upload file"}
                              </span>
                              <Input
                                id={`file-${key}`}
                                type="file"
                                accept={acceptAttr}
                                multiple={mode === "multiple"}
                                onChange={(e) =>
                                  handleFileChange(categoryIndex, documentIndex, e)
                                }
                                className="hidden"
                                disabled={fileIsUploading || !isEditable}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>
        );
      })}
        </>
      )}
    </div>
    </>
  );

}


