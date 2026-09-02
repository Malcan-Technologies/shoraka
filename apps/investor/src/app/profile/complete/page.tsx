"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import {
  SC_GENDER_LABELS,
  SC_GENDERS,
  SC_IDENTITY_PREFIX_LABELS,
  SC_INVESTOR_CATEGORIES,
  SC_INVESTOR_CATEGORY_LABELS,
  SC_MALAYSIAN_STATES,
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function InvestorProfileCompletePage() {
  const router = useRouter();
  const { activeOrganization, refreshOrganizations } = useOrganization();
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const orgId = activeOrganization?.id;
  const isCompany = activeOrganization?.type === "COMPANY";

  const completenessQuery = useQuery({
    queryKey: ["investor", "profile-completeness", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const res = await api.getProfileCompleteness("investor", orgId!);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  const [form, setForm] = React.useState({
    scInvestorCategory: activeOrganization?.scInvestorCategory ?? "",
    gender: "",
    nationality: activeOrganization?.nationality ?? "",
    state: activeOrganization?.residentialAddress?.state ?? "",
    postalCode: activeOrganization?.residentialAddress?.postalCode ?? "",
    dateOfIncorporation: toDate(activeOrganization?.dateOfIncorporation),
    countryOfIncorporation: activeOrganization?.countryOfIncorporation ?? "",
    businessState: "",
    businessPostalCode: "",
  });

  if (!orgId) {
    return (
      <PageShell title="Complete profile">
        <p className="text-ui">Select an organization first.</p>
      </PageShell>
    );
  }

  if (completenessQuery.isLoading) {
    return (
      <PageShell title="Complete profile">
        <p className="text-ui text-muted-foreground">Loading…</p>
      </PageShell>
    );
  }

  if (completenessQuery.data?.complete) {
    return (
      <PageShell title="Complete profile">
        <p className="text-ui">Your profile is complete.</p>
        <Button className="mt-4 h-10" onClick={() => router.push("/profile")}>
          Back to profile
        </Button>
      </PageShell>
    );
  }

  const missing = completenessQuery.data?.missing ?? [];

  return (
    <PageShell title="Complete profile" description="A few ComRep fields are still missing from your CashSouk profile.">
      <OnboardingStepper
        steps={[
          {
            id: "identity",
            label: "Identity",
            isCompleted: completenessQuery.data?.steps.find((s) => s.id === "identity")?.complete ?? false,
            isCurrent: true,
          },
          {
            id: "review",
            label: "Review",
            isCompleted: completenessQuery.data?.complete ?? false,
            isCurrent: false,
          },
        ]}
      />
      <form
        className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await api.patchMasterProfile("investor", orgId, isCompany
            ? {
                scInvestorCategory: form.scInvestorCategory || null,
                gender: "NOT_APPLICABLE",
                dateOfIncorporation: form.dateOfIncorporation || null,
                countryOfIncorporation: form.countryOfIncorporation || null,
                businessAddress: {
                  state: form.businessState || null,
                  postalCode: form.businessPostalCode || null,
                },
              }
            : {
                scInvestorCategory: form.scInvestorCategory || null,
                gender: form.gender || null,
                nationality: form.nationality || null,
                residentialAddress: {
                  state: form.state || null,
                  postalCode: form.postalCode || null,
                },
              });
          if (!res.success) {
            toast.error(res.error.message);
            return;
          }
          await refreshOrganizations();
          toast.success("Saved");
          router.push("/profile");
        }}
      >
        {needs(missing, "scInvestorCategory") ? (
          <SelectField
            label="Type of investor"
            value={form.scInvestorCategory}
            onChange={(v) => setForm({ ...form, scInvestorCategory: v })}
            options={SC_INVESTOR_CATEGORIES.map((k) => ({ value: k, label: SC_INVESTOR_CATEGORY_LABELS[k] }))}
          />
        ) : null}
        {!isCompany && needs(missing, "gender") ? (
          <SelectField
            label="Gender"
            value={form.gender}
            onChange={(v) => setForm({ ...form, gender: v })}
            options={SC_GENDERS.filter((g) => g !== "NOT_APPLICABLE").map((k) => ({
              value: k,
              label: SC_GENDER_LABELS[k],
            }))}
          />
        ) : null}
        {!isCompany && needs(missing, "nationality") ? (
          <TextField label="Nationality" value={form.nationality} onChange={(v) => setForm({ ...form, nationality: v })} />
        ) : null}
        {!isCompany && needs(missing, "state") ? (
          <SelectField
            label="State"
            value={form.state}
            onChange={(v) => setForm({ ...form, state: v })}
            options={SC_MALAYSIAN_STATES.map((s) => ({ value: s, label: s }))}
          />
        ) : null}
        {!isCompany && needs(missing, "postalCode") ? (
          <TextField label="Postcode" value={form.postalCode} onChange={(v) => setForm({ ...form, postalCode: v })} />
        ) : null}
        {isCompany && needs(missing, "dateOfIncorporation") ? (
          <div className="space-y-2">
            <Label className="text-ui">Date of incorporation</Label>
            <Input className="h-10 text-ui" type="date" value={form.dateOfIncorporation} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, dateOfIncorporation: e.target.value })} />
          </div>
        ) : null}
        {isCompany && needs(missing, "countryOfIncorporation") ? (
          <TextField label="Country of incorporation" value={form.countryOfIncorporation} onChange={(v) => setForm({ ...form, countryOfIncorporation: v })} />
        ) : null}
        {isCompany && needs(missing, "businessState") ? (
          <SelectField
            label="Business address — state"
            value={form.businessState}
            onChange={(v) => setForm({ ...form, businessState: v })}
            options={SC_MALAYSIAN_STATES.map((s) => ({ value: s, label: s }))}
          />
        ) : null}
        {isCompany && needs(missing, "businessPostalCode") ? (
          <TextField label="Business address — postcode" value={form.businessPostalCode} onChange={(v) => setForm({ ...form, businessPostalCode: v })} />
        ) : null}
        {isCompany ? (
          <p className="text-ui text-muted-foreground sm:col-span-2">
            Identity prefix is ROC for companies. Gender is stored as Not Applicable.
          </p>
        ) : (
          <p className="text-ui text-muted-foreground sm:col-span-2">
            Identity prefix: {SC_IDENTITY_PREFIX_LABELS[activeOrganization?.documentType?.toUpperCase().includes("PASSPORT") ? "PASSPORT" : "NRIC"]}
          </p>
        )}
        <StickyFormFooter
          className="sm:col-span-2"
          back={
            <Button type="button" className="h-10" variant="outline" onClick={() => router.push("/profile")}>
              Cancel
            </Button>
          }
          primary={
            <Button type="submit" className="h-10">
              Save
            </Button>
          }
        />
      </form>
    </PageShell>
  );
}

function needs(missing: Array<{ field: string }>, field: string) {
  return missing.some((m) => m.field === field);
}

function toDate(value: unknown): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} />
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
