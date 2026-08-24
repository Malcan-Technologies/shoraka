import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { z } from "zod";
import { OfferAcceptSignatorySource, Prisma, type PrismaClient } from "@prisma/client";
import { normalizeSigningEmail } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { sendEmail } from "../../lib/email/ses-client";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";

export const OFFER_ACCEPT_OTP_LENGTH = 6;
export const OFFER_ACCEPT_OTP_TTL_MS = 10 * 60 * 1000;
export const OFFER_ACCEPT_OTP_MAX_ATTEMPTS = 3;
export const OFFER_ACCEPT_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OFFER_ACCEPT_OTP_MAX_SENDS = 5;

const signatoryEmailSchema = z.string().email();

export type OfferAcceptOtpDb = PrismaClient | Prisma.TransactionClient;

export type OfferAcceptSignatory = {
  name: string;
  email: string;
  source: OfferAcceptSignatorySource;
};

export type AcceptedOfferSignatory = OfferAcceptSignatory & {
  verified_at: string;
};

export type EnvelopeRecipientInput = {
  role_key: string;
  name: string;
  email: string;
  status: string;
};

export type OrgDirectorInput = {
  name: string | null;
  email?: string | null;
  roles: string[];
};

export type OfferAcceptOtpChallengeRow = {
  id: string;
  application_id: string;
  invoice_id: string;
  contract_id: string;
  signatory_name: string;
  signatory_email: string;
  signatory_source: OfferAcceptSignatorySource;
  code_hash: string;
  expires_at: Date;
  attempts: number;
  consumed_at: Date | null;
  resend_count: number;
  last_sent_at: Date;
};

export type OfferAcceptOtpRequestResult = {
  challenge_id: string;
  expires_at: string;
  last_sent_at: string;
  resend_available_at: string;
  remaining_sends: number;
  remaining_attempts: number;
};

type OtpVerificationFailure =
  | "OTP_CHALLENGE_NOT_FOUND"
  | "OTP_CHALLENGE_MISMATCH"
  | "OTP_CHALLENGE_CONSUMED"
  | "OTP_EXPIRED"
  | "OTP_ATTEMPTS_EXCEEDED"
  | "OTP_INVALID";

const OTP_INVALID_MESSAGES: Record<OtpVerificationFailure, string> = {
  OTP_CHALLENGE_NOT_FOUND: "Verification challenge was not found.",
  OTP_CHALLENGE_MISMATCH: "Verification challenge does not match this invoice offer.",
  OTP_CHALLENGE_CONSUMED: "This verification code has already been used.",
  OTP_EXPIRED: "This verification code has expired. Request a new code.",
  OTP_ATTEMPTS_EXCEEDED: "Too many incorrect codes. Request a new verification code.",
  OTP_INVALID: "The verification code is incorrect.",
};

export function invoiceOfferAcceptRequiresOtp(params: {
  action: "accept" | "reject";
  invoiceContractId: string | null | undefined;
  signingCompletion?: unknown;
}): boolean {
  if (params.action !== "accept") return false;
  if (params.signingCompletion) return false;
  return Boolean(params.invoiceContractId);
}

export function resolveOfferAcceptOtpSecret(): string {
  const dedicated = process.env.OFFER_ACCEPT_OTP_SECRET?.trim();
  if (dedicated) return dedicated;
  const session = process.env.SESSION_SECRET?.trim();
  if (session) return session;
  throw new AppError(
    500,
    "OTP_SECRET_MISSING",
    "Offer acceptance verification is not configured."
  );
}

export function generateOfferAcceptOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(OFFER_ACCEPT_OTP_LENGTH, "0");
}

export function hashOfferAcceptOtp(code: string, challengeId: string, secret = resolveOfferAcceptOtpSecret()): string {
  return createHmac("sha256", secret).update(`${challengeId}:${code}`).digest("hex");
}

