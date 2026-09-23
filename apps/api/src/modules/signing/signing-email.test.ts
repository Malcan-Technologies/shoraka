import { computePhaseDeadlineExpiresAt } from "@cashsouk/types";
import type { AuthorizedPartiesSnapshot } from "@cashsouk/types";
import {
  buildSigningEmail,
  documentNamesForSigningEmail,
  recipientHasOtherSigningCapacity,
  resolveSigningEmailOfferKind,
  signingEmailRoleLabel,
} from "./signing-email";

const ISSUER_SNAPSHOT: AuthorizedPartiesSnapshot = {
  submitted_by_user_id: "user_1",
  submitted_at: "2026-08-21T00:00:00.000Z",
  parties: [
    {
      key: "issuer",
      entity_kind: "ISSUER",
      representatives: [
        {
          name: "Lim Tze Yang",
          email: "lim@acme.my",
          ic_number: "820508105871",
          capacity: "authorised_signatory",
          person_match_key: "820508105871",
        },
      ],
    },
  ],
};

const DEADLINE_ISO = computePhaseDeadlineExpiresAt("2026-09-23T02:00:00.000Z", 14);

describe("signingEmailRoleLabel", () => {
  it("uses Guarantor for the guarantor role", () => {
    expect(
      signingEmailRoleLabel({
        roleKey: "guarantor",
        roleLabel: "Guarantor",
        email: "lim@acme.my",
        authorizedParties: ISSUER_SNAPSHOT,
      })
    ).toBe("Guarantor");
  });

  it("uses the issuer representative capacity when the snapshot matches", () => {
    expect(
      signingEmailRoleLabel({
        roleKey: "issuer_director",
        roleLabel: "Issuer director",
        email: "lim@acme.my",
        authorizedParties: ISSUER_SNAPSHOT,
      })
    ).toBe("Authorised Signatory");
  });

  it("falls back to the stored role label when the snapshot has no match", () => {
    expect(
      signingEmailRoleLabel({
        roleKey: "issuer_director",
        roleLabel: "Director",
        email: "other@acme.my",
        authorizedParties: ISSUER_SNAPSHOT,
      })
    ).toBe("Director");
  });
});

describe("documentNamesForSigningEmail", () => {
  const documents = [
    { id: "doa", name: "Deed of Assignment", order: 1 },
    { id: "fa", name: "Facility Agreement", order: 2 },
    { id: "jsg", name: "Guarantor Agreement", order: 3 },
  ];
  const assignments = [
    { recipient_id: "r-issuer", document_id: "doa", action: "SIGN", status: "SIGNED" },
    { recipient_id: "r-issuer", document_id: "fa", action: "SIGN", status: "PENDING" },
    { recipient_id: "r-guarantor", document_id: "jsg", action: "SIGN", status: "PENDING" },
  ];

  it("lists this recipient's documents in package order", () => {
    expect(
      documentNamesForSigningEmail({
        documents,
        assignments,
        recipientId: "r-issuer",
        isReminder: false,
      })
    ).toEqual(["Deed of Assignment", "Facility Agreement"]);
  });

  it("omits signed documents on reminders", () => {
    expect(
      documentNamesForSigningEmail({
        documents,
        assignments,
        recipientId: "r-issuer",
        isReminder: true,
      })
    ).toEqual(["Facility Agreement"]);
  });

  it("scopes a reminder to the requested unsigned document", () => {
    expect(
      documentNamesForSigningEmail({
        documents,
        assignments,
        recipientId: "r-issuer",
        isReminder: true,
        preferredDocumentId: "fa",
      })
    ).toEqual(["Facility Agreement"]);
  });
});

describe("recipientHasOtherSigningCapacity", () => {
  it("is true when another emailed recipient shares the inbox", () => {
    expect(
      recipientHasOtherSigningCapacity(
        [
          { id: "r1", email: "lim@acme.my", execution_mode: "MANUAL", delivery_mode: "EMAIL" },
          { id: "r2", email: "Lim@acme.my", execution_mode: "MANUAL", delivery_mode: "EMAIL" },
        ],
        { id: "r1", email: "lim@acme.my" }
      )
    ).toBe(true);
  });

  it("ignores CashSouk automatic countersigners", () => {
    expect(
      recipientHasOtherSigningCapacity(
        [
          { id: "r1", email: "lim@acme.my", execution_mode: "MANUAL", delivery_mode: "EMAIL" },
          {
            id: "r-auto",
            email: "lim@acme.my",
            execution_mode: "AUTOMATIC",
            delivery_mode: "INTERNAL",
          },
        ],
        { id: "r1", email: "lim@acme.my" }
      )
    ).toBe(false);
  });
});

