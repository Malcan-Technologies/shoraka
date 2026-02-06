# Settings – Products (simple guide)

This page is for the **Products** screen in the admin app. It’s where you see the list of products, create new ones, and edit them.

---

## What you see

- A **list** of products (name, version, when it was updated).
- A **search** box (search by product name).
- Buttons: **Create product**, **Reload**.
- Each row has **Actions**: View, Edit, Delete. **Edit** opens the same big popup as Create.

---

## What the popup is (Create / Edit)

When you click **Create product** or **Edit**, a big dialog opens. Inside it you see **workflow steps** as cards. You can:

- **Drag** cards to change the order.
- **Expand** a card to fill in its form (name, category, image, documents, etc.).
- **Add** more steps with the “Add step” dropdown.
- **Save** when everything required is filled. If something is missing, an orange box tells you what to fix.

The first step is always “Financing Type.” The last is always “Review And Submit.” You can’t remove those. The rest you can add, remove, and reorder.

---

## What happens when you click Save

- **Create:** The app sends the list of steps (workflow) to the API. The API saves it and gives the product version 1.
- **Edit:** The app sends the new workflow. The API replaces the old one and bumps the version number.

So: whatever you see in the dialog (steps + their config) is what gets saved. It’s stored as JSON in the database.

---

## Required fields (why Save is disabled)

Save stays disabled until:

- **Financing Type:** name, category, description, and an image.
- **Supporting Documents:** at least one category, and every category must have at least one document; every document must have a name.
- **Declarations:** at least one declaration, and each must have text.

If something is missing, the orange box above the buttons lists the problems (e.g. “Financing Type: enter name”).

---

## Images and files (S3)

- **Financing Type** image: you pick a PNG (max 5MB). It uploads when you click Save.
- **Supporting Documents** templates: you can attach a PDF per document (max 5MB). They upload when you click Save.

The app first asks the API for an upload URL, then uploads the file, then saves the workflow with the new file key. All of that happens on Save.

---

## API (for developers)

- List: `GET /v1/products?page=1&pageSize=10&search=...`
- One product: `GET /v1/products/:id`
- Create: `POST /v1/products` with body `{ workflow: [...] }`
- Update: `PATCH /v1/products/:id` with body `{ workflow: [...] }`

Search is by product name (the backend looks inside the workflow JSON). The workflow is an array of steps. Each step has `id`, `name`, and `config`. The first step’s config has category, name, description, image. Other steps have different config shapes (see the rest of the codebase or the validation rules above).

---

## How to add a new workflow step

To add a new step (e.g. “Terms and Conditions”) to the product workflow:

1. **Types** – In `packages/types/src/application-steps.ts`, add your key to `APPLICATION_STEP_KEYS` and an entry in `STEP_KEY_DISPLAY` (title + description).
2. **Registry** – In `apps/admin/.../workflow-registry.tsx`, either add the key to `STEPS_WITHOUT_CONFIG` (no form) or create a config component and add it to `STEP_CONFIG_MAP` (has a form).
3. **Optional** – In `product-form-helpers.ts`, add validation in `getRequiredStepErrors()` and/or a default in `buildPayloadFromSteps()` if needed.

Full step-by-step with code examples: **docs/guides/add-a-product-workflow-step.md**.

---

## Where the code lives

- **Products page:** `apps/admin/src/app/settings/products/page.tsx`
- **List (table, toolbar):** `apps/admin/src/app/settings/products/components/products-list.tsx`
- **Create/Edit popup:** `apps/admin/src/app/settings/products/workflow-builder/product-form-dialog.tsx`
- **Step cards (drag, expand):** `apps/admin/src/app/settings/products/workflow-builder/workflow-step-card.tsx`
- **Step forms:** `apps/admin/src/app/settings/products/workflow-builder/step-configs/` (one file per step that has a form)
- **Wiring (which step has a form):** `apps/admin/src/app/settings/products/workflow-builder/workflow-registry.tsx`
- **Validation and payload for Save:** `apps/admin/src/app/settings/products/workflow-builder/product-form-helpers.ts`
- **Data (fetch, create, update):** `apps/admin/src/app/settings/products/hooks/use-products.ts`
- **Backend:** `apps/api/src/modules/products/` (controller, repository)
- **Product logs (audit):** `apps/api/src/modules/products/product-log.ts` — builds metadata; controller writes a row on create/update/delete.

---

## Product logs (audit) – when and what metadata

Every create, update, or delete of a product writes one row to `product_logs`. The **metadata** column stores a JSON object. Its shape is the same as the product: a **workflow** snapshot plus a few top-level fields.

### When each log is written

| Event              | When it runs                          |
|--------------------|----------------------------------------|
| `PRODUCT_CREATED`  | Right after `POST /v1/products` succeeds. |
| `PRODUCT_UPDATED`  | Right after `PATCH /v1/products/:id` succeeds. |
| `PRODUCT_DELETED`  | Right before the product row is deleted (`DELETE /v1/products/:id`). |

### What is always in metadata

| Field     | Type   | Meaning |
|-----------|--------|--------|
| `workflow` | array  | Snapshot of the product’s workflow at that moment. Same structure as when you create/edit: `[{ id: "financing_type_0", config: { name, category, ... } }, ...]`. Product name is always in the first step (financing type): `workflow[0].config.name` or `workflow[0].config.type.name`. |
| `version`  | number | Product version when the log was written (1 on create, then 2, 3, …). |

### Also in metadata

| Field                 | Type   | Meaning |
|-----------------------|--------|--------|
| `product_created_at` | string | ISO date of the product’s `created_at`. |
| `product_updated_at` | string | ISO date of the product’s `updated_at`. |

### Example metadata shapes

**PRODUCT_CREATED**:

```json
{
  "workflow": [
    { "id": "financing_type_0", "config": { "name": "Invoice Financing", "category": "invoice", "description": "...", "image": { "s3_key": "products/..." } } },
    { "id": "supporting_documents_1", "config": { ... } },
    { "id": "declarations_2", "config": { ... } },
    { "id": "review_and_submit_3", "config": {} }
  ],
  "version": 1,
  "product_created_at": "2025-02-03T10:00:00.000Z",
  "product_updated_at": "2025-02-03T10:00:00.000Z"
}
```

**PRODUCT_UPDATED**:

```json
{
  "workflow": [ { "id": "financing_type_0", "config": { "name": "Invoice Financing (Revised)", ... } }, ... ],
  "version": 2,
  "product_created_at": "2025-02-03T10:00:00.000Z",
  "product_updated_at": "2025-02-03T11:30:00.000Z"
}
```

**PRODUCT_DELETED** (workflow is the product’s last state):

```json
{
  "workflow": [ ... ],
  "version": 2,
  "product_created_at": "2025-02-03T10:00:00.000Z",
  "product_updated_at": "2025-02-03T11:30:00.000Z"
}
```

Product name is not stored in metadata; the UI and exports derive it from `metadata.workflow[0].config.name` (or `config.type.name`). The first step is always the financing type and always has a name.
