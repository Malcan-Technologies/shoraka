import * as React from "react";
import { ListToolbar } from "@/shared/admin-list/components/list-toolbar";

interface ApplicationsTableToolbarProps {
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
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "CONTRACT_PENDING", label: "Contract Pending" },
  { value: "CONTRACT_SENT", label: "Contract Sent" },
  { value: "CONTRACT_ACCEPTED", label: "Contract Accepted" },
  { value: "INVOICE_PENDING", label: "Invoice Pending" },
  { value: "INVOICES_SENT", label: "Invoices Sent" },
  { value: "AMENDMENT_REQUESTED", label: "Amendment Requested" },
  { value: "RESUBMITTED", label: "Resubmitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
] as const;

export function ApplicationsTableToolbar({
  searchQuery,
  onSearchChange,
  statusFilters,
  onStatusFiltersChange,
  totalCount,
  filteredCount,
  onClearFilters,
  onReload,
  isLoading = false,
}: ApplicationsTableToolbarProps) {
  return (
    <ListToolbar
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by ID or applicant name..."
      statusFilters={statusFilters}
      onStatusFiltersChange={onStatusFiltersChange}
      statusOptions={STATUS_OPTIONS}
      totalCount={totalCount}
      filteredCount={filteredCount}
      itemLabelSingular="application"
      itemLabelPlural="applications"
      onClearFilters={onClearFilters}
      onReload={onReload}
      isLoading={isLoading}
    />
  );
}
