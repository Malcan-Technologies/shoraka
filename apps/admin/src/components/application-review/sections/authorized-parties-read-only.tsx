"use client";

import {
  AUTHORIZED_REPRESENTATIVES_ITEM_TYPE,
  authorizedPartyReadOnlyBlocks,
  getOfferAcceptanceFromOfferDetails,
  groupAuthorizedPartyReadOnlyBlocks,
  type AuthorizedPartyGuarantorLookup,
  type AuthorizedPartyReadOnlyBlock,
  type ReviewItemType,
} from "@cashsouk/types";
import { ItemActionDropdown } from "../item-action-dropdown";
import { ReviewFieldBlock } from "../review-field-block";
import { ReviewStepStatusBadge } from "../review-step-status-badge";

function guarantorsFromUnknown(value: unknown): AuthorizedPartyGuarantorLookup[] {
  if (!Array.isArray(value)) return [];
  const rows: AuthorizedPartyGuarantorLookup[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) continue;
    const businessName =
      typeof row.business_name === "string"
        ? row.business_name
        : typeof row.businessName === "string"
          ? row.businessName
          : null;
    rows.push({
      id,
      client_guarantor_id:
        typeof row.client_guarantor_id === "string" ? row.client_guarantor_id : null,
      guarantor_type: row.guarantor_type === "company" ? "company" : row.guarantor_type === "individual" ? "individual" : null,
      name: typeof row.name === "string" ? row.name : null,
      business_name: businessName,
    });
  }
  return rows;
}

function PartyItemActions({
  block,
  status,
  isReviewable,
  approvePending,
  isActionLocked,
  actionLockTooltip,
  onApproveItem,
  onRequestAmendmentItem,
  onResetItemToPending,
}: {
  block: AuthorizedPartyReadOnlyBlock;
  status: string;
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  onApproveItem?: (itemId: string, itemType?: ReviewItemType) => Promise<void>;
  onRequestAmendmentItem?: (itemId: string, itemType?: ReviewItemType) => void;
  onResetItemToPending?: (itemId: string, itemType?: ReviewItemType) => void;
}) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {status !== "PENDING" ? (
        <ReviewStepStatusBadge
          status={status}
          size="sm"
          label={status === "AMENDMENT_REQUESTED" ? "Changes Requested" : undefined}
        />
      ) : null}
      {isReviewable && onApproveItem && onRequestAmendmentItem ? (
        <ItemActionDropdown
          itemId={block.review_item_id}
          status={status}
          isPending={approvePending}
          isActionLocked={isActionLocked}
          actionLockTooltip={actionLockTooltip}
          showReject={false}
          showRequestAmendment={status === "PENDING" || status === "APPROVED"}
          requestAmendmentLabel="Request change"
          onApprove={(itemId) => onApproveItem(itemId, "authorized_representatives")}
          onRequestAmendment={(itemId) =>
            onRequestAmendmentItem(itemId, "authorized_representatives")
          }
          onResetToPending={
            onResetItemToPending
              ? (itemId) => onResetItemToPending(itemId, "authorized_representatives")
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function RepresentativeLines({
  block,
}: {
  block: AuthorizedPartyReadOnlyBlock;
}) {
  return (
    <ul className="space-y-1.5">
      {block.representatives.map((representative, index) => (
        <li key={`${representative.email}-${index}`} className="text-ui text-foreground">
          <span className="font-medium">{representative.name}</span>
          {block.entity_kind === "ISSUER" ? (
            <span className="text-muted-foreground"> · {representative.capacity_label}</span>
          ) : null}
          {representative.email ? (
            <span className="block text-meta text-muted-foreground">{representative.email}</span>
          ) : null}
          {representative.ic_number ? (
            <span className="block text-meta text-muted-foreground">{representative.ic_number}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function AuthorizedPartiesReadOnly({
  offerDetails,
  guarantors,
  reviewItems = [],
  isReviewable = false,
  approvePending = false,
  isActionLocked,
  actionLockTooltip,
  onApproveItem,
  onRequestAmendmentItem,
  onResetItemToPending,
}: {
  offerDetails: unknown;
  guarantors?: unknown;
  reviewItems?: { item_type: string; item_id: string; status: string }[];
  isReviewable?: boolean;
  approvePending?: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  onApproveItem?: (itemId: string, itemType?: ReviewItemType) => Promise<void>;
  onRequestAmendmentItem?: (itemId: string, itemType?: ReviewItemType) => void;
  onResetItemToPending?: (itemId: string, itemType?: ReviewItemType) => void;
}) {
  const blocks = authorizedPartyReadOnlyBlocks(
    getOfferAcceptanceFromOfferDetails(offerDetails)?.authorized_parties,
    guarantorsFromUnknown(guarantors)
  );
  if (blocks.length === 0) return null;

  const statusById = new Map(
    reviewItems
      .filter((item) => item.item_type === AUTHORIZED_REPRESENTATIVES_ITEM_TYPE)
      .map((item) => [item.item_id, item.status])
  );
  const groups = groupAuthorizedPartyReadOnlyBlocks(blocks);

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const issuerBlock = group.entity_kind === "ISSUER" ? group.blocks[0] : null;
        const issuerStatus = issuerBlock
          ? (statusById.get(issuerBlock.review_item_id) ?? "PENDING")
          : "PENDING";
        return (
          <ReviewFieldBlock
            key={group.entity_kind}
            title={group.title}
            titleEnd={
              issuerBlock ? (
                <PartyItemActions
                  block={issuerBlock}
                  status={issuerStatus}
                  isReviewable={isReviewable}
                  approvePending={approvePending}
                  isActionLocked={isActionLocked}
                  actionLockTooltip={actionLockTooltip}
                  onApproveItem={onApproveItem}
                  onRequestAmendmentItem={onRequestAmendmentItem}
                  onResetItemToPending={onResetItemToPending}
                />
              ) : undefined
            }
          >
            <div className="space-y-4">
              {group.blocks.map((block, index) => {
                const status = statusById.get(block.review_item_id) ?? "PENDING";
                if (block.entity_kind === "ISSUER") {
                  return <RepresentativeLines key={block.key} block={block} />;
                }
                return (
                  <div
                    key={block.key}
                    className={index > 0 ? "space-y-2 border-t border-border pt-4" : "space-y-2"}
                  >
                    <div className="flex min-w-0 items-start gap-3 sm:items-center">
                      <div className="min-w-0 flex-1">
                        {block.entity_kind === "CORPORATE_GUARANTOR" ? (
                          <p className="text-ui font-medium text-foreground">{block.title}</p>
                        ) : null}
                        {block.entity_kind === "INDIVIDUAL_GUARANTOR" ? (
                          <RepresentativeLines block={block} />
                        ) : null}
                      </div>
                      <PartyItemActions
                        block={block}
                        status={status}
                        isReviewable={isReviewable}
                        approvePending={approvePending}
                        isActionLocked={isActionLocked}
                        actionLockTooltip={actionLockTooltip}
                        onApproveItem={onApproveItem}
                        onRequestAmendmentItem={onRequestAmendmentItem}
                        onResetItemToPending={onResetItemToPending}
                      />
                    </div>
                    {block.entity_kind === "CORPORATE_GUARANTOR" ? (
                      <RepresentativeLines block={block} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </ReviewFieldBlock>
        );
      })}
    </div>
  );
}
