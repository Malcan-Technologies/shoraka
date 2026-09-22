import {
  assertAtMostOneSealField,
  assertSignatureFieldsValid,
  dateFieldFromLine,
  fitDateFieldBetweenSignatures,
  fitSignFieldAbovePrintedLine,
  isAutomaticSigningKeywordLine,
  isDottedSignatureStroke,
  isSignatureStrokeGlyphRun,
  isSignatureStrokeLine,
  isSignerDateLabel,
  isSignerDesignationLabel,
  isSignerNameLabel,
  isSignerNricLabel,
  isUnderscoreSignatureStroke,
  joinWrappedSignerName,
  signerNameRemainder,
  isIssuerWitnessNameLabel,
  witnessColumnOriginFromNameLine,
  LAYOUT_DETECTED_DATE_FIELD,
  LAYOUT_DETECTED_PRINTED_LINE_GAP,
  LAYOUT_DETECTED_SEAL_FIELD,
  LAYOUT_DETECTED_SIGN_FIELD,
  LAYOUT_DETECTED_TEXT_FIELD,
  matchSignersToNamedSlots,
  attachPrimarySealField,
  isCompanyStampLabel,
  printedLineBottom,
  sealFieldBesideSignature,
  sealFieldFromLabel,
  SIGNING_CLOUD_STACKED_SIGN_FIELD,
  signatureFieldFromLine,
  signatureFieldsOverlap,
  signerDetailLineBottomBeforeDate,
  textFieldFromLine,
} from "./signature-field-geometry";

describe("signatureFieldFromLine", () => {
  it("sits the box on the stroke with shared height and clamped width", () => {
    const field = signatureFieldFromLine({
      pageindex: 10,
      x: 94,
      yTop: 173,
      width: 140,
      pageWidth: 595,
      pageHeight: 842,
    });
    expect(field).toEqual({
      fieldtype: "sign",
      pageindex: 10,
      left: 94,
      width: 140,
      height: LAYOUT_DETECTED_SIGN_FIELD.height,
      top: 173 - LAYOUT_DETECTED_SIGN_FIELD.height + LAYOUT_DETECTED_SIGN_FIELD.topOffset,
    });
  });

  it("keeps the field inside the page", () => {
    const field = signatureFieldFromLine({
      pageindex: 1,
      x: -40,
      yTop: 10,
      width: 400,
      pageWidth: 595,
      pageHeight: 842,
    });
    expect(field.left).toBe(LAYOUT_DETECTED_SIGN_FIELD.minLeft);
    expect(field.top).toBe(LAYOUT_DETECTED_SIGN_FIELD.minTop);
    expect(field.width).toBe(LAYOUT_DETECTED_SIGN_FIELD.maxWidth);
    expect(field.left + field.width).toBeLessThanOrEqual(595);
    expect(field.top + field.height).toBeLessThanOrEqual(842);
  });
});

describe("dateFieldFromLine", () => {
  it("places a signdate box to the right of a Date label at 5× height", () => {
    const field = dateFieldFromLine({
      pageindex: 10,
      x: 94,
      yTop: 221,
      width: 40,
      pageWidth: 595,
      pageHeight: 842,
      text: "Date :",
    });
    expect(field).toEqual({
      fieldtype: "signdate",
      pageindex: 10,
      left: 94 + 40 + LAYOUT_DETECTED_DATE_FIELD.leftGap,
      width: LAYOUT_DETECTED_DATE_FIELD.height * LAYOUT_DETECTED_DATE_FIELD.widthMultiplier,
      height: LAYOUT_DETECTED_DATE_FIELD.height,
      top: 221 - LAYOUT_DETECTED_DATE_FIELD.height + LAYOUT_DETECTED_DATE_FIELD.topOffset,
    });
  });

  it("sits over the blank after Date: underscores", () => {
    const field = dateFieldFromLine({
      pageindex: 12,
      x: 99,
      yTop: 238,
      width: 160,
      pageWidth: 595,
      pageHeight: 842,
      text: "Date: ________________",
    });
    expect(field.fieldtype).toBe("signdate");
    expect(field.width).toBe(field.height * 5);
    expect(field.left).toBeGreaterThan(99);
    expect(field.left + field.width).toBeLessThanOrEqual(595);
  });

  it("still sits to the right of Date when the colon is a separate PDF run", () => {
    const field = dateFieldFromLine({
      pageindex: 10,
      x: 324,
      yTop: 256,
      width: 23,
      pageWidth: 595,
      pageHeight: 842,
      text: "Date",
    });
    expect(field.fieldtype).toBe("signdate");
    expect(field.left).toBe(324 + 23 + LAYOUT_DETECTED_DATE_FIELD.leftGap);
  });
});

