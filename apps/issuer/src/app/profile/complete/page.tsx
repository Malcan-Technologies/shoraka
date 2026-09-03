"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import {
  groupPeopleMissingByParty,
  ISSUER_FINANCIAL_COMREP_KEYS,
  ISSUER_FINANCIAL_COMREP_LABELS,
  ISSUER_PROFILE_FLOW_STEP_IDS,
  ISSUER_PROFILE_FLOW_STEP_LABELS,
  issuerFlowStepComplete,
  missingItemsForIssuerFlowStep,
  SC_COMPANY_TYPE_LABELS,
  SC_COMPANY_TYPES,
  SC_DESIGNATION_LABELS,
  SC_DESIGNATIONS,
  SC_GENDER_LABELS,
  SC_GENDERS,
  SC_IDENTITY_PREFIX_LABELS,
  SC_IDENTITY_PREFIXES,
  SC_MALAYSIAN_STATES,
  SC_PERSON_KIND_LABELS,
  SC_PERSON_KINDS,
  SC_SHARE_TYPE_LABELS,
  SC_SHARE_TYPES,
  type ComrepProfileCompleteness,
  type IssuerProfileFlowStepId,
  type OrganizationPartyProfileDto,
  type ProfileMissingItem,
} from "@cashsouk/types";
import { OnboardingStepper, PageShell, StickyFormFooter } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function isFlowStep(value: string | null): value is IssuerProfileFlowStepId {
  return Boolean(value && (ISSUER_PROFILE_FLOW_STEP_IDS as readonly string[]).includes(value));
}

