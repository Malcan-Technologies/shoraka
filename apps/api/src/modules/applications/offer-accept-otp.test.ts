import { createHash } from "crypto";
import { UTILISATION_OFFER_CONSENT_IDS } from "@cashsouk/types";
import { OfferAcceptSignatorySource } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { acceptInvoiceOfferBodySchema, requestInvoiceOfferAcceptOtpBodySchema } from "./schemas";
import {
  buildOfferAcceptOtpEmail,
  consumeOfferAcceptOtpInTx,
  incrementOfferAcceptOtpAttempts,
  evaluateOfferAcceptOtpResend,
  evaluateOfferAcceptOtpVerification,
  hashOfferAcceptOtp,
  invoiceOfferAcceptRequiresOtp,
  matchOfferAcceptSignatory,
  offerAcceptOtpSendErrorMeta,
  persistAndSendOfferAcceptOtp,
  recoverFailedOfferAcceptOtpDelivery,
  resolveOfferAcceptEnvelopeSignatories,
  resolveOfferAcceptSignatories,
  toOfferAcceptOtpRequestResult,
  verifyOfferAcceptOtpHash,
  OFFER_ACCEPT_OTP_MAX_ATTEMPTS,
  OFFER_ACCEPT_OTP_MAX_SENDS,
  OFFER_ACCEPT_OTP_RESEND_COOLDOWN_MS,
} from "./offer-accept-otp";

const SECRET = "test-offer-accept-otp-secret-value-32chars";

describe("invoice offer accept OTP schemas", () => {
  it("requires a signatory email and a 6-digit OTP body", () => {
    expect(() => requestInvoiceOfferAcceptOtpBodySchema.parse({})).toThrow();
    expect(requestInvoiceOfferAcceptOtpBodySchema.parse({ signatory_email: "ali@co.my" })).toEqual({
      signatory_email: "ali@co.my",
    });
    expect(() => acceptInvoiceOfferBodySchema.parse({})).toThrow();
    expect(() =>
      acceptInvoiceOfferBodySchema.parse({ challenge_id: "cmchallenge000000000000001", otp_code: "12" })
    ).toThrow();
    expect(
      acceptInvoiceOfferBodySchema.parse({
        challenge_id: "cmchallenge000000000000001",
        otp_code: "123456",
        consent_ids: [...UTILISATION_OFFER_CONSENT_IDS],
      })
    ).toEqual({
      challenge_id: "cmchallenge000000000000001",
      otp_code: "123456",
      consent_ids: [...UTILISATION_OFFER_CONSENT_IDS],
    });
    expect(() =>
      acceptInvoiceOfferBodySchema.parse({
        challenge_id: "cmchallenge000000000000001",
        otp_code: "123456",
        consent_ids: ["terms"],
      })
    ).toThrow();
    expect(() =>
      acceptInvoiceOfferBodySchema.parse({
        challenge_id: "cmchallenge000000000000001",
        otp_code: "123456",
      })
    ).toThrow();
  });
});

describe("invoiceOfferAcceptRequiresOtp", () => {
  it("requires OTP only for contract-linked direct accept", () => {
    expect(
      invoiceOfferAcceptRequiresOtp({
        action: "accept",
        invoiceContractId: "contract-1",
      })
    ).toBe(true);
  });

  it("does not require OTP for reject, signing completion, or invoice-only accept", () => {
    expect(
      invoiceOfferAcceptRequiresOtp({
        action: "reject",
        invoiceContractId: "contract-1",
      })
    ).toBe(false);
    expect(
      invoiceOfferAcceptRequiresOtp({
        action: "accept",
        invoiceContractId: "contract-1",
        signingCompletion: { signedOfferLetterS3Key: "s3", signedFileSha256: "abc" },
      })
    ).toBe(false);
    expect(
      invoiceOfferAcceptRequiresOtp({
        action: "accept",
        invoiceContractId: null,
      })
    ).toBe(false);
  });
});

