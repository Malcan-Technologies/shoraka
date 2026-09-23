import {
  canonicalSigningRoleKey,
  formatPhaseDeadlineAbsolute,
  getIssuerAuthorizedParty,
  isShorakaSigningRecipient,
  normalizeSigningEmail,
  signingDesignationFromCapacity,
  type AuthorizedPartiesSnapshot,
} from "@cashsouk/types";
import { escapeHtml } from "../../lib/html-escape";

export type SigningEmailOfferKind = "facility" | "invoice";

export interface SigningEmailInput {
  recipientName: string;
  recipientRoleLabel: string;
  organizationName: string | null;
  displayReference: string | null;
  offerKind: SigningEmailOfferKind;
  documentNames: string[];
  signingExpiresAtIso: string | null;
  signingUrl: string;
  isReminder: boolean;
  hasOtherCapacity: boolean;
}

type SigningEmailDocument = {
  id: string;
  name: string;
  order: number;
};

type SigningEmailAssignment = {
  recipient_id: string;
  document_id: string;
  action: string;
  status: string;
};

type SigningEmailRecipient = {
  id: string;
  email: string;
  execution_mode?: string | null;
  delivery_mode?: string | null;
};

export function signingEmailRoleLabel(input: {
  roleKey: string;
  roleLabel: string | null | undefined;
  email: string;
  authorizedParties: AuthorizedPartiesSnapshot | null;
}): string {
  const stored = input.roleLabel?.trim() || "";
  if (canonicalSigningRoleKey(input.roleKey) === "guarantor") {
    return stored || "Guarantor";
  }
  const party = getIssuerAuthorizedParty(input.authorizedParties);
  const match = party?.representatives.find(
    (rep) => normalizeSigningEmail(rep.email) === normalizeSigningEmail(input.email)
  );
  if (match) return signingDesignationFromCapacity(match.capacity);
  return stored || "Authorised Signatory";
}

export function recipientHasOtherSigningCapacity(
  recipients: SigningEmailRecipient[],
  recipient: Pick<SigningEmailRecipient, "id" | "email">
): boolean {
  const email = normalizeSigningEmail(recipient.email);
  return recipients.some((other) => {
    if (other.id === recipient.id) return false;
    if (isShorakaSigningRecipient(other)) return false;
    return normalizeSigningEmail(other.email) === email;
  });
}

export function documentNamesForSigningEmail(input: {
  documents: SigningEmailDocument[];
  assignments: SigningEmailAssignment[];
  recipientId: string;
  isReminder: boolean;
  preferredDocumentId?: string | null;
}): string[] {
  const documentById = new Map(input.documents.map((document) => [document.id, document]));
  const rows = input.assignments
    .filter((assignment) => assignment.action === "SIGN" && assignment.recipient_id === input.recipientId)
    .map((assignment) => {
      const document = documentById.get(assignment.document_id);
      return document ? { assignment, document } : null;
    })
    .filter((row): row is { assignment: SigningEmailAssignment; document: SigningEmailDocument } => row != null)
    .sort((left, right) => left.document.order - right.document.order);

  const preferredId = input.preferredDocumentId?.trim() || null;
  const scoped = preferredId ? rows.filter((row) => row.document.id === preferredId) : rows;
  const visible = input.isReminder
    ? scoped.filter((row) => row.assignment.status !== "SIGNED")
    : scoped;

  return visible
    .map((row) => row.document.name.trim())
    .filter((name) => name.length > 0);
}

export function resolveSigningEmailOfferKind(envelope: {
  invoice_id?: string | null;
}): SigningEmailOfferKind {
  return envelope.invoice_id ? "invoice" : "facility";
}

export function signingEmailDisplayReference(
  envelope: { invoice_id?: string | null },
  application:
    | {
        invoices?: Array<{ id: string; display_reference?: string | null }>;
        contract?: { display_reference?: string | null } | null;
      }
    | null
    | undefined
): string | null {
  if (!application) return null;
  if (envelope.invoice_id) {
    const invoice = application.invoices?.find((item) => item.id === envelope.invoice_id);
    const invoiceRef = invoice?.display_reference?.trim();
    return invoiceRef || null;
  }
  const contractRef = application.contract?.display_reference?.trim();
  return contractRef || null;
}

function offerNoun(kind: SigningEmailOfferKind): string {
  return kind === "invoice" ? "invoice offer" : "facility offer";
}

function offerForPhrase(
  kind: SigningEmailOfferKind,
  organizationName: string | null,
  displayReference: string | null
): string {
  const offer = offerNoun(kind);
  const org = organizationName?.trim() || "";
  const ref = displayReference?.trim() || "";
  if (org && ref) return `the ${offer} for ${org} (${ref})`;
  if (org) return `the ${offer} for ${org}`;
  if (ref) return `the ${offer} (${ref})`;
  return `the ${offer}`;
}

