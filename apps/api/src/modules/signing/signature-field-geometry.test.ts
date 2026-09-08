import {
  assertSignatureFieldsValid,
  dateFieldFromLine,
  fitDateFieldBetweenSignatures,
  LAYOUT_DETECTED_DATE_FIELD,
  LAYOUT_DETECTED_SIGN_FIELD,
  matchSignersToNamedSlots,
  SIGNING_CLOUD_STACKED_SIGN_FIELD,
  signatureFieldFromLine,
  signatureFieldsOverlap,
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
});
