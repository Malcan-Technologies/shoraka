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
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface UsersTableToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  kycFilter: string;
  onKycFilterChange: (value: string) => void;
  investorOnboardedFilter: string;
  onInvestorOnboardedFilterChange: (value: string) => void;
  issuerOnboardedFilter: string;
  onIssuerOnboardedFilterChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
  onClearFilters: () => void;
  onReload?: () => void;
  isLoading?: boolean;
}

export function UsersTableToolbar({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  kycFilter,
  onKycFilterChange,
  investorOnboardedFilter,
  onInvestorOnboardedFilterChange,
  issuerOnboardedFilter,
  onIssuerOnboardedFilterChange,
  totalCount,
  filteredCount,
  onClearFilters,
  onReload,
  isLoading = false,
}: UsersTableToolbarProps) {
  const [isSpinning, setIsSpinning] = React.useState(false);

  const hasFilters =
    searchQuery !== "" ||
    roleFilter !== "all" ||
    kycFilter !== "all" ||
    investorOnboardedFilter !== "all" ||
    issuerOnboardedFilter !== "all";

  const activeFilterCount = [
    roleFilter !== "all",
    kycFilter !== "all",
    investorOnboardedFilter !== "all",
    issuerOnboardedFilter !== "all",
  ].filter(Boolean).length;

  const handleReload = () => {
    setIsSpinning(true);
    onReload?.();
    // Keep spinning for at least 500ms for visual feedback
    setTimeout(() => setIsSpinning(false), 500);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or User ID..."
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
          <DropdownMenuLabel>Role</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={roleFilter} onValueChange={onRoleFilterChange}>
            <DropdownMenuRadioItem value="all">All Roles</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="INVESTOR">Investor</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ISSUER">Issuer</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ADMIN">Admin</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>KYC Status</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={kycFilter} onValueChange={onKycFilterChange}>
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="verified">Verified</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="not_verified">Not Verified</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Investor Onboarded</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={investorOnboardedFilter}
            onValueChange={onInvestorOnboardedFilterChange}
          >
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="completed">Completed</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="not_completed">Not Completed</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Issuer Onboarded</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={issuerOnboardedFilter}
            onValueChange={onIssuerOnboardedFilterChange}
          >
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="completed">Completed</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="not_completed">Not Completed</DropdownMenuRadioItem>
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
        {filteredCount} {filteredCount === 1 ? "user" : "users"}
        {hasFilters && ` of ${totalCount}`}
      </Badge>
    </div>
  );
}
