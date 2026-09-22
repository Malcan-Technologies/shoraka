import {
  buildFaSigningCloudSignsetsFromPdf,
  collectFaIssuerSignatureSlots,
  FaSigningLayoutError,
  findFaIssuerCompanyStampLine,
  matchFaSignersToSlots,
  type FaSignatureSlot,
} from "./fa-signing-placement";
import {
  attachPrimarySealField,
  LAYOUT_DETECTED_DATE_FIELD,
  LAYOUT_DETECTED_PRINTED_LINE_GAP,
  sealFieldFromLabel,
  signatureFieldsOverlap,
} from "../../signing/signature-field-geometry";
import { previewFieldsFromSignsets } from "../../signing/preview-signature-stamp";
import { extractPdfTextItems, type JsgPdfTextItem } from "../joint-several-guarantee/jsg-signing-placement";
import { createFacilityAgreementFixture } from "./fa-fixture";
import { renderFacilityAgreementDocx } from "./render-fa-docx";
import {
  convertDocxToPdf,
  DocxToPdfError,
  resolveGotenbergUrl,
} from "../letter-of-offer/convert-docx-to-pdf";
import {
  LONG_PERSON_NAME,
  withLongFacilityAgreementStrings,
} from "../../generated-documents/long-merge-strings";

function item(
  pageindex: number,
  yTop: number,
  x: number,
  text: string,
  width = 140
): JsgPdfTextItem {
  return {
    pageindex,
    yTop,
    x,
    text,
    width,
    height: 9,
    pageHeight: 842,
    pageWidth: 595,
  };
}

function issuerExecutionItems(signerCount: 1 | 2): JsgPdfTextItem[] {
  const items: JsgPdfTextItem[] = [
    item(8, 80, 268, "INVESTOR"),
    item(8, 173, 94, "______________________________", 140),
    item(8, 189, 94, "Name :"),
    item(8, 205, 94, "Designation :"),
    item(8, 221, 94, "Date :", 40),
    item(8, 251, 94, "______________________________", 140),
    item(8, 266, 94, "Name :"),
    item(8, 282, 94, "Designation :"),
    item(8, 298, 94, "Date :", 40),
    item(9, 80, 268, "AGENT"),
    item(9, 173, 94, "______________________________", 140),
    item(9, 189, 94, "Name :"),
    item(9, 205, 94, "Designation :"),
    item(9, 221, 94, "Date :", 40),
    item(9, 251, 94, "______________________________", 140),
    item(9, 266, 94, "Name :"),
    item(9, 282, 94, "Designation :"),
    item(9, 298, 94, "Date :", 40),
    item(10, 80, 268, "ISSUER"),
    item(10, 173, 94, "______________________________", 140),
    item(10, 189, 94, "Name : Ali Bin Abu"),
    item(10, 205, 94, "Designation : Director"),
    item(10, 221, 94, "Date :", 40),
  ];
  if (signerCount === 2) {
    items.push(
      item(10, 251, 94, "______________________________", 140),
      item(10, 266, 94, "Name : Siti Binti Ahmad"),
      item(10, 282, 94, "Designation : Authorised Signatory"),
      item(10, 298, 94, "Date :", 40)
    );
  }
  items.push(
    item(10, 312, 94, "Issuer's company stamp:", 110),
    item(10, 330, 94, "______________________________", 140),
    item(10, 346, 94, "Name of Witness"),
    item(11, 80, 268, "SCHEDULE 1"),
    item(11, 173, 94, "______________________________", 140),
    item(11, 189, 94, "Name : Schedule Party"),
    item(14, 80, 268, "SCHEDULE 4"),
    item(14, 173, 94, "______________________________", 140),
    item(14, 189, 94, "Name : Utilisation Signatory")
  );
  return items;
}

