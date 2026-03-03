"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { XMarkIcon, ChevronDownIcon, CloudArrowUpIcon, ArrowDownTrayIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApplication } from "@/hooks/use-applications";
import { useAuthToken } from "@cashsouk/config";
import { SupportingDocumentsSkeleton } from "@/app/applications/components/supporting-documents-skeleton";
import { DebugSkeletonToggle } from "@/app/applications/components/debug-skeleton-toggle";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
  // DEBUG: Toggle skeleton mode
  const [debugSkeletonMode, setDebugSkeletonMode] = React.useState(false);
  
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

  /** Combined set for remark lookup (supports doc:... admin format). */
  const combinedItemSet = React.useMemo(() => {
    const setB = flaggedItems?.get("doc");
    return new Set<string>([...supportingDocItemSet, ...(setB ?? [])]);
  }, [flaggedItems, supportingDocItemSet]);

  /** Map scope_key -> remark for item-level amendment text. */
  const flaggedDocRemarks = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of amendmentRemarks) {
      const rem = r as { scope?: string; scope_key?: string; remark?: string };
      if (rem.scope !== "item" || !rem.scope_key) continue;
      if (combinedItemSet.has(rem.scope_key) && (rem.remark || "").trim()) {
        map.set(rem.scope_key, (rem.remark || "").trim());
      }
    }
    return map;
  }, [amendmentRemarks, combinedItemSet]);

  const categories = React.useMemo(() => {
    const config = stepConfig?.config;

    // Guard: no config or invalid shape
    if (!config || typeof config !== "object") return [];

    return Object.entries(config)

      // Only treat array values as document groups
      .filter(([, value]) => Array.isArray(value))

      // Convert each group into a UI category
      .map(([groupKey, docs]) => ({
        groupKey,
        name: groupKey
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),

        // Convert documents into UI-friendly shape
        documents: (docs as any[]).map((doc) => ({
          title: doc?.name ?? "—",
          template: doc?.template,
        })),
      }));
  }, [stepConfig]);


  const [uploadedFiles, setUploadedFiles] = React.useState<Record<string, { name: string; size?: number; uploadedAt?: string; s3_key?: string }>>({});
  const [selectedFiles, setSelectedFiles] = React.useState<Record<string, File>>({});
  const [expandedCategories, setExpandedCategories] = React.useState<Record<number, boolean>>({});
  const [uploadingKeys, setUploadingKeys] = React.useState<Set<string>>(new Set());
  const [documentCuids, setDocumentCuids] = React.useState<Record<string, string>>({});
  const [lastS3Keys, setLastS3Keys] = React.useState<Record<string, string>>({});
  const [initialUploadedFiles, setInitialUploadedFiles] = React.useState<Record<string, { name: string; size?: number; uploadedAt?: string; s3_key?: string }>>({});


  const buildDataToSave = (files: Record<string, { s3_key?: string; name?: string }>, uploadResults: Map<string, { s3_key: string; file_name: string }> = new Map()) => {
    return {
      categories: categories.map((category: any, categoryIndex: number) => ({
        name: category.name,
        documents: category.documents.map((document: any, documentIndex: number) => {
          const key = `${categoryIndex}-${documentIndex}`;
          const uploadResult = uploadResults.get(key);
          const existingFile = files[key];
          const s3_key = uploadResult?.s3_key || existingFile?.s3_key;
          const fileName = uploadResult?.file_name || existingFile?.name;
          if (s3_key && fileName) {
            return {
              title: document.title,
              file: { file_name: fileName, s3_key: s3_key },
            };
          }
          return { title: document.title };
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
      return;
    }

    let data = application.supporting_documents;
    if (typeof data === "string") {
      data = JSON.parse(data);
    }
    if (data?.supporting_documents) {
      data = data.supporting_documents;
    }

    if (!data?.categories) {
      return;
    }

    const loadedFiles: Record<string, { name: string; size: number; uploadedAt: string; s3_key: string }> = {};
    const loadedCuids: Record<string, string> = {};
    const loadedS3Keys: Record<string, string> = {};

    data.categories.forEach((savedCategory: any) => {
      const categoryIndex = categories.findIndex(
        (cat: any) => cat.name === savedCategory.name
      );
      if (categoryIndex === -1) return;

      savedCategory.documents.forEach(
        (savedDocument: any, documentIndex: number) => {

          const key = `${categoryIndex}-${documentIndex}`;

          if (savedDocument.file?.s3_key && savedDocument.file?.file_name) {
            loadedFiles[key] = {
              name: savedDocument.file.file_name,
              size: 0,
              uploadedAt: new Date().toISOString().split("T")[0],
              s3_key: savedDocument.file.s3_key,
            };
          }
        }
      );
    });


    if (Object.keys(loadedFiles).length > 0) {
      setUploadedFiles(loadedFiles);
      setDocumentCuids(loadedCuids);
      setLastS3Keys(loadedS3Keys);
      setInitialUploadedFiles(loadedFiles);
    }
  }, [application, categories]);

  const handleFileChange = (categoryIndex: number, documentIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please select a PDF file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large (max 5MB)");
      return;
    }

    const key = `${categoryIndex}-${documentIndex}`;
    const today = new Date().toISOString().split("T")[0];

    setSelectedFiles((prev: any) => ({ ...prev, [key]: file }));
    setUploadedFiles((prev: any) => ({
      ...prev,
      [key]: {
        name: file.name,
        size: file.size,
        uploadedAt: today,
      },
    }));

    toast.success("File added");
  };

  const uploadFilesToS3 = React.useCallback(async () => {
    if (!applicationId || Object.keys(selectedFiles).length === 0) {
      return null;
    }

    const uploadResults = new Map();

    for (const [key, typedFile] of Object.entries(selectedFiles) as [string, File][]) {
      try {
        setUploadingKeys((prev) => new Set(prev).add(key));

        const existingS3Key = uploadedFiles[key]?.s3_key || lastS3Keys[key];

        const token = await getAccessToken();

        const urlResponse = await fetch(`${API_URL}/v1/applications/${applicationId}/upload-document-url`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: typedFile.name,
            contentType: typedFile.type,
            fileSize: typedFile.size,
            existingS3Key: existingS3Key || undefined,
          }),
        });

        const urlResult = await urlResponse.json();
        if (!urlResult.success) {
          throw new Error("Failed to get upload URL");
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

        if (existingS3Key && existingS3Key !== s3Key) {
          try {
            const deleteResponse = await fetch(`${API_URL}/v1/applications/${applicationId}/document`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                s3Key: existingS3Key,
              }),
            });

            if (!deleteResponse.ok) {
              console.warn("Failed to delete old file, but upload succeeded");
            }
          } catch (deleteError) {
            console.warn("Error deleting old file:", deleteError);
          }
        }

        uploadResults.set(key, {
          s3_key: s3Key,
          file_name: typedFile.name,
        });

        const cuidMatch = s3Key.match(/v\d+-(\d{4}-\d{2}-\d{2})-([^.]+)\./);
        if (cuidMatch) {
          setDocumentCuids((prev: any) => ({ ...prev, [key]: cuidMatch[2] }));
          setLastS3Keys((prev: any) => ({ ...prev, [key]: s3Key }));
        }
      } catch (error) {
        console.warn(`[DOCUMENTS] Failed to upload ${typedFile.name}:`, error);
        throw error;
      } finally {
        setUploadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }

    setSelectedFiles({});

    const updatedFiles: Record<string, { name: string; size?: number; uploadedAt?: string; s3_key?: string }> = { ...uploadedFiles };
    uploadResults.forEach((result, key) => {
      const originalFile = selectedFiles[key];
      if (updatedFiles[key]) {
        updatedFiles[key] = {
          ...updatedFiles[key],
          s3_key: result.s3_key,
        };
      } else {
        updatedFiles[key] = {
          name: result.file_name,
          size: originalFile?.size || 0,
          uploadedAt: new Date().toISOString().split("T")[0],
          s3_key: result.s3_key,
        };
      }
    });

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
  }, [applicationId, selectedFiles, categories, uploadedFiles, documentCuids, lastS3Keys, getAccessToken, onDataChange]);

  const uploadFilesRef = React.useRef(uploadFilesToS3);
  React.useEffect(() => {
    uploadFilesRef.current = uploadFilesToS3;
  }, [uploadFilesToS3]);

  const isDocumentUploaded = (categoryIndex: number, documentIndex: number) => {
    const key = `${categoryIndex}-${documentIndex}`;
    return key in uploadedFiles;
  };

  const areAllFilesUploaded = React.useMemo(() => {
    if (categories.length === 0) return true;
    for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex++) {
      for (let documentIndex = 0; documentIndex < categories[categoryIndex].documents.length; documentIndex++) {
        if (!isDocumentUploaded(categoryIndex, documentIndex)) {
          return false;
        }
      }
    }
    return true;
  }, [categories, uploadedFiles]);

  const hasRemovedFiles = React.useMemo(() => {
    const initialKeys = Object.keys(initialUploadedFiles);
    const currentKeys = Object.keys(uploadedFiles);
    return initialKeys.some((key) => !currentKeys.includes(key));
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

  const handleRemoveFile = (categoryIndex: number, documentIndex: number) => {
    const key = `${categoryIndex}-${documentIndex}`;

    // Save the S3 key before removing, so we can delete it on next upload
    const currentFile = uploadedFiles[key];
    if (currentFile?.s3_key) {
      const s3Key = currentFile.s3_key;
      setLastS3Keys((prev) => ({ ...prev, [key]: s3Key }));
    }

    setUploadedFiles((prev: any) => {
      const newFiles = { ...prev };
      delete newFiles[key];
      return newFiles;
    });
    setSelectedFiles((prev: any) => {
      const newFiles = { ...prev };
      delete newFiles[key];
      return newFiles;
    });
  };

  const getCategoryStatus = (categoryIndex: number) => {
    const category = categories[categoryIndex];
    if (!category) return { uploadedCount: 0, totalCount: 0 };

    let uploadedCount = 0;
    const totalCount = category.documents.length;

    category.documents.forEach((_: any, documentIndex: number) => {
      if (isDocumentUploaded(categoryIndex, documentIndex)) {
        uploadedCount++;
      }
    });

    return { uploadedCount, totalCount };
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
      {isLoadingApp || !stepConfig || debugSkeletonMode ? (
        <>
          <SupportingDocumentsSkeleton />
          <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
        </>
      ) : (
        <>
          {categories.map((category: any, categoryIndex: number) => {
        const status = getCategoryStatus(categoryIndex);
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

                  {/* Right side: file counter */}
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {status.uploadedCount}/{status.totalCount} files required
                  </span>
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
                    const isUploaded = isDocumentUploaded(
                      categoryIndex,
                      documentIndex
                    );
                    const fileIsUploading = uploadingKeys.has(key);
                    const file = uploadedFiles[key];
                    const templateS3Key = document.template?.s3_key;
                    const groupKey = (category as any).groupKey ?? Object.keys(stepConfig?.config || {})[categoryIndex] ?? "";
                    const slug = String(document.title ?? "doc").replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
                    const rawKey = `supporting_documents:${groupKey}:${documentIndex}:${slug}`;
                    const rawKeyWithDoc = `supporting_documents:doc:${groupKey}:${documentIndex}:${slug}`;
                    const isItemFlagged =
                      supportingDocItemSet.has(rawKey) ||
                      supportingDocItemSet.has(rawKeyWithDoc);
                    let isEditable = true;
                    if (isAmendmentMode) {
                      if (hasItemLevelAmendment) {
                        isEditable = isItemFlagged;
                      } else {
                        isEditable = true;
                      }
                    }
                    isEditable = isEditable && !readOnly;
                    const rawKeyAlt = `doc:${groupKey}:${documentIndex}:${slug}`;
                    const docRemark =
                      flaggedDocRemarks.get(rawKey) ??
                      flaggedDocRemarks.get(rawKeyWithDoc) ??
                      flaggedDocRemarks.get(rawKeyAlt);

                    if (process.env.NODE_ENV !== "production" && isAmendmentMode) {
                      console.debug("[AMENDMENT][STRICT][SUPPORTING_DOCS]", {
                        hasItemLevelAmendment,
                        rawKey,
                        isItemFlagged,
                        isEditable,
                      });
                    }

                    return (
                      <div
                        key={documentIndex}
                        className={cn(
                          "col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 items-start",
                          isAmendmentMode && isItemFlagged &&
                            "rounded-lg border-2 border-destructive bg-destructive/5 p-3",
                          !isEditable && "pointer-events-none opacity-60 cursor-not-allowed"
                        )}
                      >
                        {/* Document title */}
                        <div className="text-[16px] leading-[22px] text-foreground">
                          {document.title}
                        </div>

                        {/* Action column: template, error text (if flagged), uploaded file */}
                        <div className="flex justify-end">
                          <div className="flex justify-end items-start flex-wrap gap-3">
                            {/* Download template */}
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

                            {/* Error text beside file when flagged */}
                            {isItemFlagged && docRemark && isUploaded && file && !fileIsUploading ? (
                              <div className="flex items-center gap-2 text-sm text-destructive shrink-0">
                                <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                                <span>{docRemark}</span>
                              </div>
                            ) : null}

                            {/* Separator */}
                            <div className="w-px h-4 bg-border/60" />

                            {/* Upload slot with red outline when flagged */}
                            <div className="w-[160px]">
                              {isUploaded && file && !fileIsUploading ? (
                                <div
                                  className={cn(
                                    "inline-flex items-center gap-2 rounded-sm px-2 py-[2px] w-full h-6 min-h-6",
                                    isAmendmentMode && isItemFlagged
                                      ? "border-2 border-destructive bg-destructive/5"
                                      : "border border-border"
                                  )}
                                >
                                  {isAmendmentMode && isItemFlagged ? (
                                    <ExclamationTriangleIcon className="h-3.5 w-3.5 text-destructive shrink-0" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-sm bg-foreground flex items-center justify-center shrink-0">
                                      <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                                    </div>
                                  )}
                                  <span
                                    className={cn(
                                      "text-[14px] font-medium truncate flex-1",
                                      isAmendmentMode && isItemFlagged ? "text-destructive" : ""
                                    )}
                                  >
                                    {file.name}
                                  </span>
                                  {isEditable && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveFile(categoryIndex, documentIndex)
                                      }
                                      className="text-muted-foreground hover:text-foreground shrink-0"
                                    >
                                      <XMarkIcon className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : !isEditable ? (
                                <span className="text-[14px] text-muted-foreground">—</span>
                              ) : (
                                <label
                                  htmlFor={isEditable ? `file-${key}` : undefined}
                                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-primary whitespace-nowrap w-full cursor-pointer hover:opacity-80 h-6"
                                >
                                  <CloudArrowUpIcon className="h-4 w-4 shrink-0" />
                                  <span className="truncate">
                                    {fileIsUploading ? "Uploading…" : "Upload file"}
                                  </span>
                                  <Input
                                    id={`file-${key}`}
                                    type="file"
                                    accept="application/pdf"
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
    <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
    </>
  );

}


