"use client";

/**
 * SECTION: CTOS / company registry verification (onboarding admin)
 * WHY: Manual CTOS fetch; application vs CTOS shown in separate blocks for admin review
 * INPUT: onboarding application + org CTOS list API (issuer or investor company)
 * OUTPUT: stacked Application + CTOS tables, attestation, approve / reject / RegTank amendment
 * WHERE USED: OnboardingReviewDialog (PENDING_SSM_REVIEW)
 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  DirectorKycStatus,
  OnboardingApplicationResponse,
} from "@cashsouk/types";
import {
  buildOnboardingCtosComparison,
  companyJsonReadyForCtosCompare,
  displayIdFromApp,
  displayIdFromCtosRow,
  getOnboardingPeopleSplit,
  shareholderPctFromAppRole,
  shareholderPctFromCtosRow,
  type CtosOrgDirectorParsed,
  type OnboardingCtosOrgFetchState,
  type OnboardingPeopleBuckets,
} from "@/lib/onboarding-ctos-compare";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Set to true to preview CTOS comparison UI with fake list + company_json (mirrors this application).
 * Set back to false before shipping.
 */
const USE_MOCK_ONBOARDING_CTOS = false;

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
  const portal = application.portal;
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
    const pct = shareholderPctFromAppRole(p.role);
    ctosPeople.push({
      nic_brno: fallbackId(p.governmentIdNumber, "MOCKS"),
      ic_lcno: null,
      name: baseName,
      position: "SO",
      equity_percentage: pct > 0 ? pct : 35,
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
    issuer_organization_id: portal === "issuer" ? orgId : null,
    investor_organization_id: portal === "investor" ? orgId : null,
    subject_ref: null,
    fetched_at: now,
    created_at: now,
    updated_at: now,
    has_report_html: false,
    company_json,
  };
  const older: AdminCtosReportListItem = {
    id: "mock-onboarding-ctos-older",
    issuer_organization_id: portal === "issuer" ? orgId : null,
    investor_organization_id: portal === "investor" ? orgId : null,
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

const tableBase = "w-full min-w-[20rem] text-sm";

const ctosPanelClass =
  "rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30";

interface SSMVerificationPanelProps {
  application: OnboardingApplicationResponse;
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
}

function sortOrgCtosReports(rows: AdminCtosReportListItem[]): AdminCtosReportListItem[] {
  const orgRows = rows.filter((r) => !r.subject_ref);
  return [...orgRows].sort(
    (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
  );
}

function ctosCompanyCell(
  value: string | null,
  orgFetchState: OnboardingCtosOrgFetchState,
  useOrgCtosFlow: boolean
): string {
  if (!useOrgCtosFlow) return "—";
  if (value != null && String(value).trim() !== "") return String(value).trim();
  if (orgFetchState === "not_pulled") return "Not fetched yet";
  if (orgFetchState === "no_record") return "No company extract in report";
  return "—";
}

function AppDirectorTable({ rows }: { rows: DirectorKycStatus[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className={tableBase}>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="px-3 py-2">Name</TableHead>
            <TableHead className="px-3 py-2">IC / Reg. no.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.eodRequestId}>
              <TableCell className="px-3 py-2 font-medium">{r.name}</TableCell>
              <TableCell className="px-3 py-2 text-muted-foreground">
                {displayIdFromApp(r.governmentIdNumber) ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CtosDirectorTable({ rows }: { rows: CtosOrgDirectorParsed[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-md border border-emerald-200/80 overflow-x-auto dark:border-emerald-800/80">
      <Table className={tableBase}>
        <TableHeader>
          <TableRow className="bg-emerald-100/80 dark:bg-emerald-900/40">
            <TableHead className="px-3 py-2">Name</TableHead>
            <TableHead className="px-3 py-2">IC / Reg. no.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${displayIdFromCtosRow(r) ?? "x"}-${i}`}>
              <TableCell className="px-3 py-2 font-medium">{(r.name ?? "").trim() || "—"}</TableCell>
              <TableCell className="px-3 py-2 text-muted-foreground">
                {displayIdFromCtosRow(r) ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AppShareholderTable({ rows }: { rows: DirectorKycStatus[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className={tableBase}>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="px-3 py-2">Name</TableHead>
            <TableHead className="px-3 py-2">IC / SSM</TableHead>
            <TableHead className="px-3 py-2 w-24">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.eodRequestId}>
              <TableCell className="px-3 py-2 font-medium">{r.name}</TableCell>
              <TableCell className="px-3 py-2 text-muted-foreground">
                {displayIdFromApp(r.governmentIdNumber) ?? "—"}
              </TableCell>
              <TableCell className="px-3 py-2 text-muted-foreground">
                {shareholderPctFromAppRole(r.role) > 0 ? `${shareholderPctFromAppRole(r.role)}%` : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CtosShareholderTable({ rows }: { rows: CtosOrgDirectorParsed[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-md border border-emerald-200/80 overflow-x-auto dark:border-emerald-800/80">
      <Table className={tableBase}>
        <TableHeader>
          <TableRow className="bg-emerald-100/80 dark:bg-emerald-900/40">
            <TableHead className="px-3 py-2">Name</TableHead>
            <TableHead className="px-3 py-2">IC / SSM</TableHead>
            <TableHead className="px-3 py-2 w-24">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const pct = shareholderPctFromCtosRow(r);
            return (
              <TableRow key={`${displayIdFromCtosRow(r) ?? "x"}-sh-${i}`}>
                <TableCell className="px-3 py-2 font-medium">{(r.name ?? "").trim() || "—"}</TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground">
                  {displayIdFromCtosRow(r) ?? "—"}
                </TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground">
                  {pct > 0 ? `${Math.round(pct * 100) / 100}%` : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function DirectorBucketsBlock({
  title,
  buckets,
}: {
  title: string;
  buckets: OnboardingPeopleBuckets;
}) {
  const matchedApp = buckets.matched.map((m) => m.app);
  const matchedCtos = buckets.matched.map((m) => m.ctos);
  const hasAnyApp = matchedApp.length > 0 || buckets.onlyApplication.length > 0;
  const hasAnyCtos = matchedCtos.length > 0 || buckets.onlyCtos.length > 0;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Application data</p>
        {!hasAnyApp ? (
          <p className="text-sm text-muted-foreground">No directors listed.</p>
        ) : (
          <div className="space-y-4">
            {buckets.matched.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Matched (same IC / SSM)</p>
                <AppDirectorTable rows={matchedApp} />
              </div>
            ) : null}
            {buckets.onlyApplication.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Only in application</p>
                <AppDirectorTable rows={buckets.onlyApplication} />
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div className={ctosPanelClass}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-foreground">CTOS data (source of truth)</p>
          <Badge variant="secondary" className="shrink-0">
            CTOS
          </Badge>
        </div>
        {!hasAnyCtos ? (
          <p className="text-sm text-muted-foreground">No director rows in CTOS extract.</p>
        ) : (
          <div className="space-y-4">
            {buckets.matched.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Matched (same IC / SSM)</p>
                <CtosDirectorTable rows={matchedCtos} />
              </div>
            ) : null}
            {buckets.onlyCtos.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Only in CTOS</p>
                <CtosDirectorTable rows={buckets.onlyCtos} />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ShareholderBucketsBlock({
  title,
  buckets,
}: {
  title: string;
  buckets: OnboardingPeopleBuckets;
}) {
  const matchedApp = buckets.matched.map((m) => m.app);
  const matchedCtos = buckets.matched.map((m) => m.ctos);
  const hasAnyApp = matchedApp.length > 0 || buckets.onlyApplication.length > 0;
  const hasAnyCtos = matchedCtos.length > 0 || buckets.onlyCtos.length > 0;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Application data</p>
        {!hasAnyApp ? (
          <p className="text-sm text-muted-foreground">No shareholders (≥5%) listed.</p>
        ) : (
          <div className="space-y-4">
            {buckets.matched.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Matched (same IC / SSM)</p>
                <AppShareholderTable rows={matchedApp} />
              </div>
            ) : null}
            {buckets.onlyApplication.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Only in application</p>
                <AppShareholderTable rows={buckets.onlyApplication} />
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div className={ctosPanelClass}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-foreground">CTOS data (source of truth)</p>
          <Badge variant="secondary" className="shrink-0">
            CTOS
          </Badge>
        </div>
        {!hasAnyCtos ? (
          <p className="text-sm text-muted-foreground">No shareholder rows (≥5%) in CTOS extract.</p>
        ) : (
          <div className="space-y-4">
            {buckets.matched.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Matched (same IC / SSM)</p>
                <CtosShareholderTable rows={matchedCtos} />
              </div>
            ) : null}
            {buckets.onlyCtos.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Only in CTOS</p>
                <CtosShareholderTable rows={buckets.onlyCtos} />
              </div>
            ) : null}
          </div>
        )}
      </div>
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
  const [getLatestConfirmOpen, setGetLatestConfirmOpen] = React.useState(false);
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();

  const useOrgCtosFlow = application.portal === "issuer" || application.portal === "investor";
  const orgId = application.organizationId;

  const applicationForCompare = React.useMemo(() => {
    if (!USE_MOCK_ONBOARDING_CTOS || !useOrgCtosFlow) return application;
    const { directors, shareholders } = getOnboardingPeopleSplit(application);
    if (directors.length > 0 || shareholders.length > 0) return application;
    console.log("Mock onboarding CTOS: no app people, adding demo director + shareholder", {
      organizationId: application.organizationId,
    });
    return { ...application, directorKycStatus: syntheticDemoDirectorKycForMock() };
  }, [application, useOrgCtosFlow]);

  const ctosQuery = useQuery({
    queryKey: ["admin", "organization-ctos-reports", application.portal, orgId],
    queryFn: async () => {
      const res = await apiClient.listAdminOrganizationCtosReports(application.portal, orgId);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    enabled: useOrgCtosFlow && Boolean(orgId) && !USE_MOCK_ONBOARDING_CTOS,
  });

  const fetchCtosMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.createAdminOrganizationCtosReport(application.portal, orgId);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "organization-ctos-reports", application.portal, orgId],
      });
      toast.success("CTOS report saved.");
    },
    onError: (e: Error) => {
      toast.error(e.message || "CTOS request failed");
    },
  });

  const hasCompanyInfo = application.type === "COMPANY" && application.organizationName;

  const orgCtosReports = React.useMemo(() => {
    const raw =
      USE_MOCK_ONBOARDING_CTOS && useOrgCtosFlow
        ? buildMockOrgCtosReports(applicationForCompare)
        : (ctosQuery.data ?? []);
    return sortOrgCtosReports(raw);
  }, [applicationForCompare, ctosQuery.data, useOrgCtosFlow]);

  const latestOrgCtos = orgCtosReports[0] ?? null;
  const companyJson = latestOrgCtos?.company_json ?? null;

  const orgFetchState: OnboardingCtosOrgFetchState = React.useMemo(() => {
    if (!useOrgCtosFlow) return "not_pulled";
    if (USE_MOCK_ONBOARDING_CTOS) {
      if (orgCtosReports.length === 0) return "not_pulled";
      if (!companyJsonReadyForCtosCompare(companyJson)) return "no_record";
      return "ready";
    }
    if (!ctosQuery.isSuccess) return "not_pulled";
    if (orgCtosReports.length === 0) return "not_pulled";
    if (!companyJsonReadyForCtosCompare(companyJson)) return "no_record";
    return "ready";
  }, [useOrgCtosFlow, ctosQuery.isSuccess, orgCtosReports.length, companyJson]);

  const compareState = useOrgCtosFlow ? orgFetchState : "not_pulled";

  const comparison = React.useMemo(
    () => buildOnboardingCtosComparison(applicationForCompare, companyJson, compareState),
    [applicationForCompare, companyJson, compareState]
  );

  const canApprove = confirmed && !fetchCtosMutation.isPending;

  const ctosListLoading = !USE_MOCK_ONBOARDING_CTOS && ctosQuery.isLoading;

  const openOrgReportHtml = React.useCallback(
    async (reportId: string) => {
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in");
        return;
      }
      const url = `${API_URL}/v1/admin/organizations/${application.portal}/${encodeURIComponent(orgId)}/ctos-reports/${reportId}/html`;
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
    [getAccessToken, orgId, application.portal]
  );

  const openLatestOrgReportHtml = React.useCallback(async () => {
    const raw =
      USE_MOCK_ONBOARDING_CTOS && useOrgCtosFlow
        ? buildMockOrgCtosReports(applicationForCompare)
        : (ctosQuery.data ?? []);
    const latest = sortOrgCtosReports(raw)[0];
    if (!latest?.id || !latest.has_report_html) return;
    await openOrgReportHtml(latest.id);
  }, [applicationForCompare, ctosQuery.data, useOrgCtosFlow, openOrgReportHtml]);

  const onConfirmGetLatestReport = () => {
    if (USE_MOCK_ONBOARDING_CTOS) {
      toast.message("Mock mode", { description: "Set USE_MOCK_ONBOARDING_CTOS to false to call the real API." });
      return;
    }
    const t = toast.loading("Fetching CTOS report…");
    fetchCtosMutation.mutate(undefined, {
      onSettled: () => toast.dismiss(t),
    });
  };

  const onTriggerAmendment = React.useCallback(() => {
    const url = application.regtankPortalUrl?.trim();
    if (!url) {
      toast.error("No RegTank link on this application.");
      return;
    }
    console.log("Opening RegTank onboarding URL", url);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [application.regtankPortalUrl]);

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
  const { company } = comparison;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <BuildingOffice2Icon className="h-5 w-5" />
                CTOS verification
              </CardTitle>
              <CardDescription>
                {useOrgCtosFlow
                  ? "Review application data and CTOS extract below. You confirm manually — the system does not auto-approve from row match."
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
              {useOrgCtosFlow ? (
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
                    onClick={() => void openLatestOrgReportHtml()}
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
                    onClick={() => setGetLatestConfirmOpen(true)}
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
          {useOrgCtosFlow && USE_MOCK_ONBOARDING_CTOS ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              Mock CTOS preview: list and company extract are fake (aligned to this application). Set{" "}
              <span className="font-mono text-xs">USE_MOCK_ONBOARDING_CTOS</span> to{" "}
              <span className="font-mono text-xs">false</span> in{" "}
              <span className="font-mono text-xs">ssm-verification-panel.tsx</span> for real data.
            </div>
          ) : null}

          {useOrgCtosFlow && !USE_MOCK_ONBOARDING_CTOS && ctosQuery.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {(ctosQuery.error as Error)?.message ?? "Could not load CTOS."}
            </div>
          ) : null}

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company info — application</p>
            <div className="rounded-md border overflow-x-auto">
              <Table className={tableBase}>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="px-3 py-2 w-[40%]">Field</TableHead>
                    <TableHead className="px-3 py-2">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="px-3 py-2 text-muted-foreground">Company name</TableCell>
                    <TableCell className="px-3 py-2 font-medium">{company.applicationName}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="px-3 py-2 text-muted-foreground">SSM registration no.</TableCell>
                    <TableCell className="px-3 py-2 font-medium">{company.applicationReg}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className={ctosPanelClass}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-sm font-semibold text-foreground">CTOS data (source of truth)</p>
              <Badge variant="secondary" className="shrink-0">
                CTOS
              </Badge>
            </div>
            <div className="rounded-md border border-emerald-200/80 overflow-x-auto dark:border-emerald-800/80">
              <Table className={tableBase}>
                <TableHeader>
                  <TableRow className="bg-emerald-100/80 dark:bg-emerald-900/40">
                    <TableHead className="px-3 py-2 w-[40%]">Field</TableHead>
                    <TableHead className="px-3 py-2">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="px-3 py-2 text-muted-foreground">Company name</TableCell>
                    <TableCell className="px-3 py-2 font-medium">
                      {ctosCompanyCell(company.ctosName, orgFetchState, useOrgCtosFlow)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="px-3 py-2 text-muted-foreground">SSM registration no.</TableCell>
                    <TableCell className="px-3 py-2 font-medium">
                      {ctosCompanyCell(company.ctosReg, orgFetchState, useOrgCtosFlow)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <DirectorBucketsBlock title="Directors" buckets={comparison.directors} />

          <ShareholderBucketsBlock title="Shareholders (≥5%)" buckets={comparison.shareholders} />

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
                  {useOrgCtosFlow
                    ? "I have verified this company against CTOS records."
                    : "I have verified this company against SSM records."}
                </Label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto shrink-0 rounded-full gap-2"
                  disabled={disabled}
                  onClick={onTriggerAmendment}
                >
                  <ArrowTopRightOnSquareIcon className="h-5 w-5 shrink-0" aria-hidden />
                  Trigger amendment
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  onClick={onApprove}
                  disabled={!canApprove || disabled}
                  className="w-full sm:flex-1 rounded-full gap-2 shadow-sm min-w-[12rem]"
                >
                  <CheckCircleIcon className="h-5 w-5 shrink-0" aria-hidden />
                  {useOrgCtosFlow ? "Approve CTOS verification" : "Approve SSM verification"}
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

      {useOrgCtosFlow ? (
        <AlertDialog open={getLatestConfirmOpen} onOpenChange={setGetLatestConfirmOpen}>
          <AlertDialogContent className="rounded-xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Request a new report from CTOS?</AlertDialogTitle>
              <AlertDialogDescription>
                This starts a new CTOS pull for this organization. Comparison on this page uses organization data from
                the latest stored report.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-lg" disabled={fetchCtosMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className={cn(buttonVariants({ variant: "secondary" }), "rounded-lg")}
                disabled={fetchCtosMutation.isPending}
                onClick={() => {
                  onConfirmGetLatestReport();
                }}
              >
                Get latest report
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
