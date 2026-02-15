"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ApprovalProgressStepper,
  getPersonalOnboardingSteps,
  getCompanyOnboardingSteps,
} from "./approval-progress-stepper";
import { SSMVerificationPanel } from "./ssm-verification-panel";
import {
  useRestartOnboarding,
  useCompleteFinalApproval,
  useApproveSsmVerification,
  useRefreshCorporateStatus,
  useRefreshCorporateAmlStatus,
} from "@/hooks/use-onboarding-applications";
import { DirectorKycList } from "./director-kyc-list";
import { DirectorAmlList } from "./director-aml-list";
import { CorporateShareholdersList } from "./corporate-shareholders-list";
import type { OnboardingApplicationResponse } from "@cashsouk/types";
import {
  UserIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

interface OnboardingReviewDialogProps {
  application: OnboardingApplicationResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function OnboardingReviewDialog({
  application,
  open,
  onOpenChange,
  onRefresh,
  isRefreshing,
}: OnboardingReviewDialogProps) {
  const [showRedoConfirm, setShowRedoConfirm] = React.useState(false);
  const [showFinalApprovalConfirm, setShowFinalApprovalConfirm] = React.useState(false);
  const restartMutation = useRestartOnboarding();
  const finalApprovalMutation = useCompleteFinalApproval();
  const ssmApprovalMutation = useApproveSsmVerification();
  const refreshCorporateMutation = useRefreshCorporateStatus();
  const refreshCorporateAmlMutation = useRefreshCorporateAmlStatus();

  const isCompany = application.type === "COMPANY";
  const steps = isCompany
    ? getCompanyOnboardingSteps(application.status)
    : getPersonalOnboardingSteps(application.status);

  // Check if all required approval flags are met
  const hasOnboardingApproval = application.onboardingApproved;
  const hasAmlApproval = application.amlApproved;
  const hasTncAccepted = application.tncAccepted;
  const hasSsmApproval = application.ssmApproved;

  // For personal investor: onboarding_approved, aml_approved, tnc_accepted
  // For company (investor/issuer): onboarding_approved, aml_approved, tnc_accepted, ssm_approved
  const allRequirementsMet = isCompany
    ? hasOnboardingApproval && hasAmlApproval && hasTncAccepted && hasSsmApproval
    : hasOnboardingApproval && hasAmlApproval && hasTncAccepted;

  // Use the dynamic portal URL from the API response
  const handleOpenRegTank = () => {
    if (application.regtankPortalUrl) {
      window.open(application.regtankPortalUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Open KYC/AML review page in RegTank portal
  // For corporate onboarding, use KYB URL; for individual, use KYC URL
  const handleOpenKycReview = () => {
    const url = isCompany && application.kybPortalUrl
      ? application.kybPortalUrl
      : application.kycPortalUrl;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      // If URL is not available, open a generic RegTank page
      toast.info("KYB/KYC URL not available. Please check RegTank portal manually.");
    }
  };

  const handleSSMApprove = () => {
    ssmApprovalMutation.mutate(application.id, {
      onSuccess: (data) => {
        toast.success("SSM verification approved", {
          description: data.message,
        });
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error("Failed to approve SSM verification", {
          description: error.message,
        });
      },
    });
  };

  const handleSSMReject = () => {
    toast.error("SSM verification rejected", {
      description: `Company ${application.organizationName} has been rejected.`,
    });
    onOpenChange(false);
  };

  const handleRequestRedo = () => {
    restartMutation.mutate(application.id, {
      onSuccess: (data) => {
        toast.success("Onboarding restarted", {
          description: data.message,
        });
        setShowRedoConfirm(false);
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error("Failed to restart onboarding", {
          description: error.message,
        });
        setShowRedoConfirm(false);
      },
    });
  };

  const handleFinalApproval = () => {
    finalApprovalMutation.mutate(application.id, {
      onSuccess: (data) => {
        toast.success("Onboarding completed", {
          description: data.message,
        });
        setShowFinalApprovalConfirm(false);
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error("Failed to complete onboarding", {
          description: error.message,
        });
        setShowFinalApprovalConfirm(false);
      },
    });
  };

  // Combined refresh handler that refreshes both KYC status and onboarding status
  const handleCombinedRefresh = async () => {
    if (isCompany) {
      // Refresh KYC status if in PENDING_APPROVAL
      if (application.status === "PENDING_APPROVAL" && application.directorKycStatus) {
        try {
          await refreshCorporateMutation.mutateAsync(application.id);
          toast.success("Director KYC statuses refreshed");
        } catch (error) {
          toast.error("Failed to refresh director KYC statuses", {
            description: error instanceof Error ? error.message : String(error),
          });
        }
      }
      // Refresh AML status if in PENDING_AML
      if (application.status === "PENDING_AML" && application.directorAmlStatus) {
        try {
          await refreshCorporateAmlMutation.mutateAsync(application.id);
          toast.success("Director AML statuses refreshed");
        } catch (error) {
          toast.error("Failed to refresh director AML statuses", {
            description: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    if (onRefresh) {
      onRefresh();
    }
  };

  const isCombinedRefreshing = 
    refreshCorporateMutation.isPending || 
    refreshCorporateAmlMutation.isPending || 
    (isRefreshing ?? false);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    return new Intl.DateTimeFormat("en-MY", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString));
  };

  const renderCurrentStepContent = () => {
    switch (application.status) {
      case "PENDING_ONBOARDING":
        return (
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-accent" />
                Waiting for User
              </CardTitle>
              <CardDescription>
                The user is currently completing their identity verification on RegTank. Status will
                update automatically when they finish.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Current Status:</p>
                <p className="text-sm text-muted-foreground">
                  RegTank Status: <span className="font-mono">{application.regtankStatus}</span>
                  {application.regtankSubstatus && (
                    <>
                      {" "}
                      / <span className="font-mono">{application.regtankSubstatus}</span>
                    </>
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleOpenRegTank}
                className="w-full gap-2"
                disabled={!application.regtankPortalUrl}
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                View in RegTank Portal
              </Button>
            </CardContent>
          </Card>
        );

      case "PENDING_APPROVAL":
        return (
          <Card className="border-blue-500/30 bg-blue-50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <InformationCircleIcon className="h-5 w-5 text-blue-600" />
                Onboarding Approval Required
              </CardTitle>
              <CardDescription>
                The user has completed their onboarding submission in RegTank. You must review and
                approve the onboarding before the account can proceed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-4">
                {isCompany ? (
                  <>
                    <div className="instruction-steps">
                      <p className="text-sm font-medium">Business Account – Onboarding Approval</p>
                      <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside mt-2 leading-relaxed">
                        <li>
                          Click the &quot;Open Onboarding Review&quot; button to open the business
                          onboarding page in RegTank.
                        </li>
                        <li>
                          Review the onboarding status for all applicable related parties, including:
                          Directors (if applicable), Individual Shareholders (if applicable),
                          Business Shareholders (if applicable).
                        </li>
                        <li>
                          For each applicable related party: confirm onboarding has been completed
                          and ensure the onboarding has been approved by an admin.
                        </li>
                        <li>
                          After all applicable directors and shareholders are approved, take one of:
                          <strong> Approve</strong> (if all requirements are met),{" "}
                          <strong>Reject</strong> (if the onboarding does not meet requirements), or{" "}
                          <strong>Request Amendment</strong> (if changes or additional information
                          are needed).
                        </li>
                      </ol>
                      <p className="text-sm text-muted-foreground mt-3 leading-relaxed instruction-conclusion">
                        <strong>Next step:</strong> Once approved, proceed to AML Approval.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="instruction-steps">
                      <p className="text-sm font-medium">Personal Account – Onboarding Approval</p>
                      <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside mt-2 leading-relaxed">
                        <li>
                          Click the &quot;Open Onboarding Review&quot; button to open the user&apos;s
                          onboarding page in RegTank.
                        </li>
                        <li>
                          Review the submitted KYC information and identity documents.
                        </li>
                        <li>
                          Take one of: <strong>Approve</strong> (if all information is correct),{" "}
                          <strong>Reject</strong> (if the submission does not meet requirements), or{" "}
                          <strong>Retry Onboarding</strong> (if the user needs to resubmit
                          information).
                        </li>
                      </ol>
                      <p className="text-sm text-muted-foreground mt-3 leading-relaxed instruction-conclusion">
                        <strong>Next step:</strong> Once approved, proceed to AML Approval.
                      </p>
                    </div>
                  </>
                )}
              </div>
              <Button
                onClick={handleOpenRegTank}
                className="w-full gap-2"
                disabled={!application.regtankPortalUrl}
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                Open Onboarding Review
              </Button>
              
              {/* Director KYC Status Section (for corporate onboarding) */}
              {isCompany && application.directorKycStatus && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">Director/Shareholder KYC Status</h4>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InformationCircleIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px] text-[10px] leading-tight p-2">
                          <p>
                            All directors/shareholders must complete their KYC verification in RegTank
                            before corporate onboarding can be approved.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <DirectorKycList
                      directors={application.directorKycStatus.directors}
                      isRefreshing={refreshCorporateMutation.isPending}
                    />
                  </div>
                </>
              )}

              {/* Business Shareholders / Beneficiaries Section (for corporate onboarding) */}
              {isCompany && application.corporateEntities?.corporateShareholders && application.corporateEntities.corporateShareholders.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <CorporateShareholdersList
                      corporateShareholders={application.corporateEntities.corporateShareholders}
                      businessShareholdersAml={application.directorAmlStatus?.businessShareholders}
                      status={application.status}
                    />
                  </div>
                </>
              )}
              
              <Separator />
              <div className="text-sm text-muted-foreground">
                Or request the user to redo their onboarding:
              </div>
              <Button
                onClick={() => setShowRedoConfirm(true)}
                variant="outline"
                className="w-full gap-2"
                disabled={restartMutation.isPending}
              >
                <ArrowPathIcon className="h-4 w-4" />
                Restart Onboarding
              </Button>
            </CardContent>
          </Card>
        );

      case "PENDING_AML":
        return (
          <Card className="border-[hsl(29.6_51%_28.8%)]/30 bg-[hsl(29.6_51%_28.8%)]/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <InformationCircleIcon className="h-5 w-5 text-[hsl(29.6_51%_28.8%)]" />
                AML Approval Required
              </CardTitle>
              <CardDescription>
                Onboarding has been approved. AML screening in RegTank is now required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-4">
                {isCompany ? (
                  <>
                    <div className="instruction-steps">
                      <p className="text-sm font-medium">Business Account – AML Approval</p>
                      <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside mt-2 leading-relaxed">
                        <li>
                          Click the &quot;Open KYB/AML Review&quot; button to access the AML
                          screening page in RegTank.
                        </li>
                        <li>
                          Perform AML screening for all relevant associated parties: Directors (if
                          applicable), Individual Shareholders (if applicable), Business
                          Shareholders (if applicable).
                        </li>
                        <li>
                          For each applicable related party: review their AML screening results,
                          check for name matches, mark results as &quot;True&quot; or
                          &quot;False&quot; as appropriate, and click &quot;Generate Score.&quot;
                        </li>
                        <li>
                          Once all applicable screenings are completed: <strong>Approve</strong> if
                          all AML screenings are clear, or <strong>Reject</strong> if any screening
                          fails or requires rejection.
                        </li>
                      </ol>
                      <p className="text-sm text-muted-foreground mt-3 leading-relaxed instruction-conclusion">
                        After successful approval, the AML process is complete.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="instruction-steps">
                      <p className="text-sm font-medium">Personal Account – AML Approval</p>
                      <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside mt-2 leading-relaxed">
                        <li>
                          Click the &quot;Open KYB/AML Review&quot; button to access the AML
                          screening page (My KYC) in RegTank.
                        </li>
                        <li>Review the AML screening results.</li>
                        <li>
                          Check for name matches. If no matches are found, all results should be
                          marked as &quot;False.&quot;
                        </li>
                        <li>Click &quot;Generate Score.&quot;</li>
                        <li>
                          <strong>Approve</strong> (if AML screening is clear) or{" "}
                          <strong>Reject</strong> (if screening results require rejection).
                        </li>
                      </ol>
                      <p className="text-sm text-muted-foreground mt-3 leading-relaxed instruction-conclusion">
                        Once approved, the AML process is complete.
                      </p>
                    </div>
                  </>
                )}
              </div>
              <Button
                onClick={handleOpenKycReview}
                className="w-full gap-2"
                disabled={isCompany ? !application.kybPortalUrl : !application.kycPortalUrl}
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {isCompany ? "Open KYB/AML Review" : "Open KYC/AML Review"}
              </Button>
              
              {/* Individual AML Screening Status Section (for corporate onboarding) */}
              {isCompany && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">Individual AML Screening Status</h4>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InformationCircleIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px] text-[10px] leading-tight p-2">
                          <p>
                            Individual director AML screening must be completed and approved in RegTank
                            before corporate AML approval. Once all directors are approved, corporate KYB/AML will be
                            processed automatically.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <DirectorAmlList
                      directors={application.directorAmlStatus?.directors || []}
                      isRefreshing={refreshCorporateAmlMutation.isPending}
                    />
                  </div>
                </>
              )}

              {/* Business Shareholders / Beneficiaries Section (for corporate onboarding) */}
              {isCompany && application.corporateEntities?.corporateShareholders && application.corporateEntities.corporateShareholders.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <CorporateShareholdersList
                      corporateShareholders={application.corporateEntities.corporateShareholders}
                      businessShareholdersAml={application.directorAmlStatus?.businessShareholders}
                      status={application.status}
                    />
                  </div>
                </>
              )}
              
              <Separator />
              <div className="text-sm text-muted-foreground">
                Or request the user to redo their onboarding:
              </div>
              <Button
                onClick={() => setShowRedoConfirm(true)}
                variant="outline"
                className="w-full gap-2"
                disabled={restartMutation.isPending}
              >
                <ArrowPathIcon className="h-4 w-4" />
                Restart Onboarding
              </Button>
            </CardContent>
          </Card>
        );

      case "PENDING_SSM_REVIEW":
        // For company accounts, show SSM verification
        return (
          <SSMVerificationPanel
            application={application}
            onApprove={handleSSMApprove}
            onReject={handleSSMReject}
            disabled={ssmApprovalMutation.isPending}
          />
        );

      case "PENDING_FINAL_APPROVAL":
        // Show Final Approval section with checklist
        return (
          <Card className="border-blue-500/30 bg-blue-50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <InformationCircleIcon className="h-5 w-5 text-blue-600" />
                Final Approval Required
              </CardTitle>
              <CardDescription>
                All verification steps are complete. Review the checklist below and complete the
                final approval to activate the user&apos;s account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Approval Checklist */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <p className="text-sm font-medium">Approval Checklist:</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {hasOnboardingApproval ? (
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span
                      className={`text-sm ${hasOnboardingApproval ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      Onboarding Approved
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasAmlApproval ? (
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span
                      className={`text-sm ${hasAmlApproval ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      AML Approved
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasTncAccepted ? (
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span
                      className={`text-sm ${hasTncAccepted ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      Terms & Conditions Accepted
                    </span>
                  </div>
                  {isCompany && (
                    <div className="flex items-center gap-2">
                      {hasSsmApproval ? (
                        <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span
                        className={`text-sm ${hasSsmApproval ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        SSM Approved
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sophisticated Investor Status (only for investor portal) */}
              {application.portal === "investor" && (
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <p className="text-sm font-medium">Investor Classification:</p>
                  <div className="flex items-center gap-2">
                    {application.isSophisticatedInvestor ? (
                      <>
                        <Badge className="bg-violet-500 text-white gap-1">
                          <StarIcon className="h-3 w-3" />
                          Sophisticated Investor
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="secondary">Standard Investor</Badge>
                    )}
                  </div>
                  {application.isSophisticatedInvestor && application.sophisticatedInvestorReason && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reason: {application.sophisticatedInvestorReason}
                    </p>
                  )}
                </div>
              )}

              {/* Complete Onboarding Button */}
              <Button
                onClick={() => setShowFinalApprovalConfirm(true)}
                className="w-full gap-2"
                disabled={!allRequirementsMet || finalApprovalMutation.isPending}
              >
                {finalApprovalMutation.isPending ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircleIcon className="h-4 w-4" />
                )}
                Complete Onboarding
              </Button>

              {!allRequirementsMet && (
                <p className="text-xs text-muted-foreground text-center">
                  All checklist items must be completed before final approval.
                </p>
              )}

              <Separator />
              <div className="text-sm text-muted-foreground">
                Or request the user to redo their onboarding:
              </div>
              <Button
                onClick={() => setShowRedoConfirm(true)}
                variant="outline"
                className="w-full gap-2"
                disabled={restartMutation.isPending}
              >
                <ArrowPathIcon className="h-4 w-4" />
                Restart Onboarding
              </Button>
            </CardContent>
          </Card>
        );

      case "COMPLETED":
        return (
          <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="font-semibold text-lg text-emerald-900 dark:text-emerald-100">
                    Onboarding Complete
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    This user has completed all verification steps and is fully onboarded.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="text-sm text-muted-foreground">
                If needed, you can request the user to redo their onboarding:
              </div>
              <Button
                onClick={() => setShowRedoConfirm(true)}
                variant="outline"
                className="w-full gap-2"
                disabled={restartMutation.isPending}
              >
                <ArrowPathIcon className="h-4 w-4" />
                Restart Onboarding
              </Button>
            </CardContent>
          </Card>
        );

      case "REJECTED":
        return (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <XCircleIcon className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-semibold text-lg text-destructive">Onboarding Rejected</p>
                  <p className="text-sm text-muted-foreground">
                    This application has been rejected. You can request the user to redo their
                    onboarding.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowRedoConfirm(true)}
                variant="outline"
                className="w-full gap-2"
                disabled={restartMutation.isPending}
              >
                <ArrowPathIcon className="h-4 w-4" />
                Restart Onboarding
              </Button>
            </CardContent>
          </Card>
        );

      case "EXPIRED":
        return (
          <Card className="border-muted bg-muted/30">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <ClockIcon className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-lg text-muted-foreground">Link Expired</p>
                  <p className="text-sm text-muted-foreground">
                    The onboarding link has expired. Click below to allow the user to restart the
                    onboarding process.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowRedoConfirm(true)}
                variant="outline"
                className="w-full gap-2"
                disabled={restartMutation.isPending}
              >
                <ArrowPathIcon className="h-4 w-4" />
                Restart Onboarding
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" hideCloseButton>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl flex items-center gap-3">
              Review Onboarding Application
              <Badge variant="outline" className="font-normal">
                {application.type === "PERSONAL" ? "Personal" : "Company"}
              </Badge>
              <Badge variant="secondary" className="font-normal capitalize">
                {application.portal}
              </Badge>
            </DialogTitle>
            <div className="flex gap-2">
              {(isCompany && application.directorKycStatus) || onRefresh ? (
              <Button
                variant="outline"
                size="sm"
                  onClick={handleCombinedRefresh}
                  disabled={isCombinedRefreshing}
                className="gap-1.5"
              >
                  <ArrowPathIcon
                    className={`h-4 w-4 ${isCombinedRefreshing ? "animate-spin" : ""}`}
                  />
                Refresh
              </Button>
              ) : null}
            </div>
          </div>
          <DialogDescription>
            Review the application details and complete the required approval steps.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Left Column - Progress Stepper */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Approval Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ApprovalProgressStepper steps={steps} />
              </CardContent>
            </Card>

            {/* User Info Card */}
            <Card className="mt-4">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Applicant Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{application.userName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <EnvelopeIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground break-all">
                    {application.userEmail}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <CalendarDaysIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {formatDate(application.submittedAt)}
                  </span>
                </div>
                <Separator className="my-2" />
                {application.regtankRequestId && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">RegTank ID:</span>{" "}
                    <span className="font-mono">{application.regtankRequestId}</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">User ID:</span>{" "}
                  <span className="font-mono">{application.userId}</span>
                </div>
                {application.organizationName && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Organization:</span>{" "}
                    <span>{application.organizationName}</span>
                  </div>
                )}
                {application.registrationNumber && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">SSM No:</span>{" "}
                    <span className="font-mono">{application.registrationNumber}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Current Step Content */}
          <div className="lg:col-span-2">{renderCurrentStepContent()}</div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>

      {/* Redo Confirmation Dialog */}
      <AlertDialog open={showRedoConfirm} onOpenChange={setShowRedoConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restart Onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              This will call the RegTank restart API to create a new onboarding request. The current
              onboarding will be cancelled and {application.userName} will receive a new
              verification link. Personal information from the previous submission will be
              inherited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restartMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestRedo}
              disabled={restartMutation.isPending}
              className="gap-2"
            >
              {restartMutation.isPending && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              Confirm Redo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Final Approval Confirmation Dialog */}
      <AlertDialog open={showFinalApprovalConfirm} onOpenChange={setShowFinalApprovalConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {application.userName}&apos;s onboarding as complete. They will gain
              full access to the {application.portal} portal. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalApprovalMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalApproval}
              disabled={finalApprovalMutation.isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {finalApprovalMutation.isPending && (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              )}
              Complete Onboarding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
    </TooltipProvider>
  );
}
