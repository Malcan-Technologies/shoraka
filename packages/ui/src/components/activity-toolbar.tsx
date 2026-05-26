import * as React from "react";
import { Input } from "./input";
import { Button } from "./button";
import { Badge } from "./badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "./dropdown-menu";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { ACTIVITY_DOMAIN_CONFIG, ActivityDomain } from "@cashsouk/types";

const DATE_RANGES = [
  { value: "all", label: "All Time" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
];

interface ActivityToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  availableDomains: ActivityDomain[];
  domainFilters: ActivityDomain[];
  onDomainFiltersChange: (values: ActivityDomain[]) => void;
  dateRangeFilter: string;
  onDateRangeFilterChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
  onClearFilters: () => void;
  onReload?: () => void;
  isLoading?: boolean;
}

export function ActivityToolbar({
  searchQuery,
  onSearchChange,
  availableDomains,
  domainFilters,
  onDomainFiltersChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  totalCount,
  filteredCount,
  onClearFilters,
  onReload,
  isLoading = false,
}: ActivityToolbarProps) {
  const [isSpinning, setIsSpinning] = React.useState(false);
  const domainOptions = React.useMemo(
    () =>
      availableDomains.map((value) => ({
        value,
        label: ACTIVITY_DOMAIN_CONFIG[value].label,
      })),
    [availableDomains]
  );

  const isAllDomains = domainFilters.length === 0;

  const hasFilters = searchQuery !== "" || !isAllDomains || dateRangeFilter !== "all";

  const activeDomainFilterCount = domainFilters.length;

  const handleReload = () => {
    setIsSpinning(true);
    onReload?.();
    setTimeout(() => setIsSpinning(false), 500);
  };

  const handleToggleDomain = (value: ActivityDomain | "all") => {
    if (value === "all") {
      onDomainFiltersChange([]);
      return;
    }

    const newFilters = domainFilters.includes(value)
      ? domainFilters.filter((v) => v !== value)
      : [...domainFilters, value];

    onDomainFiltersChange(newFilters);
  };

  const FilterDot = () => (
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <span className="h-2 w-2 rounded-full bg-foreground" />
    </span>
  );

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
      <div className="relative flex-1 w-full">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search activities..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-11 rounded-xl"
        />
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="gap-2 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-offset-0"
            >
              <FunnelIcon className="h-4 w-4" />
              Domain
              {activeDomainFilterCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shadow-none"
                >
                  {activeDomainFilterCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1">
            <DropdownMenuLabel>Domain</DropdownMenuLabel>
            <DropdownMenuItem
              className="pl-8 relative"
              onClick={() => handleToggleDomain("all")}
            >
              {isAllDomains && <FilterDot />}
              All Domains
            </DropdownMenuItem>
            {domainOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                className="pl-8 relative"
                onClick={() => handleToggleDomain(opt.value)}
              >
                {domainFilters.includes(opt.value) && <FilterDot />}
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="gap-2 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-offset-0"
            >
              <FunnelIcon className="h-4 w-4" />
              Date Range
              {dateRangeFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shadow-none"
                >
                  1
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1">
            <DropdownMenuLabel>Date Range</DropdownMenuLabel>
            {DATE_RANGES.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                className="pl-8 relative"
                onClick={() => onDateRangeFilterChange(opt.value)}
              >
                {dateRangeFilter === opt.value && <FilterDot />}
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasFilters && (
          <Button
            variant="ghost"
            onClick={onClearFilters}
            className="gap-2 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-offset-0"
          >
            <XMarkIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        )}

        {onReload && (
          <Button
            variant="outline"
            onClick={handleReload}
            disabled={isLoading || isSpinning}
            className="h-11 w-11 p-0 rounded-xl bg-background sm:w-auto sm:px-3 sm:gap-2 focus-visible:ring-1 focus-visible:ring-offset-0"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isLoading || isSpinning ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Reload</span>
          </Button>
        )}

        <Badge
          variant="outline"
          className="h-11 px-4 rounded-xl text-sm font-normal bg-muted/30 border-none whitespace-nowrap text-muted-foreground hover:bg-muted/30"
        >
          {hasFilters ? (
            <>
              {filteredCount} of {totalCount} activities
            </>
          ) : (
            <>
              {totalCount} {totalCount === 1 ? "activity" : "activities"}
            </>
          )}
        </Badge>
      </div>
    </div>
  );
}
