import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface ProductsTableToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
  onReload?: () => void;
  isLoading?: boolean;
}

export function ProductsTableToolbar({
  searchQuery,
  onSearchChange,
  onClearFilters,
  onReload,
  isLoading = false,
}: ProductsTableToolbarProps) {
  const [isSpinning, setIsSpinning] = React.useState(false);

  const hasActiveFilters = searchQuery !== "";

  const handleReload = () => {
    setIsSpinning(true);
    onReload?.();
    setTimeout(() => setIsSpinning(false), 500);
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by title or description..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-11 rounded-xl"
        />
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" onClick={onClearFilters} className="gap-2 h-11 rounded-xl">
          <XMarkIcon className="h-4 w-4" />
          Clear
        </Button>
      )}

      {onReload && (
        <Button
          variant="outline"
          onClick={handleReload}
          disabled={isLoading || isSpinning}
          className="gap-2 h-11 rounded-xl"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isLoading || isSpinning ? "animate-spin" : ""}`} />
          Reload
        </Button>
      )}
    </div>
  );
}