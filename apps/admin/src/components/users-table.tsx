import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@cashsouk/ui";
import { UserTableRow } from "./user-table-row";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

type UserRole = "INVESTOR" | "ISSUER" | "ADMIN";

interface User {
  id: string;
  user_id?: string | null;
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

interface UsersTableProps {
  users: User[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  totalUsers: number;
  onPageChange: (page: number) => void;
  onUserUpdate: (userId: string, updatedUser: Partial<User>) => void;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-5 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-5" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-5" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-5" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-5" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function UsersTable({
  users,
  loading,
  currentPage,
  pageSize,
  totalUsers,
  onPageChange,
  onUserUpdate,
}: UsersTableProps) {
  const [editingUserId, setEditingUserId] = React.useState<string | null>(null);

  const handleEdit = (userId: string) => {
    setEditingUserId(userId);
  };

  const handleSave = (userId: string, updatedUser: Partial<User>) => {
    // Row component handles its own confirmation dialog
    // Just update the user data directly
    onUserUpdate(userId, updatedUser);
    setEditingUserId(null);
  };

  const handleCancel = () => {
    setEditingUserId(null);
  };

  const totalPages = Math.ceil(totalUsers / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalUsers);

  return (
    <>
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-sm font-semibold">User ID</TableHead>
                <TableHead className="text-sm font-semibold">Name</TableHead>
                <TableHead className="text-sm font-semibold">Email</TableHead>
                <TableHead className="text-sm font-semibold">Phone</TableHead>
                <TableHead className="text-sm font-semibold">Roles</TableHead>
                <TableHead className="text-sm font-semibold">KYC</TableHead>
                <TableHead className="text-sm font-semibold">Investor</TableHead>
                <TableHead className="text-sm font-semibold">Issuer</TableHead>
                <TableHead className="text-sm font-semibold">Created</TableHead>
                <TableHead className="text-sm font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton />
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <UserTableRow
                    key={user.id}
                    user={user}
                    isEditing={editingUserId === user.id}
                    onEdit={() => handleEdit(user.id)}
                    onSave={(updatedUser) => handleSave(user.id, updatedUser)}
                    onCancel={handleCancel}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && users.length > 0 && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex}-{endIndex} of {totalUsers}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
