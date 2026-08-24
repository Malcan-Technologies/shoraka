"use client";

import {
  authorizedPartyReadOnlyBlocks,
  getOfferAcceptanceFromOfferDetails,
  type AuthorizedPartyGuarantorLookup,
} from "@cashsouk/types";

function guarantorsFromUnknown(value: unknown): AuthorizedPartyGuarantorLookup[] {
  if (!Array.isArray(value)) return [];
  const rows: AuthorizedPartyGuarantorLookup[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) continue;
    rows.push({
      id,
      name: typeof row.name === "string" ? row.name : null,
      business_name: typeof row.business_name === "string" ? row.business_name : null,
    });
  }
  return rows;
}

export function AuthorizedPartiesReadOnly({
  offerDetails,
  guarantors,
}: {
  offerDetails: unknown;
  guarantors?: unknown;
}) {
  const blocks = authorizedPartyReadOnlyBlocks(
    getOfferAcceptanceFromOfferDetails(offerDetails)?.authorized_parties,
    guarantorsFromUnknown(guarantors)
  );
  if (blocks.length === 0) return null;
  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <div key={block.key} className="space-y-2">
          <p className="text-ui font-medium text-foreground">{block.title}</p>
          <ul className="space-y-1.5">
            {block.representatives.map((representative, index) => (
              <li
                key={`${representative.email}-${index}`}
                className="text-ui text-foreground"
              >
                <span className="font-medium">{representative.name}</span>
                <span className="text-muted-foreground"> · {representative.capacity_label}</span>
                {representative.email ? (
                  <span className="block text-meta text-muted-foreground">
                    {representative.email}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