describe("collectFaIssuerSignatureSlots", () => {
  it("finds one issuer line and skips Investor, Agent, witness, and schedules", () => {
    const slots = collectFaIssuerSignatureSlots(issuerExecutionItems(1));
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu"]);
    expect(slots[0]?.pageindex).toBe(10);
  });

  it("finds two issuer lines in document order", () => {
    const slots = collectFaIssuerSignatureSlots(issuerExecutionItems(2));
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu", "Siti Binti Ahmad"]);
    expect(slots[0]?.top).toBeLessThan(slots[1]?.top ?? 0);
  });

  it("keeps issuer lines when SCHEDULE 1 starts on the same page", () => {
    const items = issuerExecutionItems(2).map((entry) =>
      entry.text === "SCHEDULE 1" ? { ...entry, pageindex: 10, yTop: 500 } : entry
    );
    const slots = collectFaIssuerSignatureSlots(items);
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu", "Siti Binti Ahmad"]);
  });

  it("places the left signatory line and skips the witness column", () => {
    const items: JsgPdfTextItem[] = [
      item(9, 80, 268, "AGENT"),
      item(10, 80, 268, "ISSUER"),
      item(10, 173, 94, "______________________________", 140),
      item(10, 189, 94, "Name : Ali Bin Abu"),
      item(10, 205, 94, "Designation : Director"),
      item(10, 221, 94, "Date :", 40),
      item(10, 173, 360, "______________________________", 140),
      item(10, 189, 360, "Name of Witness:"),
      item(10, 205, 360, "NRIC:"),
      item(10, 221, 360, "Date :", 40),
      item(10, 251, 94, "______________________________", 140),
      item(10, 266, 94, "Name : Siti Binti Ahmad"),
      item(10, 282, 94, "Designation : Authorised Signatory"),
      item(10, 298, 94, "Date :", 40),
      item(10, 251, 360, "______________________________", 140),
      item(10, 266, 360, "Name of Witness:"),
      item(10, 282, 360, "NRIC:"),
      item(10, 298, 360, "Date :", 40),
      item(11, 80, 268, "SCHEDULE 1"),
    ];
    const slots = collectFaIssuerSignatureSlots(items);
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu", "Siti Binti Ahmad"]);
    expect(slots[0]?.left).toBe(94);
    expect(slots[1]?.left).toBe(94);
    expect(slots[0]?.top).toBeLessThan(slots[1]?.top ?? 0);
  });

  it("joins a wrapped issuer Name that pdfjs glued to Name of Witness", () => {
    const longName = LONG_PERSON_NAME;
    const items: JsgPdfTextItem[] = [
      item(9, 80, 268, "AGENT"),
      item(10, 80, 268, "ISSUER"),
      item(10, 191.8, 77.5, "________________________", 105),
      item(10, 191.8, 303.2, "______________________", 97),
      item(
        10,
        205.4,
        77.5,
        "Name : Tunku Puan Sri Datin Seri Wan Name of Witness : Tunku Puan Sri Datin Seri",
        428
      ),
      item(10, 218.6, 137, "Nur Aisyah binti Tengku Abdul", 134),
      item(10, 218.6, 389.7, "Wan Nur Aisyah binti", 93),
      item(10, 231.8, 137, "Rahman", 38),
      item(10, 231.8, 389.7, "Tengku Abdul Rahman", 102),
      item(10, 245.2, 77.5, "Designation: Deputy Chairman – Non-", 170),
      item(10, 245.2, 303.2, "NRIC : 900101-14-5678 / Passport", 181),
      item(10, 284.9, 77.5, "Date :", 57),
      item(10, 284.9, 303.2, "Date :", 57),
      item(10, 444.5, 77.5, "________________________", 105),
      item(10, 444.5, 303.2, "______________________", 97),
      item(
        10,
        458.1,
        77.5,
        "Name : Tunku Puan Sri Datin Seri Wan Name of Witness : Tunku Puan Sri Datin Seri",
        428
      ),
      item(10, 471.3, 137, "Nur Aisyah binti Tengku Abdul", 134),
      item(10, 471.3, 389.7, "Wan Nur Aisyah binti", 93),
      item(10, 484.5, 137, "Rahman", 38),
      item(10, 484.5, 389.7, "Tengku Abdul Rahman", 102),
      item(10, 497.9, 77.5, "Designation: Deputy Chairman – Non-", 170),
      item(10, 537.6, 77.5, "Date :", 57),
      item(10, 537.6, 303.2, "Date :", 57),
      item(11, 80, 268, "SCHEDULE 1"),
    ];
    const slots = collectFaIssuerSignatureSlots(items);
    expect(slots.map((slot) => slot.name)).toEqual([longName, longName]);
    expect(() => matchFaSignersToSlots([longName, longName], slots)).not.toThrow();
  });

  it("fails when an issuer block has no Date line", () => {
    const items = issuerExecutionItems(1).filter((entry) => !/^Date\s*:/i.test(entry.text));
    expect(() => collectFaIssuerSignatureSlots(items)).toThrow(/missing a Date line/);
  });

  it("keeps issuer signature and date boxes clear of Name and Designation", () => {
    const slots = collectFaIssuerSignatureSlots(issuerExecutionItems(2));
    const gap = LAYOUT_DETECTED_PRINTED_LINE_GAP;
    const ali = slots[0]!;
    const siti = slots[1]!;
    const aliDate = ali.extraFields?.find((field) => field.fieldtype === "signdate");
    const sitiDate = siti.extraFields?.find((field) => field.fieldtype === "signdate");
    expect(aliDate).toBeDefined();
    expect(sitiDate).toBeDefined();
    expect(ali.top + ali.height + gap).toBeLessThanOrEqual(189);
    expect(aliDate!.top).toBe(
      221 - LAYOUT_DETECTED_DATE_FIELD.height + LAYOUT_DETECTED_DATE_FIELD.topOffset
    );
    expect(siti.top + siti.height + gap).toBeLessThanOrEqual(266);
    expect(sitiDate!.top).toBe(
      298 - LAYOUT_DETECTED_DATE_FIELD.height + LAYOUT_DETECTED_DATE_FIELD.topOffset
    );
    expect(ali.top + ali.height).toBeLessThanOrEqual(siti.top);
    expect(aliDate!.top + aliDate!.height).toBeLessThanOrEqual(siti.top);
    expect(
      signatureFieldsOverlap(
        {
          fieldtype: "sign",
          pageindex: ali.pageindex,
          top: ali.top,
          left: ali.left,
          height: ali.height,
          width: ali.width,
        },
        aliDate!
      )
    ).toBe(false);
  });
});