describe("resolveOfferAcceptSignatories", () => {
  it("uses signed facility envelope issuer_director recipients by default", () => {
    const result = resolveOfferAcceptSignatories({
      envelopeRecipients: [
        {
          role_key: "issuer_director",
          name: "Ali",
          email: "Ali@Co.my",
          status: "SIGNED",
        },
        {
          role_key: "issuer_director",
          name: "Ali Duplicate",
          email: "ali@co.my",
          status: "SIGNED",
        },
        {
          role_key: "guarantor",
          name: "Guarantor",
          email: "g@co.my",
          status: "SIGNED",
        },
        {
          role_key: "issuer_director",
          name: "Pending",
          email: "pending@co.my",
          status: "SENT",
        },
        {
          role_key: "issuer_director",
          name: "No Email",
          email: "",
          status: "SIGNED",
        },
      ],
      orgDirectors: [{ name: "Fallback", email: "fallback@co.my", roles: ["DIRECTOR"] }],
    });

    expect(result.source).toBe(OfferAcceptSignatorySource.FACILITY_ENVELOPE);
    expect(result.signatories).toEqual([
      { name: "Ali", email: "ali@co.my", source: OfferAcceptSignatorySource.FACILITY_ENVELOPE },
    ]);
  });

  it("falls back to current organisation directors when envelope emails are ineligible", () => {
    const result = resolveOfferAcceptSignatories({
      envelopeRecipients: [
        { role_key: "issuer_director", name: "Unsigned", email: "u@co.my", status: "SENT" },
        { role_key: "issuer_director", name: "Bad", email: "not-an-email", status: "SIGNED" },
      ],
      orgDirectors: [
        { name: "Director A", email: "A@Co.my", roles: ["DIRECTOR"] },
        { name: "Director A Dup", email: "a@co.my", roles: ["Director"] },
        { name: "Shareholder", email: "s@co.my", roles: ["SHAREHOLDER"] },
        { name: "Missing", email: " ", roles: ["DIRECTOR"] },
      ],
    });

    expect(result.source).toBe(OfferAcceptSignatorySource.ORG_DIRECTOR);
    expect(result.signatories).toEqual([
      { name: "Director A", email: "a@co.my", source: OfferAcceptSignatorySource.ORG_DIRECTOR },
    ]);
  });

  it("errors clearly when no eligible emails exist", () => {
    expect(() =>
      resolveOfferAcceptSignatories({
        envelopeRecipients: [],
        orgDirectors: [{ name: "No Email", email: "", roles: ["DIRECTOR"] }],
      })
    ).toThrow(AppError);
    try {
      resolveOfferAcceptSignatories({
        envelopeRecipients: [],
        orgDirectors: [{ name: "No Email", email: "", roles: ["DIRECTOR"] }],
      });
    } catch (error) {
      expect((error as AppError).code).toBe("OTP_NO_SIGNATORIES");
    }
  });

  it("resolves envelope signatories without requiring org directors", () => {
    const envelope = resolveOfferAcceptEnvelopeSignatories([
      { role_key: "issuer_director", name: "Ali", email: "ali@co.my", status: "SIGNED" },
    ]);
    expect(envelope?.source).toBe(OfferAcceptSignatorySource.FACILITY_ENVELOPE);
    expect(envelope?.signatories).toEqual([
      { name: "Ali", email: "ali@co.my", source: OfferAcceptSignatorySource.FACILITY_ENVELOPE },
    ]);
    expect(
      resolveOfferAcceptEnvelopeSignatories([
        { role_key: "issuer_director", name: "Pending", email: "p@co.my", status: "SENT" },
      ])
    ).toBeNull();
  });

  it("rejects an email that is not on the resolved list", () => {
    const { signatories } = resolveOfferAcceptSignatories({
      envelopeRecipients: [
        { role_key: "issuer_director", name: "Ali", email: "ali@co.my", status: "SIGNED" },
      ],
      orgDirectors: [],
    });
    expect(() => matchOfferAcceptSignatory(signatories, "other@co.my")).toThrow(AppError);
    try {
      matchOfferAcceptSignatory(signatories, "other@co.my");
    } catch (error) {
      expect((error as AppError).code).toBe("OTP_SIGNATORY_NOT_ELIGIBLE");
    }
  });
});

