"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import {
  SC_GENDER_LABELS,
  SC_GENDERS,
  SC_MALAYSIAN_STATES,
  userFacingCompleteness,
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

type InvestorFlowStep = "identity" | "review";

export default function InvestorProfileCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const requested = searchParams.get("step");
  const [step, setStep] = React.useState<InvestorFlowStep>(requested === "review" ? "review" : "identity");
  React.useEffect(() => {
    if (requested === "identity" || requested === "review") setStep(requested);
  }, [requested]);

  const goToStep = (id: InvestorFlowStep) => {
    setStep(id);
    router.replace(`/profile/complete?step=${id}`, { scroll: false });
  };

  const [form, setForm] = React.useState({
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

  if (completenessQuery.data && userFacingCompleteness(completenessQuery.data).complete) {
    return (
      <PageShell title="Complete your profile">
        <p className="text-ui">Your profile is complete.</p>
        <Button className="mt-4 h-10" onClick={() => router.push("/profile")}>
          Back to profile
        </Button>
      </PageShell>
    );
  }

  const user = completenessQuery.data ? userFacingCompleteness(completenessQuery.data) : null;
  const missing = user?.missing ?? [];
  const identityComplete = missing.filter((item) => item.step === "identity").length === 0;

  return (
    <PageShell title="Complete your profile">
      <OnboardingStepper
        steps={[
          {
            id: "identity",
            label: "Identity",
            isCompleted: identityComplete,
            isCurrent: step === "identity",
          },
          {
            id: "review",
            label: "Review",
            isCompleted: user?.complete ?? false,
            isCurrent: step === "review",
          },
        ]}
        onStepClick={(id) => {
          if (id === "identity" || id === "review") goToStep(id);
        }}
      />
      {step === "review" ? (
        <div className="mt-8 space-y-4">
          <h2 className="text-section-title">Review</h2>
          {missing.length === 0 ? (
            <p className="text-ui">All required profile fields are complete.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-ui">
              {missing.map((item) => (
                <li key={item.field}>{item.label}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
      <form
        className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const res = await api.patchMasterProfile(
            "investor",
            orgId,
            isCompany
              ? {
                  ...(needs(missing, "dateOfIncorporation")
                    ? { dateOfIncorporation: form.dateOfIncorporation || null }
                    : {}),
                  ...(needs(missing, "countryOfIncorporation")
                    ? { countryOfIncorporation: form.countryOfIncorporation || null }
                    : {}),
                  ...(needs(missing, "businessState") || needs(missing, "businessPostalCode")
                    ? {
                        businessAddress: {
                          ...(needs(missing, "businessState") ? { state: form.businessState || null } : {}),
                          ...(needs(missing, "businessPostalCode")
                            ? { postalCode: form.businessPostalCode || null }
                            : {}),
                        },
                      }
                    : {}),
                }
              : {
                  ...(needs(missing, "gender") ? { gender: form.gender || null } : {}),
                  ...(needs(missing, "nationality") ? { nationality: form.nationality || null } : {}),
                  ...(needs(missing, "state") || needs(missing, "postalCode")
                    ? {
                        residentialAddress: {
                          ...(needs(missing, "state") ? { state: form.state || null } : {}),
                          ...(needs(missing, "postalCode") ? { postalCode: form.postalCode || null } : {}),
                        },
                      }
                    : {}),
                }
          );
          if (!res.success) {
            toast.error(res.error.message);
            return;
          }
          await refreshOrganizations();
          toast.success("Saved");
          goToStep("review");
        }}
      >
        <div className="sm:col-span-2">
          <h2 className="text-section-title">Identity</h2>
          <p className="text-ui text-muted-foreground">
            {missing.length === 0 ? "This step is complete." : "Missing information"}
          </p>
        </div>
        {!isCompany && needs(missing, "gender") ? (
          <SelectField
            label="Gender"
            value={form.gender}
            onChange={(value) => setForm({ ...form, gender: value })}
            options={SC_GENDERS.filter((gender) => gender !== "NOT_APPLICABLE").map((key) => ({
              value: key,
              label: SC_GENDER_LABELS[key],
            }))}
          />
        ) : null}
        {!isCompany && needs(missing, "nationality") ? (
          <TextField
            label="Nationality"
            value={form.nationality}
            onChange={(value) => setForm({ ...form, nationality: value })}
          />
        ) : null}
        {!isCompany && needs(missing, "state") ? (
          <SelectField
            label="State"
            value={form.state}
            onChange={(value) => setForm({ ...form, state: value })}
            options={SC_MALAYSIAN_STATES.map((state) => ({ value: state, label: state }))}
          />
        ) : null}
        {!isCompany && needs(missing, "postalCode") ? (
          <TextField
            label="Postcode"
            value={form.postalCode}
            onChange={(value) => setForm({ ...form, postalCode: value })}
          />
        ) : null}
        {isCompany && needs(missing, "dateOfIncorporation") ? (
          <div className="space-y-2">
            <Label className="text-ui">Date of incorporation</Label>
            <Input
              className="h-10 text-ui"
              type="date"
              value={form.dateOfIncorporation}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, dateOfIncorporation: event.target.value })
              }
            />
          </div>
        ) : null}
        {isCompany && needs(missing, "countryOfIncorporation") ? (
          <TextField
            label="Country of incorporation"
            value={form.countryOfIncorporation}
            onChange={(value) => setForm({ ...form, countryOfIncorporation: value })}
          />
        ) : null}
        {isCompany && needs(missing, "businessState") ? (
          <SelectField
            label="Business address — state"
            value={form.businessState}
            onChange={(value) => setForm({ ...form, businessState: value })}
            options={SC_MALAYSIAN_STATES.map((state) => ({ value: state, label: state }))}
          />
        ) : null}
        {isCompany && needs(missing, "businessPostalCode") ? (
          <TextField
            label="Business address — postcode"
            value={form.businessPostalCode}
            onChange={(value) => setForm({ ...form, businessPostalCode: value })}
          />
        ) : null}
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
      )}
      {step === "review" ? (
        <StickyFormFooter
          back={
            <Button type="button" className="h-10" variant="outline" onClick={() => goToStep("identity")}>
              Back
            </Button>
          }
          primary={
            <Button type="button" className="h-10" onClick={() => router.push("/profile")}>
              Finish
            </Button>
          }
        />
      ) : null}
    </PageShell>
  );
}

function needs(missing: Array<{ field: string }>, field: string) {
  return missing.some((item) => item.field === field);
}

function toDate(value: unknown): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" value={value} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} />
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
