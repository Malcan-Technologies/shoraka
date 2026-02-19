"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { XMarkIcon, ChevronDownIcon, CloudArrowUpIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { toast } from "sonner";
import { useApplication } from "@/hooks/use-applications";
import { useAuthToken } from "@cashsouk/config";
import { StepSkeleton } from "@/app/applications/components/step-skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function SupportingDocumentsStep({
  applicationId,
  stepConfig,
  onDataChange,
}: {
  applicationId: string;
  stepConfig?: any;
  onDataChange?: (data: any) => void;
}) {
  // DEBUG: Force show skeleton
  const SHOW_SKELETON_DEBUG = true;
  
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
  const categories = React.useMemo(() => {
    const config = stepConfig?.config;

    // Guard: no config or invalid shape
    if (!config || typeof config !== "object") return [];

    return Object.entries(config)

      // Only treat array values as document groups
      .filter(([, value]) => Array.isArray(value))

      // Convert each group into a UI category
      .map(([groupKey, docs]) => ({
        // "financial_docs" → "Financial Docs"
        name: groupKey
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),

        // Convert documents into UI-friendly shape
        documents: (docs as any[]).map((doc) => ({
          title: doc?.name ?? "—", // if no document name
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
      <div className="space-y-4">
        <p className="text-muted-foreground text-center py-8">No documents required for this application.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 px-3">
      {isLoadingApp || !stepConfig || SHOW_SKELETON_DEBUG ? (
        <SupportingDocumentsSkeleton showButton={SHOW_SKELETON_DEBUG} onSaveClick={() => console.log('Save clicked from supporting-documents skeleton')} />
      ) : (categories.map((category: any, categoryIndex: number) => {
        const status = getCategoryStatus(categoryIndex);
        const isExpanded = expandedCategories[categoryIndex] ?? true;

        return (
          <section key={categoryIndex} className="space-y-4">
            {/* Section header */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedCategories((prev: any) => ({
                      ...prev,
                      [categoryIndex]: !isExpanded,
                    }))
                  }
                  className="
    w-full
    flex items-center justify-between
    cursor-pointer
    text-left
  "
                >
                  {/* Left side: chevron + title */}
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronDownIcon
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "" : "-rotate-90"
                        }`}
                    />
                    <h2 className="text-xl font-semibold text-foreground truncate">
                      {category.name}
                    </h2>
                  </div>

                  {/* Right side: file counter */}
                  <span className="text-xl text-muted-foreground whitespace-nowrap">
                    {status.uploadedCount}/{status.totalCount} files required
                  </span>
                </button>

              </div>

              <div className="mt-2 h-px bg-border" />
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

                    return (
                      <React.Fragment key={documentIndex}>
                        {/* Document title */}
                        <div className="text-[16px] leading-[22px] text-foreground">
                          {document.title}
                        </div>

                        {/* FIXED ACTION COLUMN */}
                        <div className="flex justify-end">
                          <div className="flex justify-end items-start">
                            <div className="flex items-center gap-3">
                              {/* Download template */}
                              {templateS3Key && (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground hover:text-foreground whitespace-nowrap h-6"
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

                              {/* Separator */}
                              <div className="w-px h-4 bg-border/60" />

                              {/* FIXED upload slot */}
                              <div className="w-[160px]">
                                {isUploaded && file && !fileIsUploading ? (
                                  <div className="inline-flex items-center gap-2 border border-border rounded-sm px-2 py-[2px] w-full h-6">
                                    {/* check */}
                                    <div className="w-3.5 h-3.5 rounded-sm bg-foreground flex items-center justify-center shrink-0">
                                      <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                                    </div>

                                    {/* filename (truncate) */}
                                    <span className="text-[14px] font-medium truncate flex-1">
                                      {file.name}
                                    </span>

                                    {/* remove */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveFile(categoryIndex, documentIndex)
                                      }
                                      className="text-muted-foreground hover:text-foreground shrink-0"
                                    >
                                      <XMarkIcon className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <label
                                    htmlFor={`file-${key}`}
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
                                      disabled={fileIsUploading}
                                    />
                                  </label>

                                )}
                              </div>
                            </div>
                          </div>



                        </div>
                      </React.Fragment>
                    );
                  }
                )}
              </div>
            )}
          </section>
        );
      }))}
    </div>
  )

}

function SupportingDocumentsSkeleton({ showButton, onSaveClick }: { showButton?: boolean; onSaveClick?: () => void }) {
  return <StepSkeleton rows={6} showButton={showButton} onSaveClick={onSaveClick} />;
}