describe("fitDateFieldBetweenSignatures", () => {
  it("slides a date box up when it would overlap the next signature", () => {
    const previous = signatureFieldFromLine({ pageindex: 10, x: 94, yTop: 173, width: 140 });
    const next = signatureFieldFromLine({ pageindex: 10, x: 94, yTop: 251, width: 140 });
    const date = dateFieldFromLine({
      pageindex: 10,
      x: 94,
      yTop: 221,
      width: 40,
      text: "Date :",
    });
    const fitted = fitDateFieldBetweenSignatures(date, previous, next);
    expect(fitted.top + fitted.height).toBeLessThanOrEqual(next.top);
    expect(fitted.top).toBeGreaterThanOrEqual(previous.top + previous.height);
    expect(signatureFieldsOverlap(fitted, previous)).toBe(false);
    expect(signatureFieldsOverlap(fitted, next)).toBe(false);
  });

  it("keeps the date box below a printed Designation line even when the next signature is unknown", () => {
    const previous = signatureFieldFromLine({ pageindex: 10, x: 94, yTop: 173, width: 140 });
    const date = dateFieldFromLine({
      pageindex: 10,
      x: 94,
      yTop: 221,
      width: 40,
      text: "Date :",
    });
    const designationBottom = printedLineBottom({ yTop: 205.55076377952798, height: 9 });
    const fitted = fitDateFieldBetweenSignatures(date, previous, undefined, designationBottom);
    expect(Number.isInteger(fitted.top)).toBe(true);
    expect(fitted.top).toBeGreaterThanOrEqual(
      Math.ceil(designationBottom + LAYOUT_DETECTED_PRINTED_LINE_GAP)
    );
    expect(fitted.top).toBeGreaterThanOrEqual(previous.top + previous.height);
  });
});

describe("fitSignFieldAbovePrintedLine", () => {
  it("raises or shrinks a signature so it stays above the Name line", () => {
    const sign = signatureFieldFromLine({ pageindex: 10, x: 94, yTop: 173, width: 140 });
    const fitted = fitSignFieldAbovePrintedLine(sign, 180);
    expect(fitted.top + fitted.height + LAYOUT_DETECTED_PRINTED_LINE_GAP).toBeLessThanOrEqual(180);
    expect(fitted.height).toBeGreaterThanOrEqual(LAYOUT_DETECTED_SIGN_FIELD.minHeight);
  });

  it("starts below the previous date block on a stacked execution column", () => {
    const sign = signatureFieldFromLine({ pageindex: 10, x: 94, yTop: 251, width: 140 });
    const fitted = fitSignFieldAbovePrintedLine(sign, 266, 232);
    expect(fitted.top).toBeGreaterThanOrEqual(232 + LAYOUT_DETECTED_PRINTED_LINE_GAP);
    expect(fitted.top + fitted.height + LAYOUT_DETECTED_PRINTED_LINE_GAP).toBeLessThanOrEqual(266);
  });
});

