"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline";

interface FinancingTypeConfig {
  types?: Array<{
    title: string;
    description: string;
    category?: string;
    image_url?: string;
  }>;
  availableCategories?: string[];
}

interface FinancingTypeConfigProps {
  config: FinancingTypeConfig;
  onChange: (config: FinancingTypeConfig) => void;
}

export function FinancingTypeConfig({ config, onChange }: FinancingTypeConfigProps) {
  const types = config.types || [];
  const availableCategories = config.availableCategories || ["Financing Invoice", "Trade Finance", "Working Capital"];

  const [isEditing, setIsEditing] = React.useState(types.length === 0);
  const [newTitle, setNewTitle] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("");
  const [newImageUrl, setNewImageUrl] = React.useState("");
  const [isNewCategory, setIsNewCategory] = React.useState(false);
  const [customCategory, setCustomCategory] = React.useState("");

  const currentType = types.length > 0 ? types[0] : null;

  React.useEffect(() => {
    if (currentType && isEditing) {
      setNewTitle(currentType.title);
      setNewDescription(currentType.description || "");
      setNewCategory(currentType.category || "");
      setNewImageUrl(currentType.image_url || "");
    }
  }, [currentType, isEditing]);

  const saveFinancingType = () => {
    if (!newTitle.trim() || !newCategory.trim()) return;

    const categoryToUse = isNewCategory ? customCategory.trim() : newCategory;

    const newType = {
      title: newTitle.trim(),
      description: newDescription.trim() || "",
      category: categoryToUse,
      image_url: newImageUrl.trim() || "",
    };

    const updatedCategories = isNewCategory && customCategory.trim()
      ? [...availableCategories, customCategory.trim()]
      : availableCategories;

    // Always replace with single type - only ONE financing type per product workflow
    onChange({
      ...config,
      types: [newType],
      availableCategories: updatedCategories,
    });

    setIsEditing(false);
    resetForm();
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewCategory("");
    setNewImageUrl("");
    setCustomCategory("");
    setIsNewCategory(false);
  };

  const startEdit = () => {
    if (currentType) {
      setNewTitle(currentType.title);
      setNewDescription(currentType.description || "");
      setNewCategory(currentType.category || "");
      setNewImageUrl(currentType.image_url || "");
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
      types: [],
    });
    setIsEditing(true);
    resetForm();
  };

  return (
    <div className="space-y-4 pt-4">
      {!isEditing && currentType ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Current Product Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startEdit}
                className="h-8"
              >
                <PencilIcon className="h-3 w-3 mr-1.5" />
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removeFinancingType}
                className="h-8 text-destructive hover:text-destructive"
              >
                <TrashIcon className="h-3 w-3 mr-1.5" />
                Remove
              </Button>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-4 rounded-lg border-2 border-primary/20 bg-card">
            {currentType.image_url && (
              <img
                src={currentType.image_url}
                alt={currentType.title}
                className="h-16 w-16 rounded object-cover"
              />
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-base">{currentType.title}</span>
                {currentType.category && (
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">
                    {currentType.category}
                  </span>
                )}
              </div>
              {currentType.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {currentType.description}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4 rounded-lg border-2 border-dashed bg-muted/30">
          <Label className="text-base font-semibold">
            {currentType ? "Edit Product Type" : "Create Product Type"}
          </Label>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newTitle" className="text-sm">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="newTitle"
                placeholder="e.g., Invoice Financing (Islamic)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-10 bg-background"
              />
              <p className="text-xs text-muted-foreground">
                This will be the main product name shown to borrowers
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newCategory" className="text-sm">
                Product Category <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2 items-start">
                {!isNewCategory ? (
                  <>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger id="newCategory" className="h-10 bg-background">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsNewCategory(true)}
                      className="h-10 px-3 whitespace-nowrap"
                    >
                      + Custom
                    </Button>
                  </>
                ) : (
                  <>
                    <Input
                      placeholder="Enter custom category"
                      value={customCategory}
                      onChange={(e) => {
                        setCustomCategory(e.target.value);
                        setNewCategory(e.target.value);
                      }}
                      className="h-10 bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsNewCategory(false);
                        setCustomCategory("");
                        setNewCategory("");
                      }}
                      className="h-10 px-3"
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newImageUrl" className="text-sm">
                Product Image URL <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="newImageUrl"
                placeholder="https://example.com/product-image.jpg"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="h-10 bg-background"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newDescription" className="text-sm">
                Product Description <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Textarea
                id="newDescription"
                placeholder="Describe what this financing product is for and who it's suitable for..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="min-h-[80px] bg-background"
              />
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                onClick={saveFinancingType}
                disabled={!newTitle.trim() || !newCategory.trim()}
                className="flex-1"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                {currentType ? "Update Product" : "Create Product"}
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
