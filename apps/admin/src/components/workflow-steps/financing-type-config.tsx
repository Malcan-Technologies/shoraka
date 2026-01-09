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
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

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

  const [newTitle, setNewTitle] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("");
  const [newImageUrl, setNewImageUrl] = React.useState("");
  const [isNewCategory, setIsNewCategory] = React.useState(false);
  const [customCategory, setCustomCategory] = React.useState("");

  const addFinancingType = () => {
    if (!newTitle.trim() || !newCategory.trim()) return;

    const categoryToUse = isNewCategory ? customCategory.trim() : newCategory;

    const newType = {
      title: newTitle.trim(),
      description: newDescription.trim() || "",
      category: categoryToUse,
      image_url: newImageUrl.trim() || "",
    };

    // Add new category to available categories if it's custom
    const updatedCategories = isNewCategory && customCategory.trim()
      ? [...availableCategories, customCategory.trim()]
      : availableCategories;

    onChange({
      ...config,
      types: [...types, newType],
      availableCategories: updatedCategories,
    });

    setNewTitle("");
    setNewDescription("");
    setNewCategory("");
    setNewImageUrl("");
    setCustomCategory("");
    setIsNewCategory(false);
  };

  const removeFinancingType = (index: number) => {
    onChange({
      ...config,
      types: types.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4 pt-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">
          Configure financing type options
        </p>
        <p className="text-xs text-muted-foreground">
          Add financing types that borrowers can choose from
        </p>
      </div>

      {/* Financing Types List */}
      {types.length > 0 ? (
        <div className="space-y-3">
          {types.map((type, index) => (
            <div
              key={index}
              className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:border-muted-foreground/30 transition-colors group"
            >
              {/* Image thumbnail */}
              {type.image_url && (
                <img
                  src={type.image_url}
                  alt={type.title}
                  className="h-12 w-12 rounded object-cover"
                />
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{type.title}</span>
                  {type.category && (
                    <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                      {type.category}
                    </span>
                  )}
                </div>
                {type.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {type.description}
                  </div>
                )}
              </div>
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFinancingType(index)}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
              >
                <TrashIcon className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <p className="text-xs text-muted-foreground">
            No financing types yet. Add your first financing type below.
          </p>
        </div>
      )}

      {/* Add New Financing Type */}
      <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
        <Label className="text-sm font-medium">Add New Financing Type</Label>
        
        <div className="space-y-3">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="newTitle" className="text-xs text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="newTitle"
              placeholder="e.g., Invoice financing (Islamic)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-9 text-sm bg-background"
            />
          </div>
          
          {/* Category Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="newCategory" className="text-xs text-muted-foreground">
              Category <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2 items-start">
              {!isNewCategory ? (
                <>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger id="newCategory" className="h-9 bg-background">
                      <SelectValue placeholder="Select category" />
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
                    className="h-9 px-3 whitespace-nowrap"
                  >
                    New
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    placeholder="Enter new category"
                    value={customCategory}
                    onChange={(e) => {
                      setCustomCategory(e.target.value);
                      setNewCategory(e.target.value);
                    }}
                    className="h-9 text-sm bg-background"
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
                    className="h-9 px-3"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Image URL */}
          <div className="space-y-1.5">
            <Label htmlFor="newImageUrl" className="text-xs text-muted-foreground">
              Image URL (optional)
            </Label>
            <Input
              id="newImageUrl"
              placeholder="https://example.com/image.jpg"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              className="h-9 text-sm bg-background"
            />
          </div>
          
          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="newDescription" className="text-xs text-muted-foreground">
              Description (optional)
            </Label>
            <Textarea
              id="newDescription"
              placeholder="Brief description of this financing type..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="min-h-[60px] text-xs bg-background"
            />
          </div>
          
          <Button
            type="button"
            onClick={addFinancingType}
            size="sm"
            disabled={!newTitle.trim() || !newCategory.trim()}
            className="w-full"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Financing Type
          </Button>
        </div>
      </div>

      {/* Summary */}
      {types.length > 0 && (
        <div className="pt-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded">
          {types.length} financing type{types.length !== 1 ? 's' : ''} available for borrowers
        </div>
      )}
    </div>
  );
}

