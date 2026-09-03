import { PDFDocument } from "pdf-lib";
import {
  buildWetInkPreviewFields,
  previewFieldsFromSignsets,
  signerNamesForPlannedDocument,
  signingDocumentPreviewFilename,
  stampWetInkSignatureFields,
} from "./preview-signature-stamp";
import { buildEnvelopePlanFromTemplate } from "@cashsouk/types";

describe("signingDocumentPreviewFilename", () => {
  it("builds a stable PDF filename", () => {
    expect(signingDocumentPreviewFilename("Deed of Assignment")).toBe(
      "Preview-Deed-of-Assignment.pdf"
    );
  });
});

describe("signerNamesForPlannedDocument", () => {
  it("returns names in routing order for one document", () => {
    const plan = buildEnvelopePlanFromTemplate(
      {
        enabled: true,
        roles: [
          { key: "issuer_director", label: "Director", routing_order: 0, kyc_required: true },
          { key: "guarantor", label: "Guarantor", routing_order: 1, kyc_required: true },
        ],
        documents: [
          {
            key: "deed_of_assignment",
            name: "Deed of Assignment",
            source: "TEMPLATE",
            required: true,
            order: 0,
            signer_role_keys: ["issuer_director"],
          },
          {
            key: "guarantor_agreement",
            name: "Guarantor Agreement",
            source: "TEMPLATE",
            required: true,
            order: 1,
            signer_role_keys: ["guarantor"],
          },
        ],
      },
      [
        { role_key: "issuer_director", name: "Ali", email: "ali@co.my", ic_number: "820508105871" },
        { role_key: "issuer_director", name: "Siti", email: "siti@co.my", ic_number: "900101015555" },
        { role_key: "guarantor", name: "Nora", email: "nora@co.my" },
      ]
    );
    expect(signerNamesForPlannedDocument(plan, "deed_of_assignment")).toEqual(["Ali", "Siti"]);
    expect(signerNamesForPlannedDocument(plan, "guarantor_agreement")).toEqual(["Nora"]);
  });
});

describe("stampWetInkSignatureFields", () => {
  it("stamps stacked boxes on the last page", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    pdf.addPage([595, 842]);
    const original = Buffer.from(await pdf.save());
    const loadedOriginal = await PDFDocument.load(original);
    expect(loadedOriginal.getPageCount()).toBe(2);

    const fields = buildWetInkPreviewFields(["Ali Bin Abu", "Siti Binti Ahmad"], 2);
    expect(fields).toHaveLength(2);
    expect(fields[0]?.pageindex).toBe(2);
    expect(fields[1]?.pageindex).toBe(2);
    expect(fields[1]?.top).toBeLessThan(fields[0]?.top ?? 0);

    const stamped = await stampWetInkSignatureFields(original, fields);
    expect(stamped.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(stamped.length).toBeGreaterThan(original.length);

    const reloaded = await PDFDocument.load(stamped);
    expect(reloaded.getPageCount()).toBe(2);
  });

  it("can stamp a rectangle without covering captions", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    const original = Buffer.from(await pdf.save());
    const stamped = await stampWetInkSignatureFields(original, [
      {
        top: 161,
        left: 99,
        height: 16,
        width: 120,
        pageindex: 1,
        label: "Ali Bin Abu",
        showAnnotations: false,
      },
    ]);
    expect(stamped.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});

describe("previewFieldsFromSignsets", () => {
  it("copies SigningCloud rectangles onto wet-ink preview fields", () => {
    const fields = previewFieldsFromSignsets(
      ["Ali Bin Abu"],
      [[{ fieldtype: "sign", top: 161, left: 99, height: 30, width: 100, pageindex: 12 }]]
    );
    expect(fields).toEqual([
      {
        top: 161,
        left: 99,
        height: 30,
        width: 100,
        pageindex: 12,
        label: "Ali Bin Abu",
        showAnnotations: false,
      },
    ]);
  });
});
