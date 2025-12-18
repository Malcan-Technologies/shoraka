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
import { OnboardingQueueRow } from "./onboarding-queue-row";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

export type OnboardingApprovalStatus =
  | "PENDING_SSM_REVIEW"
  | "SSM_APPROVED"
  | "PENDING_ONBOARDING"
  | "PENDING_AML"
  | "APPROVED"
  | "REJECTED";

export interface OnboardingApplication {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: "PERSONAL" | "COMPANY";
  portal: "INVESTOR" | "ISSUER";
  regtankRequestId: string;
  status: OnboardingApprovalStatus;
  submittedAt: Date;
  approvedAt?: Date;
  companyDetails?: {
    companyName: string;
    registrationNumber: string;
    businessType: string;
    address: string;
    directors: string[];
  };
  ssmVerified?: boolean;
  ssmVerifiedAt?: Date;
  ssmVerifiedBy?: string;
}

interface OnboardingQueueTableProps {
  applications: OnboardingApplication[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  totalApplications: number;
  onPageChange: (page: number) => void;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-9 w-20" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function OnboardingQueueTable({
  applications,
  loading,
  currentPage,
  pageSize,
  totalApplications,
  onPageChange,
}: OnboardingQueueTableProps) {
  const totalPages = Math.ceil(totalApplications / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalApplications);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-sm font-semibold min-w-[200px]">User</TableHead>
              <TableHead className="text-sm font-semibold">Type</TableHead>
              <TableHead className="text-sm font-semibold">Portal</TableHead>
              <TableHead className="text-sm font-semibold">Submitted</TableHead>
              <TableHead className="text-sm font-semibold">Approved</TableHead>
              <TableHead className="text-sm font-semibold">Status</TableHead>
              <TableHead className="text-sm font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No applications found
                </TableCell>
              </TableRow>
            ) : (
              applications.map((application) => (
                <OnboardingQueueRow key={application.id} application={application} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && applications.length > 0 && (
        <div className="flex items-center justify-between border-t px-6 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex}-{endIndex} of {totalApplications}
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
              Page {currentPage} of {totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

