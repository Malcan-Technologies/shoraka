"use client";

import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  SC_DESIGNATION_LABELS,
  SC_GENDER_LABELS,
  SC_IDENTITY_PREFIX_LABELS,
  SC_SHARE_TYPE_LABELS,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formInputDisabledClassName } from "@/app/(application-flow)/applications/components/form-control";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">{label}</Label>
      <Input value={value || "—"} disabled className={formInputDisabledClassName} />
    </div>
  );
}

function PartyFields({ party }: { party: OrganizationPartyProfileDto }) {
  const shareType =
    party.shareType && party.shareType in SC_SHARE_TYPE_LABELS
      ? SC_SHARE_TYPE_LABELS[party.shareType]
      : party.shareType;
  const designation =
    party.designation && party.designation in SC_DESIGNATION_LABELS
      ? SC_DESIGNATION_LABELS[party.designation]
      : party.designation;
  const gender =
    party.gender && party.gender in SC_GENDER_LABELS ? SC_GENDER_LABELS[party.gender] : party.gender;
  const prefix =
    party.identityPrefix && party.identityPrefix in SC_IDENTITY_PREFIX_LABELS
      ? SC_IDENTITY_PREFIX_LABELS[party.identityPrefix]
      : party.identityPrefix;
  const roles = [
    party.isShareholder ? "Shareholder" : null,
    party.isDirector || party.isBoard ? "Board" : null,
    party.isManagement ? "Management" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <p className="text-ui font-medium">
        {party.name || party.partyKey}
        {roles.length > 0 ? ` · ${roles.join(" · ")}` : ""}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ReadField label="Identity prefix" value={prefix || "—"} />
        <ReadField label="Identity number" value={party.identityNumber || "—"} />
        <ReadField label="Gender" value={gender || "—"} />
        <ReadField label="Nationality" value={party.nationality || "—"} />
        <ReadField label="Date of birth" value={formatDate(party.dateOfBirth)} />
        <ReadField label="Date of incorporation" value={formatDate(party.dateOfIncorporation)} />
        <ReadField label="Address" value={party.address?.line1 || "—"} />
        <ReadField label="State" value={party.address?.state || "—"} />
        <ReadField label="Postcode" value={party.address?.postalCode || "—"} />
        {party.isShareholder ? (
          <>
            <ReadField label="Type of shares" value={shareType || "—"} />
            {party.shareType === "OTHERS" ? (
              <ReadField label="Type of shares — others" value={party.shareTypeOther || "—"} />
            ) : null}
            <ReadField label="Shareholding units" value={party.shareholdingUnits || "—"} />
            <ReadField label="Shareholding amount" value={party.shareholdingAmount || "—"} />
            <ReadField label="Shareholding percentage" value={party.shareholdingPercentage || "—"} />
          </>
        ) : null}
        {party.isBoard || party.isManagement || party.isDirector ? (
          <>
            <ReadField label="Designation" value={designation || "—"} />
            {party.designation === "OTHERS" ? (
              <ReadField label="Designation — others" value={party.designationOther || "—"} />
            ) : null}
            <ReadField label="Appointment date" value={formatDate(party.appointmentDate)} />
          </>
        ) : null}
      </div>
    </div>
  );
}

export function IssuerMasterPartiesCard({ organizationId }: { organizationId: string }) {
  const { getAccessToken } = useAuthToken();
  const api = createApiClient(API_URL, getAccessToken);
  const query = useQuery({
    queryKey: ["issuer", "party-profiles", organizationId],
    queryFn: async () => {
      const res = await api.getPartyProfiles("issuer", organizationId);
      if (!res.success) throw new Error(res.error.message);
      return res.data.filter((p) => p.membershipStatus === "MASTER_ACTIVE");
    },
  });

  const parties = query.data ?? [];

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold">ComRep shareholders and board</h2>
        <p className="text-sm text-muted-foreground">
          CashSouk master list used for reporting. CTOS percentages and identity stay read-only here.
        </p>
      </div>
      <div className="p-6 space-y-4">
        {query.isLoading ? <p className="text-ui text-muted-foreground">Loading…</p> : null}
        {!query.isLoading && parties.length === 0 ? (
          <p className="text-ui text-muted-foreground">No master parties stored yet.</p>
        ) : null}
        {parties.map((party) => (
          <PartyFields key={party.id} party={party} />
        ))}
      </div>
    </div>
  );
}
