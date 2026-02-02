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

## API

- **List:** `GET /v1/products?page=1&pageSize=10&search=...` (admin only). Returns `{ products, pagination }`.
- **One product:** `GET /v1/products/:id` (admin only).

Search is by product name only: backend filters on workflow JSON text (contains, case-insensitive). Typing in the search box matches text in the workflow (e.g. product type name). ID is not shown in the table or in the view dialog.

## Code locations

- **Page:** `apps/admin/src/app/settings/products/page.tsx`
- **List UI:** `apps/admin/src/app/settings/products/components/products-list.tsx`
- **Workflow builder (Create/Edit popup):** `apps/admin/src/app/settings/products/workflow-builder/` — `product-form-dialog.tsx` (same UI for create and edit), `workflow-step-card.tsx` (draggable step card)
- **Shared utils:** `apps/admin/src/app/settings/products/product-utils.ts` (productName, workflowWithName, stepDisplayName, getDefaultWorkflowSteps)
- **Hook:** `apps/admin/src/app/settings/products/hooks/use-products.ts` (useProducts, useProduct, useCreateProduct, useUpdateProduct, useDeleteProduct)
- **API:** `apps/api/src/modules/products/products-controller.ts`, `repository.ts`
- **E2E:** `apps/admin/e2e/products.spec.ts` (smoke: heading, search, Reload).
