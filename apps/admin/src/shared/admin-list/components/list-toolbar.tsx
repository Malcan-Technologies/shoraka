import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface ListStatusOption {
  value: string;
  label: string;
}

interface ListToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  statusFilters: string[];
  onStatusFiltersChange: (values: string[]) => void;
  statusOptions: readonly ListStatusOption[];
  totalCount: number;
  filteredCount: number;
  itemLabelSingular: string;
  itemLabelPlural: string;
  onClearFilters: () => void;
  onReload?: () => void;
  isLoading?: boolean;
}

export function ListToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  statusFilters,
  onStatusFiltersChange,
  statusOptions,
  totalCount,
  filteredCount,
  itemLabelSingular,
  itemLabelPlural,
  onClearFilters,
  onReload,
  isLoading = false,
}: ListToolbarProps) {
  const [isSpinning, setIsSpinning] = React.useState(false);

  const hasFilters = searchQuery !== "" || statusFilters.length > 0;
  const activeFilterCount = statusFilters.length;

  const handleReload = () => {
    setIsSpinning(true);
    onReload?.();
    setTimeout(() => setIsSpinning(false), 500);
  };

  const handleStatusToggle = (status: string) => {
    if (statusFilters.includes(status)) {
      onStatusFiltersChange(statusFilters.filter((item) => item !== status));
      return;
    }
    onStatusFiltersChange([...statusFilters, status]);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-11 rounded-xl"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 h-11 rounded-xl">
            <FunnelIcon className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-primary text-primary-foreground"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={statusFilters.length === 0}
            onCheckedChange={() => onStatusFiltersChange([])}
          >
            All Statuses
          </DropdownMenuCheckboxItem>
          {statusOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={statusFilters.includes(option.value)}
              onCheckedChange={() => handleStatusToggle(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasFilters && (
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

      <Badge variant="secondary" className="h-11 px-4 rounded-xl text-sm">
        {filteredCount} {filteredCount === 1 ? itemLabelSingular : itemLabelPlural}
        {hasFilters && ` of ${totalCount}`}
      </Badge>
    </div>
  );
}
