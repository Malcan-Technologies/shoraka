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
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowTopRightOnSquareIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import type {
  AdminCtosReportListItem,
  CorporateDirectorData,
  OnboardingApplicationResponse,
} from "@cashsouk/types";
import {
  buildOnboardingCtosComparison,
  companyJsonReadyForCtosCompare,
  getOnboardingPeopleSplit,
  type OnboardingCtosOrgFetchState,
  type OnboardingVerificationRow,
} from "@/lib/onboarding-ctos-compare";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Set to true to preview CTOS comparison UI with fake list + company_json (mirrors this application).
 * Set back to false before shipping.
 */
const USE_MOCK_ONBOARDING_CTOS = true;

/** When the real application has no people rows, inject one director + one shareholder so mock tables show data. */
function syntheticDemoDirectorKycForMock(): CorporateDirectorData {
  const t = new Date(0).toISOString();
  return {
    corpIndvDirectorCount: 1,
    corpIndvShareholderCount: 1,
    corpBizShareholderCount: 0,
    directors: [
      {
        eodRequestId: "mock-onboarding-dir",
        name: "Ahmad Bin Hassan",
        email: "",
        role: "Director",
        kycStatus: "APPROVED",
        governmentIdNumber: "800101015001",
        lastUpdated: t,
      },
      {
        eodRequestId: "mock-onboarding-sh",
        name: "Lim Mei Ling",
        email: "",
        role: "Shareholder (35%)",
        kycStatus: "APPROVED",
        governmentIdNumber: "900505105022",
        lastUpdated: t,
      },
    ],
    lastSyncedAt: t,
  };
}

function buildMockOrgCtosReports(application: OnboardingApplicationResponse): AdminCtosReportListItem[] {
  const orgId = application.organizationId;
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const digits = (s: string) => s.replace(/\D/g, "");
  const regDigits = digits(application.registrationNumber ?? "") || "202201012345";
  const orgName = application.organizationName ?? "Mock Holdings Sdn Bhd";
  const { directors, shareholders } = getOnboardingPeopleSplit(application);

  const ctosPeople: Record<string, unknown>[] = [];
  let seq = 0;
  const fallbackId = (raw: string | undefined, prefix: string) => {
    const t = String(raw ?? "").trim().replace(/\s+/g, "");
    if (t) return t;
    return `${prefix}${String(++seq).padStart(6, "0")}`;
  };
  for (const p of directors) {
    ctosPeople.push({
      nic_brno: fallbackId(p.governmentIdNumber, "MOCKD"),
      ic_lcno: null,
      name: p.name,
      position: "DO",
      equity_percentage: null,
      equity: null,
      party_type: "I",
    });
  }
  for (const p of shareholders) {
    const baseName = p.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || p.name;
    ctosPeople.push({
      nic_brno: fallbackId(p.governmentIdNumber, "MOCKS"),
      ic_lcno: null,
      name: baseName,
      position: "SO",
      equity_percentage: null,
      equity: null,
      party_type: "I",
    });
  }

  const company_json = {
    name: orgName,
    brn_ssm: regDigits,
    directors: ctosPeople,
  };

  const latest: AdminCtosReportListItem = {
    id: "mock-onboarding-ctos-latest",
    issuer_organization_id: orgId,
    subject_ref: null,
    fetched_at: now,
    created_at: now,
    updated_at: now,
    has_report_html: false,
    company_json,
  };
  const older: AdminCtosReportListItem = {
    id: "mock-onboarding-ctos-older",
    issuer_organization_id: orgId,
    subject_ref: null,
    fetched_at: yesterday,
    created_at: yesterday,
    updated_at: yesterday,
    has_report_html: false,
    company_json: {
      name: orgName,
      brn_ssm: regDigits,
      directors: ctosPeople.map((row) => ({ ...row })),
    },
  };
  return [latest, older];
}

const compareTableClass = "table-fixed w-full min-w-[44rem] text-sm";
const compareThField = "w-[30%] min-w-[12.5rem] px-4 py-3 align-top font-semibold text-foreground";
const compareThData = "w-[35%] min-w-[14rem] px-4 py-3 align-top font-semibold text-foreground";
const compareTdField = "min-w-[12.5rem] px-4 py-3 align-top font-medium text-muted-foreground break-words";
const compareTdData = "min-w-[14rem] px-4 py-3 align-top break-words";

