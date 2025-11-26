"use client";

import * as React from "react";
import Link from "next/link";
import { subDays } from "date-fns";
import { SidebarTrigger } from "../../../components/ui/sidebar";
import { Separator } from "../../../components/ui/separator";
import { SystemHealthIndicator } from "../../../components/system-health-indicator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../../components/ui/breadcrumb";
import { Button } from "../../../components/ui/button";
import { RoleBadgeInfo } from "../../../components/role-badge-info";
import { InviteAdminDialog } from "../../../components/invite-admin-dialog";
import { AdminUsersTable } from "../../../components/admin-users-table";
import { AdminUsersToolbar } from "../../../components/admin-users-toolbar";
import {
  ShieldCheckIcon,
  DocumentCheckIcon,
  CogIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

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

// Mock admin users data
const mockAdminUsers: AdminUser[] = [
  {
    id: "admin_1",
    first_name: "Ahmad",
    last_name: "Rahman",
    email: "ahmad.rahman@cashsouk.com",
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    last_login: new Date(),
    created_at: subDays(new Date(), 180),
  },
  {
    id: "admin_2",
    first_name: "Sarah",
    last_name: "Lee",
    email: "sarah.lee@cashsouk.com",
    role: "COMPLIANCE_OFFICER",
    status: "ACTIVE",
    last_login: subDays(new Date(), 2),
    created_at: subDays(new Date(), 120),
  },
  {
    id: "admin_3",
    first_name: "Mohamed",
    last_name: "Ibrahim",
    email: "mohamed.ibrahim@cashsouk.com",
    role: "OPERATIONS_OFFICER",
    status: "ACTIVE",
    last_login: subDays(new Date(), 1),
    created_at: subDays(new Date(), 90),
  },
  {
    id: "admin_4",
    first_name: "Priya",
    last_name: "Sharma",
    email: "priya.sharma@cashsouk.com",
    role: "FINANCE_OFFICER",
    status: "ACTIVE",
    last_login: subDays(new Date(), 3),
    created_at: subDays(new Date(), 75),
  },
  {
    id: "admin_5",
    first_name: "David",
    last_name: "Tan",
    email: "david.tan@cashsouk.com",
    role: "COMPLIANCE_OFFICER",
    status: "ACTIVE",
    last_login: subDays(new Date(), 5),
    created_at: subDays(new Date(), 60),
  },
  {
    id: "admin_6",
    first_name: "Nurul",
    last_name: "Hasan",
    email: "nurul.hasan@cashsouk.com",
    role: "OPERATIONS_OFFICER",
    status: "ACTIVE",
    last_login: subDays(new Date(), 4),
    created_at: subDays(new Date(), 45),
  },
  {
    id: "admin_7",
    first_name: "Wei",
    last_name: "Chen",
    email: "wei.chen@cashsouk.com",
    role: "FINANCE_OFFICER",
    status: "INACTIVE",
    last_login: subDays(new Date(), 30),
    created_at: subDays(new Date(), 90),
  },
  {
    id: "admin_8",
    first_name: "Aisha",
    last_name: "Malik",
    email: "aisha.malik@cashsouk.com",
    role: "COMPLIANCE_OFFICER",
    status: "ACTIVE",
    last_login: subDays(new Date(), 1),
    created_at: subDays(new Date(), 30),
  },
];

const ITEMS_PER_PAGE = 10;

export default function RolesPage() {
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
  const [adminUsers, setAdminUsers] = React.useState<AdminUser[]>(mockAdminUsers);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedRoles, setSelectedRoles] = React.useState<AdminRole[]>([]);
  const [selectedStatuses, setSelectedStatuses] = React.useState<
    ("ACTIVE" | "INACTIVE")[]
  >([]);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Filter users
  const filteredUsers = React.useMemo(() => {
    return adminUsers.filter((user) => {
      const matchesSearch =
        searchQuery === "" ||
        user.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole =
        selectedRoles.length === 0 || selectedRoles.includes(user.role);

      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(user.status);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [adminUsers, searchQuery, selectedRoles, selectedStatuses]);

  // Paginate users
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleUpdateUser = (userId: string, updates: Partial<AdminUser>) => {
    setAdminUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, ...updates } : user))
    );
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedRoles([]);
    setSelectedStatuses([]);
    setCurrentPage(1);
  };

  // Reset to page 1 when filters change
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
              <BreadcrumbLink asChild>
                <Link href="/settings">Settings</Link>
              </BreadcrumbLink>
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
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Admin Roles & Users
              </h1>
              <p className="text-[15px] leading-7 text-muted-foreground mt-1">
                Manage admin user roles, permissions, and access levels.
              </p>
            </div>
            <Button
              onClick={() => setInviteDialogOpen(true)}
              className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
            >
              Invite Admin User
            </Button>
          </div>

          {/* Compact Role Reference Section */}
          <div className="p-6 bg-muted/30 rounded-2xl">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">
              Role Definitions (hover for details)
            </h2>
            <div className="flex flex-wrap gap-3">
              {roles.map((role) => (
                <RoleBadgeInfo key={role.name} role={role} />
              ))}
            </div>
          </div>

          {/* Admin Users Table Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Admin Users</h2>
            <AdminUsersToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedRoles={selectedRoles}
              onRolesChange={setSelectedRoles}
              selectedStatuses={selectedStatuses}
              onStatusesChange={setSelectedStatuses}
              totalCount={filteredUsers.length}
              onClearFilters={handleClearFilters}
            />
            <AdminUsersTable
              users={paginatedUsers}
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
