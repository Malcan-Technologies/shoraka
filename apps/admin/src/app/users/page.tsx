"use client";

import * as React from "react";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { SystemHealthIndicator } from "../../components/system-health-indicator";
import { UsersTable } from "../../components/users-table";
import { UsersTableToolbar } from "../../components/users-table-toolbar";

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

const mockUsers: User[] = [
  {
    id: "user_1",
    email: "sarah.johnson@example.com",
    cognito_sub: "sub_123456",
    cognito_username: "sarah.johnson",
    roles: ["INVESTOR"],
    first_name: "Sarah",
    last_name: "Johnson",
    phone: "+60123456789",
    email_verified: true,
    kyc_verified: true,
    investor_onboarding_completed: true,
    issuer_onboarding_completed: false,
    created_at: new Date("2024-01-15"),
    updated_at: new Date("2024-01-20"),
  },
  {
    id: "user_2",
    email: "marcus.tan@example.com",
    cognito_sub: "sub_234567",
    cognito_username: "marcus.tan",
    roles: ["ISSUER"],
    first_name: "Marcus",
    last_name: "Tan",
    phone: "+60198765432",
    email_verified: true,
    kyc_verified: true,
    investor_onboarding_completed: false,
    issuer_onboarding_completed: true,
    created_at: new Date("2024-02-01"),
    updated_at: new Date("2024-02-15"),
  },
  {
    id: "user_3",
    email: "admin@cashsouk.com",
    cognito_sub: "sub_345678",
    cognito_username: "admin",
    roles: ["ADMIN"],
    first_name: "Admin",
    last_name: "User",
    phone: "+60112233445",
    email_verified: true,
    kyc_verified: true,
    investor_onboarding_completed: false,
    issuer_onboarding_completed: false,
    created_at: new Date("2023-12-01"),
    updated_at: new Date("2024-01-10"),
  },
  {
    id: "user_4",
    email: "david.wong@example.com",
    cognito_sub: "sub_456789",
    cognito_username: "david.wong",
    roles: ["INVESTOR", "ISSUER"],
    first_name: "David",
    last_name: "Wong",
    phone: "+60187654321",
    email_verified: true,
    kyc_verified: false,
    investor_onboarding_completed: true,
    issuer_onboarding_completed: true,
    created_at: new Date("2024-01-20"),
    updated_at: new Date("2024-02-10"),
  },
  {
    id: "user_5",
    email: "lisa.kumar@example.com",
    cognito_sub: "sub_567890",
    cognito_username: "lisa.kumar",
    roles: ["INVESTOR"],
    first_name: "Lisa",
    last_name: "Kumar",
    phone: null,
    email_verified: false,
    kyc_verified: false,
    investor_onboarding_completed: false,
    issuer_onboarding_completed: false,
    created_at: new Date("2024-03-01"),
    updated_at: new Date("2024-03-01"),
  },
  {
    id: "user_6",
    email: "ahmad.ibrahim@example.com",
    cognito_sub: "sub_678901",
    cognito_username: "ahmad.ibrahim",
    roles: ["ISSUER"],
    first_name: "Ahmad",
    last_name: "Ibrahim",
    phone: "+60176543210",
    email_verified: true,
    kyc_verified: true,
    investor_onboarding_completed: false,
    issuer_onboarding_completed: false,
    created_at: new Date("2024-02-15"),
    updated_at: new Date("2024-02-28"),
  },
  {
    id: "user_7",
    email: "rachel.lee@example.com",
    cognito_sub: "sub_789012",
    cognito_username: "rachel.lee",
    roles: ["INVESTOR"],
    first_name: "Rachel",
    last_name: "Lee",
    phone: "+60165432109",
    email_verified: true,
    kyc_verified: true,
    investor_onboarding_completed: true,
    issuer_onboarding_completed: false,
    created_at: new Date("2024-01-10"),
    updated_at: new Date("2024-02-05"),
  },
  {
    id: "user_8",
    email: "michael.chen@example.com",
    cognito_sub: "sub_890123",
    cognito_username: "michael.chen",
    roles: ["INVESTOR", "ADMIN"],
    first_name: "Michael",
    last_name: "Chen",
    phone: "+60154321098",
    email_verified: true,
    kyc_verified: true,
    investor_onboarding_completed: true,
    issuer_onboarding_completed: false,
    created_at: new Date("2023-11-15"),
    updated_at: new Date("2024-01-30"),
  },
];

export default function UsersPage() {
  const [loading, setLoading] = React.useState(true);
  const [users, setUsers] = React.useState<User[]>(mockUsers);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [kycFilter, setKycFilter] = React.useState("all");
  const [investorOnboardedFilter, setInvestorOnboardedFilter] = React.useState("all");
  const [issuerOnboardedFilter, setIssuerOnboardedFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const filteredUsers = React.useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        searchQuery === "" ||
        user.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === "all" || user.roles.includes(roleFilter as UserRole);

      const matchesKyc =
        kycFilter === "all" ||
        (kycFilter === "verified" && user.kyc_verified) ||
        (kycFilter === "not_verified" && !user.kyc_verified);

      const matchesInvestorOnboarded =
        investorOnboardedFilter === "all" ||
        (investorOnboardedFilter === "completed" && user.investor_onboarding_completed) ||
        (investorOnboardedFilter === "not_completed" && !user.investor_onboarding_completed);

      const matchesIssuerOnboarded =
        issuerOnboardedFilter === "all" ||
        (issuerOnboardedFilter === "completed" && user.issuer_onboarding_completed) ||
        (issuerOnboardedFilter === "not_completed" && !user.issuer_onboarding_completed);

      return (
        matchesSearch &&
        matchesRole &&
        matchesKyc &&
        matchesInvestorOnboarded &&
        matchesIssuerOnboarded
      );
    });
  }, [users, searchQuery, roleFilter, kycFilter, investorOnboardedFilter, issuerOnboardedFilter]);

  const paginatedUsers = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const handleUserUpdate = (userId: string, updatedUser: Partial<User>) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? { ...user, ...updatedUser, updated_at: new Date() }
          : user
      )
    );
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setKycFilter("all");
    setInvestorOnboardedFilter("all");
    setIssuerOnboardedFilter("all");
    setCurrentPage(1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, kycFilter, investorOnboardedFilter, issuerOnboardedFilter]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Users</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          <UsersTableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            kycFilter={kycFilter}
            onKycFilterChange={setKycFilter}
            investorOnboardedFilter={investorOnboardedFilter}
            onInvestorOnboardedFilterChange={setInvestorOnboardedFilter}
            issuerOnboardedFilter={issuerOnboardedFilter}
            onIssuerOnboardedFilterChange={setIssuerOnboardedFilter}
            totalCount={users.length}
            filteredCount={filteredUsers.length}
            onClearFilters={handleClearFilters}
          />

          <UsersTable
            users={paginatedUsers}
            loading={loading}
            currentPage={currentPage}
            pageSize={pageSize}
            totalUsers={filteredUsers.length}
            onPageChange={setCurrentPage}
            onUserUpdate={handleUserUpdate}
          />
        </div>
      </div>
    </>
  );
}

