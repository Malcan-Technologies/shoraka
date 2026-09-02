"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createApiClient,
  useAuthToken,
  useOrganization,
} from "@cashsouk/config";
import {
  ISSUER_FINANCIAL_COMREP_KEYS,
  ISSUER_FINANCIAL_COMREP_LABELS,
  ISSUER_PROFILE_STEP_IDS,
  ISSUER_PROFILE_STEP_LABELS,
  SC_COMPANY_CATEGORIES,
  SC_COMPANY_CATEGORY_LABELS,
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
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import {
  OnboardingStepper,
  PageShell,
  StickyFormFooter,
} from "@cashsouk/ui";
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

export default function IssuerProfileCompletePage() {
  const router = useRouter();
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
  const incompleteSteps = ISSUER_PROFILE_STEP_IDS.filter((id) => {
    if (id === "review") return false;
    const step = completeness?.steps.find((s) => s.id === id);
    return !step?.complete;
  });
  const [stepIndex, setStepIndex] = React.useState(0);
  React.useEffect(() => {
    setStepIndex(0);
  }, [incompleteSteps.join("|")]);

  const currentStepId = incompleteSteps[stepIndex] ?? "review";
  const stepperSteps = ISSUER_PROFILE_STEP_IDS.map((id) => ({
    id,
    label: ISSUER_PROFILE_STEP_LABELS[id],
    isCompleted: completeness?.steps.find((s) => s.id === id)?.complete ?? false,
    isCurrent: id === currentStepId,
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
    return <PageShell title="Complete profile"><p className="text-ui">Select an organization first.</p></PageShell>;
  }

  if (completeness?.complete) {
    return (
      <PageShell title="Complete profile">
        <div className={`${issuerPageGutterClassName} ${issuerMainContentClassName} space-y-6`}>
          <p className="text-ui">Company profile is complete.</p>
          <Button className="h-10" onClick={() => router.push("/profile")}>Back to profile</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Complete profile">
      <div className={`${issuerPageGutterClassName} ${issuerMainContentClassName} space-y-8 pb-28`}>
        <OnboardingStepper steps={stepperSteps} />
        {currentStepId === "company" ? (
          <CompanyStep
            org={activeOrganization}
            missing={completeness?.steps.find((s) => s.id === "company")?.missing ?? []}
            onSave={(data) => saveMaster.mutateAsync(data)}
          />
        ) : null}
        {currentStepId === "shareholders" || currentStepId === "board" ? (
          <PartyStep
            kind={currentStepId}
            parties={(partiesQuery.data ?? []).filter((p) => p.membershipStatus === "MASTER_ACTIVE")}
            completeness={completeness}
            orgId={orgId}
            api={api}
            onSaved={async () => {
              await queryClient.invalidateQueries({ queryKey: ["issuer", "party-profiles", orgId] });
              await queryClient.invalidateQueries({ queryKey: ["issuer", "profile-completeness", orgId] });
            }}
          />
        ) : null}
        {currentStepId === "financials" ? (
          <FinancialsStep
            orgId={orgId}
            api={api}
            missing={completeness?.steps.find((s) => s.id === "financials")?.missing ?? []}
            onSaved={async () => {
              await queryClient.invalidateQueries({ queryKey: ["issuer", "profile-completeness", orgId] });
            }}
          />
        ) : null}
        {currentStepId === "review" ? (
          <div className="space-y-4">
            <p className="text-ui">Review the remaining missing items, then finish.</p>
            <ul className="list-disc space-y-1 pl-5 text-ui">
              {(completeness?.missing ?? []).map((item) => (
                <li key={`${item.step}-${item.field}-${item.partyKey ?? ""}`}>
                  {item.label}
                  {item.partyName ? ` (${item.partyName})` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <StickyFormFooter
          back={
            <Button className="h-10" variant="outline" onClick={() => (stepIndex === 0 ? router.push("/profile") : setStepIndex((i) => i - 1))}>
              Back
            </Button>
          }
          primary={
            <Button
              className="h-10"
              onClick={() => {
                if (stepIndex >= incompleteSteps.length - 1) {
                  router.push("/profile");
                  return;
                }
                setStepIndex((i) => i + 1);
              }}
            >
              {stepIndex >= incompleteSteps.length - 1 ? "Finish" : "Continue"}
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
  missing: ComrepProfileCompleteness["missing"];
  onSave: (data: Record<string, unknown>) => Promise<unknown>;
}) {
  const [form, setForm] = React.useState({
    dateOfIncorporation: toDate(org?.dateOfIncorporation),
    dateOfCommencement: toDate(org?.dateOfCommencement),
    countryOfIncorporation: org?.countryOfIncorporation ?? "",
    scCompanyType: org?.scCompanyType ?? "",
    companyCategory: org?.companyCategory ?? "",
    companyEmail: org?.companyEmail ?? "",
    phoneNumber: org?.phoneNumber ?? "",
    companyActivities: "",
    registeredState: "",
    registeredPostalCode: "",
    registeredLine1: "",
    businessState: "",
    businessPostalCode: "",
    businessLine1: "",
  });
  const needed = new Set(missing.map((m) => m.field));
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({
          dateOfIncorporation: form.dateOfIncorporation || null,
          dateOfCommencement: form.dateOfCommencement || null,
          countryOfIncorporation: form.countryOfIncorporation || null,
          scCompanyType: form.scCompanyType || null,
          companyCategory: form.companyCategory || null,
          companyEmail: form.companyEmail || null,
          phoneNumber: form.phoneNumber || null,
          companyActivities: form.companyActivities || null,
          registeredAddress: {
            line1: form.registeredLine1 || null,
            state: form.registeredState || null,
            postalCode: form.registeredPostalCode || null,
          },
          businessAddress: {
            line1: form.businessLine1 || null,
            state: form.businessState || null,
            postalCode: form.businessPostalCode || null,
          },
        });
      }}
    >
      {show(needed, "dateOfIncorporation") ? <DateField label="Date of incorporation" value={form.dateOfIncorporation} onChange={(v) => setForm({ ...form, dateOfIncorporation: v })} /> : null}
      {show(needed, "dateOfCommencement") ? <DateField label="Date of commencement" value={form.dateOfCommencement} onChange={(v) => setForm({ ...form, dateOfCommencement: v })} /> : null}
      {show(needed, "countryOfIncorporation") ? <TextField label="Country of incorporation" value={form.countryOfIncorporation} onChange={(v) => setForm({ ...form, countryOfIncorporation: v })} /> : null}
      {show(needed, "scCompanyType") ? (
        <SelectField label="Type of company" value={form.scCompanyType} onChange={(v) => setForm({ ...form, scCompanyType: v })} options={SC_COMPANY_TYPES.map((k) => ({ value: k, label: SC_COMPANY_TYPE_LABELS[k] }))} />
      ) : null}
      {show(needed, "companyCategory") ? (
        <SelectField label="Company category" value={form.companyCategory} onChange={(v) => setForm({ ...form, companyCategory: v })} options={SC_COMPANY_CATEGORIES.map((k) => ({ value: k, label: SC_COMPANY_CATEGORY_LABELS[k] }))} />
      ) : null}
      {show(needed, "companyEmail") ? <TextField label="E-mail address" value={form.companyEmail} onChange={(v) => setForm({ ...form, companyEmail: v })} /> : null}
      {show(needed, "phoneNumber") ? <TextField label="Phone number" value={form.phoneNumber} onChange={(v) => setForm({ ...form, phoneNumber: v })} /> : null}
      {show(needed, "companyActivities") ? <TextField label="Company activities" value={form.companyActivities} onChange={(v) => setForm({ ...form, companyActivities: v })} /> : null}
      {show(needed, "registeredAddress.line1") ? <TextField label="Registered address" value={form.registeredLine1} onChange={(v) => setForm({ ...form, registeredLine1: v })} /> : null}
      {show(needed, "registeredAddress.state") ? <SelectField label="Registered address — state" value={form.registeredState} onChange={(v) => setForm({ ...form, registeredState: v })} options={SC_MALAYSIAN_STATES.map((s) => ({ value: s, label: s }))} /> : null}
      {show(needed, "registeredAddress.postalCode") ? <TextField label="Registered address — postcode" value={form.registeredPostalCode} onChange={(v) => setForm({ ...form, registeredPostalCode: v })} /> : null}
      {show(needed, "businessAddress.line1") ? <TextField label="Business address" value={form.businessLine1} onChange={(v) => setForm({ ...form, businessLine1: v })} /> : null}
      {show(needed, "businessAddress.state") ? <SelectField label="Business address — state" value={form.businessState} onChange={(v) => setForm({ ...form, businessState: v })} options={SC_MALAYSIAN_STATES.map((s) => ({ value: s, label: s }))} /> : null}
      {show(needed, "businessAddress.postalCode") ? <TextField label="Business address — postcode" value={form.businessPostalCode} onChange={(v) => setForm({ ...form, businessPostalCode: v })} /> : null}
      {needed.size === 0 ? <p className="text-ui sm:col-span-2">This step is complete.</p> : null}
      <div className="sm:col-span-2">
        <Button type="submit" className="h-10">Save company details</Button>
      </div>
    </form>
  );
}

function PartyStep({
  kind,
  parties,
  completeness,
  orgId,
  api,
  onSaved,
}: {
  kind: "shareholders" | "board";
  parties: OrganizationPartyProfileDto[];
  completeness?: ComrepProfileCompleteness;
  orgId: string;
  api: ReturnType<typeof createApiClient>;
  onSaved: () => Promise<void>;
}) {
  const filtered = parties.filter((p) => (kind === "shareholders" ? p.isShareholder : p.isBoard || p.isManagement || p.isDirector));
  return (
    <div className="space-y-6">
      {filtered.length === 0 ? (
        <p className="text-ui text-muted-foreground">
          {kind === "shareholders"
            ? "No shareholders are on the CashSouk master list yet. Add them from Profile if the company structure has changed."
            : "No board or management members on the master list yet. Add them from Profile."}
        </p>
      ) : null}
      {filtered.map((party) => (
        <PartyForm
          key={party.id}
          party={party}
          kind={kind}
          missing={(completeness?.missing ?? []).filter((m) => m.partyKey === party.partyKey && m.step === kind)}
          onSave={async (data) => {
            const res = await api.patchPartyProfile("issuer", orgId, party.id, data);
            if (!res.success) throw new Error(res.error.message);
            toast.success("Saved");
            await onSaved();
          }}
        />
      ))}
    </div>
  );
}

function PartyForm({
  party,
  kind,
  missing,
  onSave,
}: {
  party: OrganizationPartyProfileDto;
  kind: "shareholders" | "board";
  missing: ComrepProfileCompleteness["missing"];
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const needed = new Set(missing.map((m) => m.field));
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
      onSubmit={async (e) => {
        e.preventDefault();
        const payload: Record<string, unknown> = {};
        if (needed.has("name")) payload.name = form.name || null;
        if (needed.has("identityPrefix")) payload.identityPrefix = form.identityPrefix || null;
        if (needed.has("identityNumber")) payload.identityNumber = form.identityNumber || null;
        if (needed.has("dateOfBirth")) payload.dateOfBirth = form.dateOfBirth || null;
        if (needed.has("dateOfIncorporation")) payload.dateOfIncorporation = form.dateOfIncorporation || null;
        if (needed.has("gender")) payload.gender = form.gender || null;
        if (needed.has("nationality")) payload.nationality = form.nationality || null;
        if (needed.has("countryOfIncorporation")) payload.countryOfIncorporation = form.countryOfIncorporation || null;
        if (
          needed.has("address.line1") ||
          needed.has("address.state") ||
          needed.has("address.postalCode")
        ) {
          payload.address = {
            ...(needed.has("address.line1") ? { line1: form.line1 || null } : {}),
            ...(needed.has("address.state") ? { state: form.state || null } : {}),
            ...(needed.has("address.postalCode") ? { postalCode: form.postalCode || null } : {}),
          };
        }
        if (kind === "shareholders") {
          if (needed.has("shareType")) payload.shareType = form.shareType || null;
          if (needed.has("shareTypeOther")) payload.shareTypeOther = form.shareTypeOther || null;
          if (needed.has("shareholdingUnits")) payload.shareholdingUnits = form.shareholdingUnits || null;
          if (needed.has("shareholdingAmount")) payload.shareholdingAmount = form.shareholdingAmount || null;
          if (needed.has("shareholdingPercentage")) payload.shareholdingPercentage = form.shareholdingPercentage || null;
        }
        if (kind === "board") {
          if (needed.has("personKind")) payload.personKind = form.personKind;
          if (needed.has("designation")) payload.designation = form.designation || null;
          if (needed.has("designationOther")) payload.designationOther = form.designationOther || null;
          if (needed.has("appointmentDate")) payload.appointmentDate = form.appointmentDate || null;
        }
        await onSave(payload);
      }}
    >
      <p className="text-ui font-medium sm:col-span-2">{party.name || party.partyKey}</p>
      {needed.size === 0 ? (
        <p className="text-ui text-muted-foreground sm:col-span-2">No missing fields for this person.</p>
      ) : null}
      {show(needed, "name") ? <TextField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} /> : null}
      {show(needed, "identityPrefix") ? <SelectField label="Identity prefix" value={form.identityPrefix} onChange={(v) => setForm({ ...form, identityPrefix: v })} options={SC_IDENTITY_PREFIXES.map((k) => ({ value: k, label: SC_IDENTITY_PREFIX_LABELS[k] }))} /> : null}
      {show(needed, "identityNumber") ? <TextField label="Identity number" value={form.identityNumber} onChange={(v) => setForm({ ...form, identityNumber: v })} /> : null}
      {show(needed, "dateOfBirth") ? <DateField label="Date of birth" value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} /> : null}
      {show(needed, "dateOfIncorporation") ? <DateField label="Date of incorporation" value={form.dateOfIncorporation} onChange={(v) => setForm({ ...form, dateOfIncorporation: v })} /> : null}
      {show(needed, "gender") ? <SelectField label="Gender" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} options={SC_GENDERS.map((k) => ({ value: k, label: SC_GENDER_LABELS[k] }))} /> : null}
      {show(needed, "nationality") ? <TextField label="Nationality" value={form.nationality} onChange={(v) => setForm({ ...form, nationality: v })} /> : null}
      {show(needed, "countryOfIncorporation") ? <TextField label="Country of incorporation" value={form.countryOfIncorporation} onChange={(v) => setForm({ ...form, countryOfIncorporation: v })} /> : null}
      {show(needed, "address.line1") ? <TextField label="Address" value={form.line1} onChange={(v) => setForm({ ...form, line1: v })} /> : null}
      {show(needed, "address.state") ? <SelectField label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} options={SC_MALAYSIAN_STATES.map((s) => ({ value: s, label: s }))} /> : null}
      {show(needed, "address.postalCode") ? <TextField label="Postcode" value={form.postalCode} onChange={(v) => setForm({ ...form, postalCode: v })} /> : null}
      {kind === "shareholders" && show(needed, "shareType") ? <SelectField label="Type of shares" value={form.shareType} onChange={(v) => setForm({ ...form, shareType: v })} options={SC_SHARE_TYPES.map((k) => ({ value: k, label: SC_SHARE_TYPE_LABELS[k] }))} /> : null}
      {kind === "shareholders" && show(needed, "shareTypeOther") ? <TextField label="Type of shares — others" value={form.shareTypeOther} onChange={(v) => setForm({ ...form, shareTypeOther: v })} /> : null}
      {kind === "shareholders" && show(needed, "shareholdingUnits") ? <TextField label="Shareholding units" value={form.shareholdingUnits} onChange={(v) => setForm({ ...form, shareholdingUnits: v })} /> : null}
      {kind === "shareholders" && show(needed, "shareholdingAmount") ? <TextField label="Shareholding amount" value={form.shareholdingAmount} onChange={(v) => setForm({ ...form, shareholdingAmount: v })} /> : null}
      {kind === "shareholders" && show(needed, "shareholdingPercentage") ? <TextField label="Shareholding percentage" value={form.shareholdingPercentage} onChange={(v) => setForm({ ...form, shareholdingPercentage: v })} /> : null}
      {kind === "board" && show(needed, "personKind") ? <SelectField label="Board / management" value={form.personKind} onChange={(v) => setForm({ ...form, personKind: v })} options={SC_PERSON_KINDS.map((k) => ({ value: k, label: SC_PERSON_KIND_LABELS[k] }))} /> : null}
      {kind === "board" && show(needed, "designation") ? <SelectField label="Designation" value={form.designation} onChange={(v) => setForm({ ...form, designation: v })} options={SC_DESIGNATIONS.map((k) => ({ value: k, label: SC_DESIGNATION_LABELS[k] }))} /> : null}
      {kind === "board" && show(needed, "designationOther") ? <TextField label="Designation — others" value={form.designationOther} onChange={(v) => setForm({ ...form, designationOther: v })} /> : null}
      {kind === "board" && show(needed, "appointmentDate") ? <DateField label="Appointment date" value={form.appointmentDate} onChange={(v) => setForm({ ...form, appointmentDate: v })} /> : null}
      <div className="sm:col-span-2">
        <Button type="submit" className="h-10">Save</Button>
      </div>
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
    missing.some((m) => m.field === "financials")
      ? [
          "bscatot",
          "bsclbank",
          "bsqpuc",
          "turnover",
          "plnpbt",
          "plnpat",
          "plnetdiv",
          ...ISSUER_FINANCIAL_COMREP_KEYS.filter(
            (k) =>
              k !== "equity_share_application" &&
              k !== "equity_share_premium" &&
              k !== "equity_minority" &&
              k !== "pl_minority"
          ),
        ]
      : missing.map((m) => FINANCIAL_MISSING_TO_KEY[m.field]).filter((k): k is string => Boolean(k))
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
      onSubmit={async (e) => {
        e.preventDefault();
        const payload: Record<string, string | number | null> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (v === "") continue;
          payload[k] = v;
        }
        const res = await api.patchIssuerOrgFinancials(orgId, year, payload);
        if (!res.success) throw new Error(res.error.message);
        toast.success("Financials saved");
        await onSaved();
      }}
    >
      <p className="text-ui sm:col-span-2">Latest year ({year}). Enter figures from the audited statements or certified management accounts.</p>
      {[...neededKeys].map((k) => (
        <TextField
          key={k}
          label={labels[k] ?? k}
          value={fields[k] ?? ""}
          onChange={(v) => setFields({ ...fields, [k]: v })}
        />
      ))}
      <div className="sm:col-span-2">
        <Button type="submit" className="h-10">Save financials</Button>
      </div>
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

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
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
  onChange: (v: string) => void;
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