export default function IssuerProfileCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeOrganization, refreshOrganizations } = useOrganization();
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const orgId = activeOrganization?.id;

  const completenessQuery = useQuery({
    queryKey: ["issuer", "profile-completeness", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const res = await api.getProfileCompleteness("issuer", orgId!);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
  const partiesQuery = useQuery({
    queryKey: ["issuer", "party-profiles", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const res = await api.getPartyProfiles("issuer", orgId!);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  const completeness = completenessQuery.data;
  const requestedStep = searchParams.get("step");
  const firstIncomplete =
    ISSUER_PROFILE_FLOW_STEP_IDS.find(
      (id) => id !== "review" && !issuerFlowStepComplete(completeness, id)
    ) ?? "review";
  const [step, setStep] = React.useState<IssuerProfileFlowStepId>(
    isFlowStep(requestedStep) ? requestedStep : firstIncomplete
  );

  React.useEffect(() => {
    if (isFlowStep(requestedStep)) setStep(requestedStep);
  }, [requestedStep]);

  const goToStep = (id: IssuerProfileFlowStepId) => {
    setStep(id);
    router.replace(`/profile/complete?step=${id}`, { scroll: false });
  };

  const stepIndex = ISSUER_PROFILE_FLOW_STEP_IDS.indexOf(step);
  const stepperSteps = ISSUER_PROFILE_FLOW_STEP_IDS.map((id) => ({
    id,
    label: ISSUER_PROFILE_FLOW_STEP_LABELS[id],
    isCompleted: issuerFlowStepComplete(completeness, id),
    isCurrent: id === step,
  }));

  const saveMaster = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.patchMasterProfile("issuer", orgId!, data);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issuer", "profile-completeness", orgId] });
      await refreshOrganizations();
      toast.success("Saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!orgId) {
    return (
      <PageShell title="Complete your profile">
        <p className="text-ui">Select an organization first.</p>
      </PageShell>
    );
  }

  if (completenessQuery.isLoading) {
    return (
      <PageShell title="Complete your profile">
        <p className="text-ui text-muted-foreground">Loading…</p>
      </PageShell>
    );
  }

  if (completeness?.complete) {
    return (
      <PageShell title="Complete your profile">
        <div className={`${issuerPageGutterClassName} ${issuerMainContentClassName} space-y-6`}>
          <p className="text-ui">Your profile is complete.</p>
          <Button className="h-10" onClick={() => router.push("/profile")}>
            Back to profile
          </Button>
        </div>
      </PageShell>
    );
  }

  const companyMissing = missingItemsForIssuerFlowStep(completeness, "company");
  const peopleMissing = missingItemsForIssuerFlowStep(completeness, "people");
  const financialMissing = missingItemsForIssuerFlowStep(completeness, "financials");

  return (
    <PageShell title="Complete your profile">
      <div className={`${issuerPageGutterClassName} ${issuerMainContentClassName} space-y-8 pb-28`}>
        <div className="grid gap-2 sm:grid-cols-4">
          {ISSUER_PROFILE_FLOW_STEP_IDS.map((id) => {
            const count =
              id === "company"
                ? companyMissing.length
                : id === "people"
                  ? peopleMissing.length
                  : id === "financials"
                    ? financialMissing.length
                    : completeness?.missing.length ?? 0;
            return (
              <button
                key={id}
                type="button"
                className={`rounded-xl border px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  id === step ? "border-primary bg-primary/5" : "bg-card"
                }`}
                onClick={() => goToStep(id)}
              >
                <p className="text-ui font-medium">{ISSUER_PROFILE_FLOW_STEP_LABELS[id]}</p>
                <p className="text-meta text-muted-foreground">
                  {id === "review"
                    ? completeness?.complete
                      ? "Ready"
                      : "Remaining items"
                    : count === 0
                      ? "Complete"
                      : `${count} missing`}
                </p>
              </button>
            );
          })}
        </div>
        <OnboardingStepper steps={stepperSteps} onStepClick={(id) => isFlowStep(id) && goToStep(id)} />
        {step === "company" ? (
          <CompanyStep
            org={activeOrganization}
            missing={companyMissing}
            onSave={(data) => saveMaster.mutateAsync(data)}
          />
        ) : null}
        {step === "people" ? (
          <PeopleStep
            parties={(partiesQuery.data ?? []).filter((party) => party.membershipStatus === "MASTER_ACTIVE")}
            missing={peopleMissing}
            orgId={orgId}
            api={api}
            onSaved={async () => {
              await queryClient.invalidateQueries({ queryKey: ["issuer", "party-profiles", orgId] });
              await queryClient.invalidateQueries({ queryKey: ["issuer", "profile-completeness", orgId] });
            }}
          />
        ) : null}
        {step === "financials" ? (
          <FinancialsStep
            orgId={orgId}
            api={api}
            missing={financialMissing}
            onSaved={async () => {
              await queryClient.invalidateQueries({ queryKey: ["issuer", "profile-completeness", orgId] });
            }}
          />
        ) : null}
        {step === "review" ? (
          <div className="space-y-4">
            <h2 className="text-section-title">Review</h2>
            {(completeness?.missing ?? []).length === 0 ? (
              <p className="text-ui">All required profile fields are complete.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-ui">
                {(completeness?.missing ?? []).map((item) => (
                  <li key={`${item.step}-${item.field}-${item.partyKey ?? ""}`}>
                    {item.label}
                    {item.partyName ? ` (${item.partyName})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        <StickyFormFooter
          back={
            <Button
              className="h-10"
              variant="outline"
              onClick={() => (stepIndex <= 0 ? router.push("/profile") : goToStep(ISSUER_PROFILE_FLOW_STEP_IDS[stepIndex - 1]!))}
            >
              Back
            </Button>
          }
          primary={
            <Button
              className="h-10"
              onClick={() => {
                if (stepIndex >= ISSUER_PROFILE_FLOW_STEP_IDS.length - 1) {
                  router.push("/profile");
                  return;
                }
                goToStep(ISSUER_PROFILE_FLOW_STEP_IDS[stepIndex + 1]!);
              }}
            >
              {stepIndex >= ISSUER_PROFILE_FLOW_STEP_IDS.length - 1 ? "Finish" : "Continue"}
            </Button>
          }
        />
      </div>
    </PageShell>
  );
}

function CompanyStep({
  org,
  missing,
  onSave,
}: {
  org: ReturnType<typeof useOrganization>["activeOrganization"];
  missing: ProfileMissingItem[];
  onSave: (data: Record<string, unknown>) => Promise<unknown>;
}) {
  const [form, setForm] = React.useState({
    dateOfIncorporation: toDate(org?.dateOfIncorporation),
    dateOfCommencement: toDate(org?.dateOfCommencement),
    countryOfIncorporation: org?.countryOfIncorporation ?? "",
    scCompanyType: org?.scCompanyType ?? "",
    companyEmail: org?.companyEmail ?? "",
    phoneNumber: org?.phoneNumber ?? "",
    companyActivities: "",
    registeredState: org?.residentialAddress?.state ?? "",
    registeredPostalCode: org?.residentialAddress?.postalCode ?? "",
    registeredLine1: "",
    businessState: "",
    businessPostalCode: "",
    businessLine1: "",
  });
  const needed = new Set(missing.map((item) => item.field));
  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        const payload: Record<string, unknown> = {};
        if (needed.has("dateOfIncorporation")) payload.dateOfIncorporation = form.dateOfIncorporation || null;
        if (needed.has("dateOfCommencement")) payload.dateOfCommencement = form.dateOfCommencement || null;
        if (needed.has("countryOfIncorporation")) payload.countryOfIncorporation = form.countryOfIncorporation || null;
        if (needed.has("scCompanyType")) payload.scCompanyType = form.scCompanyType || null;
        if (needed.has("companyEmail")) payload.companyEmail = form.companyEmail || null;
        if (needed.has("phoneNumber")) payload.phoneNumber = form.phoneNumber || null;
        if (needed.has("companyActivities")) payload.companyActivities = form.companyActivities || null;
        if (
          needed.has("registeredAddress.line1") ||
          needed.has("registeredAddress.state") ||
          needed.has("registeredAddress.postalCode")
        ) {
          payload.registeredAddress = {
            ...(needed.has("registeredAddress.line1") ? { line1: form.registeredLine1 || null } : {}),
            ...(needed.has("registeredAddress.state") ? { state: form.registeredState || null } : {}),
            ...(needed.has("registeredAddress.postalCode") ? { postalCode: form.registeredPostalCode || null } : {}),
          };
        }
        if (
          needed.has("businessAddress.line1") ||
          needed.has("businessAddress.state") ||
          needed.has("businessAddress.postalCode")
        ) {
          payload.businessAddress = {
            ...(needed.has("businessAddress.line1") ? { line1: form.businessLine1 || null } : {}),
            ...(needed.has("businessAddress.state") ? { state: form.businessState || null } : {}),
            ...(needed.has("businessAddress.postalCode") ? { postalCode: form.businessPostalCode || null } : {}),
          };
        }
        await onSave(payload);
      }}
    >
      <div>
        <h2 className="text-section-title">Company</h2>
        <p className="text-ui text-muted-foreground">
          {needed.size === 0 ? "This step is complete." : "Missing information"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {show(needed, "dateOfIncorporation") ? (
          <DateField
            label="Date of incorporation"
            value={form.dateOfIncorporation}
            onChange={(value) => setForm({ ...form, dateOfIncorporation: value })}
          />
        ) : null}
        {show(needed, "dateOfCommencement") ? (
          <DateField
            label="Date of commencement"
            value={form.dateOfCommencement}
            onChange={(value) => setForm({ ...form, dateOfCommencement: value })}
          />
        ) : null}
        {show(needed, "countryOfIncorporation") ? (
          <TextField
            label="Country of incorporation"
            value={form.countryOfIncorporation}
            onChange={(value) => setForm({ ...form, countryOfIncorporation: value })}
          />
        ) : null}
        {show(needed, "scCompanyType") ? (
          <SelectField
            label="Type of company"
            value={form.scCompanyType}
            onChange={(value) => setForm({ ...form, scCompanyType: value })}
            options={SC_COMPANY_TYPES.map((key) => ({ value: key, label: SC_COMPANY_TYPE_LABELS[key] }))}
          />
        ) : null}
        {show(needed, "companyEmail") ? (
          <TextField label="Company email" value={form.companyEmail} onChange={(value) => setForm({ ...form, companyEmail: value })} />
        ) : null}
        {show(needed, "phoneNumber") ? (
          <TextField label="Phone number" value={form.phoneNumber} onChange={(value) => setForm({ ...form, phoneNumber: value })} />
        ) : null}
        {show(needed, "companyActivities") ? (
          <TextField
            label="Company activities"
            value={form.companyActivities}
            onChange={(value) => setForm({ ...form, companyActivities: value })}
          />
        ) : null}
        {show(needed, "registeredAddress.line1") ? (
          <TextField
            label="Registered address"
            value={form.registeredLine1}
            onChange={(value) => setForm({ ...form, registeredLine1: value })}
          />
        ) : null}
        {show(needed, "registeredAddress.state") ? (
          <SelectField
            label="Registered address — state"
            value={form.registeredState}
            onChange={(value) => setForm({ ...form, registeredState: value })}
            options={SC_MALAYSIAN_STATES.map((state) => ({ value: state, label: state }))}
          />
        ) : null}
        {show(needed, "registeredAddress.postalCode") ? (
          <TextField
            label="Registered address — postcode"
            value={form.registeredPostalCode}
            onChange={(value) => setForm({ ...form, registeredPostalCode: value })}
          />
        ) : null}
        {show(needed, "businessAddress.line1") ? (
          <TextField
            label="Business address"
            value={form.businessLine1}
            onChange={(value) => setForm({ ...form, businessLine1: value })}
          />
        ) : null}
        {show(needed, "businessAddress.state") ? (
          <SelectField
            label="Business address — state"
            value={form.businessState}
            onChange={(value) => setForm({ ...form, businessState: value })}
            options={SC_MALAYSIAN_STATES.map((state) => ({ value: state, label: state }))}
          />
        ) : null}
        {show(needed, "businessAddress.postalCode") ? (
          <TextField
            label="Business address — postcode"
            value={form.businessPostalCode}
            onChange={(value) => setForm({ ...form, businessPostalCode: value })}
          />
        ) : null}
      </div>
      {needed.size > 0 ? (
        <Button type="submit" className="h-10">
          Save
        </Button>
      ) : null}
    </form>
  );
}

function PeopleStep({
  parties,
  missing,
  orgId,
  api,
  onSaved,
}: {
  parties: OrganizationPartyProfileDto[];
  missing: ProfileMissingItem[];
  orgId: string;
  api: ReturnType<typeof createApiClient>;
  onSaved: () => Promise<void>;
}) {
  const groups = groupPeopleMissingByParty(missing);
  const needsShareholder = missing.some((item) => item.field === "shareholders" && !item.partyKey);
  const personGroups = groups.filter((group) => group.partyKey);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section-title">People</h2>
        <p className="text-ui text-muted-foreground">
          {personGroups.length === 0 && !needsShareholder
            ? "This step is complete."
            : `${personGroups.length} ${personGroups.length === 1 ? "person needs" : "people need"} information`}
        </p>
      </div>
      {needsShareholder ? (
        <div className="space-y-3 rounded-xl border p-6">
          <p className="text-ui">No shareholder is currently listed.</p>
          <Button asChild className="h-10">
            <Link href="/profile#profile-people">Go to Profile → Add person</Link>
          </Button>
        </div>
      ) : null}
      {personGroups.map((group) => {
        const party = parties.find((row) => row.partyKey === group.partyKey);
        if (!party) {
          return (
            <div key={group.partyKey} className="rounded-xl border p-6">
              <p className="text-ui font-medium">{group.partyName || group.partyKey}</p>
              <ul className="mt-2 list-disc pl-5 text-ui text-muted-foreground">
                {group.items.map((item) => (
                  <li key={item.field}>{item.label}</li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <PartyForm
            key={party.id}
            party={party}
            missing={group.items}
            onSave={async (data) => {
              const res = await api.patchPartyProfile("issuer", orgId, party.id, data);
              if (!res.success) throw new Error(res.error.message);
              toast.success("Saved");
              await onSaved();
            }}
          />
        );
      })}
    </div>
  );
}

function PartyForm({
  party,
  missing,
  onSave,
}: {
  party: OrganizationPartyProfileDto;
  missing: ProfileMissingItem[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const needed = new Set(missing.map((item) => item.field));
  const [form, setForm] = React.useState({
    name: party.name ?? "",
    identityPrefix: party.identityPrefix ?? "",
    identityNumber: party.identityNumber ?? "",
    dateOfBirth: toDate(party.dateOfBirth),
    dateOfIncorporation: toDate(party.dateOfIncorporation),
    gender: party.gender ?? "",
    nationality: party.nationality ?? "",
    countryOfIncorporation: party.countryOfIncorporation ?? "",
    line1: party.address?.line1 ?? "",
    state: party.address?.state ?? "",
    postalCode: party.address?.postalCode ?? "",
    shareType: party.shareType ?? "",
    shareTypeOther: party.shareTypeOther ?? "",
    shareholdingUnits: party.shareholdingUnits ?? "",
    shareholdingAmount: party.shareholdingAmount ?? "",
    shareholdingPercentage: party.shareholdingPercentage ?? "",
    personKind: party.isManagement && !party.isBoard ? "MANAGEMENT" : "BOARD",
    designation: party.designation ?? "",
    designationOther: party.designationOther ?? "",
    appointmentDate: toDate(party.appointmentDate),
  });
  return (
    <form
      className="grid gap-4 rounded-xl border p-6 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const payload: Record<string, unknown> = {};
        if (needed.has("name")) payload.name = form.name || null;
        if (needed.has("identityPrefix")) payload.identityPrefix = form.identityPrefix || null;
        if (needed.has("identityNumber")) payload.identityNumber = form.identityNumber || null;
        if (needed.has("dateOfBirth")) payload.dateOfBirth = form.dateOfBirth || null;
        if (needed.has("dateOfIncorporation")) payload.dateOfIncorporation = form.dateOfIncorporation || null;
        if (needed.has("gender")) payload.gender = form.gender || null;
        if (needed.has("nationality")) payload.nationality = form.nationality || null;
        if (needed.has("countryOfIncorporation")) payload.countryOfIncorporation = form.countryOfIncorporation || null;
        if (needed.has("address.line1") || needed.has("address.state") || needed.has("address.postalCode")) {
          payload.address = {
            ...(needed.has("address.line1") ? { line1: form.line1 || null } : {}),
            ...(needed.has("address.state") ? { state: form.state || null } : {}),
            ...(needed.has("address.postalCode") ? { postalCode: form.postalCode || null } : {}),
          };
        }
        if (needed.has("shareType")) payload.shareType = form.shareType || null;
        if (needed.has("shareTypeOther")) payload.shareTypeOther = form.shareTypeOther || null;
        if (needed.has("shareholdingUnits")) payload.shareholdingUnits = form.shareholdingUnits || null;
        if (needed.has("shareholdingAmount")) payload.shareholdingAmount = form.shareholdingAmount || null;
        if (needed.has("shareholdingPercentage")) payload.shareholdingPercentage = form.shareholdingPercentage || null;
        if (needed.has("personKind")) payload.personKind = form.personKind;
        if (needed.has("designation")) payload.designation = form.designation || null;
        if (needed.has("designationOther")) payload.designationOther = form.designationOther || null;
        if (needed.has("appointmentDate")) payload.appointmentDate = form.appointmentDate || null;
        await onSave(payload);
      }}
    >
      <p className="text-ui font-medium sm:col-span-2">{party.name || party.partyKey}</p>
      {needed.size === 0 ? (
        <p className="text-ui text-muted-foreground sm:col-span-2">No missing fields for this person.</p>
      ) : null}
      {show(needed, "name") ? <TextField label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /> : null}
      {show(needed, "identityPrefix") ? (
        <SelectField
          label="Identity prefix"
          value={form.identityPrefix}
          onChange={(value) => setForm({ ...form, identityPrefix: value })}
          options={SC_IDENTITY_PREFIXES.map((key) => ({ value: key, label: SC_IDENTITY_PREFIX_LABELS[key] }))}
        />
      ) : null}
      {show(needed, "identityNumber") ? (
        <TextField label="Identity number" value={form.identityNumber} onChange={(value) => setForm({ ...form, identityNumber: value })} />
      ) : null}
      {show(needed, "dateOfBirth") ? (
        <DateField label="Date of birth" value={form.dateOfBirth} onChange={(value) => setForm({ ...form, dateOfBirth: value })} />
      ) : null}
      {show(needed, "dateOfIncorporation") ? (
        <DateField
          label="Date of incorporation"
          value={form.dateOfIncorporation}
          onChange={(value) => setForm({ ...form, dateOfIncorporation: value })}
        />
      ) : null}
      {show(needed, "gender") ? (
        <SelectField
          label="Gender"
          value={form.gender}
          onChange={(value) => setForm({ ...form, gender: value })}
          options={SC_GENDERS.map((key) => ({ value: key, label: SC_GENDER_LABELS[key] }))}
        />
      ) : null}
      {show(needed, "nationality") ? (
        <TextField label="Nationality" value={form.nationality} onChange={(value) => setForm({ ...form, nationality: value })} />
      ) : null}
      {show(needed, "countryOfIncorporation") ? (
        <TextField
          label="Country of incorporation"
          value={form.countryOfIncorporation}
          onChange={(value) => setForm({ ...form, countryOfIncorporation: value })}
        />
      ) : null}
      {show(needed, "address.line1") ? (
        <TextField label="Address" value={form.line1} onChange={(value) => setForm({ ...form, line1: value })} />
      ) : null}
      {show(needed, "address.state") ? (
        <SelectField
          label="State"
          value={form.state}
          onChange={(value) => setForm({ ...form, state: value })}
          options={SC_MALAYSIAN_STATES.map((state) => ({ value: state, label: state }))}
        />
      ) : null}
      {show(needed, "address.postalCode") ? (
        <TextField label="Postcode" value={form.postalCode} onChange={(value) => setForm({ ...form, postalCode: value })} />
      ) : null}
      {show(needed, "shareType") ? (
        <SelectField
          label="Type of shares"
          value={form.shareType}
          onChange={(value) => setForm({ ...form, shareType: value })}
          options={SC_SHARE_TYPES.map((key) => ({ value: key, label: SC_SHARE_TYPE_LABELS[key] }))}
        />
      ) : null}
      {show(needed, "shareTypeOther") ? (
        <TextField
          label="Type of shares — others"
          value={form.shareTypeOther}
          onChange={(value) => setForm({ ...form, shareTypeOther: value })}
        />
      ) : null}
      {show(needed, "shareholdingUnits") ? (
        <TextField
          label="Units"
          value={form.shareholdingUnits}
          onChange={(value) => setForm({ ...form, shareholdingUnits: value })}
        />
      ) : null}
      {show(needed, "shareholdingAmount") ? (
        <TextField
          label="Amount"
          value={form.shareholdingAmount}
          onChange={(value) => setForm({ ...form, shareholdingAmount: value })}
        />
      ) : null}
      {show(needed, "shareholdingPercentage") ? (
        <TextField
          label="Percentage"
          value={form.shareholdingPercentage}
          onChange={(value) => setForm({ ...form, shareholdingPercentage: value })}
        />
      ) : null}
      {show(needed, "personKind") ? (
        <SelectField
          label="Board / management"
          value={form.personKind}
          onChange={(value) => setForm({ ...form, personKind: value })}
          options={SC_PERSON_KINDS.map((key) => ({ value: key, label: SC_PERSON_KIND_LABELS[key] }))}
        />
      ) : null}
      {show(needed, "designation") ? (
        <SelectField
          label="Designation"
          value={form.designation}
          onChange={(value) => setForm({ ...form, designation: value })}
          options={SC_DESIGNATIONS.map((key) => ({ value: key, label: SC_DESIGNATION_LABELS[key] }))}
        />
      ) : null}
      {show(needed, "designationOther") ? (
        <TextField
          label="Designation — others"
          value={form.designationOther}
          onChange={(value) => setForm({ ...form, designationOther: value })}
        />
      ) : null}
      {show(needed, "appointmentDate") ? (
        <DateField
          label="Appointment date"
          value={form.appointmentDate}
          onChange={(value) => setForm({ ...form, appointmentDate: value })}
        />
      ) : null}
      {needed.size > 0 ? (
        <div className="sm:col-span-2">
          <Button type="submit" className="h-10">
            Save
          </Button>
        </div>
      ) : null}
    </form>
  );
}

const FINANCIAL_MISSING_TO_KEY: Record<string, string> = {
  currentAssets: "bscatot",
  nonCurrentAssets: "bsclbank",
  currentBorrowing: "curlib_borrowing",
  currentNonBorrowing: "curlib_non_borrowing",
  nonCurrentLoan: "ncl_loan",
  nonCurrentNonLoan: "ncl_non_loan",
  equityCapital: "bsqpuc",
  accumulatedProfit: "equity_accumulated_profit",
  revenue: "turnover",
  operatingCost: "operating_cost",
  adminCost: "admin_cost",
  interestCost: "interest_cost",
  otherCost: "other_cost",
  profitBeforeTax: "plnpbt",
  profitAfterTax: "plnpat",
  netDividend: "plnetdiv",
};

function FinancialsStep({
  orgId,
  api,
  missing,
  onSaved,
}: {
  orgId: string;
  api: ReturnType<typeof createApiClient>;
  missing: ComrepProfileCompleteness["missing"];
  onSaved: () => Promise<void>;
}) {
  const year = String(new Date().getFullYear() - 1);
  const neededKeys = new Set(
    missing.some((item) => item.field === "financials")
      ? [
          "bscatot",
          "bsclbank",
          "bsqpuc",
          "turnover",
          "plnpbt",
          "plnpat",
          "plnetdiv",
          ...ISSUER_FINANCIAL_COMREP_KEYS.filter(
            (key) =>
              key !== "equity_share_application" &&
              key !== "equity_share_premium" &&
              key !== "equity_minority" &&
              key !== "pl_minority"
          ),
        ]
      : missing.map((item) => FINANCIAL_MISSING_TO_KEY[item.field]).filter((key): key is string => Boolean(key))
  );
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const labels: Record<string, string> = {
    bscatot: "Current assets",
    bsclbank: "Non-current assets",
    bsqpuc: "Equity capital",
    turnover: "Total revenue and income",
    plnpbt: "Profit/loss before tax",
    plnpat: "Profit/loss after tax",
    plnetdiv: "Net dividend",
    ...ISSUER_FINANCIAL_COMREP_LABELS,
  };
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const payload: Record<string, string | number | null> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value === "") continue;
          payload[key] = value;
        }
        const res = await api.patchIssuerOrgFinancials(orgId, year, payload);
        if (!res.success) throw new Error(res.error.message);
        toast.success("Financials saved");
        await onSaved();
      }}
    >
      <div className="sm:col-span-2">
        <h2 className="text-section-title">Financials</h2>
        <p className="text-ui text-muted-foreground">
          Latest year ({year}). {neededKeys.size === 0 ? "This step is complete." : "Missing information"}
        </p>
      </div>
      {[...neededKeys].map((key) => (
        <TextField
          key={key}
          label={labels[key] ?? key}
          value={fields[key] ?? ""}
          onChange={(value) => setFields({ ...fields, [key]: value })}
        />
      ))}
      {neededKeys.size > 0 ? (
        <div className="sm:col-span-2">
          <Button type="submit" className="h-10">
            Save
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function show(needed: Set<string>, field: string) {
  return needed.has(field);
}

function toDate(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-10 text-ui">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
