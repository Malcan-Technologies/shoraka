# Add a placeholder to a generated document

For an **existing** catalog type (e.g. ARF contract facility LO). For a wholly new document, start with [add-a-document-type.md](./add-a-document-type.md).

## 1. Word template

Add `{snake_case}` in the `.docx` under `apps/api/src/modules/applications/templates/`.

- Match existing naming in [`facility-lo-merge.types.ts`](../../apps/api/src/modules/applications/letter-of-offer/facility-lo-merge.types.ts).
- **Repeating rows** (e.g. guarantors): use docxtemplater section loops — `{#guarantors_individual}{line}{/guarantors_individual}` — and bump catalog `version` when the Word structure changes.
- **SIGNEE** fields: do **not** add a merge tag; keep underscores in Word for wet ink.

## 2. TypeScript merge map

- Add the key to the merge interface and `MERGE_KEYS` / `CONTRACT_FACILITY_LO_MERGE_KEYS` in the types module.
- Export through `@cashsouk/types` if frontends or demos need it.

## 3. Builder mapping

In the relevant `build*MergeData` (LO: [`build-facility-lo-merge-data.ts`](../../apps/api/src/modules/applications/letter-of-offer/build-facility-lo-merge-data.ts)), classify the field:

| Class | Rule | Example |
|-------|------|---------|
| **EXISTS** | Read a known column or JSON path | `contract.offer_details.offered_facility` |
| **DERIVE** | Compute from other fields | RM format, `numberToWords`, date phrases via [`lo-format.ts`](../../apps/api/src/modules/applications/letter-of-offer/lo-format.ts) |
| **LEGAL_DEFAULT** | Fixed constant until product config exists | Availability 30 days from fixture |
| **EMPTY** | `""` until legal/product defines a source (generated docs currently print `{tag}` so gaps stay visible) | `tenure_days` today |
| **SIGNEE** | No builder entry; blank in Word | Authorised signatory wet ink lines |

Do **not** invent commercial data. If legal has not signed off, use **EMPTY**.

## 4. Tests

- Extend builder unit tests with fixture input and expected output for the new key.
- Re-run render test if template structure changed.

## 5. Documentation

- Note the field in [lo-data-sources.md](./lo-data-sources.md) (working index).
- Update the detailed table in [arf-letter-of-offer-placeholder-map.md](../application-flow/arf-letter-of-offer-placeholder-map.md) if it is an LO field.

## 6. Catalog version

If the Word file changed, bump `version` on the catalog type in `generated-documents.ts` in the same PR.
