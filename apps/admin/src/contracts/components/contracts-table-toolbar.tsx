import * as React from "react";
import { ListToolbar } from "@/shared/admin-list/components/list-toolbar";

interface ContractsTableToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilters: string[];
  onStatusFiltersChange: (values: string[]) => void;
  totalCount: number;
  filteredCount: number;
  onClearFilters: () => void;
  onReload?: () => void;
  isLoading?: boolean;
}

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "OFFER_SENT", label: "Offer Sent" },
  { value: "AMENDMENT_REQUESTED", label: "Amendment Requested" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;

export function ContractsTableToolbar({
  searchQuery,
  onSearchChange,
  statusFilters,
  onStatusFiltersChange,
  totalCount,
  filteredCount,
  onClearFilters,
  onReload,
  isLoading = false,
}: ContractsTableToolbarProps) {
  return (
    <ListToolbar
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by contract, number, organization..."
      statusFilters={statusFilters}
      onStatusFiltersChange={onStatusFiltersChange}
      statusOptions={STATUS_OPTIONS}
      totalCount={totalCount}
      filteredCount={filteredCount}
      itemLabelSingular="contract"
      itemLabelPlural="contracts"
      onClearFilters={onClearFilters}
      onReload={onReload}
      isLoading={isLoading}
    />
  );
}