describe("signer detail labels", () => {
  it("recognises FA/JSG Name, Designation, and NRIC lines", () => {
    expect(isSignerNameLabel("Name : Ali Bin Abu")).toBe(true);
    expect(isSignerNameLabel("Full Name:")).toBe(true);
    expect(isSignerNameLabel("Name of Witness")).toBe(false);
    expect(isSignerDesignationLabel("Designation : Director")).toBe(true);
    expect(isSignerNricLabel("NRIC No.:")).toBe(true);
    expect(isSignerNricLabel("NRIC / Passport:")).toBe(true);
    expect(isSignerDateLabel("Date :")).toBe(true);
    expect(isSignerDateLabel("DateCASHSOUK_FA_KHAIKITMALCANIO_DATE:")).toBe(true);
    expect(isSignerDateLabel("CASHSOUK_FA_MAXCHNGTRUESTACKMY_DATEDate :")).toBe(true);
    const bottom = signerDetailLineBottomBeforeDate(
      { pageindex: 10, x: 94, yTop: 173 },
      [
        { pageindex: 10, x: 94, yTop: 189, height: 9, text: "Name : Ali Bin Abu" },
        { pageindex: 10, x: 94, yTop: 205, height: 9, text: "Designation : Director" },
        { pageindex: 10, x: 94, yTop: 221, height: 9, text: "Date :" },
      ],
      { sameColumnDelta: 50, maxBelow: 130, beforeYTop: 221 }
    );
    expect(bottom).toBe(214);
  });
});

describe("wrapped signer names", () => {
  it("cuts a glued witness column off a Name remainder", () => {
    expect(
      signerNameRemainder(
        "Name : Tunku Puan Sri Datin Seri Wan Name of Witness : Tunku Puan Sri Datin Seri"
      )
    ).toBe("Tunku Puan Sri Datin Seri Wan");
    expect(
      signerNameRemainder("Name : Tunku Puan Sri Datin Seri Wan Name : Tunku Puan Sri Datin Seri Wan")
    ).toBe("Tunku Puan Sri Datin Seri Wan");
    expect(signerNameRemainder("Full Name : Tunku Puan Sri Datin Seri Wan Nur")).toBe(
      "Tunku Puan Sri Datin Seri Wan Nur"
    );
    expect(signerNameRemainder("Name : Ali Bin Abu")).toBe("Ali Bin Abu");
  });

  it("shifts a glued Name of Witness line onto the witness column", () => {
    expect(
      isIssuerWitnessNameLabel(
        "Name : Tunku Puan Sri Datin Seri Wan Name of Witness : Tunku Puan Sri Datin Seri"
      )
    ).toBe(true);
    expect(isIssuerWitnessNameLabel("Name of Witness:")).toBe(true);
    expect(isIssuerWitnessNameLabel("Name : Ali Bin Abu")).toBe(false);
    expect(
      witnessColumnOriginFromNameLine({
        x: 77.5,
        text: "Name : Tunku Puan Sri Datin Seri Wan Name of Witness : Tunku Puan Sri Datin Seri",
        pageWidth: 595,
      })?.x
    ).toBe(297.5);
    expect(
      witnessColumnOriginFromNameLine({
        x: 360,
        text: "Name of Witness:",
        pageWidth: 595,
      })?.x
    ).toBe(360);
  });

  it("joins hanging-indent wrap lines and ignores the witness column", () => {
    const lines = [
      {
        pageindex: 10,
        x: 77.5,
        yTop: 205.4,
        text: "Name : Tunku Puan Sri Datin Seri Wan Name of Witness : Tunku Puan Sri Datin Seri",
        pageWidth: 595,
      },
      { pageindex: 10, x: 137, yTop: 218.6, text: "Nur Aisyah binti Tengku Abdul", pageWidth: 595 },
      { pageindex: 10, x: 389.7, yTop: 218.6, text: "Wan Nur Aisyah binti", pageWidth: 595 },
      { pageindex: 10, x: 137, yTop: 231.8, text: "Rahman", pageWidth: 595 },
      { pageindex: 10, x: 389.7, yTop: 231.8, text: "Tengku Abdul Rahman", pageWidth: 595 },
      {
        pageindex: 10,
        x: 77.5,
        yTop: 245.2,
        text: "Designation: Deputy Chairman – Non-",
        pageWidth: 595,
      },
    ];
    expect(
      joinWrappedSignerName(lines[0]!, lines, {
        maxBelow: 77,
        isStop: (text) => /^designation/i.test(text),
      })
    ).toBe("Tunku Puan Sri Datin Seri Wan Nur Aisyah binti Tengku Abdul Rahman");
  });
});

