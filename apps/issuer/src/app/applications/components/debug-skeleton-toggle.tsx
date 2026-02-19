"use client";

/** Debug Skeleton Toggle
 *
 * What: Button to toggle skeleton preview mode on/off
 * Why: Easy visual testing of loading states across steps
 * Data: Boolean flag to show/hide skeleton
 */
import { Button } from "@/components/ui/button";
import React from "react";

interface DebugSkeletonToggleProps {
  isSkeletonMode: boolean;
  onToggle: (enabled: boolean) => void;
}

export function DebugSkeletonToggle({ isSkeletonMode, onToggle }: DebugSkeletonToggleProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={() => onToggle(!isSkeletonMode)}
        className={`text-sm font-medium transition-all ${
          isSkeletonMode
            ? "bg-yellow-500 hover:bg-yellow-600 text-black"
            : "bg-slate-700 hover:bg-slate-800 text-white"
        }`}
      >
        {isSkeletonMode ? "🔄 Hide Skeleton" : "⚙️ Show Skeleton Debug"}
      </Button>
    </div>
  );
}