describe("matchFaSignersToSlots", () => {
  it("places one signer on the matching issuer rectangle", () => {
    const slots = collectFaIssuerSignatureSlots(issuerExecutionItems(1));
    const signsets = matchFaSignersToSlots(["Ali Bin Abu"], slots);
    expect(signsets).toHaveLength(1);
    expect(signsets[0]?.[0]).toMatchObject({
      fieldtype: "sign",
      pageindex: slots[0]?.pageindex,
      top: slots[0]?.top,
      left: slots[0]?.left,
    });
    expect(signsets[0]?.[1]).toMatchObject({
      fieldtype: "signdate",
      pageindex: slots[0]?.pageindex,
    });
    expect(signsets[0]?.[1]?.width).toBe((signsets[0]?.[1]?.height ?? 0) * 5);
  });

  it("places two signers and keeps preview coordinates identical to send signsets", () => {
    const slots = collectFaIssuerSignatureSlots(issuerExecutionItems(2));
    const names = ["Ali Bin Abu", "Siti Binti Ahmad"];
    const signsets = matchFaSignersToSlots(names, slots);
    expect(signsets).toHaveLength(2);
    expect(signsets.every((fields) => fields.map((field) => field.fieldtype).join(",") === "sign,signdate")).toBe(
      true
    );
    const preview = previewFieldsFromSignsets(names, signsets);
    expect(preview.map((field) => [field.pageindex, field.top, field.left, field.width, field.height])).toEqual(
      signsets.map((fields) => {
        const field = fields[0];
        return [field?.pageindex, field?.top, field?.left, field?.width, field?.height];
      })
    );
  });

  it("fails when signer count does not match issuer lines", () => {
    const slots = collectFaIssuerSignatureSlots(issuerExecutionItems(2));
    expect(() => matchFaSignersToSlots(["Ali Bin Abu"], slots)).toThrow(FaSigningLayoutError);
  });

  it("fails when geometry has no issuer lines", () => {
    const empty: FaSignatureSlot[] = [];
    expect(() => matchFaSignersToSlots(["Ali Bin Abu"], empty)).toThrow(/missing issuer signature lines/);
  });
});