describe("signatureFieldsOverlap", () => {
  it("detects overlapping rectangles on the same page", () => {
    const a = signatureFieldFromLine({ pageindex: 1, x: 90, yTop: 200, width: 140 });
    const b = signatureFieldFromLine({ pageindex: 1, x: 100, yTop: 210, width: 140 });
    expect(signatureFieldsOverlap(a, b)).toBe(true);
  });

  it("allows stacked boxes on the same column", () => {
    const a = signatureFieldFromLine({ pageindex: 1, x: 94, yTop: 173, width: 140 });
    const b = signatureFieldFromLine({ pageindex: 1, x: 94, yTop: 251, width: 140 });
    expect(signatureFieldsOverlap(a, b)).toBe(false);
  });
});

describe("matchSignersToNamedSlots", () => {
  const slots = [
    { ...signatureFieldFromLine({ pageindex: 1, x: 94, yTop: 173, width: 140 }), name: "Ali Bin Abu" },
    { ...signatureFieldFromLine({ pageindex: 1, x: 94, yTop: 251, width: 140 }), name: "Siti Binti Ahmad" },
  ];

  it("places named signers and fails when a slot is unused", () => {
    expect(() =>
      matchSignersToNamedSlots(["Ali Bin Abu"], slots, {
        documentLabel: "JSG",
        allowUnnamedFallback: false,
        requireAllSlotsUsed: true,
        createError: (message) => new Error(message),
      })
    ).toThrow(/do not match signer count/);
  });

  it("uses an unnamed fallback when allowed", () => {
    const unnamed = [
      { ...signatureFieldFromLine({ pageindex: 2, x: 72, yTop: 200, width: 140 }), name: "" },
    ];
    const signsets = matchSignersToNamedSlots(["Ali Bin Abu"], unnamed, {
      documentLabel: "Facility Agreement",
      allowUnnamedFallback: true,
      requireAllSlotsUsed: true,
      createError: (message) => new Error(message),
    });
    expect(signsets).toHaveLength(1);
    expect(signsets[0]?.[0]?.pageindex).toBe(2);
  });

  it("appends extra date fields onto the matched signer's signset", () => {
    const date = dateFieldFromLine({
      pageindex: 1,
      x: 94,
      yTop: 221,
      width: 40,
      text: "Date :",
    });
    const signsets = matchSignersToNamedSlots(
      ["Ali Bin Abu"],
      [{ ...slots[0]!, extraFields: [date] }],
      {
        documentLabel: "Facility Agreement",
        allowUnnamedFallback: false,
        requireAllSlotsUsed: true,
        createError: (message) => new Error(message),
      }
    );
    expect(signsets).toEqual([
      [
        {
          fieldtype: "sign",
          top: slots[0]?.top,
          left: slots[0]?.left,
          height: slots[0]?.height,
          width: slots[0]?.width,
          pageindex: 1,
        },
        date,
      ],
    ]);
  });

  it("rejects overlapping assigned fields", () => {
    const overlapping = [
      { ...signatureFieldFromLine({ pageindex: 1, x: 90, yTop: 200, width: 140 }), name: "Ali Bin Abu" },
      { ...signatureFieldFromLine({ pageindex: 1, x: 100, yTop: 210, width: 140 }), name: "Siti Binti Ahmad" },
    ];
    expect(() =>
      matchSignersToNamedSlots(["Ali Bin Abu", "Siti Binti Ahmad"], overlapping, {
        documentLabel: "Deed of Assignment",
        allowUnnamedFallback: false,
        requireAllSlotsUsed: true,
        createError: (message) => new Error(message),
      })
    ).toThrow(/overlap/);
  });
});

