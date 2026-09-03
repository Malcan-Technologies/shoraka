"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { OrganizationPartyProfileDto } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import {
  formatMasterPartyRoles,
  formatMismatchValue,
  partyMismatchFieldLabel,
} from "@/organizations/utils/organization-profile-overview";

export function OrganizationExternalReviewSheet({
  open,
  onOpenChange,
  parties,
  canManage,
  onKeep,
  onUseExternal,
  onAdopt,
  onInactivate,
  onOpenPerson,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parties: OrganizationPartyProfileDto[];
  canManage: boolean;
  onKeep: (partyId: string, field: string) => void;
  onUseExternal: (partyId: string, field: string) => void;
  onAdopt: (partyId: string) => void;
  onInactivate: (partyId: string) => void;
  onOpenPerson?: (partyId: string) => void;
}) {
  const newParties = parties.filter((party) => party.membershipStatus === "EXTERNAL_OBSERVED");
  const mismatchParties = parties.filter(
    (party) => party.membershipStatus !== "EXTERNAL_OBSERVED" && party.mismatches.length > 0
  );
  const absentParties = parties.filter(
    (party) => party.membershipStatus === "MASTER_ACTIVE" && party.absentFromLatestExternal
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Review external changes</SheetTitle>
          <SheetDescription>
            Compare latest CTOS values with the CashSouk master record. Adopting a value updates the
            same profile the issuer or investor sees.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {newParties.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-card-title">New external people</h3>
              {newParties.map((party) => (
                <div
                  key={party.id}
                  className={cn("space-y-3 rounded-xl border p-4", ADMIN_ACTION_SURFACE_CLASS)}
                >
                  <div>
                    <p className="text-ui font-medium">{party.name || party.partyKey}</p>
                    <p className="text-meta text-muted-foreground">
                      New {formatMasterPartyRoles(party)} detected in latest CTOS
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <Button className="h-10" onClick={() => onAdopt(party.id)}>
                        Add to master
                      </Button>
                      <Button className="h-10" variant="outline" onClick={() => onOpenChange(false)}>
                        Review later
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          {mismatchParties.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-card-title">Field differences</h3>
              {mismatchParties.map((party) => (
                <div key={party.id} className="space-y-3 rounded-xl border p-4">
                  <p className="text-ui font-medium">{party.name || party.partyKey}</p>
                  {party.mismatches.map((mismatch) => (
                    <MismatchBlock
                      key={mismatch.field}
                      field={mismatch.field}
                      masterValue={mismatch.masterValue}
                      externalValue={mismatch.externalValue}
                      canManage={canManage}
                      onKeep={() => onKeep(party.id, mismatch.field)}
                      onUseExternal={() => onUseExternal(party.id, mismatch.field)}
                    />
                  ))}
                  {onOpenPerson ? (
                    <Button variant="outline" className="h-10" onClick={() => onOpenPerson(party.id)}>
                      View person
                    </Button>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          {absentParties.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-card-title">Not present in latest CTOS</h3>
              {absentParties.map((party) => (
                <div
                  key={party.id}
                  className={cn("space-y-3 rounded-xl border p-4", ADMIN_ACTION_SURFACE_CLASS)}
                >
                  <div>
                    <p className="text-ui font-medium">{party.name || party.partyKey}</p>
                    <p className="flex items-center gap-1.5 text-meta text-status-action-text">
                      <ExclamationTriangleIcon className="h-4 w-4" />
                      Not present in latest CTOS
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <Button className="h-10" variant="outline" onClick={() => onOpenChange(false)}>
                        Keep current
                      </Button>
                      <Button className="h-10" variant="outline" onClick={() => onInactivate(party.id)}>
                        Mark inactive
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          {newParties.length === 0 && mismatchParties.length === 0 && absentParties.length === 0 ? (
            <p className="text-ui text-muted-foreground">No external changes need review.</p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MismatchBlock({
  field,
  masterValue,
  externalValue,
  canManage,
  onKeep,
  onUseExternal,
}: {
  field: string;
  masterValue: unknown;
  externalValue: unknown;
  canManage: boolean;
  onKeep: () => void;
  onUseExternal: () => void;
}) {
  const master = formatMismatchValue(field, masterValue);
  const external = formatMismatchValue(field, externalValue);
  return (
    <div className={cn("space-y-2 rounded-lg border p-3", ADMIN_ACTION_SURFACE_CLASS)}>
      <p className="text-ui font-medium">{partyMismatchFieldLabel(field)}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-meta text-muted-foreground">Current CashSouk</p>
          <p className="text-ui font-medium">{master}</p>
        </div>
        <div>
          <p className="text-meta text-muted-foreground">Latest CTOS</p>
          <p className="text-ui text-muted-foreground">{external}</p>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-meta text-status-action-text">
        <ExclamationTriangleIcon className="h-4 w-4" />
        Different from latest CTOS
      </p>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button className="h-10" variant="outline" onClick={onKeep}>
            Keep {master}
          </Button>
          <Button className="h-10" onClick={onUseExternal}>
            Use {external}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
