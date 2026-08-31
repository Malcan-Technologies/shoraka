/**
 * Declares the audit presentation surface: everything that reads audit rows, formats them into
 * titles/descriptions/remarks, decides who may see them, or exports them.
 *
 * The audit standardization is writer-side only. Nothing here may change, so the parity test hashes
 * these files against the reference revision. Adding a genuinely new presentation file is a product
 * change and must be added here deliberately.
 */

/** Files that must be byte-identical to the reference revision. */
export const PRESENTATION_FILES: string[] = [
  // API readers: audit rows to API responses
  "apps/api/src/modules/activity/controller.ts",
  "apps/api/src/modules/activity/service.ts",
  "apps/api/src/modules/activity/aggregator.ts",
  "apps/api/src/modules/activity/schemas.ts",
  "apps/api/src/modules/activity/adapters/base.ts",
  "apps/api/src/modules/activity/adapters/application-log.ts",
  "apps/api/src/modules/activity/adapters/organization-log.ts",
  "apps/api/src/modules/activity/adapters/note-log.ts",
  "apps/api/src/modules/applications/controller.ts",
  "apps/api/src/modules/applications/service.ts",
  "apps/api/src/modules/admin/controller.ts",
  "apps/api/src/modules/admin/schemas.ts",
  "apps/api/src/modules/products/log/controller.ts",
  "apps/api/src/modules/products/log/service.ts",
  "apps/api/src/modules/products/service.ts",
  "apps/api/src/modules/products/schemas.ts",
  "apps/api/src/modules/legal-documents/audit-admin-controller.ts",
  "apps/api/src/modules/legal-documents/audit-admin-service.ts",
  "apps/api/src/modules/legal-documents/acceptance-admin-controller.ts",
  "apps/api/src/modules/legal-documents/acceptance-admin-service.ts",
  "apps/api/src/modules/legal-documents/schemas.ts",
  "apps/api/src/modules/notification/controller.ts",
  "apps/api/src/modules/payment/admin-service.ts",
  "apps/api/src/modules/payment/admin-schemas.ts",
  "apps/api/src/modules/notes/controller.ts",
  "apps/api/src/modules/notes/repository.ts",
  "apps/api/src/modules/notes/mapper.ts",
  "apps/api/src/modules/notes/investor-balance-activity.ts",
  "apps/api/src/modules/notes/investor-balance-statement.ts",
  "apps/api/src/modules/notes/admin-note-events-sorting.ts",
  "apps/api/src/modules/applications/revision-snapshot.ts",
  "apps/api/src/modules/application-revision-diff/index.ts",
  "apps/api/src/modules/signing/mapper.ts",
  "apps/api/src/modules/signing/repository.ts",
  "apps/api/src/modules/signing/schemas.ts",

  // Shared presentation contracts
  "packages/types/src/activity-config.ts",
  "packages/types/src/activity-presentation.ts",
  "packages/types/src/investor-balance-activity.ts",
  "packages/types/src/admin.ts",
  "packages/types/src/notes.ts",
  "packages/types/src/legal-documents.ts",
  "packages/types/src/gateway-payments.ts",
  "packages/types/src/signing-envelopes.ts",
  "packages/types/src/index.ts",
  "packages/types/src/rbac.ts",
  "packages/config/src/api-client.ts",
  "packages/ui/src/components/activity-feed.tsx",
  "packages/ui/src/components/activity-item.tsx",
  "packages/ui/src/components/activity-badge.tsx",
  "packages/ui/src/components/activity-toolbar.tsx",

  // Admin formatting, visibility and CSV
  "apps/admin/src/components/admin-timeline-format.ts",
  "apps/admin/src/components/admin-timeline-originator.ts",
  "apps/admin/src/components/organization-activity-timeline-details.ts",
  "apps/admin/src/components/admin-activity-csv.ts",
  "apps/admin/src/components/admin-vertical-timeline.tsx",
  "apps/admin/src/components/audit/audit-presentation.ts",
  "apps/admin/src/components/audit/audit-csv.ts",
  "apps/admin/src/components/audit/audit-detail-model.ts",
  "apps/admin/src/components/audit/audit-adapters.ts",
  "apps/admin/src/components/audit/audit-detail-drawer.tsx",
  "apps/admin/src/components/audit/audit-metadata-view.tsx",
  "apps/admin/src/components/audit/audit-before-after-diff.tsx",
  "apps/admin/src/components/audit/audit-actor-badge.tsx",
  "apps/admin/src/components/audit/audit-source-badge.tsx",
  "apps/admin/src/components/audit/audit-event-badge.tsx",
  "apps/admin/src/components/audit/audit-log-shell.tsx",
  "apps/admin/src/components/audit/audit-log-filters.tsx",
  "apps/admin/src/components/audit/audit-log-actor-cell.tsx",
  "apps/api/src/lib/audit-csv.ts",
  "apps/admin/src/components/admin-activity-timeline.tsx",
  "apps/admin/src/components/organization-activity-timeline.tsx",
  "apps/admin/src/components/application-review/recent-activity-card.tsx",
  "apps/admin/src/components/application-revision-diff-panel.tsx",
  "apps/admin/src/components/resubmit-comparison-modal.tsx",
  "apps/admin/src/components/admin-activity-csv-export-button.tsx",
  "apps/admin/src/components/access-logs-export-button.tsx",
  "apps/admin/src/components/onboarding-logs-export-button.tsx",
  "apps/admin/src/components/access-logs-table.tsx",
  "apps/admin/src/components/access-log-table-row.tsx",
  "apps/admin/src/components/access-log-details-dialog.tsx",
  "apps/admin/src/components/access-logs-toolbar.tsx",
  "apps/admin/src/components/audit/access-logs-panel.tsx",
  "apps/admin/src/components/audit/security-logs-panel.tsx",
  "apps/admin/src/components/audit/product-logs-panel.tsx",
  "apps/admin/src/components/audit/legal-document-audit-panel.tsx",
  "apps/admin/src/components/audit/legal-acceptances-panel.tsx",
  "apps/admin/src/components/audit/legal-external-acceptances-panel.tsx",
  "apps/admin/src/components/audit/notification-logs-panel.tsx",
  "apps/admin/src/notes/utils/note-timeline-details.ts",
  "apps/admin/src/notes/utils/note-activity-csv.ts",
  "apps/admin/src/notes/components/note-timeline-panel.tsx",
  "apps/admin/src/contracts/utils/contract-activity-csv.ts",
  "apps/admin/src/contracts/components/contract-activity-panel.tsx",
  "apps/admin/src/contracts/hooks/use-contract-detail.ts",
  "apps/admin/src/organizations/components/organization-wallet-activity.ts",
  "apps/admin/src/organizations/components/organization-wallet-activity-panel.tsx",
  "apps/admin/src/app/finance/gateway-payments/[id]/gateway-payment-copy.ts",
  "apps/admin/src/app/audit/page.tsx",
  "apps/admin/src/hooks/use-access-logs.ts",
  "apps/admin/src/hooks/use-security-logs.ts",
  "apps/admin/src/hooks/use-onboarding-logs.ts",
  "apps/admin/src/hooks/use-product-logs.ts",
  "apps/admin/src/hooks/use-organization-logs.ts",
  "apps/admin/src/hooks/use-application-logs.ts",
  "apps/admin/src/hooks/use-legal-document-audit-logs.ts",
  "apps/admin/src/hooks/use-legal-document-acceptances.ts",
  "apps/admin/src/hooks/use-legal-external-acceptances.ts",

  // Issuer and investor activity surfaces
  "apps/issuer/src/app/(application-management)/applications/components/application-timeline.ts",
  "apps/issuer/src/components/financing/facility-transactions.ts",
  "apps/issuer/src/components/activity/issuer-activity-list.tsx",
  "apps/issuer/src/hooks/use-activities.ts",
  "apps/issuer/src/hooks/use-application-logs.ts",
  "apps/investor/src/app/activity/page.tsx",
  "apps/investor/src/hooks/use-activities.ts",
  "apps/investor/src/app/transactions/components/transaction-utils.ts",
  "apps/investor/src/app/transactions/components/statement-dialog.tsx",
];