describe("offer accept OTP crypto and challenge rules", () => {
  const challengeId = "challenge_1";
  const code = "123456";
  const hash = hashOfferAcceptOtp(code, challengeId, SECRET);

  it("verifies HMAC-SHA256 hashes with timing-safe compare and rejects plain SHA-256", () => {
    expect(
      verifyOfferAcceptOtpHash({
        code,
        challengeId,
        storedHash: hash,
        secret: SECRET,
      })
    ).toBe(true);
    expect(
      verifyOfferAcceptOtpHash({
        code: "000000",
        challengeId,
        storedHash: hash,
        secret: SECRET,
      })
    ).toBe(false);
    const shaOnly = createHash("sha256").update(`${challengeId}:${code}`).digest("hex");
    expect(
      verifyOfferAcceptOtpHash({
        code,
        challengeId,
        storedHash: shaOnly,
        secret: SECRET,
      })
    ).toBe(false);
    expect(
      verifyOfferAcceptOtpHash({
        code,
        challengeId,
        storedHash: hash,
        secret: "a-different-secret-value-that-is-long",
      })
    ).toBe(false);
  });

  it("rejects expired, consumed, and exhausted challenges", () => {
    const now = new Date("2026-08-24T08:00:00.000Z");
    expect(
      evaluateOfferAcceptOtpVerification(
        {
          id: challengeId,
          code_hash: hash,
          expires_at: new Date("2026-08-24T07:59:00.000Z"),
          attempts: 0,
          consumed_at: null,
        },
        code,
        now,
        SECRET
      )
    ).toEqual({ ok: false, code: "OTP_EXPIRED" });

    expect(
      evaluateOfferAcceptOtpVerification(
        {
          id: challengeId,
          code_hash: hash,
          expires_at: new Date("2026-08-24T08:10:00.000Z"),
          attempts: 0,
          consumed_at: now,
        },
        code,
        now,
        SECRET
      )
    ).toEqual({ ok: false, code: "OTP_CHALLENGE_CONSUMED" });

    expect(
      evaluateOfferAcceptOtpVerification(
        {
          id: challengeId,
          code_hash: hash,
          expires_at: new Date("2026-08-24T08:10:00.000Z"),
          attempts: OFFER_ACCEPT_OTP_MAX_ATTEMPTS,
          consumed_at: null,
        },
        code,
        now,
        SECRET
      )
    ).toEqual({ ok: false, code: "OTP_ATTEMPTS_EXCEEDED" });

    expect(
      evaluateOfferAcceptOtpVerification(
        {
          id: challengeId,
          code_hash: hash,
          expires_at: new Date("2026-08-24T08:10:00.000Z"),
          attempts: 1,
          consumed_at: null,
        },
        "654321",
        now,
        SECRET
      )
    ).toEqual({ ok: false, code: "OTP_INVALID" });
  });

  it("enforces resend cooldown and the five-send cap", () => {
    const lastSent = new Date("2026-08-24T08:00:00.000Z");
    expect(
      evaluateOfferAcceptOtpResend(
        { resend_count: 0, last_sent_at: lastSent },
        new Date(lastSent.getTime() + 10_000)
      )
    ).toEqual({
      ok: false,
      code: "OTP_RESEND_COOLDOWN",
      resendAvailableAt: new Date(lastSent.getTime() + OFFER_ACCEPT_OTP_RESEND_COOLDOWN_MS),
    });

    expect(
      evaluateOfferAcceptOtpResend(
        { resend_count: OFFER_ACCEPT_OTP_MAX_SENDS - 1, last_sent_at: lastSent },
        new Date(lastSent.getTime() + OFFER_ACCEPT_OTP_RESEND_COOLDOWN_MS)
      )
    ).toEqual({
      ok: false,
      code: "OTP_RESEND_LIMIT",
      resendAvailableAt: lastSent,
    });

    expect(
      evaluateOfferAcceptOtpResend(
        { resend_count: 1, last_sent_at: lastSent },
        new Date(lastSent.getTime() + OFFER_ACCEPT_OTP_RESEND_COOLDOWN_MS)
      )
    ).toEqual({ ok: true, remainingSends: 2 });
  });

  it("returns timing metadata without the code or hash", () => {
    const result = toOfferAcceptOtpRequestResult({
      id: challengeId,
      expires_at: new Date("2026-08-24T08:10:00.000Z"),
      last_sent_at: new Date("2026-08-24T08:00:00.000Z"),
      resend_count: 0,
      attempts: 1,
    });
    expect(result.challenge_id).toBe(challengeId);
    expect(result.remaining_sends).toBe(4);
    expect(result.remaining_attempts).toBe(2);
    expect(JSON.stringify(result)).not.toContain(code);
    expect(JSON.stringify(result)).not.toContain(hash);
  });

  it("names the invoice offer and facility in the OTP email", () => {
    const email = buildOfferAcceptOtpEmail({
      signatoryName: "Ali",
      invoiceReference: "INV-100",
      facilityReference: "FAC-9",
      offeredAmount: 40000,
      code: "123456",
      expiresMinutes: 10,
    });
    expect(email.subject).toContain("INV-100");
    expect(email.text).toContain("invoice financing offer under the existing facility");
    expect(email.text).toContain("Facility: FAC-9");
    expect(email.text).toContain("RM 40,000.00");
    expect(email.html).toContain("123456");
  });
});

