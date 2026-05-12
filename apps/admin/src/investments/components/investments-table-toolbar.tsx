import { NoteInvestmentStatus } from "@cashsouk/types";
import { ListToolbar } from "@/shared/admin-list/components/list-toolbar";

const STATUS_LABEL: Record<string, string> = {
  COMMITTED: "Committed",
  CONFIRMED: "Confirmed",
  RELEASED: "Released",
  CANCELLED: "Cancelled",
  SETTLED: "Settled",
};

interface InvestmentsTableToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onClearFilters: () => void;
  onReload: () => void;
  totalCount: number;
  isLoading: boolean;
}

export function InvestmentsTableToolbar({
  searchQuery,
  onSearchChange,
  status,
  onStatusChange,
  onClearFilters,
  onReload,
  totalCount,
  isLoading,
}: InvestmentsTableToolbarProps) {
  const statusFilters = status === "ALL" ? [] : [status];

  const handleStatusFiltersChange = (values: string[]) => {
    onStatusChange(values[0] ?? "ALL");
  };

  return (
    <ListToolbar
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by note title, reference, investor org, or investor user"
      statusFilters={statusFilters}
      onStatusFiltersChange={handleStatusFiltersChange}
      statusOptions={Object.values(NoteInvestmentStatus).map((value) => ({
        value,
        label: STATUS_LABEL[value] ?? value,
      }))}
      statusFilterMode="single"
      totalCount={totalCount}
      filteredCount={totalCount}
      itemLabelSingular="investment"
      itemLabelPlural="investments"
      onClearFilters={onClearFilters}
      onReload={onReload}
      isLoading={isLoading}
    />
  );
}
