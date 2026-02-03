# Settings/Products

## Overview

The Settings/Products page in the admin portal (`/settings/products`) lets admins view, create, edit, and delete product definitions. Create and Edit use the same popup (dialog) with name, version, and drag-and-drop workflow steps.

## What you can do

- View a paginated list of products (name, version, updated date).
- Search by product name (backend filters on workflow JSON text, e.g. type name).
- Reload the list.
- Open a product’s details (name, version, created/updated) in a dialog.

## UI

- **Toolbar:** Search input, Clear, **Create product** button, Reload button, count badge.
- **Table:** Product name (from workflow type), Version, Updated, Actions (dropdown: View, Edit, Delete). Edit opens the same popup as Create (workflow builder with drag-and-drop cards). Loading skeleton and empty state (“No products found”) match the documents table style.
- **Error:** If the list request fails, an error message appears above the table (same pattern as Organizations).
- **Pagination:** Previous/Next when there is more than one page.

## Save flow and output

When you click **Save** in the workflow builder:

1. **Create:** Sends `POST /v1/products` with body `{ workflow: steps }`. Backend creates a row with `version: 1`, stores `workflow` as JSON.
2. **Edit:** Sends `PATCH /v1/products/:id` with body `{ workflow: steps }`. Backend updates the row: replaces `workflow` and increments `version` by 1.

**Payload:** `steps` is the array you see in the dialog (order = display order). Each step is an object:

- `id` – step id (e.g. `financing_type_1`, `company_details_1`).
- `name` – display name (e.g. `"Financing Type"`, `"Declarations"`).
- `config` – step-specific config. For **Financing Type** (first step): `category`, `name`, `description`, `image` (with `s3_key`, `file_name`, optional `file_size`). **Invoice Details** adds `max_financing_rate_percent` (number 0–100, default 80). **Declarations** uses `declarations` — array of `{ text: string }`. **Supporting Documents** only non-empty category keys; each category is an array of `{ name: string, template?: { s3_key, file_name, file_size? } }`. Many items have only `name` (no `template`). (UI: add categories via “Add category” dropdown.) Empty category arrays and `enabled_categories` are omitted. Steps without config have `config` omitted or `{}`. See **Example config for each step** below.

### What the Financing Type config looks like when saved

The **Financing Type** step’s `config` has category, name, description, and a nested **image** object:

```json
{
  "category": "Invoice financing",
  "name": "Account Receivable (AR) Financing",
  "description": "Get funding against your issued invoices under Islamic financing principles",
  "image": {
    "s3_key": "products/images/abc123xyz.png",
    "file_name": "product-logo.png",
    "file_size": 102400
  }
}
```

- **category** – Section heading on the issuer app (e.g. “Invoice financing”).
- **name** – Product card title (e.g. “Account Receivable (AR) Financing”). Also used as the product name in the admin list.
- **description** – Card subtitle/description.
- **image** – Optional object: **s3_key** (S3 key for presigned view URL), **file_name** (original file name at upload), **file_size** (optional, bytes).

Inside the full product payload, that config lives on the first workflow step:

```json
{
  "workflow": [
    {
      "id": "financing_type_1",
      "name": "Financing Type",
      "config": {
        "category": "Invoice financing",
        "name": "Account Receivable (AR) Financing",
        "description": "Get funding against your issued invoices...",
        "image": { "s3_key": "products/images/abc123xyz.png", "file_name": "product-logo.png", "file_size": 102400 }
      }
    },
    { "id": "company_details_1", "name": "Company Details", "config": {} },
    ...
  ]
}
```

The API stores `workflow` as JSON on the product row; the issuer app reads the first step’s `config` for category, name, description, and image (via `config.image.s3_key`; legacy `config.s3_key` is still supported).

**Response (what you get back):**

