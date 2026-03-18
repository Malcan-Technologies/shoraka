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


  /** Canonical file structure: file_name, file_size, s3_key, uploaded_at (ISO string). */
  const buildDataToSave = (
    files: Record<string, { s3_key?: string; name?: string; size?: number; uploadedAt?: string }>,
    uploadResults: Map<string, { s3_key: string; file_name: string; file_size: number; uploaded_at: string }> = new Map()
  ) => {
    return {
      categories: categories.map((category: any, categoryIndex: number) => ({
        name: category.name,
        documents: category.documents.map((document: any, documentIndex: number) => {
          const key = `${categoryIndex}-${documentIndex}`;
          const uploadResult = uploadResults.get(key);
          const existingFile = files[key];
          const s3_key = uploadResult?.s3_key || existingFile?.s3_key;
          const fileName = uploadResult?.file_name || existingFile?.name;
          const fileSize = uploadResult?.file_size ?? existingFile?.size ?? 0;
          const uploadedAt = uploadResult?.uploaded_at ?? existingFile?.uploadedAt ?? new Date().toISOString();
          if (s3_key && fileName) {
            return {
              title: document.title,
              file: { file_name: fileName, file_size: fileSize, s3_key, uploaded_at: uploadedAt },
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
            const f = savedDocument.file;
            loadedFiles[key] = {
              name: f.file_name,
              size: f.file_size ?? 0,
              uploadedAt: f.uploaded_at ?? new Date().toISOString(),
              s3_key: f.s3_key,
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
              // Non-fatal: upload succeeded
            }
          } catch {
            // Non-fatal: continue with new file
          }
        }

        uploadResults.set(key, {
          s3_key: s3Key,
          file_name: typedFile.name,
          file_size: typedFile.size,
          uploaded_at: new Date().toISOString(),
        });

        const cuidMatch = s3Key.match(/v\d+-(\d{4}-\d{2}-\d{2})-([^.]+)\./);
        if (cuidMatch) {
          setDocumentCuids((prev: any) => ({ ...prev, [key]: cuidMatch[2] }));
          setLastS3Keys((prev: any) => ({ ...prev, [key]: s3Key }));
        }
      } catch (error) {
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
      if (updatedFiles[key]) {
        updatedFiles[key] = {
          ...updatedFiles[key],
          s3_key: result.s3_key,
          size: result.file_size,
          uploadedAt: result.uploaded_at,
        };
      } else {
        updatedFiles[key] = {
          name: result.file_name,
          size: result.file_size,
          uploadedAt: result.uploaded_at,
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
      {isLoadingApp || !stepConfig || devTools?.showSkeletonDebug ? (
        <SupportingDocumentsSkeleton />
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
                        className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 items-start"
                      >
                        {/* Document title */}
                        <div className="text-[16px] leading-[22px] text-foreground">
                          {document.title}
                        </div>

                        {/* Action column: template, amendment, upload — all aligned far right */}
                        <div
                          className={cn(
                            "flex flex-col items-end gap-2",
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
                          <div className="flex flex-row items-center gap-3 justify-end">
                            {isItemFlagged && itemRemark ? (
                              <div className="inline-flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 max-w-[240px]">
                                <ExclamationTriangleIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <p className="text-sm text-foreground leading-snug">{itemRemark.split("\n")[0]}</p>
                              </div>
                            ) : null}
                            <div className="shrink-0">
                                {isUploaded && file && !fileIsUploading ? (
                                  isItemFlagged ? (
                                    <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 min-h-9">
                                      <span title={file.name} className="text-sm font-medium truncate min-w-0">
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
                                  ) : (
                                    <FileDisplayBadge
                                      fileName={file.name}
                                      truncate
                                      trailing={
                                        isEditable ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveFile(categoryIndex, documentIndex)
                                            }
                                            className="text-muted-foreground hover:text-foreground shrink-0"
                                          >
                                            <XMarkIcon className="h-3.5 w-3.5" />
                                          </button>
                                        ) : undefined
                                      }
                                    />
                                  )
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
    </>
  );

}


