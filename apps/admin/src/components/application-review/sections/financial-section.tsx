"use client";

import { BanknotesIcon } from "@heroicons/react/24/outline";
import { ApplicationFinancialReviewContent } from "@/components/application-financial-review-content";
import { ReviewSectionCard } from "../review-section-card";
import type { ReviewSectionId } from "../section-types";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import { ApplicationFinancialReviewComparison } from "@/components/application-financial-review-comparison";
import { computeHasPendingDirectorShareholder, type ApplicationPersonRow } from "@cashsouk/types";
// Banner is rendered inside the Director and Shareholders section.

import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import { useCreateIssuerOrganizationCtosReport } from "@/hooks/use-admin-issuer-organization-ctos-mutations";
import { CTOS_ACTION_BUTTON_COMPACT_CLASSNAME, CTOS_CONFIRM, CTOS_UI } from "@/lib/ctos-ui-labels";
import { cn } from "@/lib/utils";
import { applicationsKeys } from "@/applications/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import {
  shouldNotifyIssuerDirectorShareholderAfterOrgCtosFromResolvedPeopleSnapshots,
} from "@cashsouk/types";
import { ADMIN_DIRECTOR_SHAREHOLDER_REVIEW_HINT } from "@/lib/admin-director-shareholder-review-message";
import { format } from "date-fns";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type FinancialSectionAppSlice = {
  people?: ApplicationPersonRow[];
  issuer_organization?: {
    id?: string;
    corporate_entities?: unknown;
    latest_organization_ctos_company_json?: unknown | null;
    latest_organization_ctos_financials_json?: unknown | null;
    latest_organization_ctos_report_id?: string | null;
    latest_organization_ctos_fetched_at?: string | null;
    latest_organization_ctos_has_report_html?: boolean | null;
    latest_organization_ctos_subject_reports?: Array<{
      id: string;
      subject_ref: string | null;
      fetched_at: string;
      has_report_html: boolean;
    }> | null;
  } | null;
  financial_statements?: unknown;
};

export interface FinancialSectionProps {
  applicationId: string;
  issuerOrganizationId?: string | null;
  app: FinancialSectionAppSlice;
  section: ReviewSectionId;
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  sectionStatus?: string;
  onResetSectionToPending?: (section: ReviewSectionId) => void;
  onApprove: (section: ReviewSectionId) => void;
  onReject: (section: ReviewSectionId) => void;
  onRequestAmendment: (section: ReviewSectionId) => void;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  sectionComparison?: {
    beforeApp: FinancialSectionAppSlice;
    afterApp: FinancialSectionAppSlice;
    isPathChanged: (path: string) => boolean;
  };
  hideSectionComments?: boolean;
}

/**
 * SECTION: Financial CTOS header controls
 * WHY: Show organization CTOS “Fetch org report” / “View org report” and “Last fetch” in the Financial header.
 * INPUT: applicationId, issuerOrganizationId, and the Financial section app slice.
 * OUTPUT: A header-right React node (buttons + last fetch line + confirm dialog).
 * WHERE USED: Rendered inside `ReviewSectionCard` via its `headerRight` prop.
 */
