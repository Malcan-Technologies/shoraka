import { ListToolbar, type FilterChip } from "@cashsouk/ui";
import { AccessLogsExportButton } from "./access-logs-export-button";
import {
  AUDIT_DATE_RANGE_OPTIONS,
  AuditLogDateRangeOptions,
  AuditLogFilterOption,
  AuditLogFilterSection,
  AuditLogFilters,
} from "@/components/audit/audit-log-filters";
import { auditRecordCountLabel } from "@/components/audit/audit-log-shell";
import type { ExportAccessLogsParams, EventType, SecurityEventType } from "@cashsouk/types";

// Shared toolbar for both the access_logs and security_logs panels — labels cover the union
// of both tables' event types; each panel narrows the visible options via `allowedEventTypes`.
type ToolbarEventType = EventType | SecurityEventType;

const EVENT_TYPE_OPTIONS: { value: ToolbarEventType; label: string }[] = [
  { value: "LOGIN", label: "Login" },
  { value: "LOGOUT", label: "Logout" },
  { value: "SIGNUP", label: "Sign Up" },
  { value: "PASSWORD_CHANGED", label: "Password changed" },
  { value: "EMAIL_CHANGED", label: "Email changed" },
  { value: "ROLE_ADDED", label: "Role added" },
  { value: "ROLE_REMOVED", label: "Role removed" },
  { value: "ROLE_SWITCHED", label: "Role switched" },
  { value: "ROLE_CREATED", label: "Role created" },
  { value: "ROLE_PERMISSIONS_UPDATED", label: "Role permissions updated" },
  { value: "INVITATION_REVOKED", label: "Invitation revoked" },
  { value: "PLATFORM_FINANCE_SETTINGS_UPDATED", label: "Platform finance settings updated" },
  { value: "ONBOARDING_STATUS_UPDATED", label: "Onboarding status updated" },
  { value: "ONBOARDING_RESET", label: "Onboarding reset" },
  { value: "KYC_STATUS_UPDATED", label: "KYC status updated" },
  { value: "PROFILE_UPDATED", label: "Profile updated" },
];

const DATE_LABELS = Object.fromEntries(
  AUDIT_DATE_RANGE_OPTIONS.map((option) => [option.value, option.label])
);

const STATUS_LABELS: Record<string, string> = {
  success: "Success",
  failed: "Failed",
};

interface AccessLogsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  eventTypeFilter: string;
  onEventTypeFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  dateRangeFilter: string;
  onDateRangeFilterChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
  onClearFilters: () => void;
  exportFilters?: Omit<
    ExportAccessLogsParams,
    "format" | "page" | "pageSize" | "eventType" | "eventTypes"
  > & {
    eventType?: ToolbarEventType;
    eventTypes?: ToolbarEventType[];
  };
  onRefresh?: () => void;
  isLoading?: boolean;
  allowedEventTypes?: ToolbarEventType[];
  exportKind?: "access" | "security";
  showStatusFilter?: boolean;
}

export function AccessLogsToolbar({
  searchQuery,
  onSearchChange,
  eventTypeFilter,
  onEventTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  totalCount,
  filteredCount,
  onClearFilters,
  exportFilters,
  onRefresh,
  isLoading = false,
  allowedEventTypes,
  exportKind = "access",
  showStatusFilter = true,
}: AccessLogsToolbarProps) {
  const filteredEventTypes = allowedEventTypes
    ? EVENT_TYPE_OPTIONS.filter((opt) => allowedEventTypes.includes(opt.value))
    : EVENT_TYPE_OPTIONS;

  const hasFilters =
    searchQuery !== "" ||
    eventTypeFilter !== "all" ||
    (showStatusFilter && statusFilter !== "all") ||
    dateRangeFilter !== "all";

  const activeFilterCount = [
    eventTypeFilter !== "all",
    showStatusFilter && statusFilter !== "all",
    dateRangeFilter !== "all",
  ].filter(Boolean).length;

  const appliedFilters: FilterChip[] = [];
  if (eventTypeFilter !== "all") {
    appliedFilters.push({
      id: "event",
      label: `Event: ${
        EVENT_TYPE_OPTIONS.find((opt) => opt.value === eventTypeFilter)?.label ?? eventTypeFilter
      }`,
      onRemove: () => onEventTypeFilterChange("all"),
    });
  }
  if (showStatusFilter && statusFilter !== "all") {
    appliedFilters.push({
      id: "status",
      label: `Status: ${STATUS_LABELS[statusFilter] ?? statusFilter}`,
      onRemove: () => onStatusFilterChange("all"),
    });
  }
  if (dateRangeFilter !== "all") {
    appliedFilters.push({
      id: "date",
      label: DATE_LABELS[dateRangeFilter] ?? dateRangeFilter,
      onRemove: () => onDateRangeFilterChange("all"),
    });
  }

  return (
    <ListToolbar
      searchValue={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by user name, email, or User ID..."
      appliedFilters={appliedFilters}
      onClearFilters={hasFilters ? onClearFilters : undefined}
      onReload={onRefresh}
      isLoading={isLoading}
      countLabel={auditRecordCountLabel(filteredCount || totalCount)}
      filterGroups={
        <AuditLogFilters activeCount={activeFilterCount}>
          <AuditLogFilterSection title="Event">
            <AuditLogFilterOption
              selected={eventTypeFilter === "all"}
              onSelect={() => onEventTypeFilterChange("all")}
            >
              All events
            </AuditLogFilterOption>
            {filteredEventTypes.map((opt) => (
              <AuditLogFilterOption
                key={opt.value}
                selected={eventTypeFilter === opt.value}
                onSelect={() => onEventTypeFilterChange(opt.value)}
              >
                {opt.label}
              </AuditLogFilterOption>
            ))}
          </AuditLogFilterSection>
          {showStatusFilter ? (
            <AuditLogFilterSection title="Status">
              <AuditLogFilterOption
                selected={statusFilter === "all"}
                onSelect={() => onStatusFilterChange("all")}
              >
                All
              </AuditLogFilterOption>
              <AuditLogFilterOption
                selected={statusFilter === "success"}
                onSelect={() => onStatusFilterChange("success")}
              >
                Success
              </AuditLogFilterOption>
              <AuditLogFilterOption
                selected={statusFilter === "failed"}
                onSelect={() => onStatusFilterChange("failed")}
              >
                Failed
              </AuditLogFilterOption>
            </AuditLogFilterSection>
          ) : null}
          <AuditLogDateRangeOptions value={dateRangeFilter} onChange={onDateRangeFilterChange} />
        </AuditLogFilters>
      }
    >
      {exportFilters ? <AccessLogsExportButton filters={exportFilters} kind={exportKind} /> : null}
    </ListToolbar>
  );
}
