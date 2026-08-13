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
- **Supporting Documents** optional templates: you can attach a **PDF or Excel** file per document (max 5MB). They upload when you click Save. Issuers still upload **only one** file type per document row (PDF **or** Excel), which you pick in the workflow.

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
- **Product audit:** `apps/api/src/modules/products/audit/` writes `ProductAuditLog` (`product_audit_logs`). Admin UI: `/audit?tab=products`. See `docs/audit/product-audit-log.md`.

---

## Product audit

Product create, versioned update, in-place `completeCreate` update, inactivate, reactivate, and soft-delete write append-only `ProductAuditLog` rows (not `product_logs`; that table has been removed).

Events: `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_INACTIVATED`, `PRODUCT_REACTIVATED`, `PRODUCT_DELETED`.

Readers: `GET /v1/admin/product-logs` and `/export`. Product name is `metadata.productName` (snapshot at event time). Failed-create rollback hard-deletes the Product row and does not delete audit history.

