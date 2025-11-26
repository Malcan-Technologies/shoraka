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
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";

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
}: AccessLogsToolbarProps) {
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

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by user name or email..."
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
          <DropdownMenuLabel>Event Type</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={eventTypeFilter} onValueChange={onEventTypeFilterChange}>
            <DropdownMenuRadioItem value="all">All Events</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="LOGIN">Login</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="LOGOUT">Logout</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="SIGNUP">Signup</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ROLE_ADDED">Role Added</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ROLE_SWITCHED">Role Switched</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ONBOARDING_COMPLETED">
              Onboarding Completed
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={statusFilter} onValueChange={onStatusFilterChange}>
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="success">Success</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="failed">Failed</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Date Range</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={dateRangeFilter} onValueChange={onDateRangeFilterChange}>
            <DropdownMenuRadioItem value="all">All Time</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="24h">Last 24 Hours</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="7d">Last 7 Days</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="30d">Last 30 Days</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasFilters && (
        <Button variant="ghost" onClick={onClearFilters} className="gap-2 h-11 rounded-xl">
          <XMarkIcon className="h-4 w-4" />
          Clear
        </Button>
      )}

      <Badge variant="secondary" className="h-11 px-4 rounded-xl text-sm">
        {filteredCount} {filteredCount === 1 ? "log" : "logs"}
        {hasFilters && ` of ${totalCount}`}
      </Badge>
    </div>
  );
}
