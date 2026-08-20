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

const TYPE_LABELS: Record<string, string> = {
  PERSONAL: "Personal",
  COMPANY: "Company",
};

const ONBOARDING_LABELS: Record<string, string> = {
  PENDING: "Not started",
  IN_PROGRESS: "In progress",
  PENDING_SSM_REVIEW: "Pending SSM",
  PENDING_APPROVAL: "Pending approval",
  PENDING_AML: "Pending AML",
  PENDING_AMENDMENT: "Amendment in progress",
  PENDING_FINAL_APPROVAL: "Pending final approval",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

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
  onRefresh?: () => void;
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
  onRefresh,
  isLoading = false,
}: OrganizationsTableToolbarProps) {
  const hasFilters =
    searchQuery !== "" || typeFilter !== "all" || onboardingStatusFilter !== "all";

  const activeFilterCount = [typeFilter !== "all", onboardingStatusFilter !== "all"].filter(
    Boolean
  ).length;

  const appliedFilters: FilterChip[] = [];
  if (typeFilter !== "all") {
    appliedFilters.push({
      id: "type",
      label: `Type: ${TYPE_LABELS[typeFilter] ?? typeFilter}`,
      onRemove: () => onTypeFilterChange("all"),
    });
  }
  if (onboardingStatusFilter !== "all") {
    appliedFilters.push({
      id: "onboarding",
      label: `Onboarding: ${ONBOARDING_LABELS[onboardingStatusFilter] ?? onboardingStatusFilter}`,
      onRemove: () => onOnboardingStatusFilterChange("all"),
    });
  }

  return (
    <ListToolbar
      searchValue={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by name, reference, registration number, or owner..."
      appliedFilters={appliedFilters}
      onClearFilters={hasFilters ? onClearFilters : undefined}
      onReload={onRefresh}
      isLoading={isLoading}
      countLabel={`${filteredCount} ${
        filteredCount === 1 ? "organization" : "organizations"
      }${hasFilters ? ` of ${totalCount}` : ""}`}
      filterGroups={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ListToolbarFilterTrigger label="Filters" count={activeFilterCount} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Type</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={typeFilter} onValueChange={onTypeFilterChange}>
              <DropdownMenuRadioItem value="all">All types</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="PERSONAL">Personal</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="COMPANY">Company</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Onboarding status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={onboardingStatusFilter}
              onValueChange={onOnboardingStatusFilterChange}
            >
              <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="PENDING">Not started</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="IN_PROGRESS">In progress</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="PENDING_SSM_REVIEW">Pending SSM</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="PENDING_APPROVAL">Pending approval</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="PENDING_AML">Pending AML</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="PENDING_AMENDMENT">
                Amendment in progress
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="PENDING_FINAL_APPROVAL">
                Pending final approval
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="COMPLETED">Completed</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="REJECTED">Rejected</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
}