describe("FA mixed SigningCloud fields", () => {
  it("adds a textfield on each issuer Designation line when requested", () => {
    const slots = collectFaIssuerSignatureSlots(issuerExecutionItems(2), { includeTextField: true });
    expect(slots.every((slot) => slot.extraFields?.some((field) => field.fieldtype === "textfield"))).toBe(
      true
    );
    const signsets = matchFaSignersToSlots(["Ali Bin Abu", "Siti Binti Ahmad"], slots);
    expect(
      signsets.every((fields) => fields.map((field) => field.fieldtype).join(",") === "sign,signdate,textfield")
    ).toBe(true);
    for (const fields of signsets) {
      const sign = fields.find((field) => field.fieldtype === "sign")!;
      const date = fields.find((field) => field.fieldtype === "signdate")!;
      const text = fields.find((field) => field.fieldtype === "textfield")!;
      expect(signatureFieldsOverlap(sign, date)).toBe(false);
      expect(signatureFieldsOverlap(date, text)).toBe(false);
      expect(signatureFieldsOverlap(sign, text)).toBe(false);
    }
  });

  it("fails when a Designation line is missing and textfields are required", () => {
    const items = issuerExecutionItems(1).filter((entry) => !/^Designation\s*:/i.test(entry.text));
    expect(() => collectFaIssuerSignatureSlots(items, { includeTextField: true })).toThrow(
      /missing a Designation line/
    );
  });

  it("places one seal on the Issuer's company stamp line after the last signer", async () => {
    const items = issuerExecutionItems(2);
    const slots = collectFaIssuerSignatureSlots(items, { includeTextField: true });
    const stampLine = findFaIssuerCompanyStampLine(items);
    expect(items.filter((entry) => /company stamp/i.test(entry.text))).toHaveLength(1);
    expect(stampLine?.text).toBe("Issuer's company stamp:");
    expect(stampLine?.yTop).toBeGreaterThan(slots[1]?.top ?? 0);
    const signsets = matchFaSignersToSlots(["Ali Bin Abu", "Siti Binti Ahmad"], slots);
    const stamp = sealFieldFromLabel(stampLine!);
    const withSeal = attachPrimarySealField(
      signsets,
      [
        { name: "Ali Bin Abu" },
        { name: "Siti Binti Ahmad", appliesCompanySeal: true },
      ],
      { pageWidth: 595, pageHeight: 842 },
      (message) => new FaSigningLayoutError(message),
      [{ left: stamp.left, top: stamp.top, pageindex: stamp.pageindex }]
    );
    expect(withSeal[0]?.map((field) => field.fieldtype)).toEqual(["sign", "signdate", "textfield"]);
    expect(withSeal[1]?.map((field) => field.fieldtype)).toEqual([
      "sign",
      "signdate",
      "textfield",
      "seal",
    ]);
    const seal = withSeal[1]?.find((field) => field.fieldtype === "seal");
    const sign = withSeal[1]?.find((field) => field.fieldtype === "sign");
    expect(seal?.left).toBe(stamp.left);
    expect(seal?.top).toBeGreaterThanOrEqual(stamp.top);
    expect(seal?.top).toBeGreaterThan((sign?.top ?? 0) + (sign?.height ?? 0));
    expect(seal?.top).not.toBe(sign?.top);
  });
});