export function verifyOfferAcceptOtpHash(params: {
  code: string;
  challengeId: string;
  storedHash: string;
  secret?: string;
}): boolean {
  const expected = hashOfferAcceptOtp(params.code, params.challengeId, params.secret);
  const actual = params.storedHash;
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(actual, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export function isEligibleIssuerDirectorRole(roleKey: string): boolean {
  return roleKey === "issuer_director" || roleKey.startsWith("issuer_director");
}

function isValidSignatoryEmail(email: string): boolean {
  return signatoryEmailSchema.safeParse(email).success;
}

function displaySignatoryName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  return trimmed || "Director";
}

export function resolveOfferAcceptEnvelopeSignatories(
  envelopeRecipients: EnvelopeRecipientInput[]
): { signatories: OfferAcceptSignatory[]; source: OfferAcceptSignatorySource } | null {
  const signatories = dedupeSignatories(
    envelopeRecipients
      .filter(
        (recipient) =>
          isEligibleIssuerDirectorRole(recipient.role_key) && recipient.status === "SIGNED"
      )
      .map((recipient) => ({
        name: displaySignatoryName(recipient.name),
        email: recipient.email,
        source: OfferAcceptSignatorySource.FACILITY_ENVELOPE,
      }))
  );
  if (signatories.length === 0) return null;
  return { signatories, source: OfferAcceptSignatorySource.FACILITY_ENVELOPE };
}

export function resolveOfferAcceptSignatories(input: {
  envelopeRecipients: EnvelopeRecipientInput[];
  orgDirectors: OrgDirectorInput[];
}): { signatories: OfferAcceptSignatory[]; source: OfferAcceptSignatorySource } {
  const fromEnvelope = resolveOfferAcceptEnvelopeSignatories(input.envelopeRecipients);
  if (fromEnvelope) return fromEnvelope;

  const fromOrg = dedupeSignatories(
    input.orgDirectors
      .filter((person) => person.roles.some((role) => role.toUpperCase() === "DIRECTOR"))
      .map((person) => ({
        name: displaySignatoryName(person.name),
        email: person.email ?? "",
        source: OfferAcceptSignatorySource.ORG_DIRECTOR,
      }))
  );
  if (fromOrg.length > 0) {
    return { signatories: fromOrg, source: OfferAcceptSignatorySource.ORG_DIRECTOR };
  }

  throw new AppError(
    400,
    "OTP_NO_SIGNATORIES",
    "No authorised signatory emails are available for this facility offer."
  );
}

function dedupeSignatories(candidates: OfferAcceptSignatory[]): OfferAcceptSignatory[] {
  const seen = new Set<string>();
  const result: OfferAcceptSignatory[] = [];
  for (const candidate of candidates) {
    const email = normalizeSigningEmail(candidate.email);
    if (!email || !isValidSignatoryEmail(email) || seen.has(email)) continue;
    seen.add(email);
    result.push({ ...candidate, email });
  }
  return result;
}

export function matchOfferAcceptSignatory(
  signatories: OfferAcceptSignatory[],
  email: string
): OfferAcceptSignatory {
  const normalized = normalizeSigningEmail(email);
  const match = signatories.find((signatory) => signatory.email === normalized);
  if (!match) {
    throw new AppError(
      400,
      "OTP_SIGNATORY_NOT_ELIGIBLE",
      "Choose an authorised signatory from the facility or organisation director list."
    );
  }
  return match;
}

export function evaluateOfferAcceptOtpResend(
  challenge: Pick<OfferAcceptOtpChallengeRow, "resend_count" | "last_sent_at">,
  now = new Date()
):
  | { ok: true; remainingSends: number }
  | { ok: false; code: "OTP_RESEND_COOLDOWN" | "OTP_RESEND_LIMIT"; resendAvailableAt: Date } {
  const sendsUsed = challenge.resend_count + 1;
  if (sendsUsed >= OFFER_ACCEPT_OTP_MAX_SENDS) {
    return {
      ok: false,
      code: "OTP_RESEND_LIMIT",
      resendAvailableAt: challenge.last_sent_at,
    };
  }
  const resendAvailableAt = new Date(
    challenge.last_sent_at.getTime() + OFFER_ACCEPT_OTP_RESEND_COOLDOWN_MS
  );
  if (now.getTime() < resendAvailableAt.getTime()) {
    return { ok: false, code: "OTP_RESEND_COOLDOWN", resendAvailableAt };
  }
  return { ok: true, remainingSends: OFFER_ACCEPT_OTP_MAX_SENDS - sendsUsed - 1 };
}

export function evaluateOfferAcceptOtpVerification(
  challenge: Pick<
    OfferAcceptOtpChallengeRow,
    "id" | "code_hash" | "expires_at" | "attempts" | "consumed_at"
  >,
  otpCode: string,
  now = new Date(),
  secret?: string
): { ok: true } | { ok: false; code: Exclude<OtpVerificationFailure, "OTP_CHALLENGE_NOT_FOUND" | "OTP_CHALLENGE_MISMATCH"> } {
  if (challenge.consumed_at) {
    return { ok: false, code: "OTP_CHALLENGE_CONSUMED" };
  }
  if (challenge.attempts >= OFFER_ACCEPT_OTP_MAX_ATTEMPTS) {
    return { ok: false, code: "OTP_ATTEMPTS_EXCEEDED" };
  }
  if (now.getTime() >= challenge.expires_at.getTime()) {
    return { ok: false, code: "OTP_EXPIRED" };
  }
  if (!/^\d{6}$/.test(otpCode)) {
    return { ok: false, code: "OTP_INVALID" };
  }
  if (
    !verifyOfferAcceptOtpHash({
      code: otpCode,
      challengeId: challenge.id,
      storedHash: challenge.code_hash,
      secret,
    })
  ) {
    return { ok: false, code: "OTP_INVALID" };
  }
  return { ok: true };
}

export function escapeOfferAcceptOtpHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatOfferAcceptOtpAmount(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return `RM ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildOfferAcceptOtpEmail(input: {
  signatoryName: string;
  invoiceReference: string;
  facilityReference: string;
  offeredAmount: number | null;
  code: string;
  expiresMinutes: number;
}): { subject: string; html: string; text: string } {
  const amountLine = formatOfferAcceptOtpAmount(input.offeredAmount);
  const subject = `Verification code to accept invoice offer ${input.invoiceReference}`;
  const intro =
    "Use this code to confirm acceptance of the invoice financing offer under the existing facility.";
  const details = [
    `Invoice: ${input.invoiceReference}`,
    `Facility: ${input.facilityReference}`,
    ...(amountLine ? [`Offer amount: ${amountLine}`] : []),
    `Code: ${input.code}`,
    `This code expires in ${input.expiresMinutes} minutes.`,
  ];
  const text = [`Hello ${input.signatoryName},`, "", intro, "", ...details, "", "If you did not request this, ignore this email."].join(
    "\n"
  );
  const html = [
    `<p>Hello ${escapeOfferAcceptOtpHtml(input.signatoryName)},</p>`,
    `<p>${escapeOfferAcceptOtpHtml(intro)}</p>`,
    `<p>Invoice: ${escapeOfferAcceptOtpHtml(input.invoiceReference)}<br/>Facility: ${escapeOfferAcceptOtpHtml(input.facilityReference)}${
      amountLine ? `<br/>Offer amount: ${escapeOfferAcceptOtpHtml(amountLine)}` : ""
    }</p>`,
    `<p><strong>${escapeOfferAcceptOtpHtml(input.code)}</strong></p>`,
    `<p>This code expires in ${input.expiresMinutes} minutes.</p>`,
    "<p>If you did not request this, ignore this email.</p>",
  ].join("");
  return { subject, html, text };
}

export function toOfferAcceptOtpRequestResult(
  challenge: Pick<
    OfferAcceptOtpChallengeRow,
    "id" | "expires_at" | "last_sent_at" | "resend_count" | "attempts"
  >
): OfferAcceptOtpRequestResult {
  const sendsUsed = challenge.resend_count + 1;
  return {
    challenge_id: challenge.id,
    expires_at: challenge.expires_at.toISOString(),
    last_sent_at: challenge.last_sent_at.toISOString(),
    resend_available_at: new Date(
      challenge.last_sent_at.getTime() + OFFER_ACCEPT_OTP_RESEND_COOLDOWN_MS
    ).toISOString(),
    remaining_sends: Math.max(0, OFFER_ACCEPT_OTP_MAX_SENDS - sendsUsed),
    remaining_attempts: Math.max(0, OFFER_ACCEPT_OTP_MAX_ATTEMPTS - challenge.attempts),
  };
}

function otpVerificationError(code: OtpVerificationFailure): AppError {
  return new AppError(400, code, OTP_INVALID_MESSAGES[code]);
}

export async function incrementOfferAcceptOtpAttempts(
  params: {
    challengeId: string;
    applicationId?: string;
    invoiceId?: string;
    contractId?: string;
  },
  db: OfferAcceptOtpDb = prisma
): Promise<{ incremented: boolean }> {
  const result = await db.offerAcceptOtpChallenge.updateMany({
    where: {
      id: params.challengeId,
      consumed_at: null,
      attempts: { lt: OFFER_ACCEPT_OTP_MAX_ATTEMPTS },
      ...(params.applicationId ? { application_id: params.applicationId } : {}),
      ...(params.invoiceId ? { invoice_id: params.invoiceId } : {}),
      ...(params.contractId ? { contract_id: params.contractId } : {}),
    },
    data: { attempts: { increment: 1 } },
  });
  return { incremented: result.count === 1 };
}

export async function consumeOfferAcceptOtpInTx(
  tx: Prisma.TransactionClient,
  params: {
    challengeId: string;
    otpCode: string;
    applicationId: string;
    invoiceId: string;
    contractId: string;
  }
): Promise<AcceptedOfferSignatory> {
  await tx.$queryRaw`
    SELECT id FROM offer_accept_otp_challenges
    WHERE id = ${params.challengeId}
    FOR UPDATE
  `;
  const challenge = await tx.offerAcceptOtpChallenge.findUnique({
    where: { id: params.challengeId },
  });
  if (!challenge) {
    throw otpVerificationError("OTP_CHALLENGE_NOT_FOUND");
  }
  if (
    challenge.application_id !== params.applicationId ||
    challenge.invoice_id !== params.invoiceId ||
    challenge.contract_id !== params.contractId
  ) {
    throw otpVerificationError("OTP_CHALLENGE_MISMATCH");
  }
  const check = evaluateOfferAcceptOtpVerification(challenge, params.otpCode);
  if (!check.ok) {
    throw otpVerificationError(check.code);
  }
  const consumedAt = new Date();
  await tx.offerAcceptOtpChallenge.update({
    where: { id: challenge.id },
    data: { consumed_at: consumedAt },
  });
  return {
    name: challenge.signatory_name,
    email: challenge.signatory_email,
    source: challenge.signatory_source,
    verified_at: consumedAt.toISOString(),
  };
}

export function isOfferAcceptOtpInvalidError(error: unknown): error is AppError {
  return error instanceof AppError && error.code === "OTP_INVALID";
}

export type OfferAcceptOtpSendSnapshot = {
  code_hash: string;
  expires_at: Date;
  attempts: number;
  resend_count: number;
  last_sent_at: Date;
  signatory_name: string;
  signatory_source: OfferAcceptSignatorySource;
  requested_by_user_id: string;
};

export function offerAcceptOtpSendErrorMeta(error: unknown): {
  errorName: string;
  errorCode?: string;
} {
  if (error instanceof Error) {
    const code =
      "code" in error && typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    return code
      ? { errorName: error.name || "Error", errorCode: code }
      : { errorName: error.name || "Error" };
  }
  if (error && typeof error === "object") {
    const name =
      "name" in error && typeof error.name === "string" && error.name ? error.name : "Object";
    const code =
      "code" in error && typeof error.code === "string" && error.code ? error.code : undefined;
    return code ? { errorName: name, errorCode: code } : { errorName: name };
  }
  return { errorName: error === null ? "null" : typeof error };
}

export async function recoverFailedOfferAcceptOtpDelivery(params: {
  challengeId: string;
  createdNew: boolean;
  prior: OfferAcceptOtpSendSnapshot | null;
  db?: OfferAcceptOtpDb;
}): Promise<void> {
  const db = params.db ?? prisma;
  if (params.createdNew) {
    await db.offerAcceptOtpChallenge.delete({ where: { id: params.challengeId } });
    return;
  }
  if (!params.prior) return;
  await db.offerAcceptOtpChallenge.update({
    where: { id: params.challengeId },
    data: {
      code_hash: params.prior.code_hash,
      expires_at: params.prior.expires_at,
      attempts: params.prior.attempts,
      resend_count: params.prior.resend_count,
      last_sent_at: params.prior.last_sent_at,
      signatory_name: params.prior.signatory_name,
      signatory_source: params.prior.signatory_source,
      requested_by_user_id: params.prior.requested_by_user_id,
    },
  });
}

export async function persistAndSendOfferAcceptOtp(
  params: {
    applicationId: string;
    invoiceId: string;
    contractId: string;
    requestedByUserId: string;
    signatory: OfferAcceptSignatory;
    invoiceReference: string;
    facilityReference: string;
    offeredAmount: number | null;
  },
  deps: {
    db?: OfferAcceptOtpDb;
    send?: typeof sendEmail;
    log?: Pick<typeof logger, "error" | "info">;
  } = {}
): Promise<OfferAcceptOtpRequestResult> {
  const db = deps.db ?? prisma;
  const send = deps.send ?? sendEmail;
  const log = deps.log ?? logger;
  const now = new Date();
  const code = generateOfferAcceptOtpCode();
  const existing = await db.offerAcceptOtpChallenge.findFirst({
    where: {
      invoice_id: params.invoiceId,
      signatory_email: params.signatory.email,
      consumed_at: null,
      expires_at: { gt: now },
    },
    orderBy: { created_at: "desc" },
  });

  let challenge: OfferAcceptOtpChallengeRow;
  let createdNew = false;
  let prior: OfferAcceptOtpSendSnapshot | null = null;
  if (existing) {
    const resend = evaluateOfferAcceptOtpResend(existing, now);
    if (!resend.ok) {
      throw new AppError(
        429,
        resend.code,
        resend.code === "OTP_RESEND_COOLDOWN"
          ? "Wait before requesting another verification code."
          : "This verification challenge has reached the send limit. Try again after it expires."
      );
    }
    prior = {
      code_hash: existing.code_hash,
      expires_at: existing.expires_at,
      attempts: existing.attempts,
      resend_count: existing.resend_count,
      last_sent_at: existing.last_sent_at,
      signatory_name: existing.signatory_name,
      signatory_source: existing.signatory_source,
      requested_by_user_id: existing.requested_by_user_id,
    };
    const hash = hashOfferAcceptOtp(code, existing.id);
    challenge = await db.offerAcceptOtpChallenge.update({
      where: { id: existing.id },
      data: {
        code_hash: hash,
        expires_at: new Date(now.getTime() + OFFER_ACCEPT_OTP_TTL_MS),
        attempts: 0,
        resend_count: { increment: 1 },
        last_sent_at: now,
        signatory_name: params.signatory.name,
        signatory_source: params.signatory.source,
        requested_by_user_id: params.requestedByUserId,
      },
    });
  } else {
    createdNew = true;
    const created = await db.offerAcceptOtpChallenge.create({
      data: {
        application_id: params.applicationId,
        invoice_id: params.invoiceId,
        contract_id: params.contractId,
        requested_by_user_id: params.requestedByUserId,
        signatory_name: params.signatory.name,
        signatory_email: params.signatory.email,
        signatory_source: params.signatory.source,
        code_hash: "pending",
        expires_at: new Date(now.getTime() + OFFER_ACCEPT_OTP_TTL_MS),
        last_sent_at: now,
      },
    });
    const hash = hashOfferAcceptOtp(code, created.id);
    challenge = await db.offerAcceptOtpChallenge.update({
      where: { id: created.id },
      data: { code_hash: hash },
    });
  }

  const email = buildOfferAcceptOtpEmail({
    signatoryName: params.signatory.name,
    invoiceReference: params.invoiceReference,
    facilityReference: params.facilityReference,
    offeredAmount: params.offeredAmount,
    code,
    expiresMinutes: OFFER_ACCEPT_OTP_TTL_MS / 60_000,
  });

  try {
    await send({
      to: params.signatory.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  } catch (error) {
    log.error(
      {
        challengeId: challenge.id,
        invoiceId: params.invoiceId,
        applicationId: params.applicationId,
        ...offerAcceptOtpSendErrorMeta(error),
      },
      "Failed to send invoice offer accept OTP"
    );
    try {
      await recoverFailedOfferAcceptOtpDelivery({
        challengeId: challenge.id,
        createdNew,
        prior,
        db,
      });
    } catch (recoveryError) {
      log.error(
        {
          challengeId: challenge.id,
          invoiceId: params.invoiceId,
          applicationId: params.applicationId,
          ...offerAcceptOtpSendErrorMeta(recoveryError),
        },
        "Failed to recover invoice offer accept OTP challenge after send failure"
      );
    }
    throw new AppError(
      502,
      "OTP_EMAIL_FAILED",
      "Could not send the verification code. Please try again."
    );
  }

  log.info(
    {
      challengeId: challenge.id,
      invoiceId: params.invoiceId,
      applicationId: params.applicationId,
    },
    "Invoice offer accept OTP sent"
  );

  return toOfferAcceptOtpRequestResult(challenge);
}
