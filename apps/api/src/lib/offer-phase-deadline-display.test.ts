import {
  computePhaseDeadlineExpiresAt,
  getOfferPhaseDeadlineDisplay,
  previewAcceptanceDeadlineFromWorkflow,
  ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY,
  ACCEPTANCE_DEADLINE_WORKFLOW_KEY,
} from "@cashsouk/types";
import { APPLICATION_AUDIT_EVENTS } from "../modules/applications/audit/events";

function workflowWithAcceptance(days = 7) {
  return [
    {
      id: "financing_type",
      config: {
        [ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY]: [
          { name: "Board Resolution", required: true },
        ],
        [ACCEPTANCE_DEADLINE_WORKFLOW_KEY]: {
          days,
          reminders: [{ days_before_expiry: 1 }],
        },
      },
    },
  ];
}

describe("getOfferPhaseDeadlineDisplay (shared)", () => {
  const now = new Date("2026-07-22T06:00:00.000Z");
  const liveExpiresAt = computePhaseDeadlineExpiresAt("2026-07-22T06:00:00.000Z", 7);

  it("shows Accept by when live", () => {
    const display = getOfferPhaseDeadlineDisplay(
      {
        offer_acceptance: {
          status: "PENDING_ISSUER",
          acceptance_expires_at: liveExpiresAt,
        },
      },
      now
    );
    expect(display?.label).toBe("Accept by");
    expect(display?.absolute).toBe("29 Jul 2026, 11:59 PM");
    expect(display?.isPast).toBe(false);
  });

  it("shows Complete signing by after BR approve", () => {
    const display = getOfferPhaseDeadlineDisplay(
      {
        offer_acceptance: {
          status: "APPROVED_FOR_SIGNING",
          signing_expires_at: computePhaseDeadlineExpiresAt("2026-07-22T06:00:00.000Z", 14),
        },
      },
      now
    );
    expect(display?.label).toBe("Complete signing by");
  });

  it("shows Expired when past", () => {
    const display = getOfferPhaseDeadlineDisplay(
      {
        offer_acceptance: {
          status: "PENDING_ISSUER",
          acceptance_expires_at: "2026-07-21T16:00:00.000Z",
        },
      },
      now
    );
    expect(display?.label).toBe("Expired");
    expect(display?.urgency).toBe("past");
  });

  it("hides acceptance deadline while PENDING_ADMIN_REVIEW", () => {
    const display = getOfferPhaseDeadlineDisplay(
      {
        offer_acceptance: {
          status: "PENDING_ADMIN_REVIEW",
          acceptance_expires_at: liveExpiresAt,
        },
      },
      now
    );
    expect(display).toBe(null);
  });
});

describe("previewAcceptanceDeadlineFromWorkflow", () => {
  it("returns null when product does not use acceptance flow", () => {
    expect(previewAcceptanceDeadlineFromWorkflow([])).toBe(null);
  });

  it("previews Accept by from product days", () => {
    const sentAt = new Date("2026-07-22T06:00:00.000Z");
    const preview = previewAcceptanceDeadlineFromWorkflow(workflowWithAcceptance(7), sentAt);
    expect(preview?.days).toBe(7);
    expect(preview?.acceptByIso).toBe("2026-07-29T16:00:00.000Z");
    expect(preview?.absolute).toBe("29 Jul 2026, 11:59 PM");
    expect(preview?.summary).toContain("Issuer has 7 days");
    expect(preview?.summary).toContain("Accept by 29 Jul 2026, 11:59 PM");
    expect(preview?.confirmDialogLines).toEqual({
      duration: "Issuer has 7 days",
      deadlineAt: "29 Jul 2026, 11:59 PM",
    });
  });
});

describe("application audit expiry events", () => {
  it("includes CONTRACT_OFFER_EXPIRED and INVOICE_OFFER_EXPIRED", () => {
    expect(APPLICATION_AUDIT_EVENTS).toContain("CONTRACT_OFFER_EXPIRED");
    expect(APPLICATION_AUDIT_EVENTS).toContain("INVOICE_OFFER_EXPIRED");
  });
});
