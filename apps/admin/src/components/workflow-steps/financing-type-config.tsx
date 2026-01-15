"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline";
import { useImageViewUrl } from "@/hooks/use-image-upload";
import { toast } from "sonner";

const pendingFiles = new Map<string, { file: File; financingTypeName: string }>();

export function getPendingFiles() {
  return pendingFiles;
}

export function clearPendingFile(fileId: string) {
  pendingFiles.delete(fileId);
}

interface FinancingTypeConfig {
  type?: {
    name: string;
    description: string;
    category?: string;
    s3_key?: string;
    _pendingFileId?: string;
  };
}

interface FinancingTypeConfigProps {
  config: FinancingTypeConfig;
  onChange: (config: FinancingTypeConfig) => void;
}

export function FinancingTypeConfig({ config, onChange }: FinancingTypeConfigProps) {
  const currentType = config.type || null;

  const [isEditing, setIsEditing] = React.useState(!currentType);
  const [newName, setNewName] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

  const imageUrl = useImageViewUrl(currentType?.s3_key);
  const editImageUrl = useImageViewUrl(isEditing ? currentType?.s3_key : null);

  React.useEffect(() => {
    if (currentType && isEditing) {
      setNewName(currentType.name);
      setNewDescription(currentType.description || "");
      setNewCategory(currentType.category || "");
      setSelectedFile(null);
    }
  }, [currentType, isEditing]);

  const saveFinancingType = async () => {
    if (!newName.trim() || !newCategory.trim()) return;

    let pendingFileId: string | undefined;
    if (selectedFile) {
      pendingFileId = `pending_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      pendingFiles.set(pendingFileId, {
        file: selectedFile,
        financingTypeName: newName.trim(),
      });
    }

    onChange({
      ...config,
      type: {
        name: newName.trim(),
        description: newDescription.trim() || "",
        category: newCategory.trim(),
        s3_key: currentType?.s3_key || "",
        _pendingFileId: pendingFileId,
      },
    });

    setIsEditing(false);
    resetForm();
  };

  const resetForm = () => {
    setNewName("");
    setNewDescription("");
    setNewCategory("");
    setSelectedFile(null);
  };

  const startEdit = () => {
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    resetForm();
  };

  const removeFinancingType = () => {
    onChange({
      ...config,
      type: undefined,
    });
    setIsEditing(true);
    resetForm();
  };

  return (
    <div className="space-y-4">
      {!isEditing && currentType ? (
        <div className="relative p-3 sm:p-4 rounded-lg border bg-card">
          <div className="flex items-start gap-4">
            {currentType.s3_key && (
              <div className="h-14 w-14 rounded-lg bg-background border flex items-center justify-center flex-shrink-0">
                {imageUrl.isLoading ? (
                  <div className="h-10 w-10 animate-pulse bg-muted rounded" />
                ) : imageUrl.data ? (
                  <img
                    src={imageUrl.data}
                    alt={currentType.name}
                    className="h-10 w-10 object-contain"
                  />
                ) : null}
              </div>
            )}
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
              <Label className="text-sm font-medium">
                Product Image <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </Label>
              {currentType?.s3_key && !selectedFile && (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                  <div className="h-14 w-14 rounded-lg bg-background border flex items-center justify-center flex-shrink-0">
                    {editImageUrl.isLoading ? (
                      <div className="h-10 w-10 animate-pulse bg-muted rounded" />
                    ) : editImageUrl.data ? (
                      <img
                        src={editImageUrl.data}
                        alt={currentType.name}
                        className="h-10 w-10 object-contain"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Current image</p>
                    <p className="text-xs text-muted-foreground">Upload a new picture to replace it</p>
                  </div>
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setSelectedFile(null);
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error("File too large", {
                      description: "Maximum file size is 5MB",
                    });
                    e.target.value = "";
                    return;
                  }
                  setSelectedFile(file);
                }}
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  New file: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
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