describe("incrementOfferAcceptOtpAttempts", () => {
  const challengeId = "cmchallenge000000000000001";

  function mockDb(count: number) {
    return {
      offerAcceptOtpChallenge: {
        updateMany: jest.fn().mockResolvedValue({ count }),
        update: jest.fn(),
      },
    };
  }

  it("increments only an existing unconsumed challenge below the max", async () => {
    const db = mockDb(1);
    await expect(
      incrementOfferAcceptOtpAttempts(
        { challengeId, applicationId: "app-1", invoiceId: "inv-1" },
        db as never
      )
    ).resolves.toEqual({ incremented: true });
    expect(db.offerAcceptOtpChallenge.update).not.toHaveBeenCalled();
    expect(db.offerAcceptOtpChallenge.updateMany).toHaveBeenCalledWith({
      where: {
        id: challengeId,
        consumed_at: null,
        attempts: { lt: OFFER_ACCEPT_OTP_MAX_ATTEMPTS },
        application_id: "app-1",
        invoice_id: "inv-1",
      },
      data: { attempts: { increment: 1 } },
    });
  });

  it("is a no-op when missing, mismatched, consumed, or already at max", async () => {
    const db = mockDb(0);
    await expect(
      incrementOfferAcceptOtpAttempts(
        {
          challengeId,
          applicationId: "app-1",
          invoiceId: "inv-other",
          contractId: "contract-1",
        },
        db as never
      )
    ).resolves.toEqual({ incremented: false });
    expect(db.offerAcceptOtpChallenge.updateMany).toHaveBeenCalledWith({
      where: {
        id: challengeId,
        consumed_at: null,
        attempts: { lt: OFFER_ACCEPT_OTP_MAX_ATTEMPTS },
        application_id: "app-1",
        invoice_id: "inv-other",
        contract_id: "contract-1",
      },
      data: { attempts: { increment: 1 } },
    });
  });

  it("keeps duplicate invalid submits bounded instead of stacking past max", async () => {
    const db = {
      offerAcceptOtpChallenge: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        update: jest.fn(),
      },
    };
    const params = { challengeId, applicationId: "app-1", invoiceId: "inv-1" };
    await expect(incrementOfferAcceptOtpAttempts(params, db as never)).resolves.toEqual({
      incremented: true,
    });
    await expect(incrementOfferAcceptOtpAttempts(params, db as never)).resolves.toEqual({
      incremented: false,
    });
    expect(db.offerAcceptOtpChallenge.updateMany).toHaveBeenCalledTimes(2);
    for (const call of db.offerAcceptOtpChallenge.updateMany.mock.calls) {
      expect(call[0].where.consumed_at).toBeNull();
      expect(call[0].where.attempts).toEqual({ lt: OFFER_ACCEPT_OTP_MAX_ATTEMPTS });
    }
  });
});

