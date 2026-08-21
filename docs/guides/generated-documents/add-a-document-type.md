# Add a generated document type

Checklist for a **new** catalog entry (not changing an existing type — bump `version` for that; see step 7).

## 1. Word template

- Add a tagged `.docx` under `apps/api/src/modules/applications/templates/` (or a per-type subfolder if the file is large).
- Use docxtemplater tags: `{snake_case}` (see [add-a-placeholder.md](./add-a-placeholder.md)).
- Leave signature lines as underscores in Word for wet ink — do not add merge tags for signees unless legal approves.

## 2. Merge types

- Define merge payload type and `MERGE_KEYS` in `@cashsouk/types` (follow `facility-lo-merge.types.ts` pattern) or extend an existing merge module.
- Export keys used by the template.

## 3. Merge builder

- Add `build*MergeData` in `apps/api/src/modules/applications/letter-of-offer/` (or a new folder per family if not LO-shaped).
- Read from Prisma entities / JSON columns — cite paths in comments or [lo-data-sources.md](./lo-data-sources.md).
- Unit test with a minimal fixture ([`build-facility-lo-merge-data.test.ts`](../../apps/api/src/modules/applications/letter-of-offer/build-facility-lo-merge-data.test.ts) as reference).

## 4. Render + convert

- `render*Docx(data)` — Docxtemplater + PizZip ([`render-facility-lo-docx.ts`](../../apps/api/src/modules/applications/letter-of-offer/render-facility-lo-docx.ts)).
- PDF: `convertDocxToPdf` via Gotenberg ([`convert-docx-to-pdf.ts`](../../apps/api/src/modules/applications/letter-of-offer/convert-docx-to-pdf.ts)).
- Tests: unknown tags empty; fixture render does not throw.

## 5. Catalog row

In `packages/types/src/generated-documents.ts`:

- `key` — stable slug (never rename after first release)
- `version: 1` on first ship
- `label`, `description` — admin dropdown
- `allowedContexts` — one or more of `acceptance_documents`, `supporting_documents`, `guarantor_agreement`
- `requires` — e.g. `contract_offer_sent` when offer must be sent first

Update `GeneratedDocumentTypeKey` union when adding the first key of a new slug.

## 6. Generate adapter

In `apps/api/src/modules/generated-documents/service.ts`:

- Add a `switch` case in `generateDocument` / private generator method.
- Enforce gates: `workflowDeclaresGeneratedDocumentType` + `assertRequiresMet`.
- Log template SHA-256; set response headers (see existing LO path).

## 7. Version bumps

When changing template or merge map for an **existing** type:

- Bump catalog `version` in the **same PR** as the `.docx` / builder changes.
- Legal reviews a **filled PDF sample**, not the tagged Word file alone.

## 8. Admin UI

If `allowedContexts` includes a context, the admin **Generated** dropdown appears automatically when the catalog lists types for that context (`workflow-document-row-editor.tsx`).

## 9. Issuer download

If the type is used on acceptance rows, issuer download already routes through `download-generated-document.ts` when `generated_document_type` is set. Supporting/guarantor rows use the same step component when configured.

## 10. Verify

- [ ] Unit tests (builder + generate service gates)
- [ ] Manual: configure Generated on a test product → offer sent → issuer Download template → PDF opens with expected fields
- [ ] Negative: no row on product → 400; no offer → 400
