"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline";
import { 
  useRequestProductImageDownloadUrl,
} from "../../hooks/use-product-images";
import { toast } from "sonner";

interface FinancingTypeConfig {
  name?: string;
  description?: string;
  category?: string;
  s3_key?: string;
}

interface FinancingTypeConfigProps {
  config: FinancingTypeConfig;
  onChange: (config: FinancingTypeConfig) => void;
  onFileSelected?: (file: File | null) => void; // Callback to pass selected file to parent
}

export function FinancingTypeConfig({ config, onChange, onFileSelected }: FinancingTypeConfigProps) {
  const currentType = config.name ? config : null;

  const [isEditing, setIsEditing] = React.useState(!config.name);
  const [newName, setNewName] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = React.useState<string | null>(null);

  const requestDownloadUrl = useRequestProductImageDownloadUrl();

  // Load image preview using presigned URL when viewing (not editing)
  React.useEffect(() => {
    if (currentType?.s3_key && !isEditing) {
      // Fetch presigned download URL for display
      requestDownloadUrl.mutateAsync({ s3Key: currentType.s3_key })
        .then(result => {
          setImageUrl(result.downloadUrl);
        })
        .catch(error => {
          console.error("Failed to load image:", error);
          setImageUrl(null);
        });
    } else {
      setImageUrl(null);
    }
  }, [currentType?.s3_key, isEditing]);

  React.useEffect(() => {
    if (currentType && isEditing) {
      setNewName(currentType.name || "");
      setNewDescription(currentType.description || "");
      setNewCategory(currentType.category || "");
      // Don't clear selectedFile here - it might be a pending file waiting for upload
      // Only clear if we're starting fresh (no pending file notification from parent)
      // The file will be cleared when product is saved or dialog is cancelled
    }
  }, [currentType, isEditing]);

  // Notify parent when file is selected/deselected
  React.useEffect(() => {
    if (onFileSelected) {
      onFileSelected(selectedFile);
    }
  }, [selectedFile, onFileSelected]);

  // Handle file selection and create preview using FileReader
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type", {
        description: "Please select an image file (JPEG, PNG, WebP, or GIF)",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", {
        description: "Please select an image smaller than 5MB",
      });
      return;
    }

    setSelectedFile(file);
    // Clear existing S3 key when new file is selected (file will be uploaded later)

    // Create preview using FileReader (data URL) instead of blob URL for CSP compatibility
    const reader = new FileReader();
    reader.onload = () => {
      setUploadPreview(reader.result as string);
    };
    reader.onerror = () => {
      toast.error("Failed to load image preview");
      setUploadPreview(null);
    };
    reader.readAsDataURL(file);
  };

  // Save financing type - image will be uploaded when product is saved
  const saveFinancingType = () => {
    if (!newName.trim() || !newCategory.trim()) return;

    // Save the financing type config WITHOUT S3 key
    // S3 key will be added when product is saved (after image upload)
    onChange({
      ...config,
      name: newName.trim(),
      description: newDescription.trim() || "",
      category: newCategory.trim(),
      // Keep existing s3_key if no new file selected, otherwise it will be set after upload
      s3_key: selectedFile ? undefined : config.s3_key,
    });

    setIsEditing(false);
    // Only reset form fields, but KEEP the selected file (it will be uploaded when product is saved)
    setNewName("");
    setNewDescription("");
    setNewCategory("");
    // DO NOT clear selectedFile or uploadPreview - keep them for upload on product save
    // DO NOT call onFileSelected(null) - keep the file in pendingFilesRef
  };

  const resetForm = () => {
    setNewName("");
    setNewDescription("");
    setNewCategory("");
    setSelectedFile(null);
    setUploadPreview(null);
    // Notify parent that file is cleared (only when explicitly resetting, not on save)
    if (onFileSelected) {
      onFileSelected(null);
    }
  };

  const startEdit = () => {
    if (currentType) {
      setNewName(currentType.name || "");
      setNewDescription(currentType.description || "");
      setNewCategory(currentType.category || "");
      setSelectedFile(null);
      setUploadPreview(null);
    }
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    resetForm();
  };

  const removeFinancingType = () => {
    onChange({
      ...config,
      name: undefined,
      description: undefined,
      category: undefined,
      s3_key: undefined,
    });
    setIsEditing(true);
    resetForm();
  };

  return (
    <div className="space-y-4">
      {!isEditing && currentType ? (
        <div className="relative p-3 sm:p-4 rounded-lg border bg-card">
          <div className="flex items-start gap-4">
            {imageUrl ? (
              <div className="h-14 w-14 rounded-lg bg-background border flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img
                  src={imageUrl}
                  alt={currentType.name}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : currentType.s3_key ? (
              <div className="h-14 w-14 rounded-lg bg-background border flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-muted-foreground">Loading...</span>
              </div>
            ) : null}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm sm:text-base mb-1.5 flex items-center gap-2 flex-wrap">
                {currentType.name}
                {currentType.category && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-xs font-medium">
                    {currentType.category}
                  </span>
                )}
              </h4>
              {currentType.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {currentType.description}
                </p>
              )}
            </div>
          </div>
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={startEdit}
              className="h-8 w-8 p-0"
              title="Update"
            >
              <PencilIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeFinancingType}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Remove"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
          <div className="p-3 sm:p-5 rounded-lg border bg-card">
          <div className="mb-4 sm:mb-5">
            <Label className="text-sm sm:text-base font-semibold">
              {currentType ? "Update Financing Type" : "Add Financing Type"}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentType ? "Modify the product type details below" : "Configure the financing product details"}
            </p>
          </div>
          
          <div className="space-y-4 sm:space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newName" className="text-sm font-medium">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="newName"
                  placeholder="e.g., Account Receivable (AR) Financing"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-10 !text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Main product name shown to borrowers
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newCategory" className="text-sm font-medium">
                  Product Category <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="newCategory"
                  placeholder="e.g., Invoice Financing (Islamic)"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="h-10 !text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Category classification
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productImage" className="text-sm font-medium">
                Product Image <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </Label>
              
              {/* File Input */}
              <Input
                id="productImage"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={handleFileSelect}
                className="h-10 !text-sm"
              />
              
              {/* Preview - Image will be uploaded when you save the product */}
              {selectedFile && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                    {uploadPreview && (
                      <div className="h-16 w-16 rounded-lg bg-background border flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img
                          src={uploadPreview}
                          alt="Preview"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/*// Show existing S3 key if editing
              {currentType?.s3_key && !selectedFile && (
                <p className="text-xs text-muted-foreground">
                  Current image: <code className="bg-muted px-1 rounded">{currentType.s3_key}</code>
                </p>
              )} */}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newDescription" className="text-sm font-medium">
                Product Description <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </Label>
              <Textarea
                id="newDescription"
                placeholder="Describe what this financing product is for and who it's suitable for..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="min-h-[100px] text-sm"
              />
            </div>
            
            <div className="flex gap-3 pt-3 border-t">
              <Button
                type="button"
                onClick={saveFinancingType}
                disabled={!newName.trim() || !newCategory.trim()}
                className="flex-1"
              >
                {currentType ? (
                  <>
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
              {currentType && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEdit}
                  className="px-6"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
