"use client";

/**
 * DEMO ONLY — temporary Contract ARF-i LO merge playground.
 * Deep-link: /demos/contract-lo
 * Wet-ink signatures; no SigningCloud.
 */

import { useHeader } from "@cashsouk/ui";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  ContractFacilityLoCorporateGuarantor,
  ContractFacilityLoIndividualGuarantor,
  ContractFacilityLoMergeData,
} from "@cashsouk/types";
import { CONTRACT_FACILITY_LO_MERGE_KEYS } from "@cashsouk/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

type ContractFacilityLoScalarKey = (typeof CONTRACT_FACILITY_LO_MERGE_KEYS)[number];

const FIELD_LABELS: Partial<Record<ContractFacilityLoScalarKey, string>> = {
  issuer_id: "Issuer ID",
  our_reference: "Our reference",
  letter_date: "Letter date",
  issuer_name: "Issuer name",
  issuer_registration_number: "Issuer registration number",
  issuer_address: "Issuer address",
  attention_name: "Attention name",
  attention_position: "Attention position",
  financing_limit_rm: "Financing limit (RM …)",
  tenure_days: "Tenure days (main schedule)",
  max_invoice_tenure_days: "Max invoice tenure days (Schedule A)",
  sub_limit_per_invoice_rm: "Sub-limit per invoice (Part A)",
  part_b_financing_amount_rm: "Financing amount per invoice (Part B)",
  part_a_checkbox: "Part A checkbox (☒ / ☐)",
  part_b_checkbox: "Part B checkbox (☒ / ☐)",
  payment_period_days: "Payment period days",
  grace_period_days: "Grace period days",
  grace_period_days_words: "Grace period days (words)",
  transaction_docs_days: "Transaction docs days",
  transaction_docs_days_words: "Transaction docs days (words)",
  offer_validity_phrase: "Offer validity phrase",
  assigned_contract_date: "Assigned contract date",
  assigned_contract_counterparty: "Assigned contract counterparty",
  assigned_contract_description: "Assigned contract description",
  moa_authorised_signatory_names: "MoA authorised signatory name(s)",
};

const SECTIONS: Array<{ title: string; keys: ContractFacilityLoScalarKey[] }> = [
  {
    title: "Header / letter meta",
    keys: ["issuer_id", "our_reference", "letter_date"],
  },
  {
    title: "Addressee",
    keys: [
      "issuer_name",
      "issuer_registration_number",
      "issuer_address",
      "attention_name",
      "attention_position",
    ],
  },
  {
    title: "Facility / Schedule A terms",
    keys: [
      "financing_limit_rm",
      "tenure_days",
      "max_invoice_tenure_days",
      "sub_limit_per_invoice_rm",
      "part_b_financing_amount_rm",
      "part_a_checkbox",
      "part_b_checkbox",
    ],
  },
  {
    title: "Payment / timeline",
    keys: [
      "payment_period_days",
      "grace_period_days",
      "grace_period_days_words",
      "transaction_docs_days",
      "transaction_docs_days_words",
      "offer_validity_phrase",
    ],
  },
  {
    title: "Schedule B — assigned contract",
    keys: [
      "assigned_contract_date",
      "assigned_contract_counterparty",
      "assigned_contract_description",
    ],
  },
  {
    title: "Memorandum",
    keys: ["moa_authorised_signatory_names"],
  },
];

const LONG_FIELDS = new Set<ContractFacilityLoScalarKey>([
  "issuer_address",
  "assigned_contract_description",
]);

function formatGuarantorLine(name: string, nric: string): string {
  const trimmedName = name.trim();
  const trimmedNric = nric.trim();
  if (!trimmedName) return "";
  return trimmedNric ? `${trimmedName} (NRIC No. ${trimmedNric})` : trimmedName;
}

function emptyMerge(): ContractFacilityLoMergeData {
  return {
    ...(Object.fromEntries(CONTRACT_FACILITY_LO_MERGE_KEYS.map((k) => [k, ""])) as Pick<
      ContractFacilityLoMergeData,
      (typeof CONTRACT_FACILITY_LO_MERGE_KEYS)[number]
    >),
    guarantors_individual: [],
    guarantors_corporate: [],
  };
}

function emptyGuarantor(): ContractFacilityLoIndividualGuarantor {
  return { name: "", nric: "", line: "" };
}

function emptyCorporate(): ContractFacilityLoCorporateGuarantor {
  return { name: "", ssm: "", signatories: [{ name: "" }] };
}

