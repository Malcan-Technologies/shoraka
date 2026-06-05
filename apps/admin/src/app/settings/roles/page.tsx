"use client";

import * as React from "react";
import Link from "next/link";
import { SidebarTrigger } from "../../../components/ui/sidebar";
import { Separator } from "../../../components/ui/separator";
import { SystemHealthIndicator } from "../../../components/system-health-indicator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../../components/ui/breadcrumb";
import { Button } from "../../../components/ui/button";
import { InviteAdminDialog } from "../../../components/invite-admin-dialog";
import { AdminUsersTable } from "../../../components/admin-users-table";
import { AdminUsersToolbar } from "../../../components/admin-users-toolbar";
import { PendingInvitationsTable } from "../../../components/pending-invitations-table";
import { useAdminUsers } from "../../../hooks/use-admin-users";
import { useAdminRoleConfigs } from "../../../hooks/use-admin-role-config";
import { RequirePermission } from "../../../components/require-permission";
import {
  usePendingInvitations,
  useResendInvitation,
  useRevokeInvitation,
} from "../../../hooks/use-pending-invitations";
import { ArrowPathIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import type { AdminRoleKey, AdminUser } from "@cashsouk/types";

const ITEMS_PER_PAGE = 10;

export default function RolesPage() {
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedRoles, setSelectedRoles] = React.useState<AdminRoleKey[]>([]);
  const [selectedStatuses, setSelectedStatuses] = React.useState<("ACTIVE" | "INACTIVE")[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const { data: availableRoles = [] } = useAdminRoleConfigs();

  // Pending invitations state
  const [invitationsPage, setInvitationsPage] = React.useState(1);
  const [isInvitationsSpinning, setIsInvitationsSpinning] = React.useState(false);

  const { data, isLoading, refetch } = useAdminUsers({
    page: currentPage,
    pageSize: ITEMS_PER_PAGE,
    search: searchQuery || undefined,
    roleDescription: selectedRoles.length === 1 ? selectedRoles[0] : undefined,
    status: selectedStatuses.length === 1 ? selectedStatuses[0] : undefined,
  });

  const adminUsers = data?.users || [];
  const totalPages = data?.pagination.totalPages || 0;

  // Pending invitations hooks
  const { data: invitationsData, isLoading: invitationsLoading, refetch: refetchInvitations } = usePendingInvitations({
    page: invitationsPage,
    pageSize: ITEMS_PER_PAGE,
  });

  const resendInvitation = useResendInvitation();
  const revokeInvitation = useRevokeInvitation();

  const pendingInvitations = invitationsData?.invitations || [];
  const invitationsTotalPages = invitationsData?.pagination.totalPages || 0;

  const handleUpdateUser: (userId: string, updates: Partial<AdminUser>) => void = () => {
    refetch();
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedRoles([]);
    setSelectedStatuses([]);
    setCurrentPage(1);
  };

  const handleReload = () => {
    refetch();
  };

  const handleInvitationsReload = () => {
    setIsInvitationsSpinning(true);
    refetchInvitations();
    // Keep spinning for at least 500ms for visual feedback
    setTimeout(() => setIsInvitationsSpinning(false), 500);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedRoles, selectedStatuses]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Settings</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Roles</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <RequirePermission permission="roles.manage">
        <div className="w-full px-2 md:px-4 py-8 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Roles & Users</h1>
              <p className="text-[15px] leading-7 text-muted-foreground mt-1">
                Manage admin user roles, permissions, and access levels.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" asChild className="h-11 rounded-xl">
                <Link href="/settings/roles/configuration">
                  <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  Permission Configuration
                </Link>
              </Button>
              <Button variant="action" onClick={() => setInviteDialogOpen(true)}>
                Invite Admin User
              </Button>
            </div>
          </div>

          {/* Pending Invitations Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Pending Invitations ({invitationsData?.pagination.totalCount || 0})
              </h2>
              <Button
                variant="outline"
                onClick={handleInvitationsReload}
                disabled={invitationsLoading || isInvitationsSpinning}
                className="gap-2 h-11 rounded-xl"
              >
                <ArrowPathIcon className={`h-4 w-4 ${invitationsLoading || isInvitationsSpinning ? "animate-spin" : ""}`} />
                Reload
              </Button>
            </div>
            <PendingInvitationsTable
              invitations={pendingInvitations}
              availableRoles={availableRoles}
              isLoading={invitationsLoading}
              currentPage={invitationsPage}
              totalPages={invitationsTotalPages}
              onPageChange={setInvitationsPage}
              onResend={(id) => resendInvitation.mutate(id)}
              onRevoke={(id) => revokeInvitation.mutate(id)}
            />
          </div>

          {/* Admin Users Table Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              Admin Users ({data?.pagination.totalCount || 0})
            </h2>
            <AdminUsersToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              availableRoles={availableRoles}
              selectedRoles={selectedRoles}
              onRolesChange={(roles) => setSelectedRoles(roles)}
              selectedStatuses={selectedStatuses}
              onStatusesChange={setSelectedStatuses}
              totalCount={data?.pagination.totalCount || 0}
              onClearFilters={handleClearFilters}
              onReload={handleReload}
              isLoading={isLoading}
            />
            <AdminUsersTable
              users={adminUsers}
              availableRoles={availableRoles}
              isLoading={isLoading}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              onUpdateUser={handleUpdateUser}
              canManageRoles
            />
          </div>
        </div>
        </RequirePermission>
      </div>

      <InviteAdminDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        availableRoles={availableRoles}
      />
    </>
  );
}
