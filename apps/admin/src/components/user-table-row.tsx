"use client";

import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PencilIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

type UserRole = "INVESTOR" | "ISSUER" | "ADMIN";

interface User {
  id: string;
  email: string;
  cognito_sub: string;
  cognito_username: string;
  roles: UserRole[];
  first_name: string;
  last_name: string;
  phone: string | null;
  email_verified: boolean;
  kyc_verified: boolean;
  investor_onboarding_completed: boolean;
  issuer_onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

interface UserTableRowProps {
  user: User;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updatedUser: Partial<User>) => void;
  onCancel: () => void;
}

const roleColors: Record<UserRole, string> = {
  INVESTOR: "bg-blue-100 text-blue-800 border-blue-200",
  ISSUER: "bg-purple-100 text-purple-800 border-purple-200",
  ADMIN: "bg-red-100 text-red-800 border-red-200",
};

export function UserTableRow({ user, isEditing, onEdit, onSave, onCancel }: UserTableRowProps) {
  const [editedUser, setEditedUser] = React.useState<Partial<User>>(user);

  React.useEffect(() => {
    if (isEditing) {
      setEditedUser(user);
    }
  }, [isEditing, user]);

  const handleSave = () => {
    onSave(editedUser);
  };

  const toggleRole = (role: UserRole) => {
    const currentRoles = editedUser.roles || user.roles;
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];
    setEditedUser({ ...editedUser, roles: newRoles });
  };

  if (isEditing) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell>
          <div className="flex gap-2">
            <Input
              value={editedUser.first_name || ""}
              onChange={(e) => setEditedUser({ ...editedUser, first_name: e.target.value })}
              className="h-9 text-sm"
              placeholder="First name"
            />
            <Input
              value={editedUser.last_name || ""}
              onChange={(e) => setEditedUser({ ...editedUser, last_name: e.target.value })}
              className="h-9 text-sm"
              placeholder="Last name"
            />
          </div>
        </TableCell>
        <TableCell>
          <Input
            value={editedUser.email || ""}
            onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
            className="h-9 text-sm"
            type="email"
            disabled
          />
        </TableCell>
        <TableCell>
          <Input
            value={editedUser.phone || ""}
            onChange={(e) => setEditedUser({ ...editedUser, phone: e.target.value })}
            className="h-9 text-sm"
            placeholder="+60..."
          />
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {(["INVESTOR", "ISSUER", "ADMIN"] as UserRole[]).map((role) => (
              <Badge
                key={role}
                variant="outline"
                className={`cursor-pointer text-xs ${
                  editedUser.roles?.includes(role) ? roleColors[role] : "opacity-40"
                }`}
                onClick={() => toggleRole(role)}
              >
                {role}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <Switch
            checked={editedUser.kyc_verified ?? false}
            onCheckedChange={(checked) => setEditedUser({ ...editedUser, kyc_verified: checked })}
          />
        </TableCell>
        <TableCell>
          <Switch
            checked={editedUser.investor_onboarding_completed ?? false}
            onCheckedChange={(checked) =>
              setEditedUser({ ...editedUser, investor_onboarding_completed: checked })
            }
          />
        </TableCell>
        <TableCell>
          <Switch
            checked={editedUser.issuer_onboarding_completed ?? false}
            onCheckedChange={(checked) =>
              setEditedUser({ ...editedUser, issuer_onboarding_completed: checked })
            }
          />
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatDistanceToNow(user.created_at, { addSuffix: true })}
        </TableCell>
        <TableCell>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="h-8">
              <CheckIcon className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel} className="h-8">
              <XMarkIcon className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium text-[15px]">
        {user.first_name} {user.last_name}
      </TableCell>
      <TableCell className="text-[15px]">{user.email}</TableCell>
      <TableCell className="text-[15px]">{user.phone || "—"}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {user.roles.map((role) => (
            <Badge key={role} variant="outline" className={`text-xs ${roleColors[role]}`}>
              {role}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        {user.kyc_verified ? (
          <CheckIcon className="h-5 w-5 text-green-600" />
        ) : (
          <XMarkIcon className="h-5 w-5 text-gray-400" />
        )}
      </TableCell>
      <TableCell>
        {user.investor_onboarding_completed ? (
          <CheckIcon className="h-5 w-5 text-green-600" />
        ) : (
          <XMarkIcon className="h-5 w-5 text-gray-400" />
        )}
      </TableCell>
      <TableCell>
        {user.issuer_onboarding_completed ? (
          <CheckIcon className="h-5 w-5 text-green-600" />
        ) : (
          <XMarkIcon className="h-5 w-5 text-gray-400" />
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(user.created_at, { addSuffix: true })}
      </TableCell>
      <TableCell>
        <Button size="sm" variant="ghost" onClick={onEdit} className="h-8">
          <PencilIcon className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
}

