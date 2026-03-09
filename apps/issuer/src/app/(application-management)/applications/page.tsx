"use client";

/**
 * Applications listing page — UI only, mock data.
 * Rebuilt from scratch; no imports from old implementation.
 * Accessible at /applications
 */

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  PlusIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useHeader } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ============================================================
   Mock data
   ============================================================ */

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Pending Approval",
  UNDER_REVIEW: "Pending Approval",
  RESUBMITTED: "Pending Approval",
  AMENDMENT_REQUESTED: "Pending Amendment",
  APPROVED: "Offer Received",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

const STATUS_BADGE_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  SUBMITTED: "outline",
  UNDER_REVIEW: "outline",
  RESUBMITTED: "outline",
  AMENDMENT_REQUESTED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  ARCHIVED: "secondary",
};

const MOCK_APPLICATIONS = [
  {
    id: "00000001",
    company: "Malcan Issuers Sdn Bhd",
    type: "Contract financing",
    amount: 200000,
    status: "UNDER_REVIEW",
    contractTitle: "Mining Rig Repair 12654",
    customer: "Acme Trading Sdn Bhd",
    applicationDate: "2026-03-05",
    contractValue: 250000,
    facilityApplied: 200000,
    approvedFacility: "N/A",
    invoices: [
      {
        id: "inv-1",
        number: "INV-001",
        maturityDate: "2026-04-15",
        value: 50000,
        appliedFinancing: 40000,
        document: "invoice_001.pdf",
        financingOffered: "—",
        profitRate: "—",
        status: "DRAFT",
      },
      {
        id: "inv-2",
        number: "INV-002",
        maturityDate: "2026-05-20",
        value: 75000,
        appliedFinancing: 60000,
        document: "invoice_002.pdf",
        financingOffered: "—",
        profitRate: "—",
        status: "DRAFT",
      },
    ],
  },
  {
    id: "00000002",
    company: "Tech Solutions Sdn Bhd",
    type: "Invoice financing",
    amount: 150000,
    status: "AMENDMENT_REQUESTED",
    contractTitle: null,
    customer: "Beta Corp",
    applicationDate: "2026-03-08",
    contractValue: null,
    facilityApplied: null,
    approvedFacility: "N/A",
    invoices: [
      {
        id: "inv-3",
        number: "INV-101",
        maturityDate: "2026-06-01",
        value: 80000,
        appliedFinancing: 64000,
        document: "invoice_101.pdf",
        financingOffered: "—",
        profitRate: "—",
        status: "AMENDMENT_REQUESTED",
      },
    ],
  },
  {
    id: "00000003",
    company: "Global Exports Sdn Bhd",
    type: "Contract financing",
    amount: 350000,
    status: "APPROVED",
    contractTitle: "Equipment Purchase Order",
    customer: "Delta Industries",
    applicationDate: "2026-03-01",
    contractValue: 400000,
    facilityApplied: 350000,
    approvedFacility: "RM 350,000.00",
    invoices: [
      {
        id: "inv-4",
        number: "INV-201",
        maturityDate: "2026-07-15",
        value: 120000,
        appliedFinancing: 96000,
        document: "invoice_201.pdf",
        financingOffered: "RM 96,000.00",
        profitRate: "8.5%",
        status: "APPROVED",
      },
    ],
  },
];

/* ============================================================
   Application card component
   ============================================================ */

