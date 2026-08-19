import { ListToolbar, ListToolbarFilterTrigger, type FilterChip } from "@cashsouk/ui";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminRoleConfigRecord, AdminRoleKey } from "@cashsouk/types";
import { getAdminRoleDisplayInfo } from "./admin-role-metadata";

interface AdminUsersToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  availableRoles: AdminRoleConfigRecord[];
  selectedRoles: AdminRoleKey[];
  onRolesChange: (roles: AdminRoleKey[]) => void;
  selectedStatuses: ("ACTIVE" | "INACTIVE")[];
  onStatusesChange: (statuses: ("ACTIVE" | "INACTIVE")[]) => void;
  totalCount: number;
  onClearFilters: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const STATUS_OPTIONS: { value: "ACTIVE" | "INACTIVE"; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

export function AdminUsersToolbar({
  searchQuery,
  onSearchChange,
  availableRoles,
  selectedRoles,
  onRolesChange,
  selectedStatuses,
  onStatusesChange,
  totalCount,
  onClearFilters,
  onRefresh,
  isLoading = false,
}: AdminUsersToolbarProps) {
  const hasActiveFilters =
    searchQuery.length > 0 || selectedRoles.length > 0 || selectedStatuses.length > 0;
  const activeFilterCount = selectedRoles.length + selectedStatuses.length;

  const roleOptions = availableRoles.map((role) => ({
    value: role.key,
    label: getAdminRoleDisplayInfo(role.key, role.name, role.description, role.badgeColor).name,
  }));

  const handleRoleToggle = (role: AdminRoleKey) => {
    if (selectedRoles.includes(role)) {
      onRolesChange(selectedRoles.filter((item) => item !== role));
      return;
    }
    onRolesChange([...selectedRoles, role]);
  };

  const handleStatusToggle = (status: "ACTIVE" | "INACTIVE") => {
    if (selectedStatuses.includes(status)) {
      onStatusesChange(selectedStatuses.filter((item) => item !== status));
      return;
    }
    onStatusesChange([...selectedStatuses, status]);
  };

  const appliedFilters: FilterChip[] = [
    ...selectedRoles.map((role) => ({
      id: `role-${role}`,
      label: `Role: ${roleOptions.find((option) => option.value === role)?.label ?? role}`,
      onRemove: () => handleRoleToggle(role),
    })),
    ...selectedStatuses.map((status) => ({
      id: `status-${status}`,
      label: `Status: ${STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status}`,
      onRemove: () => handleStatusToggle(status),
    })),
  ];

  return (
    <ListToolbar
      className="mb-4"
      searchValue={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by name, email, or User ID..."
      appliedFilters={appliedFilters}
      onClearFilters={hasActiveFilters ? onClearFilters : undefined}
      onReload={onRefresh}
      isLoading={isLoading}
      countLabel={`${totalCount} ${totalCount === 1 ? "admin" : "admins"}`}
      filterGroups={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ListToolbarFilterTrigger label="Filters" count={activeFilterCount} />
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
            {STATUS_OPTIONS.map((option) => (
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
      }
    />
  );
}
