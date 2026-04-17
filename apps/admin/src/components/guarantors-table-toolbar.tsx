import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import type { GuarantorAmlStatusEnum, GuarantorTypeEnum } from "@cashsouk/types";

interface GuarantorsTableToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  guarantorTypeFilter: "all" | GuarantorTypeEnum;
  onGuarantorTypeFilterChange: (value: string) => void;
  amlStatusFilter: "all" | GuarantorAmlStatusEnum;
  onAmlStatusFilterChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
  onClearFilters: () => void;
  onReload?: () => void;
  isLoading?: boolean;
}

export function GuarantorsTableToolbar({
  searchQuery,
  onSearchChange,
  guarantorTypeFilter,
  onGuarantorTypeFilterChange,
  amlStatusFilter,
  onAmlStatusFilterChange,
  totalCount,
  filteredCount,
  onClearFilters,
  onReload,
  isLoading = false,
}: GuarantorsTableToolbarProps) {
  const [isSpinning, setIsSpinning] = React.useState(false);

  const hasFilters =
    searchQuery !== "" || guarantorTypeFilter !== "all" || amlStatusFilter !== "all";

  const activeFilterCount = [guarantorTypeFilter !== "all", amlStatusFilter !== "all"].filter(Boolean).length;

  const handleReload = () => {
    setIsSpinning(true);
    onReload?.();
    setTimeout(() => setIsSpinning(false), 500);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, IC, or SSM..."
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
          <DropdownMenuLabel>Guarantor Type</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={guarantorTypeFilter}
            onValueChange={onGuarantorTypeFilterChange}
          >
            <DropdownMenuRadioItem value="all">All Types</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="individual">Individual</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="company">Company</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>AML Status</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={amlStatusFilter} onValueChange={onAmlStatusFilterChange}>
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="Approved">Approved</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="Rejected">Rejected</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="Unresolved">Unresolved</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
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
        {filteredCount} {filteredCount === 1 ? "guarantor" : "guarantors"}
        {hasFilters && ` of ${totalCount}`}
      </Badge>
    </div>
  );
}
