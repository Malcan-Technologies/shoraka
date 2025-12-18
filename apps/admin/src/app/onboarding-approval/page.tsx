"use client";

import * as React from "react";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { SystemHealthIndicator } from "../../components/system-health-indicator";
import { OnboardingQueueTable } from "../../components/onboarding-queue-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import type { OnboardingApplication, OnboardingApprovalStatus } from "../../components/onboarding-queue-table";

// Mock data for demonstration
const MOCK_APPLICATIONS: OnboardingApplication[] = [
  {
    id: "app-001",
    userId: "usr-001",
    userName: "Ahmad bin Abdullah",
    userEmail: "ahmad.abdullah@example.com",
    type: "PERSONAL",
    portal: "INVESTOR",
    regtankRequestId: "rt-abc123",
    status: "PENDING_ONBOARDING",
    submittedAt: new Date("2024-12-15T10:30:00"),
  },
  {
    id: "app-002",
    userId: "usr-002",
    userName: "Siti Nurhaliza",
    userEmail: "siti.nurhaliza@example.com",
    type: "PERSONAL",
    portal: "INVESTOR",
    regtankRequestId: "rt-def456",
    status: "PENDING_AML",
    submittedAt: new Date("2024-12-14T14:15:00"),
  },
  {
    id: "app-003",
    userId: "usr-003",
    userName: "Tech Solutions Sdn Bhd",
    userEmail: "admin@techsolutions.com.my",
    type: "COMPANY",
    portal: "ISSUER",
    regtankRequestId: "rt-ghi789",
    status: "PENDING_SSM_REVIEW",
    submittedAt: new Date("2024-12-16T09:00:00"),
    companyDetails: {
      companyName: "Tech Solutions Sdn Bhd",
      registrationNumber: "1234567-A",
      businessType: "Information Technology",
      address: "Level 15, Menara KL, Jalan Sultan Ismail, 50250 Kuala Lumpur",
      directors: ["Tan Wei Ming", "Lee Mei Ling"],
    },
  },
  {
    id: "app-004",
    userId: "usr-004",
    userName: "Green Energy Corp",
    userEmail: "contact@greenenergy.com.my",
    type: "COMPANY",
    portal: "ISSUER",
    regtankRequestId: "rt-jkl012",
    status: "SSM_APPROVED",
    submittedAt: new Date("2024-12-13T11:45:00"),
    companyDetails: {
      companyName: "Green Energy Corp Sdn Bhd",
      registrationNumber: "9876543-B",
      businessType: "Renewable Energy",
      address: "No. 88, Jalan Ampang, 50450 Kuala Lumpur",
      directors: ["Mohd Razak bin Ismail", "Nurul Aina binti Hassan", "David Lim"],
    },
    ssmVerified: true,
    ssmVerifiedAt: new Date("2024-12-14T16:30:00"),
    ssmVerifiedBy: "admin@cashsouk.com",
  },
  {
    id: "app-005",
    userId: "usr-005",
    userName: "Wong Mei Ling",
    userEmail: "meiling.wong@example.com",
    type: "PERSONAL",
    portal: "INVESTOR",
    regtankRequestId: "rt-mno345",
    status: "APPROVED",
    submittedAt: new Date("2024-12-10T08:20:00"),
  },
  {
    id: "app-006",
    userId: "usr-006",
    userName: "Rajesh Kumar",
    userEmail: "rajesh.kumar@example.com",
    type: "PERSONAL",
    portal: "INVESTOR",
    regtankRequestId: "rt-pqr678",
    status: "REJECTED",
    submittedAt: new Date("2024-12-08T15:10:00"),
  },
  {
    id: "app-007",
    userId: "usr-007",
    userName: "Global Trading Sdn Bhd",
    userEmail: "ops@globaltrading.com.my",
    type: "COMPANY",
    portal: "ISSUER",
    regtankRequestId: "rt-stu901",
    status: "PENDING_ONBOARDING",
    submittedAt: new Date("2024-12-12T13:00:00"),
    companyDetails: {
      companyName: "Global Trading Sdn Bhd",
      registrationNumber: "5555555-C",
      businessType: "Import/Export",
      address: "Port Klang Industrial Zone, 42000 Selangor",
      directors: ["Lim Ah Kow"],
    },
    ssmVerified: true,
    ssmVerifiedAt: new Date("2024-12-13T10:00:00"),
    ssmVerifiedBy: "admin@cashsouk.com",
  },
  {
    id: "app-008",
    userId: "usr-008",
    userName: "Fatimah binti Zainal",
    userEmail: "fatimah.zainal@example.com",
    type: "PERSONAL",
    portal: "ISSUER",
    regtankRequestId: "rt-vwx234",
    status: "PENDING_ONBOARDING",
    submittedAt: new Date("2024-12-17T16:45:00"),
  },
];

