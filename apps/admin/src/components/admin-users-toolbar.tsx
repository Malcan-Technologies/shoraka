import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

type AdminRole = "SUPER_ADMIN" | "COMPLIANCE_OFFICER" | "OPERATIONS_OFFICER" | "FINANCE_OFFICER";

interface AdminUsersToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedRoles: AdminRole[];
  onRolesChange: (roles: AdminRole[]) => void;
  selectedStatuses: ("ACTIVE" | "INACTIVE")[];
  onStatusesChange: (statuses: ("ACTIVE" | "INACTIVE")[]) => void;
  totalCount: number;
  onClearFilters: () => void;
  onReload?: () => void;
  isLoading?: boolean;
}

const roleOptions: { value: AdminRole; label: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "COMPLIANCE_OFFICER", label: "Compliance Officer" },
  { value: "OPERATIONS_OFFICER", label: "Operations Officer" },
  { value: "FINANCE_OFFICER", label: "Finance Officer" },
];

const statusOptions: { value: "ACTIVE" | "INACTIVE"; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

export function AdminUsersToolbar({
  searchQuery,
  onSearchChange,
  selectedRoles,
  onRolesChange,
  selectedStatuses,
  onStatusesChange,
  totalCount,
  onClearFilters,
  onReload,
  isLoading = false,
}: AdminUsersToolbarProps) {
  const [isSpinning, setIsSpinning] = React.useState(false);

  const hasActiveFilters =
    searchQuery.length > 0 || selectedRoles.length > 0 || selectedStatuses.length > 0;

  const activeFilterCount = selectedRoles.length + selectedStatuses.length + (searchQuery ? 1 : 0);

  const handleReload = () => {
    setIsSpinning(true);
    onReload?.();
    // Keep spinning for at least 500ms for visual feedback
    setTimeout(() => setIsSpinning(false), 500);
  };

  const handleRoleToggle = (role: AdminRole) => {
    if (selectedRoles.includes(role)) {
      onRolesChange(selectedRoles.filter((r) => r !== role));
    } else {
      onRolesChange([...selectedRoles, role]);
    }
  };

  const handleStatusToggle = (status: "ACTIVE" | "INACTIVE") => {
    if (selectedStatuses.includes(status)) {
      onStatusesChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onStatusesChange([...selectedStatuses, status]);
    }
  };

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or User ID..."
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
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Role</DropdownMenuLabel>
          {roleOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selectedRoles.includes(option.value)}
              onCheckedChange={() => handleRoleToggle(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          {statusOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selectedStatuses.includes(option.value)}
              onCheckedChange={() => handleStatusToggle(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasActiveFilters && (
        <Button variant="ghost" onClick={onClearFilters} className="gap-2 h-11 rounded-xl">
          <XMarkIcon className="h-4 w-4" />
          Clear
        </Button>
      )}

      {onReload && (
        <Button
          variant="outline"
          onClick={handleReload}
          disabled={isLoading || isSpinning}
          className="gap-2 h-11 rounded-xl"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isLoading || isSpinning ? "animate-spin" : ""}`} />
          Reload
        </Button>
      )}

      <Badge variant="secondary" className="h-11 px-4 rounded-xl text-sm">
        {totalCount} {totalCount === 1 ? "admin" : "admins"}
      </Badge>
    </div>
  );
}
