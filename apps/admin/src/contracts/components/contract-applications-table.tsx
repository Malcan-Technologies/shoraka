import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import { formatApplicationReference, type AdminContractApplicationSummary } from "@cashsouk/types";
import { ApplicationStatusBadge } from "@/components/application-review";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminActionRowClass, getAdminStatusToken } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";

export function ContractApplicationsTable({
  applications,
}: {
  applications: AdminContractApplicationSummary[];
}) {
  if (applications.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-4">
        <p className="text-ui font-medium">No linked applications</p>
        <p className="mt-1 text-meta text-muted-foreground">
          Applications drawn against this facility will appear here once the issuer submits them.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Application</TableHead>
          <TableHead>Requested</TableHead>
          <TableHead className="hidden md:table-cell">Submitted</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Updated</TableHead>
          <TableHead className="text-right">Review</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((application) => (
          <TableRow
            key={application.id}
            className={cn(
              "odd:bg-muted/40 hover:bg-muted",
              adminActionRowClass(getAdminStatusToken(application.status))
            )}
          >
            <TableCell className="font-mono text-meta font-medium">
              {formatApplicationReference({
                displayReference: application.displayReference,
                id: application.id,
              })}
            </TableCell>
            <TableCell className="font-semibold">
              {formatCurrency(application.requestedAmount)}
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              {application.submittedAt
                ? format(new Date(application.submittedAt), "dd MMM yyyy")
                : "—"}
            </TableCell>
            <TableCell>
              <ApplicationStatusBadge status={application.status} />
            </TableCell>
            <TableCell className="hidden text-muted-foreground lg:table-cell">
              {format(new Date(application.updatedAt), "dd MMM yyyy")}
            </TableCell>
            <TableCell className="text-right">
              {application.productId ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link
                    href={`/applications/${encodeURIComponent(application.productId)}/${encodeURIComponent(application.id)}`}
                  >
                    Review
                  </Link>
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled>
                  Review
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