interface SSMVerificationPanelProps {
  application: OnboardingApplicationResponse;
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
}

function ctosCellDisplayText(row: OnboardingVerificationRow, state: OnboardingCtosOrgFetchState): string {
  if (row.ctosCell != null && String(row.ctosCell).trim() !== "") return row.ctosCell;
  if (state === "not_pulled") return "Not fetched";
  if (state === "no_record") return "No record found";
  return "—";
}

function ComparisonCell({
  row,
  orgFetchState,
}: {
  row: OnboardingVerificationRow;
  orgFetchState: OnboardingCtosOrgFetchState;
}) {
  const text = ctosCellDisplayText(row, orgFetchState);
  const ready = orgFetchState === "ready";
  const id = row.ctosIdDisplay?.trim();
  const showId = Boolean(ready && id);
  return (
    <div className="min-h-[1.5rem]">
      <span className="text-sm">{text}</span>
      {showId ? (
        <div className="text-xs text-muted-foreground mt-0.5">IC / Reg. no.: {id}</div>
      ) : null}
    </div>
  );
}

function AppComparisonValue({ row }: { row: OnboardingVerificationRow }) {
  const id = row.appIdDisplay?.trim();
  return (
    <div className="min-h-[1.5rem]">
      <span className="text-sm font-medium">{row.appCell}</span>
      {id ? (
        <div className="text-xs text-muted-foreground mt-0.5">IC / Reg. no.: {id}</div>
      ) : null}
    </div>
  );
}

