import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  PencilIcon,
  XMarkIcon,
  CheckIcon,
  ShieldExclamationIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useUpdateAdminRole, useDeactivateAdmin, useReactivateAdmin } from "@/hooks/use-admin-users";
import type {
  AdminRoleBadgeColor,
  AdminRoleConfigRecord,
  AdminRoleKey,
  AdminUser,
} from "@cashsouk/types";
import { getAdminRoleDisplayInfo } from "./admin-role-metadata";

interface AdminUserTableRowProps {
  user: AdminUser;
  availableRoles: AdminRoleConfigRecord[];
  onUpdate: (userId: string, updates: Partial<AdminUser>) => void;
  canManageRoles: boolean;
}

function getRoleClasses(
  roleKey: AdminRoleKey,
  badgeColor?: AdminRoleBadgeColor | null
) {
  const display = getAdminRoleDisplayInfo(roleKey, undefined, undefined, badgeColor ?? undefined);

  return {
    label: display.name,
    iconStyle: display.iconStyle,
    badgeStyle: display.badgeStyle,
  };
}

export function AdminUserTableRow({
  user,
  availableRoles,
  onUpdate,
  canManageRoles,
}: AdminUserTableRowProps) {
  const [isEditingRole, setIsEditingRole] = React.useState(false);
  const currentRole = user.admin?.role_description || null;
  const [selectedRole, setSelectedRole] = React.useState<AdminRoleKey | null>(currentRole);
  const updateRoleMutation = useUpdateAdminRole();
  const deactivateMutation = useDeactivateAdmin();
  const reactivateMutation = useReactivateAdmin();

  React.useEffect(() => {
    setSelectedRole(currentRole);
  }, [currentRole]);

  const selectableRoles = React.useMemo(() => {
    if (!currentRole || availableRoles.some((role) => role.key === currentRole)) {
      return availableRoles;
    }

    return [
      {
        id: `fallback-${currentRole}`,
        key: currentRole,
        name: getAdminRoleDisplayInfo(currentRole).name,
        description: null,
        badgeColor: getAdminRoleDisplayInfo(currentRole).badgeColor,
        permissions: [],
        isSystem: false,
        isEditable: true,
        memberCount: 0,
      },
      ...availableRoles,
    ];
  }, [availableRoles, currentRole]);

  const handleRoleChange = async () => {
    if (!selectedRole || selectedRole === currentRole) {
      setIsEditingRole(false);
      return;
    }

    try {
      if (!user.user_id) {
        toast.error("Invalid user", {
          description: "User ID is missing",
        });
        return;
      }
      await updateRoleMutation.mutateAsync({
        userId: user.user_id,
        data: { roleDescription: selectedRole },
      });
      const selectedRoleRecord = selectableRoles.find((roleOption) => roleOption.key === selectedRole);
      const selectedRoleDisplay = getAdminRoleDisplayInfo(
        selectedRole,
        selectedRoleRecord?.name,
        selectedRoleRecord?.description,
        selectedRoleRecord?.badgeColor
      );
      toast.success("Role updated", {
        description: `${user.first_name} ${user.last_name} is now ${selectedRoleDisplay.name}`,
      });
      setIsEditingRole(false);
      onUpdate(user.user_id, { 
        admin: { 
          ...user.admin, 
          role_description: selectedRole,
          status: user.admin?.status || "ACTIVE",
          last_login: user.admin?.last_login ?? null,
        } 
      });
    } catch (error) {
      toast.error("Failed to update role", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  };

  const handleCancelEdit = () => {
    setSelectedRole(currentRole);
    setIsEditingRole(false);
  };

  const status = user.admin?.status || "INACTIVE";
  const role = user.admin?.role_description;
  const roleRecord = role ? selectableRoles.find((roleOption) => roleOption.key === role) : null;
  const roleClasses = role ? getRoleClasses(role, roleRecord?.badgeColor) : null;

  const handleStartEditRole = () => {
    if (!canManageRoles) {
      toast.error("Cannot edit role", {
        description: "Your role does not have permission to manage admin roles.",
      });
      return;
    }

    if (status === "INACTIVE") {
      toast.error("Cannot edit role", {
        description: "Please activate the admin user before changing their role.",
      });
      return;
    }
    setIsEditingRole(true);
  };

  const handleToggleStatus = async () => {
    const currentStatus = user.admin?.status || "ACTIVE";
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      if (!user.user_id) {
        toast.error("Invalid user", {
          description: "User ID is missing",
        });
        return;
      }
      if (newStatus === "INACTIVE") {
        await deactivateMutation.mutateAsync(user.user_id);
        toast.success("Admin deactivated: ", {
          description: `${user.first_name} ${user.last_name} has been deactivated`,
        });
      } else {
        await reactivateMutation.mutateAsync(user.user_id);
        toast.success("Admin activated: ", {
          description: `${user.first_name} ${user.last_name} has been activated`,
        });
      }
      onUpdate(user.user_id, { 
        admin: { 
          ...user.admin, 
          status: newStatus,
          role_description: user.admin?.role_description ?? null,
          last_login: user.admin?.last_login ?? null,
        } 
      });
    } catch (error) {
      toast.error("Failed to update status", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
    });
    }
  };

  return (
    <TableRow className="hover:bg-muted/50 transition-colors">
      <TableCell className="font-medium min-w-[140px] max-w-[200px]">
        <span className="truncate block" title={`${user.first_name} ${user.last_name}`}>
          {user.first_name} {user.last_name}
        </span>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {user.user_id || "-"}
      </TableCell>
      <TableCell className="text-sm min-w-[180px] max-w-[280px]">
        <span className="truncate block" title={user.email}>{user.email}</span>
      </TableCell>
      <TableCell>
        {isEditingRole ? (
          <div className="flex items-center gap-2">
            <Select
              value={selectedRole || ""}
              onValueChange={(value) => setSelectedRole(value)}
            >
              <SelectTrigger className="w-[180px] h-9 rounded-lg">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {selectableRoles.map((roleOption) => (
                  <SelectItem key={roleOption.key} value={roleOption.key}>
                    {getAdminRoleDisplayInfo(
                      roleOption.key,
                      roleOption.name,
                      roleOption.description,
                      roleOption.badgeColor
                    ).name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRoleChange}
              title="Save changes"
              disabled={updateRoleMutation.isPending}
            >
              <CheckIcon className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCancelEdit}
              title="Cancel"
            >
              <XMarkIcon className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
        ) : role ? (
          <button
            onClick={handleStartEditRole}
            disabled={!canManageRoles || status === "INACTIVE"}
            className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              !canManageRoles || status === "INACTIVE"
                ? "opacity-50 cursor-not-allowed" 
                : "hover:shadow-sm transition-shadow"
            }`}
            style={roleClasses?.badgeStyle}
            title={
              !canManageRoles
                ? "You do not have permission to edit admin roles"
                : status === "INACTIVE"
                  ? "Activate admin to edit role"
                  : "Click to edit role"
            }
          >
            <UserCircleIcon
              className="h-3 w-3"
              style={roleClasses?.iconStyle}
            />
            {roleClasses?.label ?? role}
            <PencilIcon className={`h-3 w-3 ${
              !canManageRoles || status === "INACTIVE"
                ? "opacity-0" 
                : "opacity-0 group-hover:opacity-70 transition-opacity"
            }`} />
          </button>
        ) : (
          <span className="text-muted-foreground text-xs">No role assigned</span>
        )}
      </TableCell>
      <TableCell>
        {status === "ACTIVE" ? (
          <Badge
            variant="outline"
            className="border-green-500/30 text-foreground bg-green-500/10"
          >
            <CheckCircleIcon className="h-3 w-3 mr-1 text-green-600" />
            Active
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-gray-400/30 text-foreground bg-gray-400/10"
          >
            <XCircleIcon className="h-3 w-3 mr-1 text-gray-500" />
            Inactive
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {status === "ACTIVE" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            disabled={deactivateMutation.isPending}
            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
          >
            <ShieldExclamationIcon className="size-4" />
            Deactivate
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            disabled={reactivateMutation.isPending}
            className="gap-1.5 text-green-600 hover:text-green-600 hover:bg-green-50 border-green-200"
          >
            <ShieldCheckIcon className="size-4" />
            Activate
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