function ApplicationCard({
  application,
  onReject,
}: {
  application: (typeof MOCK_APPLICATIONS)[0];
  onReject: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);

  const hasContract = application.type === "Contract financing";
  const showPendingAmendmentBadge =
    application.status === "AMENDMENT_REQUESTED" && hasContract;

  const handleReject = async () => {
    setIsRejecting(true);
    await new Promise((r) => setTimeout(r, 500));
    onReject();
    setIsRejecting(false);
    setRejectDialogOpen(false);
  };

  const shortId = application.id.slice(-6).toUpperCase();

  return (
    <>
      <Card className="rounded-2xl border bg-card shadow-sm md:shadow">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">
                Application ID {shortId} — {application.type}
              </span>
              <Badge
                variant={
                  STATUS_BADGE_VARIANTS[application.status] ?? "secondary"
                }
                className="rounded-md"
              >
                {STATUS_LABELS[application.status] ?? application.status}
              </Badge>
              {showPendingAmendmentBadge && (
                <Badge
                  variant="outline"
                  className="rounded-md border-amber-500/50 bg-amber-500/10 text-amber-700"
                >
                  Pending Amendment
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {application.status === "AMENDMENT_REQUESTED" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  asChild
                >
                  <Link href={`/applications/edit/${application.id}`}>
                    Make Amendment
                  </Link>
                </Button>
              )}
              {application.status === "APPROVED" && (
                <Button
                  size="sm"
                  className="rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-95"
                >
                  Review Offer
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-xl"
                  >
                    <EllipsisVerticalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={() => setRejectDialogOpen(true)}
                  >
                    Reject Application
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap justify-between gap-6">
            <div className="space-y-1">
              {hasContract && application.contractTitle && (
                <div className="text-sm text-muted-foreground">
                  Contract title:{" "}
                  <span className="text-foreground">
                    {application.contractTitle}
                  </span>
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Customer:{" "}
                <span className="text-foreground">{application.customer}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Application date:{" "}
                <span className="text-foreground">
                  {application.applicationDate}
                </span>
              </div>
            </div>
            {hasContract && (
              <div className="space-y-1 text-right text-sm">
                <div className="text-muted-foreground">
                  Contract value:{" "}
                  <span className="text-foreground">
                    {application.contractValue != null
                      ? formatCurrency(application.contractValue)
                      : "—"}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Facility applied:{" "}
                  <span className="text-foreground">
                    {application.facilityApplied != null
                      ? formatCurrency(application.facilityApplied)
                      : "—"}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Approved facility:{" "}
                  <span className="text-foreground">
                    {application.approvedFacility}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-center pt-1">
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Hide details" : "View details"}
            </button>
          </div>

          {expanded && (
            <div className="mt-4 overflow-hidden rounded-xl border">
              {application.invoices.length === 0 ? (
                <div className="rounded-xl border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                  No invoices available
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-sm font-semibold">
                        Invoice number
                      </TableHead>
                      <TableHead className="text-sm font-semibold">
                        Maturity date
                      </TableHead>
                      <TableHead className="text-sm font-semibold text-right">
                        Invoice value
                      </TableHead>
                      <TableHead className="text-sm font-semibold text-right">
                        Applied financing
                      </TableHead>
                      <TableHead className="text-sm font-semibold">
                        Document
                      </TableHead>
                      <TableHead className="text-sm font-semibold text-right">
                        Financing offered
                      </TableHead>
                      <TableHead className="text-sm font-semibold text-right">
                        Profit rate
                      </TableHead>
                      <TableHead className="text-sm font-semibold">
                        Status
                      </TableHead>
                      <TableHead className="text-sm font-semibold text-right w-[120px]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {application.invoices.map((inv) => (
                      <TableRow
                        key={inv.id}
                        className="odd:bg-muted/40 hover:bg-muted"
                      >
                        <TableCell className="text-[15px]">
                          {inv.number}
                        </TableCell>
                        <TableCell className="text-[15px]">
                          {inv.maturityDate
                            ? format(new Date(inv.maturityDate), "dd MMM yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-[15px]">
                          {inv.value
                            ? formatCurrency(inv.value)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-[15px]">
                          {inv.appliedFinancing != null
                            ? formatCurrency(inv.appliedFinancing)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-[15px]">
                          {inv.document}
                        </TableCell>
                        <TableCell className="text-right text-[15px]">
                          {inv.financingOffered}
                        </TableCell>
                        <TableCell className="text-right text-[15px]">
                          {inv.profitRate}
                        </TableCell>
                        <TableCell className="text-[15px]">
                          <Badge
                            variant="secondary"
                            className="rounded-md text-xs"
                          >
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {application.status === "APPROVED" && (
                              <Button
                                size="sm"
                                className="h-8 rounded-md bg-primary text-primary-foreground text-xs hover:opacity-95"
                              >
                                Review Offer
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 rounded-full bg-muted/50"
                                >
                                  <EllipsisVerticalIcon className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="rounded-xl"
                              >
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  disabled
                                >
                                  View document
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this application?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting}
            >
              {isRejecting ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ============================================================
   Main page
   ============================================================ */

const PER_PAGE_OPTIONS = [4, 8, 12] as const;

export default function ApplicationsPage() {
  const { setTitle } = useHeader();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [customerFilter, setCustomerFilter] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(4);
  const [applications, setApplications] =
    React.useState<(typeof MOCK_APPLICATIONS)[0][]>(MOCK_APPLICATIONS);

  React.useEffect(() => {
    setTitle("Applications");
  }, [setTitle]);

  const filteredApplications = React.useMemo(() => {
    let list = [...applications];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.company.toLowerCase().includes(q) ||
          a.customer.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (customerFilter !== "all") {
      list = list.filter((a) => a.customer === customerFilter);
    }
    return list;
  }, [applications, search, statusFilter, customerFilter]);

  const uniqueCustomers = React.useMemo(
    () => [...new Set(applications.map((a) => a.customer))],
    [applications]
  );

  const paginatedApplications = filteredApplications.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const totalCount = applications.length;
  const activeFilterCount = [
    statusFilter !== "all",
    customerFilter !== "all",
    dateFilter !== "all",
  ].filter(Boolean).length;
  const hasFilters = search !== "" || activeFilterCount > 0;
  const totalPages = Math.ceil(filteredApplications.length / perPage) || 1;
  const startIndex = (page - 1) * perPage + 1;
  const endIndex = Math.min(
    page * perPage,
    filteredApplications.length
  );

  const handleReject = (id: string) => {
    setApplications((prev) => prev.filter((a) => a.id !== id));
    if (page > 1 && paginatedApplications.length <= 1) {
      setPage((p) => Math.max(1, p - 1));
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome back, there!
          </h2>
          <p className="text-[17px] leading-7 text-muted-foreground mt-1">
            Manage your loan applications from this dashboard.
          </p>
        </div>
        <Button
          asChild
          className="gap-2 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-95"
        >
          <Link href="/applications/new">
            <PlusIcon className="h-4 w-4" />
            Apply for financing
          </Link>
        </Button>
      </section>

      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 px-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl font-bold">Applications</CardTitle>
            <Badge
              variant="secondary"
              className="rounded-full bg-muted text-muted-foreground font-normal hover:bg-muted"
            >
              {filteredApplications.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search applications..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-11 rounded-xl"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Filter
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-primary text-primary-foreground"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">
                    All statuses
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="DRAFT">Draft</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="SUBMITTED">
                    Pending Approval
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="AMENDMENT_REQUESTED">
                    Pending Amendment
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="APPROVED">
                    Offer Received
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="REJECTED">
                    Rejected
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="ARCHIVED">
                    Archived
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Customer</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={customerFilter}
                  onValueChange={(v) => {
                    setCustomerFilter(v);
                    setPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">
                    All customers
                  </DropdownMenuRadioItem>
                  {uniqueCustomers.map((c) => (
                    <DropdownMenuRadioItem key={c} value={c}>
                      {c}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={dateFilter}
                  onValueChange={(v) => {
                    setDateFilter(v);
                    setPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all">
                    All time
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="7d">Last 7 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="30d">
                    Last 30 days
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="90d">
                    Last 90 days
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                {hasFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("all");
                        setCustomerFilter("all");
                        setDateFilter("all");
                        setPage(1);
                      }}
                      className="gap-2 text-muted-foreground"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      Clear filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Badge
              variant="outline"
              className="h-11 px-4 rounded-xl text-sm font-normal bg-muted/30 border-none whitespace-nowrap text-muted-foreground hover:bg-muted/30"
            >
              {filteredApplications.length}{" "}
              {filteredApplications.length === 1 ? "application" : "applications"}
              {hasFilters ? ` of ${totalCount}` : ""}
            </Badge>
          </div>

          {/* Application cards */}
          <div className="rounded-xl border bg-muted/30 p-6">
            {paginatedApplications.length > 0 ? (
              <div className="space-y-4">
                {paginatedApplications.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    application={app}
                    onReject={() => handleReject(app.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                {totalCount === 0
                  ? "No applications yet."
                  : "No applications match your filters."}
              </div>
            )}

            {filteredApplications.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Rows per page:</span>
                    <Select
                      value={String(perPage)}
                      onValueChange={(v) => {
                        setPerPage(Number(v));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 w-16 rounded-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PER_PAGE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Showing {startIndex}-{endIndex} of {filteredApplications.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page === totalPages}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
