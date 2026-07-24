import {
  addDaysIso,
  assertPhaseDeadlineConfigValid,
  deadlineReminderKey,
  parsePhaseDeadlineConfig,
  reminderFireAt,
  serializePhaseDeadlineConfig,
} from "@cashsouk/types";
import {
  assertAcceptanceDeadlineOpen,
  assertSigningDeadlineOpen,
  acceptanceDeadlinePatchOnChangesRequested,
  buildOfferAcceptanceOnSend,
  signingDeadlinePatchOnApprove,
  signingDeadlinePatchOnExtend,
} from "./phase-deadlines";
import { AppError } from "./http/error-handler";

describe("phase deadline config", () => {
  it("parses days and unique reminders before expiry", () => {
    const parsed = parsePhaseDeadlineConfig({
      days: 7,
      reminders: [
        { days_before_expiry: 1 },
        { days_before_expiry: 3 },
        { days_before_expiry: 3 },
        { days_before_expiry: 10 },
      ],
    });
    expect(parsed).toEqual({
      days: 7,
      reminders: [{ days_before_expiry: 3 }, { days_before_expiry: 1 }],
    });
  });

  it("rejects invalid reminder offsets", () => {
    expect(() =>
      assertPhaseDeadlineConfigValid(
        { days: 7, reminders: [{ days_before_expiry: 7 }] },
        "Acceptance deadline"
      )
    ).toThrow(/less than deadline days/);
  });

  it("serializes and adds days", () => {
    const serialized = serializePhaseDeadlineConfig({
      days: 14,
      reminders: [{ days_before_expiry: 1 }, { days_before_expiry: 1 }],
    });
    expect(serialized.reminders).toHaveLength(1);
    expect(addDaysIso("2026-01-01T00:00:00.000Z", 7)).toBe("2026-01-08T00:00:00.000Z");
    expect(reminderFireAt("2026-01-08T00:00:00.000Z", 1).toISOString()).toBe(
      "2026-01-07T00:00:00.000Z"
    );
    expect(deadlineReminderKey("acceptance", 1)).toBe("acceptance:1");
  });
});

describe("phase deadline stamps and gates", () => {
  const workflow = [
    {
      id: "financing_type",
      config: {
        offer_acknowledgements: [
          { key: "letter_of_offer", name: "LO", content_source: "generated_offer_letter" },
        ],
        acceptance_deadline: { days: 7, reminders: [{ days_before_expiry: 1 }] },
        signing_deadline: { days: 14, reminders: [{ days_before_expiry: 3 }] },
        signing_packages: { enabled: true, roles: [], documents: [{ key: "a", name: "A", source: "TEMPLATE", required: true, order: 0, signer_role_keys: [] }] },
      },
    },
  ];

  it("stamps acceptance_expires_at on send", () => {
    const acceptance = buildOfferAcceptanceOnSend(workflow, "2026-01-01T00:00:00.000Z");
    expect(acceptance.status).toBe("PENDING_ISSUER");
    expect(acceptance.acceptance_expires_at).toBe("2026-01-08T00:00:00.000Z");
  });

  it("stamps signing_expires_at on approve once", () => {
    const first = signingDeadlinePatchOnApprove(workflow, "2026-01-10T00:00:00.000Z", {
      status: "PENDING_ADMIN_REVIEW",
    });
    expect(first.signing_expires_at).toBe("2026-01-24T00:00:00.000Z");
    const second = signingDeadlinePatchOnApprove(workflow, "2026-01-11T00:00:00.000Z", {
      status: "APPROVED_FOR_SIGNING",
      signing_expires_at: "2026-01-24T00:00:00.000Z",
    });
    expect(second).toEqual({});
  });

  it("restamps acceptance_expires_at on changes requested and clears acceptance reminders", () => {
    const patch = acceptanceDeadlinePatchOnChangesRequested(
      workflow,
      "2026-01-15T00:00:00.000Z",
      {
        status: "PENDING_ADMIN_REVIEW",
        acceptance_expires_at: "2026-01-08T00:00:00.000Z",
        deadline_reminders_sent: {
          "acceptance:1": "2026-01-07T00:00:00.000Z",
          "signing:3": "2026-01-12T00:00:00.000Z",
        },
      }
    );
    expect(patch.acceptance_expires_at).toBe("2026-01-22T00:00:00.000Z");
    expect(patch.deadline_reminders_sent).toEqual({
      "signing:3": "2026-01-12T00:00:00.000Z",
    });
  });

  it("restamps signing_expires_at on extend and clears signing reminders", () => {
    const patch = signingDeadlinePatchOnExtend(workflow, "2026-01-20T00:00:00.000Z", {
      status: "APPROVED_FOR_SIGNING",
      signing_expires_at: "2026-01-10T00:00:00.000Z",
      deadline_reminders_sent: {
        "acceptance:1": "2026-01-07T00:00:00.000Z",
        "signing:3": "2026-01-17T00:00:00.000Z",
      },
    });
    expect(patch.signing_expires_at).toBe("2026-02-03T00:00:00.000Z");
    expect(patch.deadline_reminders_sent).toEqual({
      "acceptance:1": "2026-01-07T00:00:00.000Z",
    });
  });

  it("gates past acceptance and signing deadlines", () => {
    expect(() =>
      assertAcceptanceDeadlineOpen({
        status: "PENDING_ISSUER",
        acceptance_expires_at: "2000-01-01T00:00:00.000Z",
      })
    ).toThrow(AppError);

    expect(() =>
      assertSigningDeadlineOpen({
        status: "APPROVED_FOR_SIGNING",
        signing_expires_at: "2000-01-01T00:00:00.000Z",
      })
    ).toThrow(AppError);

    expect(() =>
      assertAcceptanceDeadlineOpen({
        status: "PENDING_ISSUER",
        acceptance_expires_at: "2099-01-01T00:00:00.000Z",
      })
    ).not.toThrow();
  });

  it("does not gate acceptance clock while PENDING_ADMIN_REVIEW", () => {
    expect(() =>
      assertAcceptanceDeadlineOpen({
        status: "PENDING_ADMIN_REVIEW",
        acceptance_expires_at: "2000-01-01T00:00:00.000Z",
      })
    ).not.toThrow();
  });
});
