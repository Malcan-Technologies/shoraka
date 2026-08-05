import {
  computePhaseDeadlineExpiresAt,
  computeReminderFireAt,
  assertPhaseDeadlineConfigValid,
  deadlineReminderKey,
  parsePhaseDeadlineConfig,
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

  it("serializes and computes MYT calendar deadlines", () => {
    const serialized = serializePhaseDeadlineConfig({
      days: 14,
      reminders: [{ days_before_expiry: 1 }, { days_before_expiry: 1 }],
    });
    expect(serialized.reminders).toHaveLength(1);
    const expiresAt = computePhaseDeadlineExpiresAt("2026-01-01T00:00:00.000Z", 7);
    expect(expiresAt).toBe("2026-01-08T16:00:00.000Z");
    expect(computeReminderFireAt(expiresAt, 1, 9).toISOString()).toBe(
      "2026-01-07T01:00:00.000Z"
    );
    expect(deadlineReminderKey("acceptance", 1)).toBe("acceptance:1");
  });
});

describe("phase deadline stamps and gates", () => {
  const workflow = [
    {
      id: "financing_type",
      config: {
        acceptance_documents: [{ name: "Board Resolution", required: true }],
        acceptance_deadline: { days: 7, reminders: [{ days_before_expiry: 1 }] },
        signing_deadline: { days: 14, reminders: [{ days_before_expiry: 3 }] },
        signing_packages: { enabled: true, roles: [], documents: [{ key: "a", name: "A", source: "TEMPLATE", required: true, order: 0, signer_role_keys: [] }] },
      },
    },
  ];

  it("stamps acceptance_expires_at on send", () => {
    const acceptance = buildOfferAcceptanceOnSend(workflow, "2026-01-01T00:00:00.000Z");
    expect(acceptance.status).toBe("PENDING_ISSUER");
    expect(acceptance.acceptance_expires_at).toBe("2026-01-08T16:00:00.000Z");
  });

  it("stamps signing_expires_at on approve once", () => {
    const first = signingDeadlinePatchOnApprove(workflow, "2026-01-10T00:00:00.000Z", {
      status: "PENDING_ADMIN_REVIEW",
    });
    expect(first.signing_expires_at).toBe("2026-01-24T16:00:00.000Z");
    const second = signingDeadlinePatchOnApprove(workflow, "2026-01-11T00:00:00.000Z", {
      status: "APPROVED_FOR_SIGNING",
      signing_expires_at: "2026-01-24T16:00:00.000Z",
    });
    expect(second).toEqual({});
  });

  it("restamps acceptance_expires_at on changes requested and clears acceptance reminders", () => {
    const patch = acceptanceDeadlinePatchOnChangesRequested(
      workflow,
      "2026-01-15T00:00:00.000Z",
      {
        status: "PENDING_ADMIN_REVIEW",
        acceptance_expires_at: "2026-01-08T16:00:00.000Z",
        deadline_reminders_sent: {
          "acceptance:1": "2026-01-07T00:00:00.000Z",
          "signing:3": "2026-01-12T00:00:00.000Z",
        },
      }
    );
    expect(patch.acceptance_expires_at).toBe("2026-01-22T16:00:00.000Z");
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
    expect(patch.signing_expires_at).toBe("2026-02-03T16:00:00.000Z");
    expect(patch.deadline_reminders_sent).toEqual({
      "acceptance:1": "2026-01-07T00:00:00.000Z",
    });
  });

  it("gates past acceptance and signing deadlines at the exclusive boundary", () => {
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
      assertAcceptanceDeadlineOpen(
        {
          status: "PENDING_ISSUER",
          acceptance_expires_at: "2099-01-01T00:00:00.000Z",
        },
        new Date("2099-01-01T00:00:00.000Z")
      )
    ).toThrow(AppError);

    expect(() =>
      assertAcceptanceDeadlineOpen(
        {
          status: "PENDING_ISSUER",
          acceptance_expires_at: "2099-01-01T00:00:00.000Z",
        },
        new Date("2098-12-31T23:59:59.999Z")
      )
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
