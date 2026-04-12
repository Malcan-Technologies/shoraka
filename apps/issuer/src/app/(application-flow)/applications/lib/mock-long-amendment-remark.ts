/**
 * SECTION: Dev-only long amendment text for layout testing
 * WHY: Preview AmendmentRemarkCard with many newlines and long lines
 * INPUT: Used when dev preview amendment is on (edit application page)
 * OUTPUT: Strings passed as section / item remarks in dev amendment preview
 * WHERE USED: getMockAmendmentContext in edit/[id]/page.tsx
 */

export const MOCK_DEV_LONG_AMENDMENT_REMARK = [
  "Please read all points below carefully before resubmitting. This block is intentionally long to test wrapping, list spacing, and scroll behavior in the issuer amendment callout.",
  "",
  "Paragraph A — General compliance",
  "The reviewer noted several inconsistencies between the uploaded contract pack and the data entered in this step. Where fields are optional, leave them blank rather than duplicating text from other sections.",
  "",
  "Paragraph B — Line items and numbering",
  "1) Verify every schedule reference in the body matches the index in the appendix.\n2) If a schedule was removed, renumber downstream references.\n3) Do not use placeholder text such as TBD or N/A for mandatory clauses.",
  "",
  "Paragraph C — Random filler with awkward breaks",
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\nUt enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.\nExcepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  "",
  "Paragraph D — Bullet-style lines (each line becomes its own list item when split by newline in the card)",
  "Cross-check party legal names against SSM printout.",
  "Ensure signing dates are not earlier than board resolution dates.",
  "If the contract is bilingual, both language versions must be uploaded in one PDF or as clearly named separate files.",
  "",
  "Paragraph E — Very long single logical line (should wrap inside the bullet cell)",
  `${"The following sentence is repeated to force a long line without a newline: ".repeat(12)}END.`,
  "",
  "Paragraph F — Mixed whitespace",
  "   Leading spaces should still display as normal text after trim per line.",
  "\tTab characters may or may not collapse depending on CSS; this is intentional for QA.",
  "",
  "Paragraph G — Closing",
  "After fixes, upload the revised documents and add a short note in Review & Submit describing what changed. Thank you.",
].join("\n");

/** Long multi-line remark for Supporting documents step (section + item dialogs). */
export const MOCK_DEV_LONG_SUPPORTING_DOCUMENTS_AMENDMENT_REMARK = [
  "Supporting documents — reviewer feedback (stress test for newlines and wrapping).",
  "",
  "Section A — File quality",
  "Scans must be legible (minimum 150 dpi effective). Do not crop stamps or signatures.\nPassword-protected PDFs are not accepted unless you provide the password in Review & Submit notes (not in the file).",
  "",
  "Section B — Naming and versions",
  "Use clear filenames: CompanyName_DocumentType_YYYY-MM.pdf\nIf you replace a file, delete the old upload first to avoid duplicate reviews.",
  "",
  "Section C — Category rules",
  "Financial docs: management accounts must cover the same fiscal period as stated in company details.\nLegal docs: ensure deed / resolution dates align with signatories shown on the contract step.",
  "",
  "Section D — Long unbroken line for wrap testing",
  `${"Upload complete uncropped PDFs; partial screenshots may be rejected: ".repeat(15)}END.`,
  "",
  "Section E — Checklist (one bullet per line after split)",
  "Bank statements must show account holder name matching the issuer entity.",
  "Invoices in this pack must not be the same files already tied to invoice financing rows unless the product allows it.",
  "Excel or Word source files are not accepted where PDF is required.",
  "",
  "Section F — Closing",
  "Re-upload corrected files, then acknowledge this step. Contact support if a required doc type is not applicable to your entity.",
].join("\n");