describe("consumeOfferAcceptOtpInTx", () => {
  const now = new Date();
  const secret = SECRET;
  const baseChallenge = {
    id: "cmchallenge000000000000001",
    application_id: "app-1",
    invoice_id: "inv-1",
    contract_id: "contract-1",
    signatory_name: "Ali",
    signatory_email: "ali@co.my",
    signatory_source: OfferAcceptSignatorySource.FACILITY_ENVELOPE,
    code_hash: hashOfferAcceptOtp("123456", "cmchallenge000000000000001", secret),
    expires_at: new Date(now.getTime() + 10 * 60 * 1000),
    attempts: 0,
    consumed_at: null,
  };

  function mockTx(challenge: typeof baseChallenge | null) {
    return {
      $queryRaw: jest.fn().mockResolvedValue(challenge ? [{ id: challenge.id }] : []),
      offerAcceptOtpChallenge: {
        findUnique: jest.fn().mockResolvedValue(challenge),
        update: jest.fn().mockResolvedValue({ ...challenge, consumed_at: now }),
      },
    };
  }

  const consumeParams = {
    challengeId: baseChallenge.id,
    otpCode: "123456",
    applicationId: "app-1",
    invoiceId: "inv-1",
    contractId: "contract-1",
  };

  it("rejects a missing challenge without consuming", async () => {
    const tx = mockTx(null);
    await expect(
      consumeOfferAcceptOtpInTx(tx as never, consumeParams)
    ).rejects.toMatchObject({ code: "OTP_CHALLENGE_NOT_FOUND" });
    expect(tx.offerAcceptOtpChallenge.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid code without consuming", async () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = secret;
    const tx = mockTx(baseChallenge);
    await expect(
      consumeOfferAcceptOtpInTx(tx as never, { ...consumeParams, otpCode: "000000" })
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
    expect(tx.offerAcceptOtpChallenge.update).not.toHaveBeenCalled();
    process.env.SESSION_SECRET = previous;
  });

  it("rejects a consumed challenge without writing again", async () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = secret;
    const tx = mockTx({ ...baseChallenge, consumed_at: now });
    await expect(
      consumeOfferAcceptOtpInTx(tx as never, consumeParams)
    ).rejects.toMatchObject({ code: "OTP_CHALLENGE_CONSUMED" });
    expect(tx.offerAcceptOtpChallenge.update).not.toHaveBeenCalled();
    process.env.SESSION_SECRET = previous;
  });
});

describe("offerAcceptOtpSendErrorMeta", () => {
  it("logs only class/name/code and never a message that could contain emails", () => {
    const error = Object.assign(new Error("Message rejected for ali@co.my from no-reply@cashsouk.com"), {
      name: "MessageRejected",
      code: "MessageRejected",
    });
    expect(offerAcceptOtpSendErrorMeta(error)).toEqual({
      errorName: "MessageRejected",
      errorCode: "MessageRejected",
    });
    expect(JSON.stringify(offerAcceptOtpSendErrorMeta(error))).not.toContain("@");
    expect(JSON.stringify(offerAcceptOtpSendErrorMeta(error))).not.toContain("rejected");
  });
});

describe("recoverFailedOfferAcceptOtpDelivery", () => {
  it("deletes a newly created challenge and restores a prior resend snapshot", async () => {
    const db = {
      offerAcceptOtpChallenge: {
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    await recoverFailedOfferAcceptOtpDelivery({
      challengeId: "new-1",
      createdNew: true,
      prior: null,
      db: db as never,
    });
    expect(db.offerAcceptOtpChallenge.delete).toHaveBeenCalledWith({ where: { id: "new-1" } });

    const prior = {
      code_hash: "old-hash",
      expires_at: new Date("2026-08-24T08:10:00.000Z"),
      attempts: 1,
      resend_count: 0,
      last_sent_at: new Date("2026-08-24T08:00:00.000Z"),
      signatory_name: "Ali",
      signatory_source: OfferAcceptSignatorySource.FACILITY_ENVELOPE,
      requested_by_user_id: "user1",
    };
    await recoverFailedOfferAcceptOtpDelivery({
      challengeId: "resend-1",
      createdNew: false,
      prior,
      db: db as never,
    });
    expect(db.offerAcceptOtpChallenge.update).toHaveBeenCalledWith({
      where: { id: "resend-1" },
      data: prior,
    });
  });
});

describe("persistAndSendOfferAcceptOtp send failure", () => {
  const signatory = {
    name: "Ali",
    email: "ali@co.my",
    source: OfferAcceptSignatorySource.FACILITY_ENVELOPE,
  };
  const params = {
    applicationId: "app-1",
    invoiceId: "inv-1",
    contractId: "contract-1",
    requestedByUserId: "user1",
    signatory,
    invoiceReference: "INV-100",
    facilityReference: "FAC-9",
    offeredAmount: 1000,
  };

  it("deletes a newly created challenge when SES fails and keeps logs PII-safe", async () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = SECRET;
    const created = {
      id: "cmchallenge000000000000009",
      resend_count: 0,
      last_sent_at: new Date("2026-08-24T08:00:00.000Z"),
      expires_at: new Date("2026-08-24T08:10:00.000Z"),
      attempts: 0,
    };
    const db = {
      offerAcceptOtpChallenge: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn().mockResolvedValue(created),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const log = { error: jest.fn(), info: jest.fn() };
    const sendError = Object.assign(new Error("Email rejected for ali@co.my"), {
      name: "MessageRejected",
      code: "MessageRejected",
    });

    await expect(
      persistAndSendOfferAcceptOtp(params, {
        db: db as never,
        send: jest.fn().mockRejectedValue(sendError),
        log,
      })
    ).rejects.toMatchObject({ code: "OTP_EMAIL_FAILED" });

    expect(db.offerAcceptOtpChallenge.delete).toHaveBeenCalledWith({
      where: { id: created.id },
    });
    const logged = JSON.stringify(log.error.mock.calls);
    expect(logged).not.toContain("ali@co.my");
    expect(logged).not.toContain("Email rejected");
    expect(logged).not.toMatch(/\b\d{6}\b/);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeId: created.id,
        errorName: "MessageRejected",
        errorCode: "MessageRejected",
      }),
      "Failed to send invoice offer accept OTP"
    );
    process.env.SESSION_SECRET = previous;
  });

  it("restores the prior challenge so a failed resend does not consume cooldown", async () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = SECRET;
    const lastSent = new Date("2026-08-24T07:58:00.000Z");
    const existing = {
      id: "cmchallenge000000000000008",
      application_id: "app-1",
      invoice_id: "inv-1",
      contract_id: "contract-1",
      requested_by_user_id: "user1",
      signatory_name: "Ali",
      signatory_email: "ali@co.my",
      signatory_source: OfferAcceptSignatorySource.FACILITY_ENVELOPE,
      code_hash: "old-hash",
      expires_at: new Date("2026-08-24T08:10:00.000Z"),
      attempts: 1,
      consumed_at: null,
      resend_count: 0,
      last_sent_at: lastSent,
    };
    const db = {
      offerAcceptOtpChallenge: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ ...existing, resend_count: 1 }),
        delete: jest.fn(),
      },
    };

    await expect(
      persistAndSendOfferAcceptOtp(params, {
        db: db as never,
        send: jest.fn().mockRejectedValue(Object.assign(new Error("SES down"), { name: "Timeout" })),
        log: { error: jest.fn(), info: jest.fn() },
      })
    ).rejects.toMatchObject({ code: "OTP_EMAIL_FAILED" });

    expect(db.offerAcceptOtpChallenge.delete).not.toHaveBeenCalled();
    expect(db.offerAcceptOtpChallenge.update).toHaveBeenLastCalledWith({
      where: { id: existing.id },
      data: {
        code_hash: "old-hash",
        expires_at: existing.expires_at,
        attempts: 1,
        resend_count: 0,
        last_sent_at: lastSent,
        signatory_name: "Ali",
        signatory_source: OfferAcceptSignatorySource.FACILITY_ENVELOPE,
        requested_by_user_id: "user1",
      },
    });
    process.env.SESSION_SECRET = previous;
  });
});

describe("utilisation consent accept order", () => {
  it("resolves consents before consuming the OTP challenge", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const source = fs.readFileSync(path.join(__dirname, "service.ts"), "utf8");
    const consentIdx = source.indexOf(
      "buildUtilisationOfferConsentAcknowledgement(options.consent_ids, now)"
    );
    const consumeIdx = source.indexOf("acceptedSignatory = await consumeOfferAcceptOtpInTx");
    expect(consentIdx).toBeGreaterThan(-1);
    expect(consumeIdx).toBeGreaterThan(consentIdx);
  });
});
