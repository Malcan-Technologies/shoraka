"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { useContractDetail } from "@/hooks/use-contract-detail";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import { ApplicationStatusBadge } from "@/components/application-review";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ContractDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { data, isLoading, error } = useContractDetail(id);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Button variant="ghost" size="sm" onClick={() => router.push("/contracts")} className="gap-2 h-8 px-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-lg font-semibold">Contract Details</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-8">
          {isLoading && (
            <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
              Loading contract details...
            </div>
          )}

          {error && (
            <div className="rounded-2xl border bg-card p-6 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load contract details"}
            </div>
          )}

          {data && (
            <>
              <section className="rounded-2xl border bg-card shadow-sm p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <DocumentTextIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">
                        {data.contractNumber || data.id.slice(-8).toUpperCase()}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Contract reference {data.id}
                      </p>
                    </div>
                  </div>
                  <ApplicationStatusBadge status={data.status} />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Organization</p>
                    <p className="mt-1 text-sm font-medium flex items-center gap-1.5">
                      <BuildingOffice2Icon className="h-4 w-4 text-muted-foreground" />
                      {data.issuerOrganizationName || "Unnamed Organization"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Requested Facility</p>
                    <p className="mt-1 text-sm font-semibold">{formatCurrency(data.requestedFacility)}</p>
                  </div>
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved Facility</p>
                    <p className="mt-1 text-sm font-semibold">{formatCurrency(data.approvedFacility)}</p>
                  </div>
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
                    <p className="mt-1 text-sm font-medium">{format(new Date(data.updatedAt), "dd MMM yyyy, HH:mm")}</p>
                  </div>
                </div>

                {(data.title || data.description) && (
                  <div className="rounded-xl border bg-background p-4">
                    {data.title && <p className="text-sm font-semibold">{data.title}</p>}
                    {data.description && <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h3 className="text-base font-semibold">Related Applications</h3>
                    <p className="text-sm text-muted-foreground">
                      Applications tied to this contract
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-xl px-3 py-1">
                    {data.applications.length} {data.applications.length === 1 ? "application" : "applications"}
                  </Badge>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-sm font-semibold">Application Ref</TableHead>
                      <TableHead className="text-sm font-semibold">Requested Amount</TableHead>
                      <TableHead className="text-sm font-semibold">Submitted</TableHead>
                      <TableHead className="text-sm font-semibold">Status</TableHead>
                      <TableHead className="text-sm font-semibold">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.applications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          No linked applications
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.applications.map((application) => (
                        <TableRow key={application.id} className="odd:bg-muted/40 hover:bg-muted">
                          <TableCell className="text-sm font-medium">
                            {application.id.slice(-8).toUpperCase()}
                          </TableCell>
                          <TableCell className="text-sm font-semibold">
                            {formatCurrency(application.requestedAmount)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {application.submittedAt
                              ? format(new Date(application.submittedAt), "dd MMM yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <ApplicationStatusBadge status={application.status} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(application.updatedAt), "dd MMM yyyy")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
