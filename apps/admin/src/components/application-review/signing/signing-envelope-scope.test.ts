import fs from "node:fs";
import path from "node:path";
import {
  envelopesForSelectedInvoice,
  resolveAcceptanceOfferDetails,
} from "./signing-envelope-scope";

const PANEL_SOURCE = fs.readFileSync(
  path.join(__dirname, "signing-envelope-panel.tsx"),
  "utf8"
);

describe("resolveAcceptanceOfferDetails", () => {
  const invoices = [
    { id: "inv-a", offer_details: { offer_acceptance: { status: "APPROVED_FOR_SIGNING" } } },
    { id: "inv-b", offer_details: { offer_acceptance: { status: "PENDING_ISSUER" } } },
    { id: "inv-c" },
  ];

  it("returns only the selected invoice's offer details", () => {
    expect(
      resolveAcceptanceOfferDetails({
        offerDetails: { from: "contract" },
        invoices,
        selectedInvoiceId: "inv-b",
        primaryEnvelopeInvoiceId: "inv-a",
      })
    ).toEqual({ offer_acceptance: { status: "PENDING_ISSUER" } });
  });

  it("does not fall back to another invoice when the selection has no offer", () => {
    expect(
      resolveAcceptanceOfferDetails({
        invoices,
        selectedInvoiceId: "inv-c",
        primaryEnvelopeInvoiceId: "inv-a",
      })
    ).toBeNull();
  });

  it("does not fall back when the selected invoice is missing", () => {
    expect(
      resolveAcceptanceOfferDetails({
        invoices,
        selectedInvoiceId: "inv-missing",
        primaryEnvelopeInvoiceId: "inv-a",
      })
    ).toBeNull();
  });

  it("uses the primary envelope invoice, then contract details, then first invoice with an offer", () => {
    expect(
      resolveAcceptanceOfferDetails({
        invoices,
        primaryEnvelopeInvoiceId: "inv-a",
      })
    ).toEqual({ offer_acceptance: { status: "APPROVED_FOR_SIGNING" } });
    expect(
      resolveAcceptanceOfferDetails({
        offerDetails: { from: "contract" },
        invoices: [{ id: "inv-c" }],
      })
    ).toEqual({ from: "contract" });
    expect(resolveAcceptanceOfferDetails({ invoices })).toEqual({
      offer_acceptance: { status: "APPROVED_FOR_SIGNING" },
    });
  });
});

describe("envelopesForSelectedInvoice", () => {
  const envelopes = [
    { id: "env-a", invoice_id: "inv-a" },
    { id: "env-b", invoice_id: "inv-b" },
    { id: "env-c", invoice_id: null },
  ];

  it("returns every envelope when no invoice is selected", () => {
    expect(envelopesForSelectedInvoice(envelopes)).toEqual(envelopes);
    expect(envelopesForSelectedInvoice(envelopes, null)).toEqual(envelopes);
  });

  it("keeps only envelopes for the selected invoice", () => {
    expect(envelopesForSelectedInvoice(envelopes, "inv-b")).toEqual([
      { id: "env-b", invoice_id: "inv-b" },
    ]);
    expect(envelopesForSelectedInvoice(envelopes, "inv-missing")).toEqual([]);
  });
});

describe("signing envelope panel invoice scope wiring", () => {
  it("scopes envelopes, offer details, send/extend, and send-blocking to the selected invoice", () => {
    expect(PANEL_SOURCE).toContain("envelopesForSelectedInvoice");
    expect(PANEL_SOURCE).toContain("selectedInvoiceId");
    expect(PANEL_SOURCE).toContain("scopedEnvelopes");
    expect(PANEL_SOURCE).toContain("if (selectedInvoiceId) return selectedInvoiceId");
    expect(PANEL_SOURCE).toContain("hasEnvelopeBlockingNewSend(scopedEnvelopes)");
    expect(PANEL_SOURCE).toContain("scopedEnvelopes.length === 0");
  });
});