function sortOrgCtosReports(rows: AdminCtosReportListItem[]): AdminCtosReportListItem[] {
  const orgRows = rows.filter((r) => !r.subject_ref);
  return [...orgRows].sort(
    (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
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

  const applicationForCompare = React.useMemo(() => {
    if (!USE_MOCK_ONBOARDING_CTOS || !isIssuerPortal) return application;
    const { directors, shareholders } = getOnboardingPeopleSplit(application);
    if (directors.length > 0 || shareholders.length > 0) return application;
    console.log("Mock onboarding CTOS: no app people, adding demo director + shareholder", {
      organizationId: application.organizationId,
    });
    return { ...application, directorKycStatus: syntheticDemoDirectorKycForMock() };
  }, [application, isIssuerPortal]);

  const ctosQuery = useQuery({
    queryKey: ["admin", "organization-ctos-reports", orgId],
    queryFn: async () => {
      const res = await apiClient.listAdminOrganizationCtosReports("issuer", orgId);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    enabled: isIssuerPortal && Boolean(orgId) && !USE_MOCK_ONBOARDING_CTOS,
  });

  const fetchCtosMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.createAdminOrganizationCtosReport("issuer", orgId);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "organization-ctos-reports", orgId] });
      toast.success("CTOS report saved.");
    },
    onError: (e: Error) => {
      toast.error(e.message || "CTOS request failed");
    },
  });

  const hasCompanyInfo = application.type === "COMPANY" && application.organizationName;

  const orgCtosReports = React.useMemo(() => {
    const raw =
      USE_MOCK_ONBOARDING_CTOS && isIssuerPortal
        ? buildMockOrgCtosReports(applicationForCompare)
        : (ctosQuery.data ?? []);
    return sortOrgCtosReports(raw);
  }, [applicationForCompare, ctosQuery.data, isIssuerPortal]);

  const latestOrgCtos = orgCtosReports[0] ?? null;
  const companyJson = latestOrgCtos?.company_json ?? null;

  const orgFetchState: OnboardingCtosOrgFetchState = React.useMemo(() => {
    if (!isIssuerPortal) return "not_pulled";
    if (USE_MOCK_ONBOARDING_CTOS) {
      if (orgCtosReports.length === 0) return "not_pulled";
      if (!companyJsonReadyForCtosCompare(companyJson)) return "no_record";
      return "ready";
    }
    if (!ctosQuery.isSuccess) return "not_pulled";
    if (orgCtosReports.length === 0) return "not_pulled";
    if (!companyJsonReadyForCtosCompare(companyJson)) return "no_record";
    return "ready";
  }, [isIssuerPortal, ctosQuery.isSuccess, orgCtosReports.length, companyJson]);

  const compareState = isIssuerPortal ? orgFetchState : "not_pulled";

  const comparison = React.useMemo(
    () => buildOnboardingCtosComparison(applicationForCompare, companyJson, compareState),
    [applicationForCompare, companyJson, compareState]
  );

  const compareReady = isIssuerPortal && orgFetchState === "ready";

  const autoChecksPass =
    !isIssuerPortal || (compareReady && comparison.checklist.every((c) => c.ok));

  const canApprove = confirmed && autoChecksPass && !fetchCtosMutation.isPending;

  const ctosListLoading = !USE_MOCK_ONBOARDING_CTOS && ctosQuery.isLoading;

  const openOrgReportHtml = React.useCallback(
    async (reportId: string) => {
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in");
        return;
      }
      const url = `${API_URL}/v1/admin/organizations/issuer/${encodeURIComponent(orgId)}/ctos-reports/${reportId}/html`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        toast.error("Could not load full report");
        return;
      }
      const html = await res.text();
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    },
    [getAccessToken, orgId]
  );

  const onGetLatestReport = () => {
    if (USE_MOCK_ONBOARDING_CTOS) {
      toast.message("Mock mode", { description: "Set USE_MOCK_ONBOARDING_CTOS to false to call the real API." });
      return;
    }
    const t = toast.loading("Fetching CTOS report…");
    fetchCtosMutation.mutate(undefined, {
      onSettled: () => toast.dismiss(t),
    });
  };

  if (!hasCompanyInfo) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-destructive">
            <ExclamationTriangleIcon className="h-5 w-5" />
            <span>No company details.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isAlreadyVerified = application.ssmVerified;

  const companyRows: { label: string; row: OnboardingVerificationRow }[] = [
    { label: "Company name", row: comparison.companyName },
    { label: "SSM registration no.", row: comparison.registration },
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
                {isIssuerPortal
                  ? "Compare the application with CTOS. Use Get latest report if nothing is listed yet."
                  : "Compare the application with your SSM or registry checks."}
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
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 shrink-0"
                                       disabled={
                      disabled ||
                      USE_MOCK_ONBOARDING_CTOS ||
                      !latestOrgCtos?.has_report_html ||
                      ctosListLoading
                    }
                    onClick={() => latestOrgCtos && void openOrgReportHtml(latestOrgCtos.id)}
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    View report
                  </Button>
                  <Button
                    type="button"
                    className="gap-2 shrink-0"
                    disabled={
                      disabled ||
                      USE_MOCK_ONBOARDING_CTOS ||
                      fetchCtosMutation.isPending ||
                      ctosListLoading
                    }
                    onClick={onGetLatestReport}
                  >
                    <DocumentTextIcon className="h-4 w-4" />
                    {fetchCtosMutation.isPending ? "Loading…" : "Get latest report"}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isIssuerPortal ? (
            <div className="rounded-lg border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              CTOS reports are for issuers only. For investors, check SSM yourself, then confirm below.
            </div>
          ) : null}

          {isIssuerPortal && USE_MOCK_ONBOARDING_CTOS ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              Mock CTOS preview: list and company extract are fake (aligned to this application). Set{" "}
              <span className="font-mono text-xs">USE_MOCK_ONBOARDING_CTOS</span> to{" "}
              <span className="font-mono text-xs">false</span> in{" "}
              <span className="font-mono text-xs">ssm-verification-panel.tsx</span> for real data.
            </div>
          ) : null}

          {isIssuerPortal && !USE_MOCK_ONBOARDING_CTOS && ctosQuery.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {(ctosQuery.error as Error)?.message ?? "Could not load CTOS."}
            </div>
          ) : null}

          {isIssuerPortal ? (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
              <p className="text-sm font-medium">CTOS reports for this organization</p>
              {ctosListLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : orgCtosReports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reports yet. Click Get latest report.</p>
              ) : (
                <ul className="space-y-2">
                  {orgCtosReports.map((r, idx) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-border/60 pb-2 last:border-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">
                          {new Date(r.fetched_at).toLocaleString("en-MY", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {idx === 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            Latest
                          </Badge>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1"
                        disabled={!r.has_report_html}
                        onClick={() => void openOrgReportHtml(r.id)}
                      >
                        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="rounded-md border overflow-x-auto">
            <Table className={compareTableClass}>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className={compareThField}>Field</TableHead>
                  <TableHead className={compareThData}>Application</TableHead>
                  <TableHead className={compareThData}>CTOS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyRows.map(({ label, row }) => (
                  <TableRow key={label}>
                    <TableCell className={compareTdField}>{label}</TableCell>
                    <TableCell className={compareTdData}>
                      <AppComparisonValue row={row} />
                    </TableCell>
                    <TableCell className={compareTdData}>
                      <ComparisonCell row={row} orgFetchState={orgFetchState} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Directors</h4>
            <div className="rounded-md border overflow-x-auto">
              <Table className={compareTableClass}>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={compareThField}>Name</TableHead>
                    <TableHead className={compareThData}>Application</TableHead>
                    <TableHead className={compareThData}>CTOS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.directors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className={`${compareTdData} text-muted-foreground`}>
                        No directors listed.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comparison.directors.map((row, i) => (
                      <TableRow key={`d-${i}-${row.appCell}`}>
                        <TableCell className={compareTdField}>Director</TableCell>
                        <TableCell className={compareTdData}>
                          <AppComparisonValue row={row} />
                        </TableCell>
                        <TableCell className={compareTdData}>
                          <ComparisonCell row={row} orgFetchState={orgFetchState} />
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
            <div className="rounded-md border overflow-x-auto">
              <Table className={compareTableClass}>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={compareThField}>Name</TableHead>
                    <TableHead className={compareThData}>Application</TableHead>
                    <TableHead className={compareThData}>CTOS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.shareholders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className={`${compareTdData} text-muted-foreground`}>
                        No shareholders listed.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comparison.shareholders.map((row, i) => (
                      <TableRow key={`s-${i}-${row.appCell}`}>
                        <TableCell className={compareTdField}>Shareholder</TableCell>
                        <TableCell className={compareTdData}>
                          <AppComparisonValue row={row} />
                        </TableCell>
                        <TableCell className={compareTdData}>
                          <ComparisonCell row={row} orgFetchState={orgFetchState} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
            <p className="text-sm font-medium">Checks</p>
            <ul className="space-y-1.5">
              {comparison.checklist.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  {isIssuerPortal ? (
                    compareReady ? (
                      item.ok ? (
                        <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 shrink-0" />
                      )
                    ) : (
                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 shrink-0" />
                    )
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-muted-foreground/40 shrink-0" aria-hidden />
                  )}
                  <span
                    className={
                      item.ok && isIssuerPortal && compareReady ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
            {isIssuerPortal && orgFetchState === "not_pulled" ? (
              <p className="text-xs text-muted-foreground pt-1">
                No CTOS data yet — checks stay failed until you fetch a report with company data.
              </p>
            ) : null}
            {isIssuerPortal && orgFetchState === "no_record" ? (
              <p className="text-xs text-muted-foreground pt-1">
                Report saved but no company extract — try Get latest report again or check the full HTML.
              </p>
            ) : null}
          </div>

          {!isAlreadyVerified ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Switch
                  id="ctos-confirmed"
                  checked={confirmed}
                  onCheckedChange={setConfirmed}
                  disabled={disabled}
                />
                <Label
                  htmlFor="ctos-confirmed"
                  className="text-sm font-normal text-foreground leading-snug cursor-pointer"
                >
                  {isIssuerPortal
                    ? "I have verified this company against CTOS records."
                    : "I have verified this company against SSM records."}
                </Label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  onClick={onApprove}
                  disabled={!canApprove || disabled}
                  className="w-full sm:flex-1 rounded-full gap-2 shadow-sm"
                >
                  <CheckCircleIcon className="h-5 w-5 shrink-0" aria-hidden />
                  {isIssuerPortal ? "Approve CTOS Verification" : "Approve SSM Verification"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={onReject}
                  disabled={disabled}
                  className="w-full sm:w-auto shrink-0 rounded-full border-destructive text-destructive hover:bg-destructive/10"
                >
                  Reject
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isAlreadyVerified ? (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-900 dark:text-emerald-100">Already verified</p>
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
    </div>
  );
}