describe("assertSignatureFieldsValid", () => {
  it("accepts stacked defaults on one page", () => {
    expect(() =>
      assertSignatureFieldsValid(
        [
          { ...SIGNING_CLOUD_STACKED_SIGN_FIELD, pageindex: 1 },
          {
            ...SIGNING_CLOUD_STACKED_SIGN_FIELD,
            pageindex: 1,
            top: SIGNING_CLOUD_STACKED_SIGN_FIELD.top - 50,
          },
        ],
        (message) => new Error(message)
      )
    ).not.toThrow();
  });

  it("rejects a date field that overlaps its signature", () => {
    const sign = signatureFieldFromLine({ pageindex: 1, x: 94, yTop: 173, width: 140 });
    const date = { ...sign, fieldtype: "signdate" as const };
    expect(() => assertSignatureFieldsValid([sign, date], (message) => new Error(message))).toThrow(
      /overlap/
    );
  });

  it("rejects two seal fields on the same document", () => {
    const first = {
      fieldtype: "seal" as const,
      pageindex: 1,
      top: 40,
      left: 40,
      width: 44,
      height: 44,
    };
    const second = { ...first, left: 200 };
    expect(() => assertSignatureFieldsValid([first, second], (message) => new Error(message))).toThrow(
      /one organisation seal/
    );
  });
});

describe("textFieldFromLine", () => {
  it("places a textfield to the right of a blank Designation label", () => {
    expect(isSignerDesignationLabel("Designation :")).toBe(true);
    const field = textFieldFromLine({
      pageindex: 10,
      x: 94,
      yTop: 205,
      width: 40,
      pageWidth: 595,
      pageHeight: 842,
      text: "Designation :",
    });
    expect(field.fieldtype).toBe("textfield");
    expect(field.left).toBe(94 + 40 + LAYOUT_DETECTED_TEXT_FIELD.leftGap);
    expect(field.height).toBe(LAYOUT_DETECTED_TEXT_FIELD.height);
  });
});

describe("sealFieldFromLabel", () => {
  it("sits the seal to the right of a blank Company Stamp label", () => {
    expect(isCompanyStampLabel("Company Stamp:")).toBe(true);
    expect(isCompanyStampLabel("Issuer's company stamp:")).toBe(true);
    const field = sealFieldFromLabel({
      pageindex: 10,
      x: 78,
      yTop: 420,
      width: 90,
      pageWidth: 595,
      pageHeight: 842,
      text: "Company Stamp:",
    });
    expect(field.fieldtype).toBe("seal");
    expect(field.left).toBe(78 + 90 + LAYOUT_DETECTED_SEAL_FIELD.gap);
    expect(field.width).toBe(LAYOUT_DETECTED_SEAL_FIELD.width);
    expect(field.height).toBe(LAYOUT_DETECTED_SEAL_FIELD.height);
    const issuerStamp = sealFieldFromLabel({
      pageindex: 44,
      x: 77.5,
      yTop: 298.3,
      width: 110,
      pageWidth: 595,
      pageHeight: 842,
      text: "Issuer's company stamp:",
    });
    expect(issuerStamp.left).toBe(Math.round(77.5 + 110 + LAYOUT_DETECTED_SEAL_FIELD.gap));
    expect(issuerStamp.top).toBeGreaterThan(250);
  });
});

