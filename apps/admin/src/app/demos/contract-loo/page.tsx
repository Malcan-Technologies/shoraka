"use client";

/**
 * DEMO ONLY — temporary Contract ARF-i LOO merge playground.
 * Deep-link: /demos/contract-loo
 * Wet-ink signatures; no SigningCloud.
 */

import { useHeader } from "@cashsouk/ui";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { ContractLooMergeData } from "@cashsouk/types";
import { CONTRACT_LOO_MERGE_KEYS } from "@cashsouk/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const FIELD_LABELS: Partial<Record<keyof ContractLooMergeData, string>> = {
  letterhead_note: "Letterhead note",
  issuer_id: "Issuer ID",
  our_reference: "Our reference",
  letter_date: "Letter date",
  issuer_name: "Issuer name",
  issuer_registration_number: "Issuer registration number",
  issuer_address: "Issuer address",
  attention_name: "Attention name",
  attention_position: "Attention position",
  financing_limit_rm: "Financing limit (RM …)",
  margin_of_receivable_percent: "Margin of receivable %",
  profit_rate_percent: "Profit rate % (per month wording)",
  tenure_days: "Tenure days",
  availability_period_phrase: "Availability period phrase",
  guarantor_1_line: "Guarantor 1 line (Name + NRIC)",
  guarantor_2_line: "Guarantor 2 line",
  guarantor_3_line: "Guarantor 3 line",
  guarantor_1_name: "Guarantor 1 name (ack)",
  guarantor_2_name: "Guarantor 2 name (ack)",
  payment_period_days: "Payment period days",
  grace_period_days: "Grace period days",
  grace_period_days_words: "Grace period days (words)",
  transaction_docs_days: "Transaction docs days",
  transaction_docs_days_words: "Transaction docs days (words)",
  withdrawal_notice_phrase: "Withdrawal notice phrase",
  offer_validity_phrase: "Offer validity phrase",
  assigned_contract_date: "Assigned contract date",
  assigned_contract_counterparty: "Assigned contract counterparty",
  assigned_contract_description: "Assigned contract description",
  moa_authorised_signatory_names: "MoA authorised signatory name(s)",
  corporate_guarantor_name: "Corporate guarantor name",
  corporate_guarantor_ssm: "Corporate guarantor SSM",
  corporate_signatory_1_name: "Corporate signatory 1",
  corporate_signatory_2_name: "Corporate signatory 2",
};

const SECTIONS: Array<{ title: string; keys: Array<keyof ContractLooMergeData> }> = [
  {
    title: "Header / letter meta",
    keys: ["letterhead_note", "issuer_id", "our_reference", "letter_date"],
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
    title: "Facility terms",
    keys: [
      "financing_limit_rm",
      "margin_of_receivable_percent",
      "profit_rate_percent",
      "tenure_days",
      "availability_period_phrase",
    ],
  },
  {
    title: "Guarantors (transaction documents)",
    keys: ["guarantor_1_line", "guarantor_2_line", "guarantor_3_line"],
  },
  {
    title: "Payment / timeline",
    keys: [
      "payment_period_days",
      "grace_period_days",
      "grace_period_days_words",
      "transaction_docs_days",
      "transaction_docs_days_words",
      "withdrawal_notice_phrase",
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
    title: "Memorandum / acknowledgements",
    keys: [
      "moa_authorised_signatory_names",
      "guarantor_1_name",
      "guarantor_2_name",
      "corporate_guarantor_name",
      "corporate_guarantor_ssm",
      "corporate_signatory_1_name",
      "corporate_signatory_2_name",
    ],
  },
];

const LONG_FIELDS = new Set<keyof ContractLooMergeData>([
  "issuer_address",
  "assigned_contract_description",
  "guarantor_1_line",
  "guarantor_2_line",
  "guarantor_3_line",
]);

function emptyMerge(): ContractLooMergeData {
  return Object.fromEntries(CONTRACT_LOO_MERGE_KEYS.map((k) => [k, ""])) as ContractLooMergeData;
}

export default function ContractLooDemoPage() {
  const { setTitle } = useHeader();
  useEffect(() => {
    setTitle("Contract LOO demo (temporary)");
    return () => setTitle("");
  }, [setTitle]);

  const { getAccessToken } = useAuthToken();
  const apiClient = useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);

  const [form, setForm] = useState<ContractLooMergeData>(emptyMerge);
  const [contractId, setContractId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setField = useCallback((key: keyof ContractLooMergeData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const loadFixture = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await apiClient.getContractLooDemoFixture();
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
      const result = await apiClient.getContractLooDemoPrefill(id);
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

  const downloadDocx = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await apiClient.generateContractLooDemoDocx(form);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ARF-LOO-${(form.issuer_name || "demo").replace(/[^\w-]+/g, "_").slice(0, 40)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("Downloaded filled .docx — open in Word; signature lines stay blank for wet ink");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }, [apiClient, form]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Contract LOO generation demo</CardTitle>
          <CardDescription>
            Temporary playground for the ARF-i facility Letter of Offer. Edits merge into the legal
            Word template and download as <code>.docx</code> for wet-ink signing. Not wired to Send
            Offer or SigningCloud.
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
          <Button type="button" onClick={() => void downloadDocx()} disabled={busy}>
            Download .docx
          </Button>
        </CardContent>
        {status ? <p className="px-6 pb-4 text-[15px] text-muted-foreground">{status}</p> : null}
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
        Template: <code>apps/api/src/modules/applications/templates/arf-contract-facility-loo.docx</code>
      </p>
    </div>
  );
}
