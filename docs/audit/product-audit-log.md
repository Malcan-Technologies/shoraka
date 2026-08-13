# ProductAuditLog (Phase 1)

Append-only Product lifecycle audit. Readers use `GET /v1/admin/product-logs` backed by `product_audit_logs`.

## Known limitation: failed-create rollback

`POST /v1/products/:id/rollback-create` hard-deletes the Product row (and leftover legacy `product_logs`). It does **not** delete `ProductAuditLog`.

`PRODUCT_CREATED` / `PRODUCT_UPDATED` rows may remain for a `product_id` that no longer exists. Display uses `metadata.productName` (snapshot at event time), not a live Product row.

A dedicated rollback audit event is out of scope for Phase 1.
