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
import { OrganizationDetailDialog } from "./organization-detail-dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { OrganizationResponse, PortalType } from "@cashsouk/types";

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
            </>
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

  // Investor: 10 columns (includes risk + sophisticated + deposit), Issuer: 8 columns
  const columnCount = portal === "investor" ? 10 : 8;

  // State for detail dialog
  const [selectedOrg, setSelectedOrg] = React.useState<{
    portal: PortalType;
    id: string;
  } | null>(null);

  const handleViewDetails = (org: OrganizationResponse) => {
    setSelectedOrg({ portal: org.portal, id: org.id });
  };

  return (
    <>
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-sm font-semibold">Organization</TableHead>
                <TableHead className="text-sm font-semibold">Type</TableHead>
                <TableHead className="text-sm font-semibold">Onboarding</TableHead>
                <TableHead className="text-sm font-semibold">Risk</TableHead>
                {portal === "investor" && (
                  <>
                    <TableHead className="text-sm font-semibold">Sophisticated</TableHead>
                    <TableHead className="text-sm font-semibold">Deposit</TableHead>
                  </>
                )}
                <TableHead className="text-sm font-semibold">Members</TableHead>
                <TableHead className="text-sm font-semibold">Created</TableHead>
                <TableHead className="text-sm font-semibold">Updated</TableHead>
                <TableHead className="text-sm font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton portal={portal} />
              ) : organizations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="text-center py-10 text-muted-foreground">
                    No organizations found
                  </TableCell>
                </TableRow>
              ) : (
                organizations.map((org) => (
                  <OrganizationsTableRow
                    key={`${org.portal}-${org.id}`}
                    organization={org}
                    showSophisticated={portal === "investor"}
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

      {/* Organization Detail Dialog */}
      <OrganizationDetailDialog
        portal={selectedOrg?.portal ?? null}
        organizationId={selectedOrg?.id ?? null}
        open={selectedOrg !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedOrg(null);
        }}
      />
    </>
  );
}

