"use client";

import * as React from "react";
import { Checkbox } from "@cashsouk/ui";
import { useRequestProductImageDownloadUrl } from "@/hooks/use-product-images";
import { cn } from "@/lib/utils";

interface FinancingTypeCardProps {
  id: string;
  name: string;
  description: string;
  s3Key: string | null;
  isSelected: boolean;
  onSelect: () => void;
}

export function FinancingTypeCard({
  id,
  name,
  description,
  s3Key,
  isSelected,
  onSelect,
}: FinancingTypeCardProps) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const requestDownloadUrl = useRequestProductImageDownloadUrl();

  // Load image if S3 key exists
  React.useEffect(() => {
    if (!s3Key) {
      setImageUrl(null);
      return;
    }

    let cancelled = false;

    const loadImage = async () => {
      try {
        const result = await requestDownloadUrl.mutateAsync({ s3Key });
        if (!cancelled) {
          setImageUrl(result.downloadUrl);
        }
      } catch (error) {
        console.error("Failed to load product image:", error);
        if (!cancelled) {
          setImageUrl(null);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s3Key]);

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border cursor-pointer select-none",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/50"
      )}
      onClick={onSelect}
      style={{ transition: 'none' }}
    >
      {/* Icon/Image */}
      <div className="flex-shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-14 w-14 object-contain rounded-lg"
          />
        ) : (
          <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
            <span className="text-2xl">🌙</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base mb-1">{name}</h3>
            {description ? (
              <p className="text-sm text-muted-foreground line-clamp-2 truncate">
                {description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground line-clamp-2 opacity-0">
                &nbsp;
              </p>
            )}
          </div>

          {/* Selection Indicator - Square Checkbox */}
          <div className="flex-shrink-0">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="rounded-none transition-none [&>span]:transition-none [&>span[data-state]]:transition-none pointer-events-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
