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

interface OrganizationsTableToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  onboardingStatusFilter: string;
  onOnboardingStatusFilterChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
  onClearFilters: () => void;
  onReload?: () => void;
  isLoading?: boolean;
}

export function OrganizationsTableToolbar({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  onboardingStatusFilter,
  onOnboardingStatusFilterChange,
  totalCount,
  filteredCount,
  onClearFilters,
  onReload,
  isLoading = false,
}: OrganizationsTableToolbarProps) {
  const [isSpinning, setIsSpinning] = React.useState(false);

  const hasFilters =
    searchQuery !== "" ||
    typeFilter !== "all" ||
    onboardingStatusFilter !== "all";

  const activeFilterCount = [
    typeFilter !== "all",
    onboardingStatusFilter !== "all",
  ].filter(Boolean).length;

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
          placeholder="Search by name, registration number, or owner..."
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
          <DropdownMenuLabel>Type</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={typeFilter} onValueChange={onTypeFilterChange}>
            <DropdownMenuRadioItem value="all">All Types</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="PERSONAL">Personal</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="COMPANY">Company</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Onboarding Status</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={onboardingStatusFilter}
            onValueChange={onOnboardingStatusFilterChange}
          >
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="COMPLETED">Completed</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="PENDING">Not Started</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="IN_PROGRESS">In Progress</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="PENDING_APPROVAL">Pending Approval</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="PENDING_AML">Pending AML</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="PENDING_SSM_REVIEW">Pending SSM Review</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="PENDING_FINAL_APPROVAL">Pending Final Approval</DropdownMenuRadioItem>
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
        {filteredCount} {filteredCount === 1 ? "organization" : "organizations"}
        {hasFilters && ` of ${totalCount}`}
      </Badge>
    </div>
  );
}

