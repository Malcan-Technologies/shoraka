# ProductAuditLog

Append-only Product lifecycle audit. This is the sole Product audit history.

Readers: `GET /v1/admin/product-logs` and `GET /v1/admin/product-logs/export` (table: `product_audit_logs`). Admin UI: `/audit?tab=products` (`ProductLogsPanel` + `ListToolbar`), permission `audit.product.view`. Live events: `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_INACTIVATED`, `PRODUCT_REACTIVATED`, `PRODUCT_DELETED`.

The legacy `ProductLog` model and `product_logs` table have been removed. There is no backfill; ProductAuditLog is the only writer/reader.

## Failed-create rollback

`POST /v1/products/:id/rollback-create` hard-deletes the Product row. It does **not** delete `ProductAuditLog`.

`PRODUCT_CREATED` / `PRODUCT_UPDATED` rows may remain for a `product_id` that no longer exists. Display uses `metadata.productName` (snapshot at event time), not a live Product row.

`PRODUCT_CREATE_ROLLED_BACK` is not emitted. Adding a dedicated rollback event remains a known design consideration.
