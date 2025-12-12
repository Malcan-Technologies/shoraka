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
import { format } from "date-fns";
import { toast } from "sonner";
import { PencilIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useUpdateAdminRole, useDeactivateAdmin, useReactivateAdmin } from "@/hooks/use-admin-users";
import type { AdminUser, AdminRole } from "@cashsouk/types";

interface AdminUserTableRowProps {
  user: AdminUser;
  onUpdate: (userId: string, updates: Partial<AdminUser>) => void;
}

const roleConfig: Record<AdminRole, { label: string; color: string; bgColor: string }> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
  },
  COMPLIANCE_OFFICER: {
    label: "Compliance Officer",
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
  },
  OPERATIONS_OFFICER: {
    label: "Operations Officer",
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-200",
  },
  FINANCE_OFFICER: {
    label: "Finance Officer",
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200",
  },
};

export function AdminUserTableRow({ user, onUpdate }: AdminUserTableRowProps) {
  const [isEditingRole, setIsEditingRole] = React.useState(false);
  const currentRole = user.admin?.role_description || null;
  const [selectedRole, setSelectedRole] = React.useState<AdminRole | null>(currentRole);
  const updateRoleMutation = useUpdateAdminRole();
  const deactivateMutation = useDeactivateAdmin();
  const reactivateMutation = useReactivateAdmin();

  React.useEffect(() => {
    setSelectedRole(currentRole);
  }, [currentRole]);

  const handleRoleChange = async () => {
    if (!selectedRole || selectedRole === currentRole) {
      setIsEditingRole(false);
      return;
    }

    try {
      await updateRoleMutation.mutateAsync({
        userId: user.id,
        data: { roleDescription: selectedRole },
      });
      toast.success("Role updated", {
        description: `${user.first_name} ${user.last_name} is now ${roleConfig[selectedRole].label}`,
      });
    setIsEditingRole(false);
      onUpdate(user.id, { 
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

  const handleToggleStatus = async () => {
    const currentStatus = user.admin?.status || "ACTIVE";
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      if (newStatus === "INACTIVE") {
        await deactivateMutation.mutateAsync(user.id);
        toast.success("Admin deactivated", {
          description: `${user.first_name} ${user.last_name} has been deactivated`,
        });
      } else {
        await reactivateMutation.mutateAsync(user.id);
        toast.success("Admin activated", {
          description: `${user.first_name} ${user.last_name} has been activated`,
        });
      }
      onUpdate(user.id, { 
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

  const status = user.admin?.status || "INACTIVE";
  const role = user.admin?.role_description;

  return (
    <TableRow className="hover:bg-muted/50 transition-colors">
      <TableCell className="font-medium">
        {user.first_name} {user.last_name}
      </TableCell>
      <TableCell className="text-[15px] font-mono text-xs text-muted-foreground">
        {user.user_id || "-"}
      </TableCell>
      <TableCell className="text-[15px]">{user.email}</TableCell>
      <TableCell>
        {isEditingRole ? (
          <div className="flex items-center gap-2">
            <Select
              value={selectedRole || ""}
              onValueChange={(value) => setSelectedRole(value as AdminRole)}
            >
              <SelectTrigger className="w-[180px] h-9 rounded-lg">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
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
            onClick={() => setIsEditingRole(true)}
            className={`group inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${
              roleConfig[role].bgColor
            } ${roleConfig[role].color} hover:shadow-sm transition-shadow`}
          >
            {roleConfig[role].label}
            <PencilIcon className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity" />
          </button>
        ) : (
          <span className="text-muted-foreground text-xs">No role assigned</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant={status === "ACTIVE" ? "default" : "secondary"}
          className={
            status === "ACTIVE"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-gray-100 text-gray-600 border-gray-200"
          }
        >
          {status}
        </Badge>
      </TableCell>
      <TableCell className="text-[15px] text-muted-foreground">
        {user.admin?.last_login ? format(new Date(user.admin.last_login), "MMM d, yyyy h:mm a") : "Never"}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleStatus}
          disabled={deactivateMutation.isPending || reactivateMutation.isPending}
          className={`text-[13px] ${status === "ACTIVE" ? "text-red-600 hover:text-red-100" : ""}`}
        >
          {status === "ACTIVE" ? "Deactivate" : "Activate"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
