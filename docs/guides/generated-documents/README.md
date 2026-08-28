# Generated documents

Platform-filled Word templates (converted to PDF on download) for issuer acceptance and other workflow document rows.

## Three layers

| Layer | Where it lives | What it does |
|-------|----------------|--------------|
| **Definition (git)** | Catalog in `packages/types`, `.docx` + merge builders in `apps/api` | Engineers define what can be generated and how data maps into the template |
| **Composition (admin)** | Product workflow document rows | Admin picks **None**, **Upload**, or **Generated** per row |
| **Instance (runtime)** | Generate on download | Issuer or admin downloads a filled PDF; issuer uploads the completed copy as today |

There is **no generated-document instance table**. The uploaded file after download is the artefact.

## Source of truth

- **Catalog keys and template version** — git (`packages/types/src/generated-documents.ts` + API adapters). Never rename a catalog `key` after release; bump `version` when the Word file or merge map changes.
- **Which type applies to an application** — frozen `application.product_version` workflow JSON (`generated_document_type` on the document row).
- **Issued uploads** — never overwritten by generate. Generate only produces a download; it does not replace files already on the application.

## Product version vs template version

- `application.product_version` pins the **workflow** (including which rows use Generated and which catalog key).
- Catalog `version` on a type describes the **Word template / merge map** revision in git, logged on each generate (SHA-256 of template bytes + `X-Generated-Document-Version` header).

An application keeps its frozen product version even if the live catalog product is updated.

## Merge tags (all generated Word types)

- Empty / missing data prints the merge tag or legal placeholder — never a blank slot. Required commercial fields still fail generate (`GENERATED_DOCUMENT_DATA_INCOMPLETE`).
- Every **value** merge (filled or not) is yellow-highlighted in Word. Loop/raw tags are not.
- LO Finance Documents guarantor entities use lower-roman `i. ii. iii.`; company representatives nest as `a. b. c.` (not the parent `(a) (b) (c)` list).

Details: [add-a-placeholder.md](./add-a-placeholder.md).

## Operator flow (production)

1. Admin → product workflow → Acceptance document row → Template source **Generated** → pick type (e.g. ARF contract facility LO) → save/publish.
2. Admin sends contract offer on an application using that product version.
3. Issuer → Review Offer / acceptance step → **Download template** → filled PDF.
4. Issuer completes offline → uploads PDF → submits acceptance as usual.

## API (developers)

| Endpoint | Audience | Purpose |
|----------|----------|---------|
| `GET /v1/admin/generated-document-types?context=` | Admin | List catalog types |
| `GET /v1/applications/:id/generated-documents/:type?format=pdf\|docx` | Issuer (org member) or admin | Generate and download |
| `GET /v1/admin/applications/:id/generated-documents/:type?format=` | Admin | Same generate path |

Gates: frozen product row must declare the type; `requires` must be met (LO: contract `offer_details` present).

Demo (merge iteration only): `GET/POST /v1/admin/demos/contract-lo/*` — same tagged `.docx` + `renderFacilityLoDocx` as production; not wired to Send Offer or signing.

## Code map

| Area | Path |
|------|------|
| Catalog | `packages/types/src/generated-documents.ts` |
| Row field | `packages/types/src/workflow-document-row.ts` |
| Generate service | `apps/api/src/modules/generated-documents/service.ts` |
| LO merge/render | `apps/api/src/modules/applications/letter-of-offer/` |
| Admin composition UI | `apps/admin/.../workflow-document-row-editor.tsx` |
| Issuer download | `apps/issuer/src/lib/download-generated-document.ts` |

## Extending the system

- New document type: [add-a-document-type.md](./add-a-document-type.md)
- New placeholder on an existing type: [add-a-placeholder.md](./add-a-placeholder.md)
- LO field status today: [lo-data-sources.md](./lo-data-sources.md)
- LO 19 Aug 2026 verification map: [lo-19-aug-2026-field-map.md](./lo-19-aug-2026-field-map.md)

Build history (vertical slices): [implementation-slices.md](./implementation-slices.md).

## Out of scope (today)

- CMS upload of generated Word templates
- Auto-generate on Send Offer
- Invoice LO
- PDFKit offer letters, SigningCloud `GENERATED_OFFER_LETTER`, trustee/prospectus generators in this pipeline
- Side-by-side historical `.docx` versions per deploy (until a type must support old forms after upgrade)
