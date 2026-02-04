"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { XMarkIcon, ChevronDownIcon, CloudArrowUpIcon, CheckIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { toast } from "sonner";
import { useApplication } from "@/hooks/use-applications";
import { useAuthToken } from "@cashsouk/config";
import { Separator } from "@/components/ui/separator";

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
  const { getAccessToken } = useAuthToken();
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);

  const categories = React.useMemo(() => {
    const config = stepConfig?.config;
    if (!config || typeof config !== "object") return [];

    return Object.entries(config)
      .filter(([, value]) => Array.isArray(value))
      .map(([groupKey, docs]) => ({
        name: groupKey
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        documents: (docs as any[]).map((doc) => ({
          title: doc?.name ?? "Untitled document",
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

  if (isLoadingApp || !stepConfig) {
    return (
      <div className="space-y-6 sm:space-y-8 md:space-y-12">
        {[1, 2].map((categoryIndex) => (
          <div key={categoryIndex} className="space-y-3 sm:space-y-4">
            <div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-5 sm:h-6 w-32 sm:w-40" />
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 sm:h-5 w-20 sm:w-24" />
                </div>
              </div>
              <div className="mt-2 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-3 sm:mt-4 pl-3 sm:pl-4 md:pl-6">
              {[1, 2, 3].map((docIndex) => (
                <React.Fragment key={docIndex}>
                  <Skeleton className="h-5 w-40 sm:w-48" />
                  <div className="flex justify-end">
                    <Skeleton className="h-8 w-24 sm:w-28" />
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

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
      const categoryIndex = categories.findIndex((cat: any) => cat.name === savedCategory.name);
      if (categoryIndex === -1) return;

      savedCategory.documents.forEach((savedDocument: any) => {
        const documentIndex = categories[categoryIndex].documents.findIndex(
          (doc: any) => doc.title === savedDocument.title
        );
        if (documentIndex === -1) return;

        if (savedDocument.file?.s3_key && savedDocument.file?.file_name) {
          const key = `${categoryIndex}-${documentIndex}`;
          loadedFiles[key] = {
            name: savedDocument.file.file_name,
            size: 0,
            uploadedAt: new Date().toISOString().split("T")[0],
            s3_key: savedDocument.file.s3_key,
          };

          const cuidMatch = savedDocument.file.s3_key.match(/v\d+-(\d{4}-\d{2}-\d{2})-([^.]+)\./);
          if (cuidMatch) {
            loadedCuids[key] = cuidMatch[2];
            loadedS3Keys[key] = savedDocument.file.s3_key;
          }
        }
      });
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
      toast.error("Invalid file type", {
        description: "Only PDF files are allowed",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", {
        description: "File size must be less than 5MB",
      });
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

    toast.success("File selected. Click 'Save and continue' to upload.");
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
        toast.error(`Failed to upload ${typedFile.name}`);
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
    toast.success("File removed");
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
    <div className="space-y-6 sm:space-y-8 md:space-y-12">
      {categories.map((category: any, categoryIndex: number) => {
        const status = getCategoryStatus(categoryIndex);
        const isComplete = status.uploadedCount === status.totalCount && status.totalCount > 0;
        const isExpanded = expandedCategories[categoryIndex] ?? true;

        return (
          <div key={categoryIndex} className="space-y-3 sm:space-y-4">
            <div>
              <div className="flex justify-between items-center gap-2">
                <button
                  onClick={() => setExpandedCategories((prev: any) => ({ ...prev, [categoryIndex]: !isExpanded }))}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity p-1 -m-1 min-w-0 flex-1"
                  type="button"
                >
                  <ChevronDownIcon
                    className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "" : "-rotate-90"}`}
                  />
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold truncate">{category.name}</h3>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {isComplete && (
                    <div className="w-4 h-4 rounded flex items-center justify-center bg-destructive text-destructive-foreground">
                      <CheckIcon className="h-2.5 w-2.5" />
                    </div>
                  )}
                  <span className="text-sm sm:text-base md:text-[17px] leading-5 sm:leading-6 md:leading-7 text-muted-foreground whitespace-nowrap">
                    {status.uploadedCount}/{status.totalCount} <span className="hidden sm:inline">files </span>{isComplete ? "uploaded" : "required"}
                  </span>
                </div>
              </div>
              <div className="mt-2 h-px bg-border" />
            </div>
            {isExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-3 sm:mt-4 pl-3 sm:pl-4 md:pl-6">
                {category.documents.map((document: any, documentIndex: number) => {
                  const key = `${categoryIndex}-${documentIndex}`;
                  const isUploaded = isDocumentUploaded(categoryIndex, documentIndex);
                  const fileIsUploading = uploadingKeys.has(key);
                  const file = uploadedFiles[key];
                  const templateS3Key = document.template?.s3_key;

                  return (
                    <React.Fragment key={documentIndex}>
                      <div className="text-sm sm:text-base leading-5 sm:leading-6 text-muted-foreground">{document.title}</div>
                      <div className="flex items-center justify-end gap-4">

                        {templateS3Key && (
                          <>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                              onClick={async () => {
                                try {
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
                                  } else {
                                    toast.error("Unable to download template");
                                  }
                                } catch (err) {
                                  toast.error("Unable to download template");
                                }
                              }}
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              <span>Download template</span>
                            </button>

                            {/* separator */}
                            <Separator orientation="vertical" className="h-4" />
                          </>
                        )}

                        {isUploaded && file && !fileIsUploading ? (
                          <div className="inline-flex items-center gap-2 bg-background text-foreground border border-border rounded-sm px-2 py-1 max-w-full">
                            <div className="w-3.5 h-3.5 rounded flex items-center justify-center bg-foreground shrink-0">
                              <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                            </div>
                            <span className="text-sm truncate max-w-[120px] sm:max-w-[200px]">{file.name}</span>
                            <button
                              onClick={() => handleRemoveFile(categoryIndex, documentIndex)}
                              className="hover:text-destructive transition-colors cursor-pointer shrink-0"
                              type="button"
                            >
                              <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label htmlFor={`file-${key}`} className="inline-flex items-center gap-1.5 text-destructive font-medium cursor-pointer hover:opacity-80">
                            <CloudArrowUpIcon className="h-4 w-4 shrink-0" />
                            <span className="hidden sm:inline">{fileIsUploading ? "Uploading..." : "Upload file"}</span>
                            <span className="sm:hidden">{fileIsUploading ? "Uploading..." : "Upload"}</span>
                            <Input
                              id={`file-${key}`}
                              type="file"
                              accept="application/pdf,.pdf"
                              onChange={(e) => handleFileChange(categoryIndex, documentIndex, e)}
                              className="hidden"
                              disabled={fileIsUploading}
                            />
                          </label>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