function FinancialCtosHeaderControls({
  applicationId,
  issuerOrganizationId,
  app,
}: {
  applicationId: string;
  issuerOrganizationId: string | null;
  app: FinancialSectionAppSlice;
}) {
  const issuerOrgId = issuerOrganizationId?.trim() ?? "";
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const createOrgCtos = useCreateIssuerOrganizationCtosReport(
    issuerOrgId || undefined,
    applicationId
  );
  const [orgCtosConfirmOpen, setOrgCtosConfirmOpen] = React.useState(false);

  const lastFetchedAtIso = app.issuer_organization?.latest_organization_ctos_fetched_at ?? null;
  const lastFetchLabel = lastFetchedAtIso ? format(new Date(lastFetchedAtIso), "d MMM yyyy, p") : null;

  const openFullReport = React.useCallback(async () => {
    const reportId = app.issuer_organization?.latest_organization_ctos_report_id;
    if (!reportId || !issuerOrgId) return;
    const token = await getAccessToken();
    if (!token) {
      toast.error("Not signed in");
      return;
    }

    const url = `${API_URL}/v1/admin/organizations/issuer/${encodeURIComponent(issuerOrgId)}/ctos-reports/${reportId}/html`;
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
  }, [API_URL, app.issuer_organization?.latest_organization_ctos_report_id, getAccessToken, issuerOrgId]);

  const onGetCtos = React.useCallback(() => {
    if (!issuerOrgId) {
      toast.error("Issuer organization is missing.");
      return;
    }
    const t = toast.loading("Fetching CTOS report…");
    createOrgCtos.mutate(undefined, {
      onSuccess: () => {
        toast.dismiss(t);
        toast.success("CTOS report saved.");

        const cached = queryClient.getQueryData<{
          people?: ApplicationPersonRow[];
          issuer_organization?: Record<string, unknown>;
        }>(applicationsKeys.detail(applicationId));

        const org = (cached?.issuer_organization ?? app.issuer_organization) as
          | Record<string, unknown>
          | undefined;

        if (
          shouldNotifyIssuerDirectorShareholderAfterOrgCtosFromResolvedPeopleSnapshots({
            beforePeople: app.people,
            afterPeople: cached?.people,
            issuerDirectorKycStatus: org?.director_kyc_status ?? null,
            issuerDirectorAmlStatus: org?.director_aml_status ?? null,
            ctosPartySupplements: (org?.ctos_party_supplements as
              | Array<{ party_key?: string | null; partyKey?: string | null }>
              | null
              | undefined) ?? null,
          })
        ) {
          toast("New update", { description: ADMIN_DIRECTOR_SHAREHOLDER_REVIEW_HINT });
        }
      },
      onError: (e: Error) => {
        toast.dismiss(t);
        toast.error(e.message || "CTOS request failed");
      },
    });
  }, [ADMIN_DIRECTOR_SHAREHOLDER_REVIEW_HINT, applicationId, app.issuer_organization, app.people, createOrgCtos, issuerOrgId, queryClient]);

  return (
    <>
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className={CTOS_ACTION_BUTTON_COMPACT_CLASSNAME}
            disabled={createOrgCtos.isPending || !issuerOrgId}
            onClick={() => setOrgCtosConfirmOpen(true)}
          >
            {createOrgCtos.isPending ? CTOS_UI.fetching : "Fetch organization report"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={CTOS_ACTION_BUTTON_COMPACT_CLASSNAME}
            disabled={!app.issuer_organization?.latest_organization_ctos_has_report_html}
            onClick={() => void openFullReport()}
          >
            View organization report
          </Button>
        </div>
        <p className="m-0 text-left text-xs text-muted-foreground tabular-nums leading-snug">
          Last fetch: {lastFetchLabel ?? "\u2014"}
        </p>
      </div>

      <AlertDialog
        open={orgCtosConfirmOpen}
        onOpenChange={(open) => {
          setOrgCtosConfirmOpen(open);
        }}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{CTOS_CONFIRM.title}</AlertDialogTitle>
            <AlertDialogDescription>{CTOS_CONFIRM.organizationDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={createOrgCtos.isPending}>
              {CTOS_CONFIRM.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "secondary" }), "rounded-lg")}
              disabled={createOrgCtos.isPending}
              onClick={() => {
                onGetCtos();
                setOrgCtosConfirmOpen(false);
              }}
            >
              {createOrgCtos.isPending ? CTOS_UI.fetching : CTOS_CONFIRM.primaryAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function FinancialSection({
  applicationId,
  issuerOrganizationId,
  app,
  section,
  isReviewable,
  approvePending,
  isActionLocked,
  actionLockTooltip,
  sectionStatus,
  onResetSectionToPending,
  onApprove,
  onReject,
  onRequestAmendment,
  comments,
  onAddComment,
  sectionComparison,
  hideSectionComments = false,
}: FinancialSectionProps) {
  const hasPendingDirectorShareholder = computeHasPendingDirectorShareholder(app.people);

  if (sectionComparison) {
    return (
      <ReviewSectionCard title="Financial" icon={BanknotesIcon} section={section} isReviewable={false}>
        <ApplicationFinancialReviewComparison
          beforeApp={sectionComparison.beforeApp}
          afterApp={sectionComparison.afterApp}
          isPathChanged={sectionComparison.isPathChanged}
        />
        {!hideSectionComments ? (
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        ) : null}
      </ReviewSectionCard>
    );
  }

  return (
    <ReviewSectionCard
      title="Financial"
      icon={BanknotesIcon}
      section={section}
      isReviewable={isReviewable}
      approvePending={approvePending}
      isActionLocked={isActionLocked}
      actionLockTooltip={actionLockTooltip}
      sectionStatus={sectionStatus}
      showApprove={true}
      approveDisabled={hasPendingDirectorShareholder}
      headerRight={
        <FinancialCtosHeaderControls
          applicationId={applicationId}
          issuerOrganizationId={issuerOrganizationId ?? app.issuer_organization?.id ?? null}
          app={app}
        />
      }
      onResetToPending={onResetSectionToPending}
      onApprove={onApprove}
      onReject={onReject}
      onRequestAmendment={onRequestAmendment}
    >
      <ApplicationFinancialReviewContent
        applicationId={applicationId}
        issuerOrganizationId={issuerOrganizationId ?? app.issuer_organization?.id ?? null}
        app={app}
      />
      {!hideSectionComments ? (
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      ) : null}
    </ReviewSectionCard>
  );
}