type PortalFilter = "all" | "INVESTOR" | "ISSUER";
type TypeFilter = "all" | "PERSONAL" | "COMPANY";
type StatusFilter = "all" | OnboardingApprovalStatus;

export default function OnboardingApprovalPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [portalFilter, setPortalFilter] = React.useState<PortalFilter>("all");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const pageSize = 10;

  // Filter applications
  const filteredApplications = React.useMemo(() => {
    return MOCK_APPLICATIONS.filter((app) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          app.userName.toLowerCase().includes(query) ||
          app.userEmail.toLowerCase().includes(query) ||
          app.companyDetails?.companyName?.toLowerCase().includes(query) ||
          app.companyDetails?.registrationNumber?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Portal filter
      if (portalFilter !== "all" && app.portal !== portalFilter) return false;

      // Type filter
      if (typeFilter !== "all" && app.type !== typeFilter) return false;

      // Status filter
      if (statusFilter !== "all" && app.status !== statusFilter) return false;

      return true;
    });
  }, [searchQuery, portalFilter, typeFilter, statusFilter]);

  const handleReload = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setPortalFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const hasFilters =
    searchQuery !== "" ||
    portalFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all";

  // Pagination
  const totalApplications = filteredApplications.length;
  const paginatedApplications = filteredApplications.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Count pending items that need attention
  const pendingCount = MOCK_APPLICATIONS.filter(
    (app) =>
      app.status === "PENDING_SSM_REVIEW" ||
      app.status === "SSM_APPROVED" ||
      app.status === "PENDING_ONBOARDING" ||
      app.status === "PENDING_AML"
  ).length;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Onboarding Approval</h1>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="ml-2">
            {pendingCount} pending
          </Badge>
        )}
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Description */}
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-semibold mb-2">KYC/KYB Approval Queue</h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed">
              Review and approve user onboarding applications. Personal applications go directly to RegTank for approval.
              Company applications require SSM verification on our side before proceeding to RegTank.
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 rounded-xl"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Portal
                  {portalFilter !== "all" && (
                    <Badge variant="secondary" className="ml-1">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Portal</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={portalFilter}
                  onValueChange={(v) => setPortalFilter(v as PortalFilter)}
                >
                  <DropdownMenuRadioItem value="all">All Portals</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="INVESTOR">Investor</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="ISSUER">Issuer</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Type
                  {typeFilter !== "all" && (
                    <Badge variant="secondary" className="ml-1">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Onboarding Type</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={typeFilter}
                  onValueChange={(v) => setTypeFilter(v as TypeFilter)}
                >
                  <DropdownMenuRadioItem value="all">All Types</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="PERSONAL">Personal</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="COMPANY">Company</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Status
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="ml-1">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                  <DropdownMenuRadioItem value="all">All Statuses</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="PENDING_SSM_REVIEW">Pending SSM Review</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="SSM_APPROVED">SSM Approved</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="PENDING_ONBOARDING">Pending Onboarding</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="PENDING_AML">Pending AML</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="APPROVED">Approved</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="REJECTED">Rejected</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasFilters && (
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                className="gap-2 h-11 rounded-xl"
              >
                <XMarkIcon className="h-4 w-4" />
                Clear
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleReload}
              disabled={isLoading}
              className="gap-2 h-11 rounded-xl"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Reload
            </Button>

            <Badge variant="secondary" className="h-11 px-4 rounded-xl text-sm">
              {totalApplications} {totalApplications === 1 ? "application" : "applications"}
            </Badge>
          </div>

          {/* Queue Table */}
          <OnboardingQueueTable
            applications={paginatedApplications}
            loading={isLoading}
            currentPage={currentPage}
            pageSize={pageSize}
            totalApplications={totalApplications}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </>
  );
}

