import { ListToolbar, ListToolbarFilterTrigger, type FilterChip } from "@cashsouk/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const ONBOARDED_LABELS: Record<string, string> = {
  completed: "Completed",
  not_completed: "Not completed",
};

interface UsersTableToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  investorOnboardedFilter: string;
  onInvestorOnboardedFilterChange: (value: string) => void;
  issuerOnboardedFilter: string;
  onIssuerOnboardedFilterChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
  onClearFilters: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function UsersTableToolbar({
  searchQuery,
  onSearchChange,
  roleFilter: _roleFilter,
  investorOnboardedFilter,
  onInvestorOnboardedFilterChange,
  issuerOnboardedFilter,
  onIssuerOnboardedFilterChange,
  totalCount,
  filteredCount,
  onClearFilters,
  onRefresh,
  isLoading = false,
}: UsersTableToolbarProps) {
  const hasFilters =
    searchQuery !== "" ||
    investorOnboardedFilter !== "all" ||
    issuerOnboardedFilter !== "all";

  const activeFilterCount = [
    investorOnboardedFilter !== "all",
    issuerOnboardedFilter !== "all",
  ].filter(Boolean).length;

  const appliedFilters: FilterChip[] = [];
  if (investorOnboardedFilter !== "all") {
    appliedFilters.push({
      id: "investor-onboarded",
      label: `Investor: ${ONBOARDED_LABELS[investorOnboardedFilter] ?? investorOnboardedFilter}`,
      onRemove: () => onInvestorOnboardedFilterChange("all"),
    });
  }
  if (issuerOnboardedFilter !== "all") {
    appliedFilters.push({
      id: "issuer-onboarded",
      label: `Issuer: ${ONBOARDED_LABELS[issuerOnboardedFilter] ?? issuerOnboardedFilter}`,
      onRemove: () => onIssuerOnboardedFilterChange("all"),
    });
  }

  return (
    <ListToolbar
      searchValue={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by name, email, or User ID..."
      appliedFilters={appliedFilters}
      onClearFilters={hasFilters ? onClearFilters : undefined}
      onReload={onRefresh}
      isLoading={isLoading}
      countLabel={`${filteredCount} ${filteredCount === 1 ? "user" : "users"}${
        hasFilters ? ` of ${totalCount}` : ""
      }`}
      filterGroups={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ListToolbarFilterTrigger label="Filters" count={activeFilterCount} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Investor onboarded</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={investorOnboardedFilter}
              onValueChange={onInvestorOnboardedFilterChange}
            >
              <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="completed">Completed</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="not_completed">Not completed</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Issuer onboarded</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={issuerOnboardedFilter}
              onValueChange={onIssuerOnboardedFilterChange}
            >
              <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="completed">Completed</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="not_completed">Not completed</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
}