describe("sealFieldBesideSignature", () => {
  it("sits to the right of the signature without overlapping", () => {
    const sign = signatureFieldFromLine({
      pageindex: 10,
      x: 94,
      yTop: 173,
      width: 140,
      pageWidth: 595,
      pageHeight: 842,
    });
    const seal = sealFieldBesideSignature(sign, { pageWidth: 595, pageHeight: 842 });
    expect(seal.fieldtype).toBe("seal");
    expect(seal.width).toBe(LAYOUT_DETECTED_SEAL_FIELD.width);
    expect(signatureFieldsOverlap(sign, seal)).toBe(false);
    expect(() =>
      assertSignatureFieldsValid([sign, seal], (message) => new Error(message))
    ).not.toThrow();
  });

  it("does not allow a second seal even when assertAtMostOneSealField is called directly", () => {
    const seal = {
      fieldtype: "seal" as const,
      pageindex: 1,
      top: 40,
      left: 40,
      width: 44,
      height: 44,
    };
    expect(() =>
      assertAtMostOneSealField([seal, { ...seal, left: 120 }], (message) => new Error(message))
    ).toThrow(/one organisation seal/);
  });

  it("shifts the seal past Designation when a stacked FA block would overlap", () => {
    const sign = {
      fieldtype: "sign" as const,
      pageindex: 44,
      top: 254,
      left: 78,
      width: 167,
      height: 36,
    };
    const date = {
      fieldtype: "signdate" as const,
      pageindex: 44,
      top: 314,
      left: 108,
      width: 70,
      height: 14,
    };
    const text = {
      fieldtype: "textfield" as const,
      pageindex: 44,
      top: 297,
      left: 141,
      width: 154,
      height: 16,
    };
    const withSeal = attachPrimarySealField(
      [[sign, date, text]],
      [{ name: "Siti Binti Ahmad", appliesCompanySeal: true }],
      { pageWidth: 595, pageHeight: 842 },
      (message) => new Error(message)
    );
    const seal = withSeal[0]?.find((field) => field.fieldtype === "seal");
    expect(seal).toBeDefined();
    expect(signatureFieldsOverlap(seal!, sign)).toBe(false);
    expect(signatureFieldsOverlap(seal!, date)).toBe(false);
    expect(signatureFieldsOverlap(seal!, text)).toBe(false);
    expect(seal!.left).toBeGreaterThanOrEqual(text.left + text.width);
  });

  it("prefers a Company Stamp origin over sitting beside the signature", () => {
    const sign = {
      fieldtype: "sign" as const,
      pageindex: 10,
      top: 258,
      left: 78,
      width: 240,
      height: 36,
    };
    const text = {
      fieldtype: "textfield" as const,
      pageindex: 10,
      top: 347,
      left: 135,
      width: 100,
      height: 16,
    };
    const stamp = sealFieldFromLabel({
      pageindex: 10,
      x: 78,
      yTop: 430,
      width: 90,
      pageWidth: 595,
      pageHeight: 842,
      text: "Company Stamp:",
    });
    const withSeal = attachPrimarySealField(
      [[sign, text]],
      [{ name: "Siti Binti Ahmad", appliesCompanySeal: true }],
      { pageWidth: 595, pageHeight: 842 },
      (message) => new Error(message),
      [stamp]
    );
    const seal = withSeal[0]?.find((field) => field.fieldtype === "seal");
    expect(seal).toMatchObject({ left: stamp.left, top: stamp.top, pageindex: 10 });
    expect(signatureFieldsOverlap(seal!, sign)).toBe(false);
    expect(seal!.left).toBeLessThan(sign.left + sign.width);
  });
});

describe("signature stroke detection", () => {
  it("still treats dotted and underscored lines as strokes after a CashSouk keyword joins them", () => {
    expect(isDottedSignatureStroke("...........................................................................CASHSOUK_DOA_SSP")).toBe(
      true
    );
    expect(isUnderscoreSignatureStroke("______________________________________CASHSOUK_DOA_SSP")).toBe(true);
    expect(isSignatureStrokeLine("........................................................................... CASHSOUK_DOA_SSP")).toBe(
      true
    );
    expect(isAutomaticSigningKeywordLine("CASHSOUK_DOA_SSP")).toBe(true);
    expect(isDottedSignatureStroke("\u2026".repeat(8))).toBe(true);
    expect(isSignatureStrokeLine("\u2026".repeat(8))).toBe(true);
    expect(isUnderscoreSignatureStroke("\u2500".repeat(12))).toBe(true);
    expect(isSignatureStrokeLine("\u2500".repeat(12))).toBe(true);
    expect(isDottedSignatureStroke("...........................................................................CASHSOUK_DOA_SSP extra")).toBe(
      false
    );
    expect(isSignatureStrokeGlyphRun(".")).toBe(true);
    expect(isSignatureStrokeGlyphRun("...")).toBe(true);
    expect(isSignatureStrokeGlyphRun("Name: Ali")).toBe(false);
  });
});
