import {
  getOfferPhaseDeadlineDisplay,
  previewAcceptanceDeadlineFromWorkflow,
  ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY,
  ACCEPTANCE_DEADLINE_WORKFLOW_KEY,
} from "@cashsouk/types";
import { ApplicationLogEventType } from "../modules/applications/logs/types";

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

  it("shows Accept by when live", () => {
    const display = getOfferPhaseDeadlineDisplay(
      {
        offer_acceptance: {
          status: "PENDING_ISSUER",
          acceptance_expires_at: "2026-07-29T06:00:00.000Z",
        },
      },
      now
    );
    expect(display?.label).toBe("Accept by");
    expect(display?.isPast).toBe(false);
  });

  it("shows Complete signing by after BR approve", () => {
    const display = getOfferPhaseDeadlineDisplay(
      {
        offer_acceptance: {
          status: "APPROVED_FOR_SIGNING",
          signing_expires_at: "2026-08-05T06:00:00.000Z",
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
          acceptance_expires_at: "2026-07-21T06:00:00.000Z",
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
          acceptance_expires_at: "2026-07-29T06:00:00.000Z",
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
    const sentAt = new Date("2026-07-22T00:00:00.000Z");
    const preview = previewAcceptanceDeadlineFromWorkflow(workflowWithAcceptance(7), sentAt);
    expect(preview?.days).toBe(7);
    expect(preview?.acceptByIso).toBe("2026-07-29T00:00:00.000Z");
    expect(preview?.summary).toContain("Issuer has 7 days");
    expect(preview?.summary).toContain("Accept by");
    expect(preview?.confirmDialogLines).toEqual({
      duration: "Issuer has 7 days",
      acceptBy: expect.stringContaining("Accept by"),
    });
  });
});

describe("ApplicationLogEventType expiry events", () => {
  it("includes CONTRACT_OFFER_EXPIRED and INVOICE_OFFER_EXPIRED", () => {
    expect(ApplicationLogEventType.CONTRACT_OFFER_EXPIRED).toBe("CONTRACT_OFFER_EXPIRED");
    expect(ApplicationLogEventType.INVOICE_OFFER_EXPIRED).toBe("INVOICE_OFFER_EXPIRED");
  });
});