export default function ContractLoDemoPage() {
  const { setTitle } = useHeader();
  useEffect(() => {
    setTitle("Contract Letter of Offer (LO) demo");
    return () => setTitle("");
  }, [setTitle]);

  const { getAccessToken } = useAuthToken();
  const apiClient = useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);

  const [form, setForm] = useState<ContractFacilityLoMergeData>(emptyMerge);
  const [contractId, setContractId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setField = useCallback((key: ContractFacilityLoScalarKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setGuarantorField = useCallback(
    (index: number, key: keyof ContractFacilityLoIndividualGuarantor, value: string) => {
      setForm((prev) => {
        const next = [...prev.guarantors_individual];
        const current = next[index] ?? emptyGuarantor();
        const updated = { ...current, [key]: value };
        if (key === "name" || key === "nric") {
          updated.line = formatGuarantorLine(
            key === "name" ? value : updated.name,
            key === "nric" ? value : updated.nric
          );
        }
        next[index] = updated;
        return { ...prev, guarantors_individual: next };
      });
    },
    []
  );

  const addGuarantor = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      guarantors_individual: [...prev.guarantors_individual, emptyGuarantor()],
    }));
  }, []);

  const removeGuarantor = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      guarantors_individual: prev.guarantors_individual.filter((_, i) => i !== index),
    }));
  }, []);

  const setCorporateField = useCallback(
    (index: number, key: "name" | "ssm", value: string) => {
      setForm((prev) => {
        const next = [...prev.guarantors_corporate];
        const current = next[index] ?? emptyCorporate();
        next[index] = { ...current, [key]: value };
        return { ...prev, guarantors_corporate: next };
      });
    },
    []
  );

  const setCorporateSignatory = useCallback((companyIndex: number, signatoryIndex: number, value: string) => {
    setForm((prev) => {
      const next = [...prev.guarantors_corporate];
      const current = next[companyIndex] ?? emptyCorporate();
      const signatories = [...current.signatories];
      signatories[signatoryIndex] = { name: value };
      next[companyIndex] = { ...current, signatories };
      return { ...prev, guarantors_corporate: next };
    });
  }, []);

  const addCorporate = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      guarantors_corporate: [...prev.guarantors_corporate, emptyCorporate()],
    }));
  }, []);

  const removeCorporate = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      guarantors_corporate: prev.guarantors_corporate.filter((_, i) => i !== index),
    }));
  }, []);

  const addCorporateSignatory = useCallback((companyIndex: number) => {
    setForm((prev) => {
      const next = [...prev.guarantors_corporate];
      const current = next[companyIndex] ?? emptyCorporate();
      next[companyIndex] = { ...current, signatories: [...current.signatories, { name: "" }] };
      return { ...prev, guarantors_corporate: next };
    });
  }, []);

  const removeCorporateSignatory = useCallback((companyIndex: number, signatoryIndex: number) => {
    setForm((prev) => {
      const next = [...prev.guarantors_corporate];
      const current = next[companyIndex] ?? emptyCorporate();
      next[companyIndex] = {
        ...current,
        signatories: current.signatories.filter((_, i) => i !== signatoryIndex),
      };
      return { ...prev, guarantors_corporate: next };
    });
  }, []);

  const loadFixture = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await apiClient.getFacilityLoDemoFixture();
      if (!result.success) {
        setStatus(result.error?.message ?? "Failed to load fixture");
        return;
      }
      setForm(result.data);
      setStatus("Loaded fixture defaults");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load fixture");
    } finally {
      setBusy(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void loadFixture();
  }, [loadFixture]);

  const loadFromContract = useCallback(async () => {
    const id = contractId.trim();
    if (!id) {
      setStatus("Enter a contract id");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const result = await apiClient.getFacilityLoDemoPrefill(id);
      if (!result.success) {
        setStatus(result.error?.message ?? "Prefill failed");
        return;
      }
      setForm(result.data);
      setStatus(`Prefilled from contract ${id}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Prefill failed");
    } finally {
      setBusy(false);
    }
  }, [apiClient, contractId]);

  const downloadFile = useCallback(
    async (format: "docx" | "pdf") => {
      setBusy(true);
      setStatus(null);
      try {
        const blob = await apiClient.generateFacilityLoDemoDocx(form, { format });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ARF-LO-${(form.issuer_name || "demo").replace(/[^\w-]+/g, "_").slice(0, 40)}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatus(
          format === "pdf"
            ? "Downloaded filled .pdf (Gotenberg); signature lines stay blank for wet ink"
            : "Downloaded filled .docx — open in Word; signature lines stay blank for wet ink"
        );
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Generate failed");
      } finally {
        setBusy(false);
      }
    },
    [apiClient, form]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Contract Letter of Offer (LO) demo</CardTitle>
          <CardDescription>
            Same Word template and merge/render path as production generate (
            <code>arf_contract_facility_lo</code> v4 — per-guarantor acknowledgement pages). Prefill uses{" "}
            <code>buildFacilityLoMergeData</code>; edits here only affect this download. PDF needs{" "}
            <code>GOTENBERG_URL</code>. Wet-ink only — not wired to Send Offer or SigningCloud.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-[240px] flex-1 flex-col gap-2">
            <Label htmlFor="contractId">Load from contract id</Label>
            <Input
              id="contractId"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              placeholder="Contract cuid"
              disabled={busy}
            />
          </div>
          <Button type="button" variant="secondary" onClick={() => void loadFromContract()} disabled={busy}>
            Prefill
          </Button>
          <Button type="button" variant="outline" onClick={() => void loadFixture()} disabled={busy}>
            Reset fixture
          </Button>
          <Button type="button" variant="outline" onClick={() => void downloadFile("docx")} disabled={busy}>
            Download .docx
          </Button>
          <Button type="button" onClick={() => void downloadFile("pdf")} disabled={busy}>
            Download .pdf
          </Button>
        </CardContent>
        {status ? <p className="px-6 pb-4 text-[15px] text-muted-foreground">{status}</p> : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Individual guarantors</CardTitle>
          <CardDescription>
            Repeated in the finance-document list and one full acknowledgement page per person.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {form.guarantors_individual.map((guarantor, index) => (
            <div key={index} className="grid gap-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Guarantor {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGuarantor(index)}
                  disabled={busy}
                >
                  Remove
                </Button>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`guarantor-name-${index}`}>Name</Label>
                <Input
                  id={`guarantor-name-${index}`}
                  value={guarantor.name}
                  onChange={(e) => setGuarantorField(index, "name", e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`guarantor-nric-${index}`}>NRIC</Label>
                <Input
                  id={`guarantor-nric-${index}`}
                  value={guarantor.nric}
                  onChange={(e) => setGuarantorField(index, "nric", e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`guarantor-line-${index}`}>List line (auto-filled)</Label>
                <Textarea
                  id={`guarantor-line-${index}`}
                  value={guarantor.line}
                  onChange={(e) => setGuarantorField(index, "line", e.target.value)}
                  rows={2}
                  disabled={busy}
                />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addGuarantor} disabled={busy}>
            Add guarantor
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Corporate guarantors</CardTitle>
          <CardDescription>
            Each company gets its own acknowledgement; more than four signatories continue on a new
            page (two boxes per row).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {form.guarantors_corporate.map((company, companyIndex) => (
            <div key={companyIndex} className="grid gap-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Company {companyIndex + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCorporate(companyIndex)}
                  disabled={busy}
                >
                  Remove
                </Button>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`corp-name-${companyIndex}`}>Company name</Label>
                <Input
                  id={`corp-name-${companyIndex}`}
                  value={company.name}
                  onChange={(e) => setCorporateField(companyIndex, "name", e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`corp-ssm-${companyIndex}`}>Registration / SSM</Label>
                <Input
                  id={`corp-ssm-${companyIndex}`}
                  value={company.ssm}
                  onChange={(e) => setCorporateField(companyIndex, "ssm", e.target.value)}
                  disabled={busy}
                />
              </div>
              {company.signatories.map((signatory, signatoryIndex) => (
                <div key={signatoryIndex} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="grid gap-2">
                    <Label htmlFor={`corp-sig-${companyIndex}-${signatoryIndex}`}>
                      Signatory {signatoryIndex + 1}
                    </Label>
                    <Input
                      id={`corp-sig-${companyIndex}-${signatoryIndex}`}
                      value={signatory.name}
                      onChange={(e) =>
                        setCorporateSignatory(companyIndex, signatoryIndex, e.target.value)
                      }
                      disabled={busy}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCorporateSignatory(companyIndex, signatoryIndex)}
                    disabled={busy}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addCorporateSignatory(companyIndex)}
                disabled={busy}
              >
                Add signatory
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addCorporate} disabled={busy}>
            Add company
          </Button>
        </CardContent>
      </Card>

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-lg">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {section.keys.map((key) => (
              <div key={key} className="grid gap-2">
                <Label htmlFor={key}>{FIELD_LABELS[key] ?? key}</Label>
                {LONG_FIELDS.has(key) ? (
                  <Textarea
                    id={key}
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    rows={2}
                    disabled={busy}
                  />
                ) : (
                  <Input
                    id={key}
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    disabled={busy}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Separator />
      <p className="text-sm text-muted-foreground">
        Template: <code>apps/api/src/modules/applications/templates/arf-contract-facility-lo.docx</code>
      </p>
    </div>
  );
}
