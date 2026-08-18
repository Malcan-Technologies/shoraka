import type { ActivityAudience } from "./activity-visibility";
import { toTitleCase } from "./title-case";

export type ActivityPresentation = {
  title: string;
  description: string;
};

export type ActivityPresentationContext = {
  sectionLabel?: string;
  noteReference?: string;
  noteTitle?: string;
};

function asRecord(metadata?: Record<string, unknown> | null): Record<string, unknown> {
  return metadata && typeof metadata === "object" ? metadata : {};
}

function readString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readActorName(metadata: Record<string, unknown>): string | undefined {
  return readString(metadata, "actorName");
}

function withActor(actorName: string | undefined, withName: string, fallback: string): string {
  return actorName ? withName.replace("{actorName}", actorName) : fallback;
}

function formatAmount(metadata: Record<string, unknown>): string | undefined {
  const amount = readNumber(metadata, "amount");
  const currency = readString(metadata, "currency");
  if (amount == null || !currency) return undefined;
  return `${currency} ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function firstString(metadata: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readString(metadata, key);
    if (value) return value;
  }
  return undefined;
}

function noteLabel(metadata: Record<string, unknown>, context?: ActivityPresentationContext): string | undefined {
  const reference = context?.noteReference ?? readString(metadata, "noteReference");
  if (reference) return `note ${reference}`;
  const title = context?.noteTitle ?? readString(metadata, "noteTitle");
  if (title) return `note ${title}`;
  return undefined;
}

function isSophisticatedGranted(metadata: Record<string, unknown>): boolean | undefined {
  const action = readString(metadata, "action");
  if (action === "REVOKED") return false;
  if (action === "GRANTED" || action === "AUTO_GRANTED") return true;
  const newValue = metadata.newValue;
  if (typeof newValue === "boolean") return newValue;
  return undefined;
}

const SERVICING_TITLES: Record<string, string> = {
  CURRENT: "Repayment On Track",
  PARTIAL: "Partial Payment Recorded",
  ADVANCE_PAID: "Advance Payment Recorded",
  LATE: "Payment Delayed",
  ARREARS: "Payment Overdue",
  DEFAULTED: "Repayment in Default",
  SETTLED: "Servicing Completed",
};

const ONBOARDING_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  PENDING: "Pending",
  PENDING_SSM_REVIEW: "Pending SSM Review",
  PENDING_APPROVAL: "Pending Approval",
  PENDING_AMENDMENT: "Pending Amendment",
  PENDING_AML: "Pending AML",
  PENDING_FINAL_APPROVAL: "Pending Final Approval",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

function humanizeOnboardingStatus(status: string | undefined): string {
  if (!status) return "an unknown stage";
  const key = status.trim().toUpperCase();
  return ONBOARDING_STATUS_LABELS[key] ?? toTitleCase(status);
}

function onboardingStatusChangedCopy(metadata: Record<string, unknown>): ActivityPresentation {
  const previous = readString(metadata, "previousStatus");
  const next = readString(metadata, "newStatus");
  const previousKey = previous?.toUpperCase();
  const nextKey = next?.toUpperCase();
  const fromInitial = previousKey === "IN_PROGRESS" || previousKey === "PENDING";

  if (fromInitial && nextKey === "PENDING_SSM_REVIEW") {
    return {
      title: "Verification Submitted",
      description: "The organisation was submitted for company verification review.",
    };
  }
  if (fromInitial && nextKey === "PENDING_APPROVAL") {
    return {
      title: "Verification Submitted",
      description: "The organisation was submitted for onboarding review.",
    };
  }
  if (previousKey === "PENDING_AMENDMENT" && nextKey === "PENDING_SSM_REVIEW") {
    return {
      title: "Verification Resubmitted",
      description: "Updated verification was submitted and review resumed.",
    };
  }
  if (
    (previousKey === "PENDING_SSM_REVIEW" || previousKey === "PENDING_APPROVAL") &&
    nextKey === "PENDING_AMENDMENT"
  ) {
    return {
      title: "Amendment Requested",
      description: "The organisation was sent back to update verification details.",
    };
  }

  return {
    title: "Onboarding Stage Updated",
    description: `Onboarding moved from ${humanizeOnboardingStatus(previous)} to ${humanizeOnboardingStatus(next)}.`,
  };
}

function directorKycCopy(
  audience: ActivityAudience,
  status: string | undefined
): ActivityPresentation {
  if (status === "APPROVED") {
    return {
      title: "Director Verification Approved",
      description:
        audience === "admin"
          ? "Director verification was approved."
          : "A director has completed verification.",
    };
  }
  if (status === "REJECTED") {
    return {
      title: "Director Verification Rejected",
      description:
        audience === "admin"
          ? "Director verification was rejected."
          : "A director’s verification was not approved. Please review and try again.",
    };
  }
  if (status === "ACTION_REQUIRED") {
    return {
      title: audience === "admin" ? "Director Verification Action Required" : "Director Verification Action Needed",
      description:
        audience === "admin"
          ? "Director verification needs further action."
          : "A director needs to take further action to complete verification.",
    };
  }
  return {
    title: "Director Verification Updated",
    description:
      audience === "admin"
        ? "Director verification was updated."
        : "A director’s verification status was updated.",
  };
}

export function formatOnboardingActivity(
  audience: ActivityAudience,
  eventType: string,
  metadata?: Record<string, unknown> | null
): ActivityPresentation {
  const record = asRecord(metadata);
  const actorName = audience === "admin" ? readActorName(record) : undefined;

  switch (eventType) {
    case "ONBOARDING_STARTED":
      return {
        title: "Onboarding Started",
        description:
          audience === "admin"
            ? withActor(actorName, "{actorName} started onboarding.", "Onboarding started.")
            : "Your organization onboarding has started.",
      };
    case "ONBOARDING_RESUMED":
      return {
        title: "Onboarding Resumed",
        description:
          audience === "admin"
            ? withActor(actorName, "{actorName} resumed onboarding.", "Onboarding was resumed.")
            : "You resumed your organization onboarding.",
      };
    case "ONBOARDING_RESTARTED":
      return {
        title: "Onboarding Restarted",
        description:
          audience === "admin"
            ? "Onboarding was restarted."
            : "Your organization onboarding was restarted.",
      };
    case "ONBOARDING_APPROVED":
      if (audience === "admin") {
        return {
          title: "Onboarding Approved",
          description: withActor(
            actorName,
            "{actorName} approved the onboarding submission.",
            "The onboarding submission was approved."
          ),
        };
      }
      return {
        title: "Onboarding Submission Approved",
        description:
          "Your onboarding submission was approved. Additional checks may still be required before onboarding is completed.",
      };
    case "ONBOARDING_REJECTED":
      return {
        title: "Onboarding Rejected",
        description:
          audience === "admin"
            ? "Onboarding was rejected."
            : "Your organization onboarding was rejected.",
      };
    case "ONBOARDING_COMPLETED":
      return {
        title: "Onboarding Completed",
        description:
          audience === "admin"
            ? "Onboarding was marked completed."
            : "Your organization onboarding is complete.",
      };
    case "ONBOARDING_STATUS_CHANGED":
      return onboardingStatusChangedCopy(record);
    case "INVESTOR_SOPHISTICATED_STATUS_UPDATED": {
      const granted = isSophisticatedGranted(record);
      if (audience === "admin") {
        if (granted === true) {
          return {
            title: "Sophisticated Status Updated",
            description: "Sophisticated investor status was granted.",
          };
        }
        if (granted === false) {
          return {
            title: "Sophisticated Status Updated",
            description: "Sophisticated investor status was removed.",
          };
        }
        return {
          title: "Sophisticated Status Updated",
          description: "Sophisticated investor status was updated.",
        };
      }
      if (granted === true) {
        return {
          title: "Sophisticated Status Updated",
          description: "You have been recognised as a sophisticated investor.",
        };
      }
      if (granted === false) {
        return {
          title: "Sophisticated Status Updated",
          description: "Your sophisticated investor status was removed.",
        };
      }
      return {
        title: "Sophisticated Status Updated",
        description: "Your sophisticated investor status was updated.",
      };
    }
    case "DIRECTOR_ONBOARDING_INVITATION_SENT": {
      const email = audience === "admin" ? readString(record, "directorEmail") : undefined;
      return {
        title: "Director Invitation Sent",
        description:
          audience === "admin"
            ? email
              ? `A director invitation was sent to ${email}.`
              : "A director invitation was sent."
            : "A director was invited to complete verification.",
      };
    }
    case "DIRECTOR_KYC_STATUS_UPDATED":
      return directorKycCopy(audience, readString(record, "newKycStatus"));
    case "ONBOARDING_RESET":
      return {
        title: "Onboarding Reset",
        description:
          "The user onboarding marker was reset. Organization onboarding state was not rewound.",
      };
    case "ONBOARDING_FINAL_APPROVAL_COMPLETED":
      if (audience !== "admin") {
        return {
          title: "Onboarding Completed",
          description: "Your organization onboarding is complete.",
        };
      }
      return {
        title: "Final Approval Completed",
        description: withActor(
          actorName,
          "{actorName} completed final onboarding approval.",
          "Final onboarding approval was completed."
        ),
      };
    case "AML_APPROVED":
      return {
        title: "AML Approved",
        description: "AML screening was approved.",
      };
    case "SSM_APPROVED":
      return {
        title: "SSM Approved",
        description: "SSM review was approved.",
      };
    case "CTOS_REPORT_RECEIVED":
      return {
        title: "CTOS Report Received",
        description: "A credit report was received.",
      };
    case "CORPORATE_ENTITIES_UPDATED":
      return {
        title: "Corporate Entities Updated",
        description: "Corporate entity records were updated.",
      };
    case "ORGANIZATION_PROFILE_UPDATED_BY_ADMIN": {
      const changed = Array.isArray(record.changedFields)
        ? record.changedFields.filter((field): field is string => typeof field === "string")
        : [];
      return {
        title: "Organization Profile Updated",
        description:
          audience === "admin"
            ? withActor(
                actorName,
                changed.length > 0
                  ? `{actorName} updated ${changed.join(", ")}.`
                  : "{actorName} updated the organization profile.",
                changed.length > 0
                  ? `Updated ${changed.join(", ")}.`
                  : "The organization profile was updated."
              )
            : "The organization profile was updated.",
      };
    }
    default:
      return {
        title: "Onboarding Update",
        description:
          audience === "admin"
            ? "An onboarding update was recorded."
            : "This onboarding update was recorded for your organization.",
      };
  }
}

export function formatApplicationActivity(
  audience: ActivityAudience,
  eventType: string,
  metadata?: Record<string, unknown> | null,
  context?: ActivityPresentationContext
): ActivityPresentation {
  const record = asRecord(metadata);
  const actorName = audience === "admin" ? readActorName(record) : undefined;
  const invoiceNumber = firstString(record, ["invoiceNumber", "invoice_number"]);
  const contractNumber = firstString(record, ["contractNumber", "contract_number", "contract_reference"]);

  switch (eventType) {
    case "APPLICATION_CREATED":
      return {
        title: "Application Created",
        description:
          audience === "admin"
            ? withActor(actorName, "{actorName} created the application.", "The application was created.")
            : "You created a financing application.",
      };
    case "APPLICATION_SUBMITTED":
      return {
        title: "Application Submitted",
        description:
          audience === "admin"
            ? withActor(
                actorName,
                "{actorName} submitted the application for review.",
                "The application was submitted for review."
              )
            : "Your application has been submitted for review.",
      };
    case "APPLICATION_REVIEW_STARTED":
      return {
        title: "Review Started",
        description: "Review of the application has started.",
      };
    case "APPLICATION_RESUBMITTED":
      return {
        title: "Application Resubmitted",
        description:
          audience === "admin"
            ? withActor(actorName, "{actorName} resubmitted the application.", "The application was resubmitted.")
            : "You resubmitted your application after making the requested updates.",
      };
    case "APPLICATION_AMENDMENTS_REQUESTED":
      return {
        title: "Updates Requested",
        description:
          audience === "admin"
            ? "Updates were requested on the application."
            : "Updates were requested on your application.",
      };
    case "APPLICATION_SECTION_REVIEW_UPDATED":
      return {
        title: "Section Changes Requested",
        description:
          audience === "admin"
            ? context?.sectionLabel
              ? `Changes were requested for ${context.sectionLabel}.`
              : "Changes were requested for a section of the application."
            : "Changes were requested for a section of your application.",
      };
    case "APPLICATION_REOPENED_FOR_REVIEW":
      return {
        title: audience === "admin" ? "Reopened for Review" : "Application Reopened",
        description:
          audience === "admin"
            ? "The application was reopened for review."
            : "Your application was reopened for review.",
      };
    case "APPLICATION_WITHDRAWN":
      return {
        title: "Application Withdrawn",
        description:
          audience === "admin" ? "The application was withdrawn." : "Your application was withdrawn.",
      };
    case "APPLICATION_REJECTED":
      return {
        title: "Application Rejected",
        description:
          audience === "admin" ? "The application was rejected." : "Your application was rejected.",
      };
    case "APPLICATION_COMPLETED":
      return {
        title: "Application Completed",
        description:
          audience === "admin" ? "The application was completed." : "Your application is complete.",
      };
    case "CONTRACT_OFFER_SENT":
      return {
        title: "Facility Offer Sent",
        description: contractNumber
          ? audience === "admin"
            ? `A facility offer was sent for ${contractNumber}.`
            : `A facility offer for ${contractNumber} is ready for your review.`
          : audience === "admin"
            ? "A facility offer was sent."
            : "A facility offer is ready for your review.",
      };
    case "CONTRACT_OFFER_RETRACTED":
      return {
        title: "Facility Offer Retracted",
        description:
          audience === "admin"
            ? "The facility offer was retracted."
            : "The facility offer was withdrawn before it was accepted.",
      };
    case "CONTRACT_SIGNING_DEADLINE_EXTENDED":
      return {
        title: "Signing Deadline Extended",
        description: "The signing deadline was extended.",
      };
    case "CONTRACT_OFFER_EXPIRED":
      return {
        title: "Facility Offer Expired",
        description: "The facility offer expired.",
      };
    case "CONTRACT_ACCEPTANCE_SUBMITTED":
      return {
        title: "Facility Acceptance Submitted",
        description:
          audience === "admin"
            ? "Facility acceptance was submitted."
            : "You submitted your facility acceptance for review.",
      };
    case "CONTRACT_ACCEPTANCE_RESUBMITTED":
      return {
        title: "Facility Acceptance Resubmitted",
        description:
          audience === "admin"
            ? "Facility acceptance was resubmitted."
            : "You resubmitted your facility acceptance after requested changes.",
      };
    case "CONTRACT_ACCEPTANCE_CHANGES_REQUESTED":
      return {
        title: "Facility Acceptance Changes Requested",
        description:
          audience === "admin"
            ? "Changes were requested on facility acceptance."
            : "Changes were requested on your facility acceptance.",
      };
    case "CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING":
      return {
        title: "Facility Acceptance Approved for Signing",
        description:
          audience === "admin"
            ? "Facility acceptance was approved for signing."
            : "Your facility acceptance was approved. Signing can now be arranged.",
      };
    case "CONTRACT_OFFER_ACCEPTED":
      return {
        title: "Facility Offer Accepted",
        description: "The facility offer was accepted.",
      };
    case "CONTRACT_OFFER_REJECTED":
      return {
        title: audience === "admin" ? "Facility Offer Rejected" : "Facility Offer Declined",
        description:
          audience === "admin" ? "The facility offer was rejected." : "The facility offer was declined.",
      };
    case "CONTRACT_WITHDRAWN":
      return {
        title: "Facility Withdrawn",
        description: "The facility was withdrawn.",
      };
    case "INVOICE_OFFER_SENT":
      return {
        title: "Invoice Offer Sent",
        description: invoiceNumber
          ? audience === "admin"
            ? `An invoice offer was sent for invoice ${invoiceNumber}.`
            : `An invoice offer for invoice ${invoiceNumber} is ready for your review.`
          : audience === "admin"
            ? "An invoice offer was sent."
            : "An invoice offer is ready for your review.",
      };
    case "INVOICE_OFFER_RETRACTED":
      return {
        title: "Invoice Offer Retracted",
        description:
          audience === "admin"
            ? "The invoice offer was retracted."
            : "The invoice offer was withdrawn before it was accepted.",
      };
    case "INVOICE_SIGNING_DEADLINE_EXTENDED":
      return {
        title: "Signing Deadline Extended",
        description: "The signing deadline was extended.",
      };
    case "INVOICE_OFFER_EXPIRED":
      return {
        title: "Invoice Offer Expired",
        description: "The invoice offer expired.",
      };
    case "INVOICE_ACCEPTANCE_SUBMITTED":
      return {
        title: "Invoice Acceptance Submitted",
        description:
          audience === "admin"
            ? "Invoice acceptance was submitted."
            : "You submitted your invoice acceptance for review.",
      };
    case "INVOICE_ACCEPTANCE_RESUBMITTED":
      return {
        title: "Invoice Acceptance Resubmitted",
        description:
          audience === "admin"
            ? "Invoice acceptance was resubmitted."
            : "You resubmitted your invoice acceptance after requested changes.",
      };
    case "INVOICE_ACCEPTANCE_CHANGES_REQUESTED":
      return {
        title: "Invoice Acceptance Changes Requested",
        description:
          audience === "admin"
            ? "Changes were requested on invoice acceptance."
            : "Changes were requested on your invoice acceptance.",
      };
    case "INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING":
      return {
        title: "Invoice Acceptance Approved for Signing",
        description:
          audience === "admin"
            ? "Invoice acceptance was approved for signing."
            : "Your invoice acceptance was approved. Signing can now be arranged.",
      };
    case "INVOICE_OFFER_ACCEPTED":
      return {
        title: "Invoice Offer Accepted",
        description: "The invoice offer was accepted.",
      };
    case "INVOICE_OFFER_REJECTED":
      return {
        title: audience === "admin" ? "Invoice Offer Rejected" : "Invoice Offer Declined",
        description:
          audience === "admin" ? "The invoice offer was rejected." : "The invoice offer was declined.",
      };
    case "INVOICE_WITHDRAWN":
      return {
        title: "Invoice Withdrawn",
        description: invoiceNumber ? `Invoice ${invoiceNumber} was withdrawn.` : "The invoice was withdrawn.",
      };
    default:
      return {
        title: "Application Update",
        description:
          audience === "admin"
            ? "An application update was recorded."
            : "An application update was recorded for your account.",
      };
  }
}

export function formatSigningActivity(
  audience: ActivityAudience,
  eventType: string,
  metadata?: Record<string, unknown> | null
): ActivityPresentation {
  const record = asRecord(metadata);
  const email = audience === "admin" ? readString(record, "email") : undefined;

  switch (eventType) {
    case "SIGNING_PACKAGE_CREATED":
      return {
        title: "Signing Package Created",
        description: "A signing package was created.",
      };
    case "SIGNING_PACKAGE_SENT":
      return {
        title: "Signing Package Sent",
        description: "The signing package was sent to signers.",
      };
    case "SIGNING_PACKAGE_COMPLETED":
      return {
        title: "Signing Package Completed",
        description: "All required signers have completed the signing package.",
      };
    case "SIGNING_PACKAGE_VOIDED":
      return audience === "issuer"
        ? {
            title: "Signing Package Cancelled",
            description: "The signing package was cancelled.",
          }
        : {
            title: "Signing Package Voided",
            description: "The signing package was voided.",
          };
    case "SIGNING_PACKAGE_DECLINED":
      return {
        title: "Signing Package Declined",
        description:
          audience === "admin"
            ? "The signing package was declined."
            : "The signing package was declined by a signer.",
      };
    case "SIGNING_PACKAGE_EXPIRED":
      return {
        title: "Signing Package Expired",
        description: "The signing package expired before it was completed.",
      };
    case "SIGNING_RECIPIENT_COMPLETED":
      return {
        title: "Signer Completed",
        description: "A signer completed their documents.",
      };
    case "SIGNING_RECIPIENT_DECLINED":
      return {
        title: "Signer Declined",
        description: "A signer declined to sign.",
      };
    case "SIGNING_EKYC_FAILED":
      return {
        title: "Signer Identity Check Failed",
        description:
          audience === "admin"
            ? email
              ? `Identity verification failed for ${email}.`
              : "Identity verification failed for a signer."
            : "A signer could not complete identity verification. They need to try again.",
      };
    default:
      return {
        title: "Signing Update",
        description: "A signing update was recorded.",
      };
  }
}

function servicingPresentation(
  audience: ActivityAudience,
  metadata: Record<string, unknown>
): ActivityPresentation {
  const status = readString(metadata, "newServicingStatus");
  const title = status ? SERVICING_TITLES[status] : undefined;
  if (!title || !status) {
    return {
      title: "Servicing Status Updated",
      description:
        audience === "investor"
          ? "The servicing status for a note you invested in was updated."
          : "The servicing status for this note was updated.",
    };
  }

  const descriptions: Record<string, { issuer: string; investor: string; admin: string }> = {
    CURRENT: {
      admin: "Repayment for this note is on track.",
      issuer: "Repayment for this note is on track.",
      investor: "Repayment for a note you invested in is on track.",
    },
    PARTIAL: {
      admin: "A partial payment was recorded for this note.",
      issuer: "A partial payment was recorded for this note.",
      investor: "A partial payment was recorded for a note you invested in.",
    },
    ADVANCE_PAID: {
      admin: "An advance payment was recorded for this note.",
      issuer: "An advance payment was recorded for this note.",
      investor: "An advance payment was recorded for a note you invested in.",
    },
    LATE: {
      admin: "A repayment on this note is late.",
      issuer: "A repayment on this note is late.",
      investor: "A repayment on a note you invested in is late.",
    },
    ARREARS: {
      admin: "This note is now overdue.",
      issuer: "This note is now overdue.",
      investor: "A note you invested in is now overdue.",
    },
    DEFAULTED: {
      admin: "Servicing for this note was marked in default.",
      issuer: "Servicing for this note was marked in default.",
      investor: "Servicing for a note you invested in was marked in default.",
    },
    SETTLED: {
      admin: "Servicing for this note is complete.",
      issuer: "Servicing for this note is complete.",
      investor: "Servicing for a note you invested in is complete.",
    },
  };

  return {
    title,
    description: descriptions[status][audience],
  };
}

export const ADMIN_NOTE_OPERATIONAL_EVENT_TYPES = [
  "NOTE_PROSPECTUS_REVIEW_CREATED",
  "NOTE_PROSPECTUS_APPROVED",
  "NOTE_PROSPECTUS_INVALIDATED",
  "DISBURSEMENT_INITIATED",
  "DISBURSEMENT_LETTER_GENERATED",
  "DISBURSEMENT_SUBMITTED_TO_TRUSTEE",
  "DISBURSEMENT_BENEFICIARY_UPDATED",
  "RESIDUAL_RETURN_LETTER_GENERATED",
  "RESIDUAL_RETURN_SUBMITTED_TO_TRUSTEE",
  "SHORAKA_ORDER_SUBMITTED",
  "SHORAKA_CERTIFICATE_RECEIVED",
  "SETTLEMENT_PREVIEWED",
  "SETTLEMENT_APPROVED",
  "SERVICE_FEE_TRUSTEE_LETTER_GENERATED",
  "SERVICE_FEE_TRUSTEE_SUBMITTED",
  "SERVICE_FEE_TRUSTEE_COMPLETED",
  "ARREARS_LETTER_GENERATED",
  "DEFAULT_NOTICE_GENERATED",
] as const;

function formatAdminNoteOperationalActivity(
  eventType: string,
  metadata: Record<string, unknown>
): ActivityPresentation | null {
  const actorName = readActorName(metadata);
  const fileName = readString(metadata, "fileName");
  const amount = formatAmount(metadata);
  const displayReference = readString(metadata, "displayReference");
  const contentVersion = readNumber(metadata, "contentVersion");
  const payoutCount = readNumber(metadata, "investorPayoutCount");

  switch (eventType) {
    case "NOTE_PROSPECTUS_REVIEW_CREATED":
      return {
        title: "Prospectus Review Started",
        description: withActor(
          actorName,
          "{actorName} started prospectus review.",
          "Prospectus review was started."
        ),
      };
    case "NOTE_PROSPECTUS_APPROVED":
      return {
        title: "Prospectus Approved",
        description:
          contentVersion != null
            ? withActor(
                actorName,
                `{actorName} approved the prospectus (version ${contentVersion}).`,
                `The prospectus was approved (version ${contentVersion}).`
              )
            : withActor(actorName, "{actorName} approved the prospectus.", "The prospectus was approved."),
      };
    case "NOTE_PROSPECTUS_INVALIDATED":
      return {
        title: "Prospectus Approval Invalidated",
        description: "The prospectus approval was invalidated and review returned to draft.",
      };
    case "DISBURSEMENT_INITIATED":
      return {
        title: "Disbursement Initiated",
        description: amount
          ? withActor(
              actorName,
              `{actorName} initiated issuer disbursement of ${amount}.`,
              `Issuer disbursement of ${amount} was initiated.`
            )
          : withActor(
              actorName,
              "{actorName} initiated issuer disbursement.",
              "Issuer disbursement was initiated."
            ),
      };
    case "DISBURSEMENT_LETTER_GENERATED":
      return {
        title: "Disbursement Letter Generated",
        description: fileName
          ? `The disbursement trustee letter ${fileName} was generated.`
          : "The disbursement trustee letter was generated.",
      };
    case "DISBURSEMENT_SUBMITTED_TO_TRUSTEE":
      return {
        title: "Disbursement Submitted to Trustee",
        description: withActor(
          actorName,
          "{actorName} submitted the disbursement instruction to the trustee.",
          "The disbursement instruction was submitted to the trustee."
        ),
      };
    case "DISBURSEMENT_BENEFICIARY_UPDATED":
      return {
        title: "Disbursement Beneficiary Updated",
        description: withActor(
          actorName,
          "{actorName} updated the disbursement beneficiary details.",
          "Disbursement beneficiary details were updated."
        ),
      };
    case "RESIDUAL_RETURN_LETTER_GENERATED":
      return {
        title: "Residual Return Letter Generated",
        description: fileName
          ? `The residual return trustee letter ${fileName} was generated.`
          : "The residual return trustee letter was generated.",
      };
    case "RESIDUAL_RETURN_SUBMITTED_TO_TRUSTEE":
      return {
        title: "Residual Return Submitted to Trustee",
        description: withActor(
          actorName,
          "{actorName} submitted the residual return instruction to the trustee.",
          "The residual return instruction was submitted to the trustee."
        ),
      };
    case "SHORAKA_ORDER_SUBMITTED":
      return {
        title: "Tawarruq Order Submitted",
        description: withActor(
          actorName,
          "{actorName} submitted the Tawarruq order.",
          "The Tawarruq order was submitted."
        ),
      };
    case "SHORAKA_CERTIFICATE_RECEIVED":
      return {
        title: "Tawarruq Certificate Received",
        description: "The Tawarruq certificate was received.",
      };
    case "SETTLEMENT_PREVIEWED":
      return {
        title: "Settlement Preview Generated",
        description:
          payoutCount != null && payoutCount >= 1
            ? `A settlement preview was generated for ${payoutCount} investor payout${payoutCount === 1 ? "" : "s"}.`
            : "A settlement preview was generated.",
      };
    case "SETTLEMENT_APPROVED":
      return {
        title: "Settlement Approved",
        description: displayReference
          ? withActor(
              actorName,
              `{actorName} approved settlement ${displayReference}.`,
              `Settlement ${displayReference} was approved.`
            )
          : withActor(actorName, "{actorName} approved the settlement.", "The settlement was approved."),
      };
    case "SERVICE_FEE_TRUSTEE_LETTER_GENERATED":
      return {
        title: "Service Fee Trustee Letter Generated",
        description: fileName
          ? `The service fee trustee letter ${fileName} was generated.`
          : "The service fee trustee letter was generated.",
      };
    case "SERVICE_FEE_TRUSTEE_SUBMITTED":
      return {
        title: "Service Fee Submitted to Trustee",
        description: withActor(
          actorName,
          "{actorName} submitted the service fee instruction to the trustee.",
          "The service fee instruction was submitted to the trustee."
        ),
      };
    case "SERVICE_FEE_TRUSTEE_COMPLETED":
      return {
        title: "Service Fee Trustee Processing Completed",
        description: "Service fee trustee processing was completed.",
      };
    case "ARREARS_LETTER_GENERATED":
      return {
        title: "Arrears Letter Generated",
        description: fileName
          ? `The arrears letter ${fileName} was generated.`
          : "An arrears letter was generated.",
      };
    case "DEFAULT_NOTICE_GENERATED":
      return {
        title: "Default Notice Generated",
        description: fileName
          ? `A default notice ${fileName} was generated.`
          : "A default notice was generated.",
      };
    case "TRUSTEE_SIGNATURE_UPDATED":
      return {
        title: "Trustee Signature Updated",
        description: fileName
          ? `The trustee signature image was updated (${fileName}).`
          : "The trustee signature image was updated.",
      };
    default:
      return null;
  }
}

export function formatNoteActivity(
  audience: ActivityAudience,
  eventType: string,
  metadata?: Record<string, unknown> | null,
  context?: ActivityPresentationContext
): ActivityPresentation {
  const record = asRecord(metadata);
  if (audience === "admin") {
    const operational = formatAdminNoteOperationalActivity(eventType, record);
    if (operational) return operational;
  }
  const label = noteLabel(record, context);
  const amount = formatAmount(record);

  switch (eventType) {
    case "NOTE_CREATED":
      return {
        title: "Note Created",
        description: label
          ? `${label.charAt(0).toUpperCase()}${label.slice(1)} was created from an approved invoice.`
          : "A note was created from an approved invoice.",
      };
    case "NOTE_TERMS_UPDATED":
      return {
        title: "Note Terms Updated",
        description: "The listed terms for this note were updated.",
      };
    case "NOTE_PUBLISHED":
      return {
        title: "Note Published",
        description:
          audience === "issuer"
            ? "Your note is now listed and open for investment."
            : "The note is now listed and open for investment.",
      };
    case "NOTE_UNPUBLISHED":
      return {
        title: "Note Unpublished",
        description: audience === "issuer" ? "Your note is no longer listed." : "The note is no longer listed.",
      };
    case "NOTE_CAMPAIGN_PAUSED":
      return {
        title: "Campaign Paused",
        description:
          audience === "investor"
            ? "The campaign was temporarily closed to new investment. Existing commitments are held."
            : audience === "issuer"
              ? "Your campaign was temporarily closed to new investment. Existing commitments are held."
              : "The campaign was temporarily closed to new investment. Existing commitments are held.",
      };
    case "NOTE_CAMPAIGN_RESUMED":
      return {
        title: "Campaign Resumed",
        description:
          audience === "investor"
            ? "The campaign is open for investment again."
            : audience === "issuer"
              ? "Your campaign is open for investment again."
              : "The campaign is open for investment again.",
      };
    case "NOTE_FUNDING_CLOSED":
      return {
        title: "Funding Closed",
        description:
          audience === "investor"
            ? "Funding has closed for a note you invested in."
            : "Funding for this note has closed.",
      };
    case "NOTE_FUNDING_FAILED":
      return {
        title: "Funding Unsuccessful",
        description:
          audience === "investor"
            ? "A note you committed to did not reach the required funding. Your committed funds were released."
            : "This note did not reach the required funding.",
      };
    case "NOTE_ACTIVATED":
      return audience === "investor"
        ? {
            title: "Investment Activated",
            description: "Your investment is now active and servicing has started.",
          }
        : {
            title: "Note Activated",
            description: "The note is now active and servicing has started.",
          };
    case "NOTE_SERVICING_STATUS_CHANGED":
      return servicingPresentation(audience, record);
    case "NOTE_MARKED_DEFAULT":
      return {
        title: "Note Marked in Default",
        description:
          audience === "investor"
            ? "A note you invested in has been formally marked in default."
            : audience === "admin"
              ? "The note was formally marked in default."
              : "This note has been formally marked in default.",
      };
    case "DISBURSEMENT_COMPLETED":
      return {
        title: "Disbursement Completed",
        description: "Disbursement for this note was completed.",
      };
    case "RESIDUAL_RETURN_COMPLETED":
      return {
        title: "Residual Return Completed",
        description: "The residual return for this note was completed.",
      };
    case "REPAYMENT_SUBMITTED":
      return {
        title: "Repayment Submitted",
        description:
          audience === "issuer" && amount
            ? `A repayment of ${amount} was submitted and is awaiting review.`
            : "A repayment was submitted and is awaiting review.",
      };
    case "REPAYMENT_RECEIVED":
      return {
        title: "Repayment Received",
        description:
          audience === "issuer" && amount
            ? `A repayment of ${amount} was received.`
            : "A repayment was received.",
      };
    case "REPAYMENT_REJECTED":
      return {
        title: "Repayment Rejected",
        description: "A repayment was rejected.",
      };
    case "INVESTMENT_COMMITTED":
      return {
        title: "Investment Committed",
        description:
          audience === "investor"
            ? amount
              ? `Your investment of ${amount} was committed.`
              : "Your investment was committed."
            : "An investment was committed.",
      };
    case "SETTLEMENT_POSTED":
      return {
        title: audience === "investor" ? "Returns Credited" : "Settlement Posted",
        description:
          audience === "investor"
            ? "Your returns were credited to your CashSouk balance."
            : "Settlement was posted.",
      };
    default:
      return {
        title: "Note Update",
        description:
          audience === "admin"
            ? "A note update was recorded."
            : "A note update was recorded for your organization.",
      };
  }
}

export function formatPaymentActivity(
  audience: ActivityAudience,
  eventType: string,
  metadata?: Record<string, unknown> | null
): ActivityPresentation {
  const record = asRecord(metadata);
  const amount = audience === "investor" ? formatAmount(record) : undefined;

  switch (eventType) {
    case "PAYMENT_FAILED":
      return {
        title: "Payment Failed",
        description: "Your payment did not complete.",
      };
    case "PAYMENT_EXPIRED":
      return {
        title: "Payment Expired",
        description: "Your payment expired before it was completed.",
      };
    case "PAYMENT_NAME_CHECK_REJECTED":
      return {
        title: "Payment Verification Failed",
        description:
          "We could not verify the account details for this payment. Please review the details and try again.",
      };
    case "INVESTOR_DEPOSIT_RECEIVED":
      return {
        title: "Deposit Received",
        description: amount
          ? `A deposit of ${amount} was credited to your CashSouk balance.`
          : "A deposit was credited to your CashSouk balance.",
      };
    case "PAYMENT_REFUND_INITIATED":
      return {
        title: "Refund Processing",
        description: "A refund for your payment is being processed.",
      };
    case "PAYMENT_REFUNDED":
      return {
        title: "Refund Completed",
        description: "Your payment was refunded.",
      };
    case "INVESTOR_WITHDRAWAL_REQUESTED":
      return {
        title: "Withdrawal Requested",
        description: amount
          ? `Your withdrawal request for ${amount} was submitted.`
          : "Your withdrawal request was submitted.",
      };
    case "INVESTOR_WITHDRAWAL_SUBMITTED_TO_TRUSTEE":
      return {
        title: "Withdrawal Processing",
        description: "Your withdrawal request is being processed.",
      };
    case "INVESTOR_WITHDRAWAL_COMPLETED":
      return {
        title: "Withdrawal Completed",
        description: "Your withdrawal has been completed.",
      };
    default:
      return {
        title: "Payment Update",
        description: "A payment update was recorded for your account.",
      };
  }
}

export function audienceFromPortal(portalType?: "investor" | "issuer"): ActivityAudience {
  return portalType === "investor" ? "investor" : "issuer";
}