```json
{
  "success": true,
  "data": {
    "id": "<product-cuid>",
    "version": 1,
    "workflow": [
      { "id": "financing_type_1", "name": "Financing Type", "config": { ... } },
      { "id": "company_details_1", "name": "Company Details", "config": { ... } },
      ...
    ],
    "created_at": "2026-02-03T01:00:00.000Z",
    "updated_at": "2026-02-03T01:00:00.000Z"
  }
}
```

On **edit**, `version` is the new value (previous + 1). The list and product detail then show this saved product; the dialog closes.

## S3 uploads (product-uploads controller)

All product S3 logic lives in **product-uploads-controller.ts**. Uploads happen **only when the user clicks Save**.

1. **Request URL:** **POST /v1/products/:id/upload-image-url** (body: `fileName`, `contentType`) or **POST /v1/products/:id/upload-template-url** (body: `categoryKey`, `templateIndex`, `fileName`, `contentType`, `fileSize`). Backend loads the product, gets the current S3 key from the workflow (if any), and returns `uploadUrl` + `s3Key`. The **S3 key version** (v1, v2, …) is per file/slot and **separate from the product version**.
2. **Upload:** Frontend **PUT**s the file to `uploadUrl` via `uploadFileToS3` (same helper as site-documents).
3. **Save:** Frontend merges all new `s3Key`s into the workflow and sends **one PATCH** with the full workflow. Product version increments once per Save. Replaced S3 keys are deleted by the main products controller after a successful PATCH.

Flow: user selects files (pending) → clicks Save → create product if new → for each pending file: request URL → upload to S3 → merge key into workflow → PATCH product once.

## Validation before Save/Create

The Save/Create button is disabled until all required fields are filled. An amber alert box above the footer lists what’s missing. Every field in every step with config is required (including descriptions and image). Implemented in `getRequiredStepErrors` in `product-form-dialog.tsx`.

| Step | Rule | Error message (step label + message) |
|------|------|-------------------------------------|
| **Financing Type** | Name must be non-empty (trimmed). | `{step}: enter name` |
| **Financing Type** | Category must be non-empty (trimmed). | `{step}: enter category` |
| **Financing Type** | Description must be non-empty (trimmed). | `{step}: enter description` |
| **Financing Type** | Image required: `config.image.s3_key`, legacy `config.s3_key`, or a pending image chosen in the dialog (stored as client-only `config._pendingImage`, stripped before save). | `{step}: add an image` |
| **Supporting Documents** | At least one category must be added (enabled). | `{step}: add at least one category` |
| **Supporting Documents** | Every enabled category must have at least one document. | `{step}: every category must have at least one document` |
| **Supporting Documents** | Every document row must have a non-empty name (trimmed). | `{step}: every document must have a name` |
| **Declarations** | At least one declaration. | `{step}: add at least one declaration` |
| **Declarations** | Every declaration must have non-empty text (trimmed; supports `{ text: string }` or legacy string items). | `{step}: every declaration must have text` |

Steps without config UI (Financing Structure, Contract Details, Company Details, Business Details, Review And Submit) are not validated in this list. Only steps that have config panels in the workflow builder are checked.

## API

- **List:** `GET /v1/products?page=1&pageSize=10&search=...` (admin only). Returns `{ products, pagination }`.
- **One product:** `GET /v1/products/:id` (admin only).

Search is by product name only: backend filters on workflow JSON text (contains, case-insensitive). Typing in the search box matches text in the workflow (e.g. product type name). ID is not shown in the table or in the view dialog.

## All step configs

In the workflow builder, some steps show a chevron and expand to reveal config; others do not.

| Step | Config panel shown? | Config UI |
|------|---------------------|-----------|
| **Financing Type** | Yes | Category, Name, Description, optional Image (upload/preview). |
| **Financing Structure** | No | (BaseStepConfig: Label, Required — not shown in UI.) |
| **Contract Details** | No | (BaseStepConfig.) |
| **Invoice Details** | Yes | Max financing rate (%) — number input 0–100, default 80. |
| **Company Details** | No | (BaseStepConfig.) |
| **Business Details** | No | (BaseStepConfig.) |
| **Supporting Documents** | Yes | Add category dropdown; per category: document list (number on left, name input, Optional template), no outer border. |
| **Declarations** | Yes | Add declaration button; list of items (number on left, textarea, move up/down/remove), no outer border. |
| **Review And Submit** | No | (BaseStepConfig.) |

