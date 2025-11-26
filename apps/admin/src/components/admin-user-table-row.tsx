"use client";

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

type AdminRole =
  | "SUPER_ADMIN"
  | "COMPLIANCE_OFFICER"
  | "OPERATIONS_OFFICER"
  | "FINANCE_OFFICER";

interface AdminUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: AdminRole;
  status: "ACTIVE" | "INACTIVE";
  last_login: Date | null;
  created_at: Date;
}

interface AdminUserTableRowProps {
  user: AdminUser;
  onUpdate: (userId: string, updates: Partial<AdminUser>) => void;
}

const roleConfig: Record<
  AdminRole,
  { label: string; color: string; bgColor: string }
> = {
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
  const [selectedRole, setSelectedRole] = React.useState<AdminRole>(user.role);

  const handleRoleChange = (newRole: AdminRole) => {
    onUpdate(user.id, { role: newRole });
    setIsEditingRole(false);
    toast.success("Role updated", {
      description: `${user.first_name} ${user.last_name} is now ${roleConfig[newRole].label}`,
    });
  };

  const handleToggleStatus = () => {
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    onUpdate(user.id, { status: newStatus });
    toast.success(
      newStatus === "ACTIVE" ? "Admin activated" : "Admin deactivated",
      {
        description: `${user.first_name} ${user.last_name} is now ${newStatus.toLowerCase()}`,
      }
    );
  };

  return (
    <TableRow className="hover:bg-muted/50 transition-colors">
      <TableCell className="font-medium">
        {user.first_name} {user.last_name}
      </TableCell>
      <TableCell className="text-[15px]">{user.email}</TableCell>
      <TableCell>
        {isEditingRole ? (
          <Select
            value={selectedRole}
            onValueChange={(value) => {
              setSelectedRole(value as AdminRole);
              handleRoleChange(value as AdminRole);
            }}
          >
            <SelectTrigger className="w-[200px] h-9 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(roleConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <button
            onClick={() => setIsEditingRole(true)}
            className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-medium ${
              roleConfig[user.role].bgColor
            } ${roleConfig[user.role].color} hover:shadow-sm transition-shadow`}
          >
            {roleConfig[user.role].label}
          </button>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant={user.status === "ACTIVE" ? "default" : "secondary"}
          className={
            user.status === "ACTIVE"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-gray-100 text-gray-600 border-gray-200"
          }
        >
          {user.status}
        </Badge>
      </TableCell>
      <TableCell className="text-[15px] text-muted-foreground">
        {user.last_login
          ? format(user.last_login, "MMM d, yyyy h:mm a")
          : "Never"}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleStatus}
          className="text-[13px]"
        >
          {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

