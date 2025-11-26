import * as React from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminUserTableRow } from "./admin-user-table-row";
import { Button } from "@/components/ui/button";

type AdminRole = "SUPER_ADMIN" | "COMPLIANCE_OFFICER" | "OPERATIONS_OFFICER" | "FINANCE_OFFICER";

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

interface AdminUsersTableProps {
  users: AdminUser[];
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onUpdateUser: (userId: string, updates: Partial<AdminUser>) => void;
}

export function AdminUsersTable({
  users,
  isLoading = false,
  currentPage,
  totalPages,
  onPageChange,
  onUpdateUser,
}: AdminUsersTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-12 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border bg-muted/20 p-12 text-center">
        <p className="text-[15px] text-muted-foreground">
          No admin users found matching your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Email</TableHead>
              <TableHead className="font-semibold">Role</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Last Login</TableHead>
              <TableHead className="font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <AdminUserTableRow key={user.id} user={user} onUpdate={onUpdateUser} />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
