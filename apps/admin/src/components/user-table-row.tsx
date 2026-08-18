"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { BuildingOffice2Icon, EyeIcon } from "@heroicons/react/24/outline";
import type { UserRole } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { UserRoleBadges } from "@/components/user-role-badges";

interface User {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string;
  roles: UserRole[];
  investor_account: string[];
  issuer_account: string[];
  investor_organization_count?: number;
  issuer_organization_count?: number;
  password_changed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  cognito_sub: string;
  cognito_username: string;
}

interface UserTableRowProps {
  user: User;
}

export function UserTableRow({ user }: UserTableRowProps) {
  const userHref = `/users/${encodeURIComponent(user.user_id)}`;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-mono text-sm">
        <Link href={userHref} className="hover:text-primary hover:underline">
          {user.user_id}
        </Link>
      </TableCell>
      <TableCell className="text-sm font-medium">{user.first_name}</TableCell>
      <TableCell className="text-sm font-medium">{user.last_name}</TableCell>
      <TableCell className="text-sm">{user.phone || "—"}</TableCell>
      <TableCell className="text-sm">{user.email}</TableCell>
      <TableCell>
        <UserRoleBadges roles={user.roles} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <BuildingOffice2Icon className="h-4 w-4" />
          <span className="text-sm font-medium">
            {user.investor_organization_count ?? user.investor_account?.length ?? 0}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <BuildingOffice2Icon className="h-4 w-4" />
          <span className="text-sm font-medium">
            {user.issuer_organization_count ?? user.issuer_account?.length ?? 0}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {user.password_changed_at
          ? formatDistanceToNow(user.password_changed_at, { addSuffix: true })
          : "Never"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {format(new Date(user.created_at), "dd MMM yyyy")}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(user.updated_at, { addSuffix: true })}
      </TableCell>
      <TableCell>
        <Button asChild size="sm" variant="ghost" className="h-8 px-2">
          <Link href={userHref}>
            <EyeIcon className="h-4 w-4 mr-1" />
            View
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
