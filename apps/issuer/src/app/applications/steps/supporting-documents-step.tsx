"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { XMarkIcon, ChevronDownIcon, CloudArrowUpIcon, CheckIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { toast } from "sonner";
import { useApplication } from "@/hooks/use-applications";
import { useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Document = {
  title: string;
};

type Category = {
  name: string;
  documents: Document[];
};

type UploadedFile = {
  name: string;
  size: number;
  uploadedAt: string;
  s3_key?: string;
};

interface SupportingDocumentsStepProps {
  applicationId: string;
  stepConfig?: {
    categories?: Category[];
  };
  onDataChange?: (data: any) => void;
}

function getDocumentKey(categoryIndex: number, documentIndex: number): string {
  return `${categoryIndex}-${documentIndex}`;
}

export function SupportingDocumentsStep({
  applicationId,
  stepConfig,
  onDataChange,
}: SupportingDocumentsStepProps) {
  const { getAccessToken } = useAuthToken();

  const categories: Category[] = React.useMemo(() => {
    if (!stepConfig?.categories || !Array.isArray(stepConfig.categories)) {
      return [];
    }
    return stepConfig.categories as Category[];
  }, [stepConfig]);

  const { data: application } = useApplication(applicationId);

  const [uploadedFiles, setUploadedFiles] = React.useState<Record<string, UploadedFile>>({});
  const [selectedFiles, setSelectedFiles] = React.useState<Record<string, File>>({});
  const [expandedCategories, setExpandedCategories] = React.useState<Record<number, boolean>>({});
  const [uploadingKeys, setUploadingKeys] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const allExpanded: Record<number, boolean> = {};
    categories.forEach((_, index) => {
      allExpanded[index] = true;
    });
    setExpandedCategories(allExpanded);
  }, [categories]);

  React.useEffect(() => {
    if (!application?.supporting_documents) {
      return;
    }

    const savedData = application.supporting_documents as {
      categories?: Array<{
        name: string;
        documents: Array<{
          title: string;
          file?: {
            file_name?: string;
            name?: string;
            s3_key?: string;
            size?: number;
            uploadedAt?: string;
          };
        }>;
      }>;
    };

    if (!savedData?.categories) {
      return;
    }

    const loadedFiles: Record<string, UploadedFile> = {};

    savedData.categories.forEach((category, categoryIndex) => {
      category.documents.forEach((document, documentIndex) => {
        if (document.file) {
          const file = document.file;
          const s3_key = file.s3_key;
          const fileName = file.file_name || file.name;

          if (s3_key && fileName) {
            const key = getDocumentKey(categoryIndex, documentIndex);
            loadedFiles[key] = {
              name: fileName,
              size: file.size || 0,
              uploadedAt: file.uploadedAt || new Date().toISOString().split("T")[0],
              s3_key: s3_key,
            };
          }
        }
      });
    });

    setUploadedFiles(loadedFiles);
  }, [application]);

  const handleFileChange = (
    categoryIndex: number,
    documentIndex: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const maxSizeInBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      toast.error("File size must be less than 5MB");
      return;
    }

    const allowedExtensions = [".png"];
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error("File type not allowed. Please upload PNG files only.");
      return;
    }

    const key = getDocumentKey(categoryIndex, documentIndex);
    const today = new Date().toISOString().split("T")[0];

    setSelectedFiles((prev) => ({
      ...prev,
      [key]: file,
    }));

    setUploadedFiles((prev) => ({
      ...prev,
      [key]: {
        name: file.name,
        size: file.size,
        uploadedAt: today,
      },
    }));

    toast.success("File selected. Click 'Save and continue' to upload.");
  };

  const uploadFilesToS3 = React.useCallback(async (): Promise<{ supporting_documents: unknown } | null> => {
    if (!applicationId || Object.keys(selectedFiles).length === 0) {
      return null;
    }

    const uploadResults = new Map<string, { s3_key: string; file_name: string }>();

    for (const [key, file] of Object.entries(selectedFiles)) {
      try {
        setUploadingKeys((prev) => new Set(prev).add(key));

        const formData = new FormData();
        formData.append("file", file);
        formData.append("applicationId", applicationId);

        const token = await getAccessToken();
        const response = await fetch(`${API_URL}/v1/applications/${applicationId}/upload-document`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to upload file");
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error?.message || "Failed to upload file");
        }

        uploadResults.set(key, {
          s3_key: result.data.s3_key || result.data.s3Key,
          file_name: file.name,
        });
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
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

    const updatedFiles = { ...uploadedFiles };
    uploadResults.forEach((result, key) => {
      if (updatedFiles[key]) {
        updatedFiles[key] = {
          ...updatedFiles[key],
          s3_key: result.s3_key,
        };
      }
    });
    setUploadedFiles(updatedFiles);

    const dataToSave = {
      categories: categories.map((category, categoryIndex) => ({
        name: category.name,
        documents: category.documents.map((document, documentIndex) => {
          const key = getDocumentKey(categoryIndex, documentIndex);
          const uploadResult = uploadResults.get(key);
          const existingFile = uploadedFiles[key];

          const s3_key = uploadResult?.s3_key || existingFile?.s3_key;
          const fileName = uploadResult?.file_name || existingFile?.name;

          if (s3_key && fileName) {
            return {
              title: document.title,
              file: {
                file_name: fileName,
                s3_key: s3_key,
              },
            };
          }

          return { title: document.title };
        }),
      })),
    };

    if (onDataChange) {
      onDataChange({
        supporting_documents: dataToSave,
        _uploadFiles: uploadFilesRef.current,
      });
    }

    return { supporting_documents: dataToSave };
  }, [applicationId, selectedFiles, categories, uploadedFiles, getAccessToken, onDataChange]);

  const uploadFilesRef = React.useRef(uploadFilesToS3);
  React.useEffect(() => {
    uploadFilesRef.current = uploadFilesToS3;
  }, [uploadFilesToS3]);

  const isDocumentUploaded = (categoryIndex: number, documentIndex: number): boolean => {
    const key = getDocumentKey(categoryIndex, documentIndex);
    return key in uploadedFiles;
  };

  const areAllFilesUploaded = React.useMemo(() => {
    if (categories.length === 0) return true;
    
    for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex++) {
      const category = categories[categoryIndex];
      for (let documentIndex = 0; documentIndex < category.documents.length; documentIndex++) {
        if (!isDocumentUploaded(categoryIndex, documentIndex)) {
          return false;
        }
      }
    }
    return true;
  }, [categories, uploadedFiles]);

  React.useEffect(() => {
    if (onDataChange) {
      onDataChange({
        hasPendingChanges: Object.keys(selectedFiles).length > 0,
        saveFunction: uploadFilesToS3,
        areAllFilesUploaded: areAllFilesUploaded,
      });
    }
  }, [selectedFiles, uploadFilesToS3, onDataChange, areAllFilesUploaded]);

  React.useEffect(() => {
    if (!applicationId || !onDataChange) {
      return;
    }

    const dataToSave = {
      categories: categories.map((category, categoryIndex) => ({
        name: category.name,
        documents: category.documents.map((document, documentIndex) => {
          const key = getDocumentKey(categoryIndex, documentIndex);
          const file = uploadedFiles[key];

          if (file?.s3_key) {
            return {
              title: document.title,
              file: {
                file_name: file.name,
                s3_key: file.s3_key,
              },
            };
          }

          return {
            title: document.title,
          };
        }),
      })),
    };

    onDataChange({
      supporting_documents: dataToSave,
      _uploadFiles: uploadFilesRef.current,
    });
  }, [uploadedFiles, categories, applicationId, onDataChange]);

  const handleRemoveFile = (categoryIndex: number, documentIndex: number) => {
    const key = getDocumentKey(categoryIndex, documentIndex);

    setUploadedFiles((prev) => {
      const newFiles = { ...prev };
      delete newFiles[key];
      return newFiles;
    });

    setSelectedFiles((prev) => {
      const newFiles = { ...prev };
      delete newFiles[key];
      return newFiles;
    });

    toast.success("File removed");
  };

  const getCategoryStatus = (categoryIndex: number) => {
    const category = categories[categoryIndex];
    if (!category) {
      return { uploadedCount: 0, totalCount: 0 };
    }

    let uploadedCount = 0;
    const totalCount = category.documents.length;

    category.documents.forEach((_, documentIndex) => {
      if (isDocumentUploaded(categoryIndex, documentIndex)) {
        uploadedCount++;
      }
    });

    return { uploadedCount, totalCount };
  };

  if (!stepConfig) {
    return (
      <div className="space-y-12">
        {[1, 2].map((categoryIndex) => (
          <div key={categoryIndex}>
            <div className="flex justify-between items-center border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="flex items-center gap-1">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <ul className="space-y-4 mt-6 pl-6">
              {[1, 2, 3].map((docIndex) => (
                <li key={docIndex} className="flex items-center justify-between text-[17px] leading-7 min-h-[2rem]">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-8 w-28" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-center py-8">
          No documents required for this application.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {categories.map((category, categoryIndex) => {
        const status = getCategoryStatus(categoryIndex);
        const isComplete = status.uploadedCount === status.totalCount && status.totalCount > 0;
        const isExpanded = expandedCategories[categoryIndex] ?? true;

        return (
          <div key={categoryIndex}>
            <div className="flex justify-between items-center border-b border-border pb-2">
              <button
                onClick={() => setExpandedCategories(prev => ({ ...prev, [categoryIndex]: !isExpanded }))}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                type="button"
              >
                <ChevronDownIcon 
                  className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`} 
                />
                <h3 className="font-semibold text-xl">{category.name}</h3>
              </button>
              <div className="flex items-center gap-1">
                {isComplete && (
                  <div className="w-4 h-4 rounded flex items-center justify-center bg-destructive text-destructive-foreground">
                    <CheckIcon className="h-2.5 w-2.5" />
                  </div>
                )}
                <span className="text-[17px] leading-7 text-muted-foreground">
                  {status.uploadedCount}/{status.totalCount} files {isComplete ? "uploaded" : "required"}
                </span>
              </div>
            </div>
            {isExpanded && (
              <ul className="space-y-4 mt-6 pl-6">
                {category.documents.map((document, documentIndex) => {
                  const key = getDocumentKey(categoryIndex, documentIndex);
                  const isUploaded = isDocumentUploaded(categoryIndex, documentIndex);
                  const fileIsUploading = uploadingKeys.has(key);
                  const file = uploadedFiles[key];

                  return (
                    <li key={documentIndex} className="flex items-center justify-between text-[17px] leading-7 min-h-[2rem]">
                      <span className="pl-6">{document.title}</span>
                      {isUploaded && file && !fileIsUploading ? (
                        <div className="flex items-center gap-2 bg-background text-foreground border border-border text-[17px] leading-7 rounded-sm px-2 py-1 min-h-[2rem]">
                          <div className="w-3.5 h-3.5 rounded flex items-center justify-center bg-foreground">
                            <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                          </div>
                          <span>{file.name}</span>
                          <button
                            onClick={() => handleRemoveFile(categoryIndex, documentIndex)}
                            className="hover:text-destructive transition-colors cursor-pointer"
                            type="button"
                            aria-label="Remove file"
                          >
                            <XMarkIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label htmlFor={`file-${key}`} className="flex items-center gap-1.5 text-primary font-medium cursor-pointer hover:underline min-h-[2rem] text-[17px] leading-7">
                          <CloudArrowUpIcon className="h-4 w-4" />
                          {fileIsUploading ? "Uploading..." : "Upload file"}
                          <Input
                            id={`file-${key}`}
                            type="file"
                            accept=".png"
                            onChange={(e) =>
                              handleFileChange(categoryIndex, documentIndex, e)
                            }
                            className="hidden"
                            disabled={fileIsUploading}
                          />
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