Steps without a config panel do not show a chevron or expandable section.

### Example config for each step

**Financing Type**

```json
{
  "category": "Invoice financing",
  "name": "Account Receivable (AR) Financing",
  "description": "Get funding against your issued invoices under Islamic financing principles",
  "image": {
    "s3_key": "products/images/abc123.png",
    "file_name": "product-logo.png",
    "file_size": 102400
  }
}
```

**Financing Structure** (no config in UI)

```json
{}
```

**Contract Details** (no config in UI)

```json
{}
```

**Invoice Details**

```json
{
  "max_financing_rate_percent": 80
}
```

**Company Details** (no config in UI)

```json
{}
```

**Business Details** (no config in UI)

```json
{}
```

**Supporting Documents**

Omit empty category arrays. Each item has `name`; **only items with an uploaded template** include a `template` object with `s3_key`, `file_name`, and optionally `file_size`. Many items may have no `template` field.

```json
{
  "financial_docs": [
    { "name": "Bank statement (last 6 months)", "template": { "s3_key": "products/prod-abc/v1-2026-02-03-xyz.pdf", "file_name": "sample.pdf", "file_size": 503400 } },
    { "name": "Tax return" }
  ],
  "legal_docs": [
    { "name": "Certificate of incorporation" }
  ]
}
```

**Declarations**

Stored as an array of objects so more fields can be added later (e.g. `required`, `id`).

```json
{
  "declarations": [
    { "text": "I confirm that the information provided is accurate." },
    { "text": "I agree to the terms and conditions." }
  ]
}
```

**Review And Submit** (no config in UI)

```json
{}
```

## Verify save to DB

The save flow persists to the database:

1. **Dialog** → `createProduct.mutateAsync({ workflow })` or `updateProduct.mutateAsync({ id, data: { workflow } })`.
2. **API** → POST /v1/products or PATCH /v1/products/:id with body `{ workflow }`; controller calls `productRepository.create` or `productRepository.update`.
3. **Repository** → `create` sets `version: 1`. `update` increments version unless `completeCreate: true` (used only for the first save after create).
4. **DB** → `products` table, `workflow` column (JSON).

To verify with a real DB: run the API (`pnpm -F @cashsouk/api dev`) and admin app (`pnpm -F investor dev` or the admin app), ensure `DATABASE_URL` is set and migrations are applied. Create a product (fill required fields; you can skip image/templates to avoid S3), click Save. Then open the products list or GET /v1/products — the new product should appear with the same workflow. Repository unit tests: `apps/api/src/modules/products/repository.test.ts` (mocks Prisma; run with `pnpm -F @cashsouk/api test -- --testPathPattern=products/repository`).

## Code locations

- **Page:** `apps/admin/src/app/settings/products/page.tsx`
- **List UI:** `apps/admin/src/app/settings/products/components/products-list.tsx`
- **Workflow builder (Create/Edit popup):** `apps/admin/src/app/settings/products/workflow-builder/` — `product-form-dialog.tsx` (same UI for create and edit), `workflow-step-card.tsx` (draggable step card)
- **Shared utils:** `apps/admin/src/app/settings/products/product-utils.ts` (productName, workflowWithName, stepDisplayName, getDefaultWorkflowSteps)
- **Hook:** `apps/admin/src/app/settings/products/hooks/use-products.ts` (useProducts, useProduct, useCreateProduct, useUpdateProduct, useDeleteProduct)
- **API:** `apps/api/src/modules/products/products-controller.ts`, `repository.ts`
- **E2E:** `apps/admin/e2e/products.spec.ts` (smoke: heading, search, Reload).
