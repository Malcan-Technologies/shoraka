"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@cashsouk/ui";
import { useGuarantorDetail, useRestartGuarantorOnboarding } from "@/hooks/use-guarantor-detail";
import { format } from "date-fns";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BuildingOffice2Icon,
  UserIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  LinkIcon,
  DocumentTextIcon,
  ArrowRightIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{value}</div>
    </div>
  );
}

function CopyableField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const [copied, setCopied] = React.useState(false);
  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 text-sm font-medium bg-background hover:bg-muted px-2 py-1 rounded border transition-colors cursor-pointer group mt-0.5"
        title="Click to copy"
      >
        <span className="break-all text-left">{value}</span>
        {copied ? (
          <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        ) : (
          <ClipboardIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        )}
      </button>
    </div>
  );
}

function AmlStatusBadge({ status }: { status: string }) {
  if (status === "Approved") {
    return (
      <Badge className="bg-emerald-500 text-white text-xs">
        <CheckCircleIcon className="h-3 w-3 mr-1" />
        Approved
      </Badge>
    );
  }
  if (status === "Rejected") {
    return (
      <Badge variant="outline" className="border-red-500/30 text-foreground bg-red-500/10 text-xs">
        <XCircleIcon className="h-3 w-3 mr-1 text-red-600" />
        Rejected
      </Badge>
    );
  }
  if (status === "Unresolved") {
    return (
      <Badge variant="outline" className="border-orange-500/30 text-foreground bg-orange-500/10 text-xs">
        <ExclamationTriangleIcon className="h-3 w-3 mr-1 text-orange-600" />
        Unresolved
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/30 text-foreground bg-amber-500/10 text-xs">
      <ClockIcon className="h-3 w-3 mr-1 text-amber-600" />
      Pending
    </Badge>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
    </div>
  );
}

function GuarantorKycAmlCard({
  data,
}: {
  data: {
    amlStatus: string;
    amlRiskLevel: string | null;
    amlRiskScore: number | null;
    kycId: string | null;
    kybId: string | null;
    onboardingRequestId: string | null;
    amlMessageStatus: string;
    lastSyncedAt: string | null;
    updatedAt: string;
  };
}) {
  const getRiskLevelColor = (riskLevel: string | null) => {
    if (!riskLevel) return "bg-muted text-muted-foreground";
    const level = riskLevel.toLowerCase();
    if (level.includes("low")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (level.includes("medium")) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    if (level.includes("high")) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    return "bg-muted text-muted-foreground";
  };

  const getStatusColor = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "approved") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (normalized === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    if (normalized.includes("pending") || normalized.includes("unresolved")) {
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    }
    return "bg-muted text-muted-foreground";
  };

  const screeningDate = data.lastSyncedAt ?? data.updatedAt;
  const systemId = data.kycId ?? data.kybId;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ShieldExclamationIcon className="h-4 w-4" />
          KYC/AML Screening Result
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Badge className={getStatusColor(data.amlStatus)}>{data.amlStatus}</Badge>
          </div>
          {data.amlRiskLevel && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Risk Level:</span>
              <Badge className={getRiskLevelColor(data.amlRiskLevel)}>{data.amlRiskLevel}</Badge>
            </div>
          )}
          {data.amlRiskScore !== null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Risk Score:</span>
              <Badge variant="outline">{data.amlRiskScore}</Badge>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {systemId && (
            <div>
              <div className="text-xs text-muted-foreground">System ID</div>
              <div className="font-mono">{systemId}</div>
            </div>
          )}
          {data.onboardingRequestId && (
            <div>
              <div className="text-xs text-muted-foreground">Request ID</div>
              <div className="font-mono">{data.onboardingRequestId}</div>
            </div>
          )}
          {data.onboardingRequestId && (
            <div>
              <div className="text-xs text-muted-foreground">Onboarding ID</div>
              <div className="font-mono">{data.onboardingRequestId}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground">Message Status</div>
            <div>{data.amlMessageStatus}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-muted-foreground">Screening Date</div>
            <div>{format(new Date(screeningDate), "PPpp")}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GuarantorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data, isLoading, error } = useGuarantorDetail(id);
  const restart = useRestartGuarantorOnboarding();
  const shouldShowKycAmlCard = Boolean(data && data.amlMessageStatus === "DONE");

  const handleRestartOnboarding = () => {
    if (!data) return;
    restart.mutate(
      { guarantorId: data.id },
      {
        onSuccess: () => toast.success("Guarantor onboarding restarted"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to restart onboarding"),
      }
    );
  };

  const handleOpenApplication = (appId: string, productId: string | null) => {
    if (!productId) {
      toast.error("Missing product mapping for this application");
      return;
    }
    router.push(`/applications/${productId}/${appId}`);
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Button variant="ghost" size="sm" onClick={() => router.push("/guarantors")} className="gap-1.5 -ml-1">
          <ArrowLeftIcon className="h-4 w-4" />
          Guarantors
        </Button>
        <Separator orientation="vertical" className="mx-2 h-4" />
        <h1 className="text-lg font-semibold truncate">
          {isLoading ? "Loading..." : data?.displayName ?? "Guarantor"}
        </h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-6 py-8 space-y-6">
            {isLoading && <PageSkeleton />}

            {error ? (
              <div className="py-8 text-center text-destructive">
                {error instanceof Error ? error.message : "Failed to load guarantor"}
              </div>
            ) : null}

            {data ? (
              <>
                <Card className="rounded-2xl">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                          {data.guarantorType === "company" ? (
                            <BuildingOffice2Icon className="h-6 w-6 text-primary" />
                          ) : (
                            <UserIcon className="h-6 w-6 text-primary" />
                          )}
                        </div>
                        <h2 className="text-xl font-bold">{data.displayName}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          {data.guarantorType === "company" ? (
                            <Badge variant="outline" className="border-blue-500/30 text-foreground bg-blue-500/10 text-xs">
                              <BuildingOffice2Icon className="h-3 w-3 mr-1 text-blue-600" />
                              Company
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-slate-500/30 text-foreground bg-slate-500/10 text-xs">
                              <UserIcon className="h-3 w-3 mr-1 text-slate-600" />
                              Individual
                            </Badge>
                          )}
                          <AmlStatusBadge status={data.amlStatus} />
                          {data.onboardingStatus ? (
                            <Badge variant="secondary" className="text-xs">
                              <ClockIcon className="h-3 w-3 mr-1" />
                              {data.onboardingStatus}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          onClick={handleRestartOnboarding}
                          disabled={restart.isPending}
                          className="gap-1.5"
                        >
                          <ArrowPathIcon className={`h-4 w-4 ${restart.isPending ? "animate-spin" : ""}`} />
                          Restart onboarding
                        </Button>
                        {data.regtankPortalUrl ? (
                          <Button asChild variant="outline" className="gap-1.5">
                            <a href={data.regtankPortalUrl} target="_blank" rel="noopener noreferrer">
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                              Open in RegTank
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                      <DetailRow label="Created" value={format(new Date(data.createdAt), "PPpp")} />
                      <DetailRow label="Updated" value={format(new Date(data.updatedAt), "PPpp")} />
                      {data.onboardingStatus ? <DetailRow label="Onboarding Status" value={data.onboardingStatus} /> : null}
                      {data.onboardingSubstatus ? (
                        <DetailRow label="Onboarding Substatus" value={data.onboardingSubstatus} />
                      ) : null}
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground font-mono">ID: {data.id}</p>
                      <p className="text-xs text-muted-foreground font-mono">Canonical: {data.canonicalKey}</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {data.guarantorType === "company" ? (
                          <BuildingOffice2Icon className="h-4 w-4" />
                        ) : (
                          <UserIcon className="h-4 w-4" />
                        )}
                        Guarantor Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailRow label="Display Name" value={data.displayName} />
                        <CopyableField label="Email" value={data.email} />
                        <DetailRow label="First Name" value={data.firstName} />
                        <DetailRow label="Last Name" value={data.lastName} />
                        <DetailRow label="Company Name" value={data.companyName} />
                        <CopyableField label="IC Number" value={data.icNumber} />
                        <CopyableField label="SSM Number" value={data.ssmNumber} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DocumentTextIcon className="h-4 w-4" />
                        RegTank Onboarding
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CopyableField label="Onboarding Request ID" value={data.onboardingRequestId} />
                        <DetailRow label="AML Message Status" value={data.amlMessageStatus} />
                        <DetailRow label="Onboarding Status" value={data.onboardingStatus} />
                        <DetailRow label="Onboarding Substatus" value={data.onboardingSubstatus} />
                      </div>
                      {data.onboardingVerifyLink && (
                        <div className="pt-2">
                          <Button asChild variant="outline" size="sm" className="gap-1.5">
                            <a href={data.onboardingVerifyLink} target="_blank" rel="noopener noreferrer">
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                              Open verify link
                            </a>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-2xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <LinkIcon className="h-4 w-4" />
                      Linked Applications ({data.linkedApplications.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="divide-y">
                      {data.linkedApplications.length === 0 && (
                        <div className="py-8 text-sm text-muted-foreground text-center">
                          No linked applications found
                        </div>
                      )}

                      {data.linkedApplications.map((app) => (
                        <div key={app.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <Badge variant="outline" className="text-xs">
                              {app.status}
                            </Badge>
                            <div className="min-w-0">
                              <p className="text-sm font-medium font-mono truncate">{app.id}</p>
                              <p className="text-xs text-muted-foreground">
                                {app.issuerOrganization.name || app.issuerOrganization.id}
                                {app.relationship ? ` · ${app.relationship}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {app.submittedAt
                                ? `Submitted ${format(new Date(app.submittedAt), "MMM d, yyyy")}`
                                : `Created ${format(new Date(app.createdAt), "MMM d, yyyy")}`}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={!app.productId}
                              onClick={() => handleOpenApplication(app.id, app.productId)}
                            >
                              View application
                              <ArrowRightIcon className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </div>

        <div className="w-[380px] xl:w-[420px] shrink-0 hidden lg:flex flex-col overflow-hidden py-8 pr-4 gap-4">
          {shouldShowKycAmlCard && data ? <GuarantorKycAmlCard data={data} /> : null}
        </div>
      </div>
    </>
  );
}