describe("buildSigningEmail", () => {
  const base = {
    recipientName: "Lim Tze Yang",
    recipientRoleLabel: "Authorised Signatory",
    organizationName: "Acme Trading Sdn Bhd",
    displayReference: "FAC-1042",
    offerKind: "facility" as const,
    documentNames: ["Facility Agreement", "Deed of Assignment"],
    signingExpiresAtIso: DEADLINE_ISO,
    signingUrl: "https://issuer.example/signing/external/token-1",
    isReminder: false,
    hasOtherCapacity: true,
  };

  it("builds a branded first-send email with role, documents, and deadline", () => {
    const email = buildSigningEmail(base);

    expect(email.subject).toBe("[CashSouk] Signature requested — as Authorised Signatory");
    expect(email.html).toContain("class=\"container\"");
    expect(email.html).toContain("class=\"button\"");
    expect(email.html).toContain("Open signing link");
    expect(email.html).toContain("You are signing as <strong>Authorised Signatory</strong>");
    expect(email.html).toContain("<li>Facility Agreement</li>");
    expect(email.html).toContain("<li>Deed of Assignment</li>");
    expect(email.html).toContain("Acme Trading Sdn Bhd");
    expect(email.html).toContain("FAC-1042");
    expect(email.html).toContain("Complete signing by");
    expect(email.html).toContain("Malaysia time");
    expect(email.html).toContain("MyKad number");
    expect(email.html).toContain("another capacity");
    expect(email.html).toContain(base.signingUrl);
    expect(email.text).toContain("Documents you need to sign");
    expect(email.text).toContain("- Facility Agreement");
    expect(email.text).toContain(base.signingUrl);
  });

  it("uses reminder copy and lists only remaining documents", () => {
    const email = buildSigningEmail({
      ...base,
      isReminder: true,
      documentNames: ["Facility Agreement"],
      hasOtherCapacity: false,
    });

    expect(email.subject).toBe(
      "[CashSouk] Reminder — Facility Agreement still needs your signature"
    );
    expect(email.html).toContain("Reminder: signature still needed");
    expect(email.html).toContain("This is a reminder to complete signing");
    expect(email.html).toContain("Documents still to sign");
    expect(email.html).not.toContain("another capacity");
  });

  it("names an invoice offer from the invoice reference", () => {
    expect(resolveSigningEmailOfferKind({ invoice_id: "inv-1" })).toBe("invoice");
    const email = buildSigningEmail({
      ...base,
      offerKind: "invoice",
      displayReference: "INV-88",
      hasOtherCapacity: false,
    });
    expect(email.html).toContain("invoice offer");
    expect(email.html).toContain("INV-88");
    expect(email.html).not.toContain("facility offer");
  });

  it("escapes recipient-controlled HTML in the HTML body only", () => {
    const payload = `<img src=x onerror=alert(1)>`;
    const email = buildSigningEmail({
      ...base,
      recipientName: payload,
      recipientRoleLabel: payload,
      organizationName: payload,
      documentNames: [payload],
      signingUrl: `https://issuer.example/signing/external/${payload}`,
      hasOtherCapacity: false,
    });

    expect(email.html).not.toContain(payload);
    expect(email.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(email.text).toContain(payload);
  });

  it("omits org, documents, and deadline when they are missing", () => {
    const email = buildSigningEmail({
      ...base,
      organizationName: null,
      displayReference: null,
      documentNames: [],
      signingExpiresAtIso: null,
      hasOtherCapacity: false,
    });

    expect(email.html).toContain("the facility offer");
    expect(email.html).not.toContain("Documents you need to sign");
    expect(email.html).not.toContain("Complete signing by");
    expect(email.subject).toBe("[CashSouk] Signature requested — as Authorised Signatory");
  });
});
