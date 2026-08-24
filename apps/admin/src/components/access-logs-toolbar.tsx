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
import { AccessLogsExportButton } from "./access-logs-export-button";
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
  { value: "USER_COMPLETED", label: "User completed" },
  { value: "ONBOARDING_STATUS_UPDATED", label: "Onboarding status updated" },
  { value: "ONBOARDING_RESET", label: "Onboarding reset" },
  { value: "KYC_STATUS_UPDATED", label: "KYC status updated" },
  { value: "PROFILE_UPDATED", label: "Profile updated" },
];

const DATE_LABELS: Record<string, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

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
}: AccessLogsToolbarProps) {
  const filteredEventTypes = allowedEventTypes
    ? EVENT_TYPE_OPTIONS.filter((opt) => allowedEventTypes.includes(opt.value))
    : EVENT_TYPE_OPTIONS;

  const hasFilters =
    searchQuery !== "" ||
    eventTypeFilter !== "all" ||
    statusFilter !== "all" ||
    dateRangeFilter !== "all";

  const activeFilterCount = [
    eventTypeFilter !== "all",
    statusFilter !== "all",
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
  if (statusFilter !== "all") {
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
      countLabel={`${filteredCount} ${filteredCount === 1 ? "log" : "logs"}${
        hasFilters ? ` of ${totalCount}` : ""
      }`}
      filterGroups={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ListToolbarFilterTrigger label="Filters" count={activeFilterCount} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Event type</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={eventTypeFilter} onValueChange={onEventTypeFilterChange}>
              <DropdownMenuRadioItem value="all">All events</DropdownMenuRadioItem>
              {filteredEventTypes.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={statusFilter} onValueChange={onStatusFilterChange}>
              <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="success">Success</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="failed">Failed</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Date range</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={dateRangeFilter} onValueChange={onDateRangeFilterChange}>
              <DropdownMenuRadioItem value="all">All time</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="24h">Last 24 hours</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="7d">Last 7 days</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="30d">Last 30 days</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {exportFilters ? <AccessLogsExportButton filters={exportFilters} /> : null}
    </ListToolbar>
  );
}