/**
 * Files where a standardized writer sits beside a reader or exporter. The whole file cannot be
 * hashed, so the reader/exporter blocks are hashed individually.
 */
export const MIXED_FILE_READERS: Record<string, string[]> = {
  "apps/api/src/modules/admin/repository.ts": [
    "getAccessLogs",
    "getSecurityLogs",
    "getOnboardingLogs",
  ],
  "apps/api/src/modules/admin/service.ts": [
    "getSecurityLogs",
    "exportAccessLogs",
    "exportSecurityLogs",
    "exportOnboardingLogs",
  ],
  "apps/api/src/modules/products/repository.ts": ["findForExport"],
  "apps/api/src/modules/notes/service.ts": [
    "listEvents",
    "listInvestorBalanceActivity",
    "listInvestorBalanceActivityForOrganizations",
    "exportInvestorBalanceStatement",
  ],
  "apps/api/src/modules/notification/service.ts": ["getAdminLogs"],
  "apps/api/src/modules/payment/gateway-events.ts": [
    "mapGatewayPaymentEvent",
    "getOpenOverrideProposal",
  ],
};

/**
 * Slices out named function or method blocks by brace balance, starting at the declaration line.
 * Returns only the blocks that were found so a caller can report absences explicitly.
 */
export function extractNamedBlocks(source: string, names: string[]): Record<string, string> {
  const blocks: Record<string, string> = {};
  for (const name of names) {
    const declaration = new RegExp(
      `^\\s*(?:export\\s+)?(?:public\\s+|private\\s+|protected\\s+)?(?:async\\s+)?(?:function\\s+)?${name}\\s*[(<]`,
      "m"
    );
    const match = declaration.exec(source);
    if (!match) continue;
    const bodyStart = source.indexOf("{", match.index + match[0].length - 1);
    if (bodyStart === -1) continue;
    let depth = 0;
    let end = -1;
    for (let i = bodyStart; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    blocks[name] = source.slice(match.index, end + 1);
  }
  return blocks;
}