function formatDeadlineLabel(iso: string | null): string | null {
  if (!iso?.trim()) return null;
  if (!Number.isFinite(Date.parse(iso))) return null;
  return `${formatPhaseDeadlineAbsolute(iso)} (Malaysia time)`;
}

function reminderDocumentSubject(documentNames: string[]): string | null {
  if (documentNames.length !== 1) return null;
  const name = documentNames[0]?.trim();
  return name ? name : null;
}

export function buildSigningEmail(input: SigningEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const name = input.recipientName.trim() || "there";
  const roleLabel = input.recipientRoleLabel.trim() || "Authorised Signatory";
  const offerPhrase = offerForPhrase(input.offerKind, input.organizationName, input.displayReference);
  const deadline = formatDeadlineLabel(input.signingExpiresAtIso);
  const documentsHeading = input.isReminder ? "Documents still to sign" : "Documents you need to sign";
  const intro = input.isReminder
    ? `This is a reminder to complete signing for ${offerPhrase}.`
    : `CashSouk has asked you to sign documents for ${offerPhrase}.`;
  const heading = input.isReminder ? "Reminder: signature still needed" : "Signature requested";
  const reminderDoc = input.isReminder ? reminderDocumentSubject(input.documentNames) : null;
  const subject = input.isReminder
    ? reminderDoc
      ? `[CashSouk] Reminder — ${reminderDoc} still needs your signature`
      : "[CashSouk] Reminder — signature still needed"
    : `[CashSouk] Signature requested — as ${roleLabel}`;

  const documentItemsHtml = input.documentNames
    .map((documentName) => `<li>${escapeHtml(documentName)}</li>`)
    .join("");
  const documentsHtml =
    input.documentNames.length > 0
      ? `<p style="margin: 0 0 8px; font-weight: 600;">${escapeHtml(documentsHeading)}</p>
          <ul style="margin: 0 0 16px; padding-left: 20px;">
            ${documentItemsHtml}
          </ul>`
      : "";
  const deadlineHtml = deadline
    ? `<p>Complete signing by <strong>${escapeHtml(deadline)}</strong>.</p>`
    : "";
  const otherCapacityHtml = input.hasOtherCapacity
    ? "<p>If you are also signing in another capacity, you will receive a separate email with a different link.</p>"
    : "";
  const year = new Date().getFullYear();
  const safeUrl = escapeHtml(input.signingUrl);
  const safeName = escapeHtml(name);
  const safeRole = escapeHtml(roleLabel);
  const safeIntro = escapeHtml(intro);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
        .header { margin-bottom: 20px; border-bottom: 2px solid #8A0304; padding-bottom: 10px; }
        .header h2 { color: #8A0304; margin: 0; }
        .content { margin-bottom: 30px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #8A0304; color: #ffffff !important; text-decoration: none; border-radius: 4px; font-weight: bold; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .footer a { color: #8A0304; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${escapeHtml(heading)}</h2>
        </div>
        <div class="content">
          <p>Hello ${safeName},</p>
          <p>${safeIntro}</p>
          <p>You are signing as <strong>${safeRole}</strong>.</p>
          ${documentsHtml}
          ${deadlineHtml}
          <div style="margin-top: 25px;">
            <a href="${safeUrl}" class="button">Open signing link</a>
          </div>
          <p>This link is unique to you. You will be asked to confirm your MyKad number before signing.</p>
          <p>If the button does not work, copy and paste this link into your browser:<br>
            <a href="${safeUrl}" style="color: #8A0304; word-break: break-all;">${safeUrl}</a>
          </p>
        </div>
        <div class="footer">
          ${otherCapacityHtml}
          <p>If you did not expect this email, you can ignore it.</p>
          <p>&copy; ${year} CashSouk. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const documentLines =
    input.documentNames.length > 0
      ? `\n\n${documentsHeading}\n${input.documentNames.map((documentName) => `- ${documentName}`).join("\n")}`
      : "";
  const deadlineLine = deadline ? `\n\nComplete signing by ${deadline}.` : "";
  const otherCapacityLine = input.hasOtherCapacity
    ? "\n\nIf you are also signing in another capacity, you will receive a separate email with a different link."
    : "";

  const text = `${heading}

Hello ${name},

${intro}

You are signing as ${roleLabel}.${documentLines}${deadlineLine}

Open your signing link:
${input.signingUrl}

This link is unique to you. You will be asked to confirm your MyKad number before signing.

If the button does not work, copy and paste this link into your browser:
${input.signingUrl}${otherCapacityLine}

If you did not expect this email, you can ignore it.

© ${year} CashSouk. All rights reserved.`;

  return { subject, html, text };
}
