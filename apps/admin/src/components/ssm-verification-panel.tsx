"use client";

/**
 * SECTION: CTOS / company registry verification (onboarding admin)
 * WHY: Manual CTOS fetch and Application vs CTOS comparison before registry approval
 * INPUT: onboarding application + org CTOS list API for issuer portal
 * OUTPUT: comparison tables, checklist, attestation, approve/reject
 * WHERE USED: OnboardingReviewDialog (PENDING_SSM_REVIEW)
 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { Checkbox } from "@cashsouk/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BuildingOffice2Icon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import type { OnboardingApplicationResponse } from "@cashsouk/types";
import { buildOnboardingCtosComparison, type OnboardingVerificationRow } from "@/lib/onboarding-ctos-compare";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface SSMVerificationPanelProps {
  application: OnboardingApplicationResponse;
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
}

function ComparisonCell({ row, showMatchIcon }: { row: OnboardingVerificationRow; showMatchIcon: boolean }) {
  return (
    <div className="flex items-center gap-2 min-h-[1.5rem]">
      <span className="text-sm">{row.ctosCell ?? "—"}</span>
      {showMatchIcon && row.ctosCell != null && row.match ? (
        <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
      ) : null}
    </div>
  );
}

function AppCellWithIcon({ row }: { row: OnboardingVerificationRow }) {
  const showIcon = row.appCell !== "—" && row.ctosCell != null && row.match;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{row.appCell}</span>
      {showIcon ? <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden /> : null}
    </div>
  );
}

export function SSMVerificationPanel({
  application,
  onApprove,
  onReject,
  disabled = false,
}: SSMVerificationPanelProps) {
  const [confirmed, setConfirmed] = React.useState(false);
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();

  const isIssuerPortal = application.portal === "issuer";
  const orgId = application.organizationId;

  const ctosQuery = useQuery({
    queryKey: ["admin", "organization-ctos-reports", orgId],
    queryFn: async () => {
      const res = await apiClient.listAdminOrganizationCtosReports("issuer", orgId);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    enabled: isIssuerPortal && Boolean(orgId),
  });

  const fetchCtosMutation = useMutation({
    mutationFn: async () => {
      console.log("Fetching CTOS report for issuer organization:", orgId);
      const res = await apiClient.createAdminOrganizationCtosReport("issuer", orgId);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: () => {
      console.log("CTOS report request finished for organization:", orgId);
      void queryClient.invalidateQueries({ queryKey: ["admin", "organization-ctos-reports", orgId] });
    },
  });

  const hasCompanyInfo = application.type === "COMPANY" && application.organizationName;

  const latestOrgCtos = React.useMemo(() => {
    const rows = ctosQuery.data ?? [];
    const orgRows = rows.filter((r) => !r.subject_ref);
    return orgRows[0] ?? null;
  }, [ctosQuery.data]);

  const companyJson = latestOrgCtos?.company_json ?? null;
  const hasCtosPayload = isIssuerPortal && companyJson != null && typeof companyJson === "object";

  const comparison = React.useMemo(
    () => buildOnboardingCtosComparison(application, hasCtosPayload ? companyJson : null),
    [application, hasCtosPayload, companyJson]
  );

  const autoChecksPass =
    !isIssuerPortal || (hasCtosPayload && comparison.checklist.every((c) => c.ok));

  const canApprove = confirmed && autoChecksPass && !fetchCtosMutation.isPending;

  if (!hasCompanyInfo) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-destructive">
            <ExclamationTriangleIcon className="h-5 w-5" />
            <span>Company details not available</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isAlreadyVerified = application.ssmVerified;

  const companyRows: { label: string; row: OnboardingVerificationRow }[] = [
    { label: "Company name", row: comparison.companyName },
    { label: "SSM registration no.", row: comparison.registration },
    { label: "Industry / business activity", row: comparison.industryActivity },
    { label: "Entity type", row: comparison.entityType },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <BuildingOffice2Icon className="h-5 w-5" />
                Company info
              </CardTitle>
              <CardDescription>
                Compare application data with CTOS. For issuer companies, fetch the latest CTOS company report
                before approving.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAlreadyVerified ? (
                <Badge className="bg-emerald-600 text-white">
                  <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                  Verified
                </Badge>
              ) : null}
              {isIssuerPortal ? (
                <Button
                  type="button"
                  className="gap-2 shrink-0"
                  disabled={disabled || fetchCtosMutation.isPending || ctosQuery.isLoading}
                  onClick={() => fetchCtosMutation.mutate()}
                >
                  <DocumentTextIcon className="h-4 w-4" />
                  {fetchCtosMutation.isPending ? "Fetching…" : "Get CTOS report"}
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isIssuerPortal ? (
            <div className="rounded-lg border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              CTOS company snapshots are stored for issuer organizations only. Use SSM / manual sources to verify
              investor companies, then confirm below.
            </div>
          ) : null}

          {isIssuerPortal && ctosQuery.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {(ctosQuery.error as Error)?.message ?? "Could not load CTOS reports."}
            </div>
          ) : null}

          {fetchCtosMutation.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {(fetchCtosMutation.error as Error).message}
            </div>
          ) : null}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[28%] font-semibold">Field</TableHead>
                  <TableHead className="font-semibold">Application</TableHead>
                  <TableHead className="font-semibold">CTOS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyRows.map(({ label, row }) => (
                  <TableRow key={label}>
                    <TableCell className="font-medium text-muted-foreground">{label}</TableCell>
                    <TableCell>
                      <AppCellWithIcon row={row} />
                    </TableCell>
                    <TableCell>
                      <ComparisonCell row={row} showMatchIcon={Boolean(isIssuerPortal && hasCtosPayload)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Directors</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[28%] font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Application</TableHead>
                    <TableHead className="font-semibold">CTOS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.directors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-sm text-muted-foreground">
                        No directors with Director role found in onboarding data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comparison.directors.map((row, i) => (
                      <TableRow key={`d-${i}-${row.appCell}`}>
                        <TableCell className="font-medium text-muted-foreground">Director</TableCell>
                        <TableCell>
                          <AppCellWithIcon row={row} />
                        </TableCell>
                        <TableCell>
                          <ComparisonCell row={row} showMatchIcon={Boolean(isIssuerPortal && hasCtosPayload)} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Shareholders</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[28%] font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Application</TableHead>
                    <TableHead className="font-semibold">CTOS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.shareholders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-sm text-muted-foreground">
                        No shareholders found in onboarding data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comparison.shareholders.map((row, i) => (
                      <TableRow key={`s-${i}-${row.appCell}`}>
                        <TableCell className="font-medium text-muted-foreground">Shareholder</TableCell>
                        <TableCell>
                          <AppCellWithIcon row={row} />
                        </TableCell>
                        <TableCell>
                          <ComparisonCell row={row} showMatchIcon={Boolean(isIssuerPortal && hasCtosPayload)} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
            <p className="text-sm font-medium">Automated checks</p>
            <ul className="space-y-1.5">
              {comparison.checklist.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  {isIssuerPortal && hasCtosPayload ? (
                    item.ok ? (
                      <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 shrink-0" />
                    )
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-muted-foreground/40 shrink-0" aria-hidden />
                  )}
                  <span className={item.ok && isIssuerPortal && hasCtosPayload ? "text-foreground" : "text-muted-foreground"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
            {isIssuerPortal && !hasCtosPayload ? (
              <p className="text-xs text-muted-foreground pt-1">
                Run &quot;Get CTOS report&quot; to populate CTOS columns and enable automated checks.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isAlreadyVerified ? (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-900 dark:text-emerald-100">CTOS verification completed</p>
                {application.ssmVerifiedAt && application.ssmVerifiedBy ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    Verified by {application.ssmVerifiedBy} on{" "}
                    {new Date(application.ssmVerifiedAt).toLocaleDateString("en-MY", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!isAlreadyVerified ? (
        <Card className="border-primary/25 bg-primary/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">CTOS verification required</CardTitle>
            <CardDescription>
              {isIssuerPortal
                ? "Fetch CTOS, confirm the checklist passes, then attest before approving."
                : "Confirm you have verified this company against SSM or equivalent records."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Separator />
            <div className="flex items-start space-x-3">
              <Checkbox
                id="ctos-confirmed"
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
                disabled={disabled}
              />
              <Label htmlFor="ctos-confirmed" className="text-sm font-medium leading-relaxed cursor-pointer">
                I have verified this company against CTOS / SSM records.
              </Label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={onApprove}
                disabled={!canApprove || disabled}
                className="flex-1 gap-2 sm:order-1"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Approve CTOS verification
              </Button>
              <Button
                variant="outline"
                onClick={onReject}
                disabled={disabled}
                className="border-destructive text-destructive hover:bg-destructive/10 sm:order-2"
              >
                Reject
              </Button>
            </div>
            {isIssuerPortal && !hasCtosPayload ? (
              <p className="text-xs text-muted-foreground text-center">
                Approve stays disabled until a CTOS company report is loaded and all checks pass.
              </p>
            ) : null}
            {isIssuerPortal && hasCtosPayload && !comparison.checklist.every((c) => c.ok) ? (
              <p className="text-xs text-muted-foreground text-center">
                Resolve mismatches or reject. Approve is only available when every automated check passes.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
