import {
  formatSigningDocumentSignedDescription,
  formatSigningDocumentSignedTitle,
  isAutomaticSigningDocumentSigned,
} from "./signing-activity";
import {
  isShorakaSigningRecipient,
  signingRecipientDisplayTitle,
} from "./signing-envelopes";

describe("signing document signed copy", () => {
  const manual = {
    signer_name: "Ali",
    document_name: "Facility Agreement",
    role_label: "Issuer director",
    execution_mode: "MANUAL",
  };

  const automatic = {
    signer_name: "Aisha Rahman",
    document_name: "Facility Agreement",
    role_label: "Facility Agreement — signer 1 of 2",
    execution_mode: "AUTOMATIC",
  };

  it("titles a named manual signer without using email or IC", () => {
    expect(formatSigningDocumentSignedTitle(manual)).toBe("Ali Completed Signing");
    expect(formatSigningDocumentSignedDescription(manual)).toBe(
      "Ali signed Facility Agreement as Issuer director."
    );
    expect(JSON.stringify(manual)).not.toMatch(/@|ic_number|identity/i);
  });

  it("labels automatic CashSouk signatures as platform-signed", () => {
    expect(isAutomaticSigningDocumentSigned(automatic)).toBe(true);
    expect(formatSigningDocumentSignedTitle(automatic)).toBe("CashSouk Completed Signing");
    expect(formatSigningDocumentSignedDescription(automatic)).toBe(
      "Facility Agreement was signed automatically as Facility Agreement — signer 1 of 2."
    );
  });

  it("falls back when metadata is sparse", () => {
    expect(formatSigningDocumentSignedTitle({})).toBe("Signer Completed Signing");
    expect(formatSigningDocumentSignedDescription({})).toBe("A signer completed a signing step.");
    expect(formatSigningDocumentSignedDescription({ execution_mode: "AUTOMATIC" })).toBe(
      "CashSouk signed automatically."
    );
  });
});

describe("signing recipient display title", () => {
  it("keeps issuer role titles and hides a Shoraka name reused as the role label", () => {
    expect(
      signingRecipientDisplayTitle(
        {
          name: "Ivan Chew",
          email: "ivan@issuer.my",
          role_key: "guarantor",
          role_label: "Guarantor",
          execution_mode: "MANUAL",
        },
        false
      )
    ).toBe("Guarantor");
    expect(
      signingRecipientDisplayTitle(
        {
          name: "Max Cheng",
          email: "max@cashsouk.com",
          role_key: "FA",
          role_label: "Max Cheng",
          execution_mode: "AUTOMATIC",
        },
        false
      )
    ).toBe("");
    expect(
      signingRecipientDisplayTitle(
        {
          name: "Max Cheng",
          email: "max@cashsouk.com",
          role_key: "FA",
          role_label: "Authorised Signatory",
          execution_mode: "AUTOMATIC",
        },
        false
      )
    ).toBe("Authorised Signatory");
    expect(
      isShorakaSigningRecipient({ execution_mode: "AUTOMATIC", delivery_mode: "INTERNAL" })
    ).toBe(true);
    expect(isShorakaSigningRecipient({ execution_mode: "MANUAL", delivery_mode: "EMAIL" })).toBe(
      false
    );
  });
});
