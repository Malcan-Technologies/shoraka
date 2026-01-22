"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { XMarkIcon, ChevronDownIcon, CloudArrowUpIcon, CheckIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { toast } from "sonner";
import type { StepComponentProps } from "../step-components";
import { useApplication } from "@/hooks/use-applications";
import { useS3Upload } from "@/hooks/use-s3-upload";

// Types for better readability
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
  s3Key?: string;
};

// Helper function to create a unique key for each document
function getDocumentKey(categoryIndex: number, documentIndex: number): string {
  return `${categoryIndex}-${documentIndex}`;
}

export default function SupportingDocumentsStep({
  stepConfig,
  applicationId,
  onDataChange,
}: StepComponentProps) {
  // Get categories from step config
  const categories: Category[] = React.useMemo(() => {
    if (!stepConfig?.categories || !Array.isArray(stepConfig.categories)) {
      return [];
    }
    return stepConfig.categories as Category[];
  }, [stepConfig]);

  const { data: application } = useApplication(applicationId);

  // State for uploaded files (files that are ready to save)
  const [uploadedFiles, setUploadedFiles] = React.useState<Record<string, UploadedFile>>({});

  // State for newly selected files (files waiting to be uploaded to S3)
  const [selectedFiles, setSelectedFiles] = React.useState<Record<string, File>>({});

  // State for which categories are expanded/collapsed
  const [expandedCategories, setExpandedCategories] = React.useState<Record<number, boolean>>({});

  const { uploadFiles: uploadFilesToS3Hook, isUploading } = useS3Upload(applicationId);

  // Expand all categories by default when they load
  React.useEffect(() => {
    const allExpanded: Record<number, boolean> = {};
    categories.forEach((_, index) => {
      allExpanded[index] = true;
    });
    setExpandedCategories(allExpanded);
  }, [categories]);

  // Load existing files from the application data
  React.useEffect(() => {
    if (!application?.supportingDocuments) {
      return;
    }

    const savedData = application.supportingDocuments as {
      categories?: Array<{
        name: string;
        documents: Array<{
          title: string;
          file?: {
            file_name?: string;
            name?: string;
            s3_key?: string;
            s3Key?: string;
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
          const s3Key = file.s3_key || file.s3Key;
          const fileName = file.file_name || file.name;

          if (s3Key && fileName) {
            const key = getDocumentKey(categoryIndex, documentIndex);
            loadedFiles[key] = {
              name: fileName,
              size: file.size || 0,
              uploadedAt: file.uploadedAt || new Date().toISOString().split("T")[0],
              s3Key: s3Key,
            };
          }
        }
      });
    });

    setUploadedFiles(loadedFiles);
  }, [application]);

  // Handle when user selects a file
  const handleFileChange = (
    categoryIndex: number,
    documentIndex: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Check file size (max 10MB)
    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeInBytes) {
      toast.error("File size must be less than 10MB");
      return;
    }

    // Check file type
    const allowedExtensions = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error("File type not allowed. Please upload PDF, DOC, DOCX, JPG, or PNG files.");
      return;
    }

    const key = getDocumentKey(categoryIndex, documentIndex);
    const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD

    // Save the file for later upload to S3
    setSelectedFiles((prev) => ({
      ...prev,
      [key]: file,
    }));

    // Mark it as uploaded locally (will upload to S3 when user clicks "Save and continue")
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

  // Upload files to S3 when user clicks "Save and continue"
  const uploadFilesToS3 = React.useCallback(async (): Promise<{ supportingDocuments: unknown } | null> => {
    if (!applicationId || Object.keys(selectedFiles).length === 0) {
      return null;
    }

    // Convert selected files to a Map for the upload hook
    const filesMap = new Map(Object.entries(selectedFiles));
    const uploadResults = await uploadFilesToS3Hook(filesMap);

    if (uploadResults.size === 0) {
      throw new Error("Failed to upload files");
    }

    // Clear selected files since they're now uploaded
    setSelectedFiles({});

    // Update uploaded files with S3 keys
    const updatedFiles = { ...uploadedFiles };
    uploadResults.forEach((result, key) => {
      if (updatedFiles[key]) {
        updatedFiles[key] = {
          ...updatedFiles[key],
          s3Key: result.s3_key,
        };
      }
    });
    setUploadedFiles(updatedFiles);

    // Build the data structure to save
    const dataToSave = {
      categories: categories.map((category, categoryIndex) => ({
        name: category.name,
        documents: category.documents.map((document, documentIndex) => {
          const key = getDocumentKey(categoryIndex, documentIndex);
          const uploadResult = uploadResults.get(key);
          const existingFile = uploadedFiles[key];

          const s3Key = uploadResult?.s3_key || existingFile?.s3Key;
          const fileName = uploadResult?.file_name || existingFile?.name;

          if (s3Key && fileName) {
            return {
              title: document.title,
              file: {
                file_name: fileName,
                s3_key: s3Key,
              },
            };
          }

          return { title: document.title };
        }),
      })),
    };

    if (onDataChange) {
      onDataChange({
        supportingDocuments: dataToSave,
        _uploadFiles: uploadFilesRef.current,
      });
    }

    return { supportingDocuments: dataToSave };
  }, [applicationId, selectedFiles, uploadFilesToS3Hook, categories, uploadedFiles, onDataChange]);

  // Keep a ref to the upload function so parent can call it
  const uploadFilesRef = React.useRef(uploadFilesToS3);
  React.useEffect(() => {
    uploadFilesRef.current = uploadFilesToS3;
  }, [uploadFilesToS3]);

  // Remove a file when user clicks the X button
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

  // Check if a document has a file uploaded
  const isDocumentUploaded = (categoryIndex: number, documentIndex: number): boolean => {
    const key = getDocumentKey(categoryIndex, documentIndex);
    return key in uploadedFiles;
  };

  // Save data whenever uploaded files change (for files that already have S3 keys)
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

          // Only include file info if it has an S3 key (already uploaded)
          if (file?.s3Key) {
            return {
              title: document.title,
              file: {
                file_name: file.name,
                s3_key: file.s3Key,
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
      supportingDocuments: dataToSave,
      _uploadFiles: uploadFilesRef.current,
    });
  }, [uploadedFiles, categories, applicationId, onDataChange]);

  // Count how many files are uploaded in a category
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

  const [isLoadingDocuments] = React.useState(false);
  const isLoading = isLoadingDocuments || !stepConfig;

  if (isLoading) {
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
            <ul className="space-y-4 mt-6">
              {[1, 2, 3].map((docIndex) => (
                <li key={docIndex} className="flex items-center justify-between text-[17px] leading-7 min-h-[2rem]">
                  <Skeleton className="h-3.5 w-48 pl-6" />
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
              <ul className="space-y-4 mt-6">
                {category.documents.map((document, documentIndex) => {
                  const key = getDocumentKey(categoryIndex, documentIndex);
                  const isUploaded = isDocumentUploaded(categoryIndex, documentIndex);
                  const fileIsUploading = isUploading(key);
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
                          Upload file
                          <Input
                            id={`file-${key}`}
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
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
