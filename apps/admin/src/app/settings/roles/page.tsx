"use client";

import * as React from "react";
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
import { RoleBadgeInfo } from "../../../components/role-badge-info";
import { InviteAdminDialog } from "../../../components/invite-admin-dialog";
import { AdminUsersTable } from "../../../components/admin-users-table";
import { AdminUsersToolbar } from "../../../components/admin-users-toolbar";
import { useAdminUsers } from "../../../hooks/use-admin-users";
import {
  ShieldCheckIcon,
  DocumentCheckIcon,
  CogIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import type { AdminUser, AdminRole } from "@cashsouk/types";

const roles = [
  {
    name: "Super Admin",
    icon: ShieldCheckIcon,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    description:
      "Full administrative access to all platform features and settings. Can manage all users, configure system settings, and oversee all operations.",
    permissions: [
      "Complete access to all modules",
      "User and role management",
      "Security and RBAC configuration",
      "Platform settings and limits",
      "All compliance and operational tools",
    ],
  },
  {
    name: "Compliance Officer",
    icon: DocumentCheckIcon,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description:
      "Manages regulatory compliance, KYC verification, and fraud prevention. Ensures platform adheres to Malaysian financial regulations and Shariah principles.",
    permissions: [
      "KYC and AML verification",
      "Sanctions screening and blacklist management",
      "Regulatory reporting",
      "Access logs and audit trails",
      "Data export for compliance",
    ],
  },
  {
    name: "Operations Officer",
    icon: CogIcon,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    description:
      "Handles day-to-day platform operations including loan management, user support, and communication. Oversees investment processing and customer service.",
    permissions: [
      "Loan and investment management",
      "User account operations",
      "Repayment and transaction records",
      "Customer support tools",
      "Marketing and communications",
    ],
  },
  {
    name: "Finance Officer",
    icon: BanknotesIcon,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    description:
      "Manages financial operations including fund disbursements and payment processing. Monitors transaction flows and financial compliance.",
    permissions: [
      "Disbursement triggering",
      "Financial compliance viewing",
      "Data export for finance",
      "Limited loan operations access",
    ],
  },
];

const ITEMS_PER_PAGE = 10;

export default function RolesPage() {
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedRoles, setSelectedRoles] = React.useState<AdminRole[]>([]);
  const [selectedStatuses, setSelectedStatuses] = React.useState<("ACTIVE" | "INACTIVE")[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);

  const { data, isLoading, refetch } = useAdminUsers({
    page: currentPage,
    pageSize: ITEMS_PER_PAGE,
    search: searchQuery || undefined,
    roleDescription: selectedRoles.length === 1 ? selectedRoles[0] : undefined,
    status: selectedStatuses.length === 1 ? selectedStatuses[0] : undefined,
  });

  const adminUsers = data?.users || [];
  const totalPages = data?.pagination.totalPages || 0;

  const handleUpdateUser = (_userId: string, _updates: Partial<AdminUser>) => {
    // Optimistic update - the mutation will invalidate and refetch
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
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Roles & Users</h1>
              <p className="text-[15px] leading-7 text-muted-foreground mt-1">
                Manage admin user roles, permissions, and access levels.
              </p>
            </div>
            <Button variant="action" onClick={() => setInviteDialogOpen(true)}>
              Invite Admin User
            </Button>
          </div>

          {/* Compact Role Reference Section */}
          <div className="px-4 py-3 bg-muted/20 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-2">
              Role Definitions (hover for details)
            </p>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <RoleBadgeInfo key={role.name} role={role} />
              ))}
            </div>
          </div>

          {/* Admin Users Table Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              Admin Users ({data?.pagination.totalCount || 0})
            </h2>
            <AdminUsersToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
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
              isLoading={isLoading}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              onUpdateUser={handleUpdateUser}
            />
          </div>
        </div>
      </div>

      <InviteAdminDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} />
    </>
  );
}
