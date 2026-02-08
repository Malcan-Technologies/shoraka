/**
 * Invoice & Contract - Implementation notes (extracted)
 *
 * What existed (before invoice APIs removal)
 * -----------------------------------------
 *
 * 1) High-level responsibilities
 - Invoice module handled invoices lifecycle: create, read, update, delete, approve, reject.
 - Contract model carried capacity numbers in `contract_details`:
   - approved_facility
   - utilized_facility
   - available_facility
 - Invoices changed contract capacity on create/update/approve/reject/delete.

 2) Business rules / calculations
 - Max financing per invoice = 80% of invoice.value (maxFinancing = value * 0.8).
 - On invoice creation (when linked to a contract): available_facility was decremented by financeAmount.
 - On invoice update: compute diff between newFinanceAmount and oldFinanceAmount, then
   decrement available_facility by diff (if positive) or increment if negative (with validation).
 - On invoice deletion (if not APPROVED and has contract): available_facility was restored by financeAmount.
 - On invoice approval: utilized_facility was incremented by financeAmount.
 - On invoice rejection: available_facility was incremented by financeAmount.

 3) Access control & validation
 - verifyInvoiceAccess(invoiceId, userId): ensures invoice exists and user belongs to issuer org or owner.
 - verifyApplicationAccess(applicationId, userId): similar check for application.
 - verifyContractAccess(contractId, userId): ensures contract belongs to org and user is member/owner.
 - Facility limit checks throw AppError(400, "FACILITY_LIMIT_EXCEEDED") when exceeding available capacity.

 4) Document handling / S3 flow
 - requestUploadUrl generated versioned, application-scoped S3 keys:
   applications/{applicationId}/v{version}-{date}-{cuid}.{ext}
 - If existingS3Key provided, version was incremented (generateApplicationDocumentKeyWithVersion).
 - generatePresignedUploadUrl returned uploadUrl + s3Key + expiresIn.
 - deleteDocument removed S3 object via deleteS3Object.
 - Frontend would PUT file directly to presigned URL and then call deleteInvoiceDocument when replacing.

 5) Status transitions
 - Allowed statuses: DRAFT, SUBMITTED, APPROVED, REJECTED.
 - create -> DRAFT (default)
 - transitionInvoicesToSubmitted(applicationId): set draft invoices -> SUBMITTED
 - approveInvoice: only SUBMITTED -> APPROVED (updates utilized_facility)
 - rejectInvoice: only SUBMITTED -> REJECTED (restores available_facility)

 6) Repository methods (InvoiceRepository)
 - create(data)
 - findById(id) (included application & contract relations)
 - update(id, data)
 - delete(id)
 - findByApplicationId(applicationId)
 - findByContractId(contractId) -> filtered to status in ["SUBMITTED","APPROVED"]
 - updateStatus, updateManyStatus(ids, status)

 7) Frontend expectations (UI/UX)
 - InvoiceDetailsStep and Review step validated:
   - each invoice must have number, value>0, maturity_date, uploaded document
 - Total financing amount computed as sum(invoice.value * 0.8)
 - UI merged invoices from application and existing-contract avoiding duplicates (by id)
 - Upload flow:
   - Frontend created invoice (if temporary id) then requested upload URL and uploaded directly to S3
   - After upload, frontend informed backend to persist document/s3Key (via requestInvoiceUploadUrl / createInvoice)

 8) Endpoints (previously)
 - POST /v1/invoices
 - GET /v1/invoices/:id
 - PATCH /v1/invoices/:id
 - DELETE /v1/invoices/:id
 - GET /v1/invoices/by-application/:applicationId
 - GET /v1/invoices/by-contract/:contractId
 - PATCH /v1/invoices/:id/approve
 - PATCH /v1/invoices/:id/reject
 - POST /v1/invoices/:id/upload-url
 - DELETE /v1/invoices/:id/document

 9) Places to inspect (code references)
 - apps/api/src/modules/invoices/ (service/controller/repository/schemas) [REMOVED]
 - apps/api/src/modules/applications/service.ts
   - financing_structure handling (link/unlink contract; previously cleared invoice contract_id on invoice-only)
 - apps/api/src/modules/applications/repository.ts (previously included invoices relation)
 - packages/config/src/api-client.ts (client methods for /v1/invoices) [updated/removed]
 - apps/issuer/src/app/applications/steps/invoice-details-step.tsx (UI implementation, files upload flow)
 - apps/issuer/src/hooks/use-invoices.ts (hook) [REMOVED]

 Guidance for re-implementation
 ------------------------------
 - Data model: decide whether invoices remain first‑class DB model or become embedded within applications/contracts.
 - Concurrency: capacity updates must be transactional (prisma.$transaction) and use advisory locks to avoid races.
 - Ownership: keep verify*Access checks to ensure org-level security.
 - Document versioning: retain application-scoped keys + versioning strategy for auditability.
 - Status model: keep clear state machine (DRAFT -> SUBMITTED -> APPROVED/REJECTED) and enforce transitions.
 - Frontend contract: preserve the 80% business rule and validation requirements.

 End of notes.
*/

