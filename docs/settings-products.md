# Settings/Products

## Overview

The Settings/Products page in the admin portal (`/settings/products`) lets admins view and search product definitions. It is read-only: list and view details only.

## What you can do

- View a paginated list of products (name, version, updated date).
- Search by product name (backend filters on workflow JSON text, e.g. type name).
- Reload the list.
- Open a product’s details (name, version, created/updated) in a dialog.

## UI

- **Toolbar:** Search input, Clear (when search has text), Reload button, count badge.
- **Table:** Product name (from workflow type), Version, Updated, Actions (View). Loading skeleton and empty state (“No products found”) match the documents table style.
- **Error:** If the list request fails, an error message appears above the table (same pattern as Organizations).
- **Pagination:** Previous/Next when there is more than one page.

## API

- **List:** `GET /v1/products?page=1&pageSize=10&search=...` (admin only). Returns `{ products, pagination }`.
- **One product:** `GET /v1/products/:id` (admin only).

Search is by product name only: backend filters on workflow JSON text (contains, case-insensitive). Typing in the search box matches text in the workflow (e.g. product type name). ID is not shown in the table or in the view dialog.

## Code locations

- **Page:** `apps/admin/src/app/settings/products/page.tsx`
- **List UI:** `apps/admin/src/app/settings/products/components/products-list.tsx`
- **Hook:** `apps/admin/src/app/settings/products/hooks/use-products.ts`
- **API:** `apps/api/src/modules/products/products-controller.ts`, `repository.ts`
- **E2E:** `apps/admin/e2e/products.spec.ts` (smoke: heading, search, Reload).