describe("buildFaSigningCloudSignsetsFromPdf", () => {
  it("places issuer CA fields on a Gotenberg Facility Agreement PDF", async () => {
    if (!resolveGotenbergUrl()) return;
    const twoSigners = createFacilityAgreementFixture();
    const oneSigner = {
      ...twoSigners,
      issuer_signatories: [twoSigners.issuer_signatories[0]!],
    };

    let twoSignerPdf: Buffer;
    let oneSignerPdf: Buffer;
    try {
      twoSignerPdf = await convertDocxToPdf(renderFacilityAgreementDocx(twoSigners));
      oneSignerPdf = await convertDocxToPdf(renderFacilityAgreementDocx(oneSigner));
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") return;
      throw err;
    }

    const twoNames = ["Ali Bin Abu", "Siti Binti Ahmad"];
    const twoItems = await extractPdfTextItems(twoSignerPdf);
    expect(twoItems.filter((entry) => /issuer'?s\s+company\s+stamp/i.test(entry.text))).toHaveLength(1);
    const twoSignsets = await buildFaSigningCloudSignsetsFromPdf(twoSignerPdf, twoNames);
    expect(twoSignsets).toHaveLength(2);
    expect(twoSignsets.every((fields) => fields.length === 2)).toBe(true);
    expect(twoSignsets.flat().filter((field) => field.fieldtype === "signdate")).toHaveLength(2);
    const twoPreview = previewFieldsFromSignsets(twoNames, twoSignsets);
    expect(
      twoPreview.map((field) => [field.pageindex, field.top, field.left, field.width, field.height])
    ).toEqual(
      twoSignsets.map((fields) => {
        const field = fields[0];
        return [field?.pageindex, field?.top, field?.left, field?.width, field?.height];
      })
    );

    const oneNames = ["Ali Bin Abu"];
    const oneSignsets = await buildFaSigningCloudSignsetsFromPdf(oneSignerPdf, oneNames);
    expect(oneSignsets).toHaveLength(1);
    expect(oneSignsets[0]?.[0]?.pageindex).toBeGreaterThan(0);
    expect((oneSignsets[0]?.[0]?.left ?? 0) + (oneSignsets[0]?.[0]?.width ?? 0)).toBeLessThanOrEqual(595);
    expect(twoSignsets[0]?.[0]?.left).toBe(twoSignsets[1]?.[0]?.left);
    expect(twoSignsets[0]?.[0]?.top).not.toBe(twoSignsets[1]?.[0]?.top);

    const withSeal = await buildFaSigningCloudSignsetsFromPdf(
      twoSignerPdf,
      [
        { name: twoNames[0]!, appliesCompanySeal: false },
        { name: twoNames[1]!, appliesCompanySeal: true },
      ],
      { includeTextField: true, includeSeal: true }
    );
    expect(withSeal.flat().filter((field) => field.fieldtype === "seal")).toHaveLength(1);
    expect(withSeal[1]?.map((field) => field.fieldtype)).toEqual([
      "sign",
      "signdate",
      "textfield",
      "seal",
    ]);
    const seal = withSeal[1]?.find((field) => field.fieldtype === "seal");
    const sign = withSeal[1]?.find((field) => field.fieldtype === "sign");
    expect(seal?.top).toBeGreaterThan((sign?.top ?? 0) + (sign?.height ?? 0));
  }, 120_000);

  it("places issuer CA fields when Gotenberg wraps a long issuer Name", async () => {
    if (!resolveGotenbergUrl()) return;
    const data = withLongFacilityAgreementStrings(createFacilityAgreementFixture());
    let pdf: Buffer;
    try {
      pdf = await convertDocxToPdf(renderFacilityAgreementDocx(data));
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") return;
      throw err;
    }
    const names = data.issuer_signatories.map((row) => row.name);
    const signsets = await buildFaSigningCloudSignsetsFromPdf(pdf, names);
    expect(signsets).toHaveLength(2);
    expect(signsets.every((fields) => fields.map((field) => field.fieldtype).join(",") === "sign,signdate")).toBe(
      true
    );
  }, 120_000);
});
