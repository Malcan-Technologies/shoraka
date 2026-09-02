"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  PROFILE_VALUE_SOURCE_LABELS,
  type OrganizationDetailResponse,
  type OrganizationPartyProfileDto,
  type PortalType,
} from "@cashsouk/types";
import { IdentificationIcon } from "@heroicons/react/24/outline";
import { StatusBadge } from "@cashsouk/ui";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/use-permissions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function OrganizationRegulatoryPartiesPanel({
  org,
  portal,
  organizationId,
}: {
  org: OrganizationDetailResponse;
  portal: PortalType;
  organizationId: string;
}) {
  const { can } = usePermissions();
  const canManage = can("organizations.manage");
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const parties = org.partyProfiles ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "organization-detail", portal, organizationId] });

  const resolve = useMutation({
    mutationFn: async (input: { partyId: string; action: "KEEP" | "USE_EXTERNAL"; field: string }) => {
      const res = await api.resolvePartyMismatch(portal, organizationId, input.partyId, {
        action: input.action,
        field: input.field,
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Mismatch resolved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const adopt = useMutation({
    mutationFn: async (partyId: string) => {
      const res = await api.adoptObservedParty(portal, organizationId, partyId);
      if (!res.success) throw new Error(res.error.message);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Party added to the CashSouk master list");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const inactivate = useMutation({
    mutationFn: async (partyId: string) => {
      const res = await api.inactivateMasterParty(portal, organizationId, partyId);
      if (!res.success) throw new Error(res.error.message);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Party marked inactive on the master list");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (org.type !== "COMPANY") return null;

  return (
    <Card>
      <AdminDetailCardHeader
        icon={IdentificationIcon}
        title="Regulatory parties"
        description="CashSouk master list used for ComRep. CTOS and RegTank never overwrite these values unless you adopt a change."
      />
      <CardContent className="space-y-4">
        {org.profileCompleteness ? (
          <p className="text-ui text-muted-foreground">
            Profile completeness {org.profileCompleteness.percent}%
            {org.profileCompleteness.complete ? " — complete" : " — missing required fields"}
          </p>
        ) : null}
        {parties.length === 0 ? (
          <p className="text-ui text-muted-foreground">No regulatory parties stored yet. They seed from CTOS (all shareholders, including below 5%) or from RegTank when CTOS is empty.</p>
        ) : null}
        {parties.map((party) => (
          <PartyCard
            key={party.id}
            party={party}
            canManage={canManage}
            onKeep={(field) => resolve.mutate({ partyId: party.id, action: "KEEP", field })}
            onUseExternal={(field) => resolve.mutate({ partyId: party.id, action: "USE_EXTERNAL", field })}
            onAdopt={() => adopt.mutate(party.id)}
            onInactivate={() => inactivate.mutate(party.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function PartyCard({
  party,
  canManage,
  onKeep,
  onUseExternal,
  onAdopt,
  onInactivate,
}: {
  party: OrganizationPartyProfileDto;
  canManage: boolean;
  onKeep: (field: string) => void;
  onUseExternal: (field: string) => void;
  onAdopt: () => void;
  onInactivate: () => void;
}) {
  const status =
    party.membershipStatus === "EXTERNAL_OBSERVED"
      ? { key: "action" as const, label: "New from CTOS" }
      : party.absentFromLatestExternal
        ? { key: "action" as const, label: "Absent from latest CTOS" }
        : party.membershipStatus === "MASTER_INACTIVE"
          ? { key: "neutral" as const, label: "Inactive" }
          : { key: "completed" as const, label: "Master" };

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-ui font-medium">{party.name || party.partyKey}</p>
          <p className="text-meta text-muted-foreground">
            {party.entityType} · {party.isDirector ? "Director" : ""}
            {party.isDirector && party.isShareholder ? " · " : ""}
            {party.isShareholder ? "Shareholder" : ""}
            {party.isManagement ? " · Management" : ""}
          </p>
        </div>
        <StatusBadge status={status.key} label={status.label} />
      </div>
      <p className="text-meta text-muted-foreground">
        Sources:{" "}
        {Object.entries(party.fieldSources)
          .slice(0, 6)
          .map(([field, src]) => `${field} (${PROFILE_VALUE_SOURCE_LABELS[src.source]})`)
          .join(", ") || "—"}
      </p>
      {party.mismatches.length > 0 ? (
        <div className="space-y-2">
          {party.mismatches.map((mismatch) => (
            <div key={mismatch.field} className="rounded-lg border border-status-action-text/20 bg-status-action-bg/40 p-3">
              <p className="text-ui">
                {mismatch.field}: master “{String(mismatch.masterValue ?? "")}” vs CTOS “{String(mismatch.externalValue ?? "")}”
              </p>
              {canManage ? (
                <div className="mt-2 flex gap-2">
                  <Button className="h-10" variant="outline" onClick={() => onKeep(mismatch.field)}>
                    Keep master
                  </Button>
                  <Button className="h-10" onClick={() => onUseExternal(mismatch.field)}>
                    Use CTOS
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {canManage && party.membershipStatus === "EXTERNAL_OBSERVED" ? (
        <Button className="h-10" onClick={onAdopt}>
          Add to master list
        </Button>
      ) : null}
      {canManage && party.absentFromLatestExternal && party.membershipStatus === "MASTER_ACTIVE" ? (
        <Button className="h-10" variant="outline" onClick={onInactivate}>
          Mark inactive
        </Button>
      ) : null}
    </div>
  );
}
