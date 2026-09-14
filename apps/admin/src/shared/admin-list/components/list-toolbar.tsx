import {
  ListToolbar as SharedListToolbar,
  ListToolbarFilterTrigger,
  type FilterChip,
} from "@cashsouk/ui";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

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
  statusFilterMode?: "multi" | "single";
  totalCount: number;
  filteredCount: number;
  itemLabelSingular: string;
  itemLabelPlural: string;
  onClearFilters: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  extraToggleLabel?: string;
  extraToggleChecked?: boolean;
  onExtraToggleChange?: (checked: boolean) => void;
  secondaryFilterLabel?: string;
  secondaryFilters?: string[];
  onSecondaryFiltersChange?: (values: string[]) => void;
  secondaryOptions?: readonly ListStatusOption[];
}

export function ListToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  statusFilters,
  onStatusFiltersChange,
  statusOptions,
  statusFilterMode = "multi",
  totalCount,
  filteredCount,
  itemLabelSingular,
  itemLabelPlural,
  onClearFilters,
  onRefresh,
  isLoading = false,
  extraToggleLabel,
  extraToggleChecked = false,
  onExtraToggleChange,
  secondaryFilterLabel,
  secondaryFilters = [],
  onSecondaryFiltersChange,
  secondaryOptions = [],
}: ListToolbarProps) {
  const hasExtraToggle = Boolean(extraToggleLabel && onExtraToggleChange);
  const hasSecondaryFilter = Boolean(secondaryFilterLabel && onSecondaryFiltersChange);
  const hasFilters =
    searchQuery !== "" ||
    statusFilters.length > 0 ||
    secondaryFilters.length > 0 ||
    (hasExtraToggle && extraToggleChecked);
  const activeFilterCount =
    statusFilters.length +
    secondaryFilters.length +
    (hasExtraToggle && extraToggleChecked ? 1 : 0);

  const handleStatusToggle = (status: string) => {
    if (statusFilterMode === "single") {
      onStatusFiltersChange(statusFilters.includes(status) ? [] : [status]);
      return;
    }

    if (statusFilters.includes(status)) {
      onStatusFiltersChange(statusFilters.filter((item) => item !== status));
      return;
    }
    onStatusFiltersChange([...statusFilters, status]);
  };

  const appliedFilters: FilterChip[] = statusFilters.map((value) => ({
    id: `status-${value}`,
    label: `Status: ${statusOptions.find((option) => option.value === value)?.label ?? value}`,
    onRemove: () => handleStatusToggle(value),
  }));
  if (hasExtraToggle && extraToggleChecked && extraToggleLabel) {
    appliedFilters.push({
      id: "extra",
      label: extraToggleLabel,
      onRemove: () => onExtraToggleChange?.(false),
    });
  }
  if (hasSecondaryFilter) {
    for (const value of secondaryFilters) {
      appliedFilters.push({
        id: `secondary-${value}`,
        label: `${secondaryFilterLabel}: ${
          secondaryOptions.find((option) => option.value === value)?.label ?? value
        }`,
        onRemove: () =>
          onSecondaryFiltersChange?.(secondaryFilters.filter((item) => item !== value)),
      });
    }
  }

  return (
    <SharedListToolbar
      searchValue={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      appliedFilters={appliedFilters}
      onClearFilters={hasFilters ? onClearFilters : undefined}
      onReload={onRefresh}
      isLoading={isLoading}
      countLabel={`${filteredCount} ${
        filteredCount === 1 ? itemLabelSingular : itemLabelPlural
      }${hasFilters ? ` of ${totalCount}` : ""}`}
      filterGroups={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ListToolbarFilterTrigger label="Filters" count={activeFilterCount} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={statusFilters.length === 0}
              onCheckedChange={() => onStatusFiltersChange([])}
            >
              All statuses
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
            {hasSecondaryFilter ? (
              <>
                <DropdownMenuLabel>{secondaryFilterLabel}</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={secondaryFilters.length === 0}
                  onCheckedChange={() => onSecondaryFiltersChange?.([])}
                >
                  All
                </DropdownMenuCheckboxItem>
                {secondaryOptions.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={secondaryFilters.includes(option.value)}
                    onCheckedChange={() =>
                      onSecondaryFiltersChange?.(
                        secondaryFilters.includes(option.value) ? [] : [option.value]
                      )
                    }
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            ) : null}
            {hasExtraToggle ? (
              <DropdownMenuCheckboxItem
                checked={extraToggleChecked}
                onCheckedChange={(checked) => {
                  onExtraToggleChange?.(Boolean(checked));
                }}
              >
                {extraToggleLabel}
              </DropdownMenuCheckboxItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
}
