"use client";

import Link from "next/link";
import { EyeIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import {
  formatApplicationReference,
  formatNamedEntityDisplay,
  type PaymasterSubmittedApplicationIdentity,
} from "@cashsouk/types";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { ApplicationStatusBadge } from "@/components/application-review/application-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orgHref } from "@/lib/admin-directory-hrefs";
import { paymasterApplicationReviewHref } from "@/paymasters/utils/paymaster-linked-records";

function applicationLabel(row: PaymasterSubmittedApplicationIdentity): string {
  return formatApplicationReference({
    displayReference: row.applicationDisplayReference,
    id: row.applicationId,
  });
}

export function PaymasterSubmittedIdentitiesCard({
  identities,
}: {
  identities: PaymasterSubmittedApplicationIdentity[];
}) {
  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={DocumentTextIcon}
        title="Submitted Application Identities"
        description="What issuers declared on linked applications for this SSM. These are not separate Paymaster records."
      />
      <CardContent>
        {identities.length === 0 ? (
          <p className="py-8 text-center text-ui text-muted-foreground">
            No submitted application identities available yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Application</TableHead>
                  <TableHead>Issuer</TableHead>
                  <TableHead>Submitted name</TableHead>
                  <TableHead>Entity type</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {identities.map((row) => {
                  const href = paymasterApplicationReviewHref(
                    row.applicationProductId,
                    row.applicationId
                  );
                  const issuerHref = row.issuerOrganizationId
                    ? orgHref("issuer", row.issuerOrganizationId)
                    : null;
                  const issuerName = formatNamedEntityDisplay(row.issuerName, null);
                  return (
                    <TableRow key={row.applicationId} className="odd:bg-muted/40 hover:bg-muted">
                      <TableCell className="min-w-[140px] font-medium">
                        {href ? (
                          <Link href={href} className="text-primary underline-offset-4 hover:underline">
                            {applicationLabel(row)}
                          </Link>
                        ) : (
                          applicationLabel(row)
                        )}
                      </TableCell>
                      <TableCell className="text-ui">
                        {issuerHref ? (
                          <Link
                            href={issuerHref}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {issuerName}
                          </Link>
                        ) : (
                          issuerName
                        )}
                      </TableCell>
                      <TableCell className="min-w-[180px] font-medium">{row.legalName}</TableCell>
                      <TableCell className="text-ui text-muted-foreground">{row.entityType}</TableCell>
                      <TableCell className="text-ui text-muted-foreground">
                        {row.registrationCountry}
                      </TableCell>
                      <TableCell>
                        {row.applicationStatus ? (
                          <ApplicationStatusBadge status={row.applicationStatus} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {href ? (
                          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                            <Link href={href}>
                              <EyeIcon className="h-4 w-4" />
                              View
                            </Link>
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-8 px-2" disabled>
                            <EyeIcon className="h-4 w-4" />
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
