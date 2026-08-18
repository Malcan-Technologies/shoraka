"use client";

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
import { OrganizationsTableRow } from "./organizations-table-row";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import type { OrganizationResponse, PortalType } from "@cashsouk/types";
import { orgHref } from "@/lib/admin-directory-hrefs";
import { SortableTableHead } from "@/shared/admin-list/components/sortable-table-head";
import { useTableSort } from "@/shared/admin-list/use-table-sort";
import { organizationsSortValue } from "@/organizations/utils/organizations-table-sort";

interface OrganizationsTableProps {
  portal: PortalType;
  organizations: OrganizationResponse[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  totalOrganizations: number;
  onPageChange: (page: number) => void;
}

function TableSkeleton({ portal }: { portal: PortalType }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-5 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16" />
          </TableCell>
          {portal === "investor" && (
            <>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
            </>
          )}
          {portal === "issuer" && (
            <TableCell>
              <Skeleton className="h-5 w-16" />
            </TableCell>
          )}
          <TableCell>
            <Skeleton className="h-5 w-10" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function OrganizationsTable({
  portal,
  organizations,
  loading,
  currentPage,
  pageSize,
  totalOrganizations,
  onPageChange,
}: OrganizationsTableProps) {
  const totalPages = Math.ceil(totalOrganizations / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalOrganizations);

  const router = useRouter();
  const { sortedRows, sortColumn, sortDirection, onSort } = useTableSort(
    organizations,
    organizationsSortValue
  );

  // Investor: 12 columns (risk + sophisticated + deposit + wallet + invested), Issuer: 9 columns
  const columnCount = portal === "investor" ? 12 : 9;

  const handleViewDetails = (org: OrganizationResponse) => {
    router.push(orgHref(org.portal, org.id));
  };

  return (
    <>
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableTableHead
                  column="organization"
                  label="Organization"
                  className="min-w-[180px] max-w-[280px]"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
                <SortableTableHead
                  column="type"
                  label="Type"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
                <TableHead className="text-sm font-semibold">Onboarding</TableHead>
                <SortableTableHead
                  column="risk"
                  label="Risk"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
                {portal === "investor" && (
                  <>
                    <SortableTableHead
                      column="sophisticated"
                      label="Sophisticated"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                    <SortableTableHead
                      column="deposit"
                      label="Deposit"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                    <SortableTableHead
                      column="wallet"
                      label="Wallet"
                      className="text-right [&>button]:ml-auto"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                    <SortableTableHead
                      column="invested"
                      label="Invested"
                      className="text-right [&>button]:ml-auto"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                  </>
                )}
                {portal === "issuer" && (
                  <SortableTableHead
                    column="onboardingFee"
                    label="Onboarding Fee"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={onSort}
                  />
                )}
                <SortableTableHead
                  column="members"
                  label="Members"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
                <SortableTableHead
                  column="created"
                  label="Created"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
                <SortableTableHead
                  column="updated"
                  label="Updated"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
                <TableHead className="text-sm font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton portal={portal} />
              ) : sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="text-center py-10 text-muted-foreground">
                    {portal === "issuer" ? "No issuers found" : "No investors found"}
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((org) => (
                  <OrganizationsTableRow
                    key={`${org.portal}-${org.id}`}
                    organization={org}
                    showSophisticated={portal === "investor"}
                    showOnboardingFee={portal === "issuer"}
                    onViewDetails={handleViewDetails}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && organizations.length > 0 && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex}-{endIndex} of {totalOrganizations}
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

