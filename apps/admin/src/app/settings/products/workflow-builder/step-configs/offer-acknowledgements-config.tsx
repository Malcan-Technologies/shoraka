"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { INPUT_CLASS, SECTION_GAP } from "../product-form-input-styles";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { Textarea } from "../../../../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../components/ui/select";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
  DEFAULT_OFFER_ACKNOWLEDGEMENTS,
  OFFER_ACKNOWLEDGEMENTS_WORKFLOW_KEY,
  parseOfferAcknowledgementsConfig,
  writeOfferAcknowledgementsConfig,
  type OfferAcknowledgementContentSource,
  type OfferAcknowledgementDocument,
  type OfferAcknowledgementTemplateKey,
} from "@cashsouk/types";
import { validateOptionalWorkflowDocumentTemplateFile } from "./workflow-document-row-editor";

function slugifyKey(name: string, index: number): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return base || `acknowledgement_${index}`;
}

export function OfferAcknowledgementsConfig({
  config,
  onChange,
  onPendingTemplateChange,
}: {
  config: unknown;
  onChange: (nextFinancingConfig: Record<string, unknown>) => void;
  onPendingTemplateChange?: (index: number, file: File | null) => void;
}) {
  const base = React.useMemo(() => (config as Record<string, unknown>) ?? {}, [config]);
  const [items, setItems] = React.useState<OfferAcknowledgementDocument[]>(() =>
    parseOfferAcknowledgementsConfig(config)
  );
  const [pendingFiles, setPendingFiles] = React.useState<Record<number, File>>({});

  React.useEffect(() => {
    setItems(parseOfferAcknowledgementsConfig(config));
  }, [config]);

  const persist = React.useCallback(
    (nextItems: OfferAcknowledgementDocument[]) => {
      onChange(writeOfferAcknowledgementsConfig(base, nextItems));
    },
    [base, onChange]
  );

  const addDoc = (preset?: "letter_of_offer" | "guarantee_acknowledgement") => {
    if (preset) {
      const existing = items.some((item) => item.key === preset);
      if (existing) return;
      const fromDefault = DEFAULT_OFFER_ACKNOWLEDGEMENTS.find((doc) => doc.key === preset);
      if (!fromDefault) return;
      const next = [...items, { ...fromDefault }];
      setItems(next);
      persist(next);
      return;
    }
    const index = items.length;
    const next: OfferAcknowledgementDocument[] = [
      ...items,
      {
        key: `acknowledgement_${index}`,
        name: "",
        required: true,
        content_source: "html_template",
        template_key: "letter_of_offer",
      },
    ];
    setItems(next);
    persist(next);
  };

  const updateDoc = (index: number, updates: Partial<OfferAcknowledgementDocument>) => {
    const next = [...items];
    const current = next[index];
    const merged: OfferAcknowledgementDocument = { ...current, ...updates };
    if (updates.name != null && (!current.key || current.key.startsWith("acknowledgement_"))) {
      merged.key = slugifyKey(updates.name, index);
    }
    if (updates.content_source === "html_template") {
      delete merged.template;
      delete merged.static_text;
      if (!merged.template_key) merged.template_key = "letter_of_offer";
    }
    if (updates.content_source === "static_text") {
      delete merged.template;
      delete merged.template_key;
    }
    if (updates.content_source === "generated_offer_letter") {
      delete merged.template;
      delete merged.static_text;
      delete merged.template_key;
    }
    if (updates.content_source === "template_pdf") {
      delete merged.static_text;
      delete merged.template_key;
    }
    if (updates.template_key) {
      merged.key = updates.template_key;
      if (updates.template_key === "letter_of_offer" && !updates.name) {
        merged.name = merged.name || "Letter of Offer";
      }
      if (updates.template_key === "guarantee_acknowledgement" && !updates.name) {
        merged.name = merged.name || "Guarantee Acknowledgement";
      }
    }
    next[index] = merged;
    setItems(next);
    persist(next);
  };

  const removeDoc = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    persist(next);
    setPendingFiles((prev) => {
      const out: Record<number, File> = {};
      for (const [k, v] of Object.entries(prev)) {
        const ki = Number(k);
        if (ki < index) out[ki] = v;
        else if (ki > index) out[ki - 1] = v;
      }
      return out;
    });
  };

  const handleTemplateSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!validateOptionalWorkflowDocumentTemplateFile(file)) return;
    setPendingFiles((prev) => ({ ...prev, [index]: file }));
    onPendingTemplateChange?.(index, file);
  };

  const removeTemplate = (index: number) => {
    const hadPending = Boolean(pendingFiles[index]);
    setPendingFiles((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    onPendingTemplateChange?.(index, null);
    if (hadPending) return;
    updateDoc(index, { template: undefined });
  };

  const hasLetterOfOffer = items.some((item) => item.key === "letter_of_offer");
  const hasGuaranteeAck = items.some((item) => item.key === "guarantee_acknowledgement");

  return (
    <div className={cn("grid min-w-0", SECTION_GAP)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">Offer acknowledgements</h2>
        <p className="text-sm text-muted-foreground">
          Documents the issuer must preview and tick before uploading acceptance files. Choose Letter
          of Offer or Guarantee Acknowledgement (HTML placeholders for now), or add a custom row. One
          checkbox per document — not signed on SigningCloud.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value=""
          onValueChange={(value) => {
            if (value === "letter_of_offer" || value === "guarantee_acknowledgement") {
              addDoc(value);
              return;
            }
            if (value === "custom") addDoc();
          }}
        >
          <SelectTrigger className={cn(INPUT_CLASS, "w-auto min-w-[220px] gap-1.5")}>
            <PlusIcon className="h-4 w-4 shrink-0" />
            <SelectValue placeholder="Add acknowledgement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="letter_of_offer" disabled={hasLetterOfOffer}>
              Letter of Offer
            </SelectItem>
            <SelectItem value="guarantee_acknowledgement" disabled={hasGuaranteeAck}>
              Guarantee Acknowledgement
            </SelectItem>
            <SelectItem value="custom">Custom acknowledgement</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-6">
          No acknowledgements configured. Add Letter of Offer and Guarantee Acknowledgement for the
          standard facility pair.
        </p>
      ) : (
        <ul className={cn("flex flex-col", SECTION_GAP)}>
          {items.map((item, index) => (
            <li
              key={`${OFFER_ACKNOWLEDGEMENTS_WORKFLOW_KEY}_${item.key}_${index}`}
              className="rounded-xl border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Name</Label>
                    <Input
                      className={INPUT_CLASS}
                      value={item.name}
                      placeholder="e.g. Letter of Offer"
                      onChange={(e) => updateDoc(index, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Preview source</Label>
                    <Select
                      value={item.content_source}
                      onValueChange={(value) =>
                        updateDoc(index, {
                          content_source: value as OfferAcknowledgementContentSource,
                        })
                      }
                    >
                      <SelectTrigger className={INPUT_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="html_template">HTML template (placeholder)</SelectItem>
                        <SelectItem value="generated_offer_letter">
                          Generated offer letter (PDF)
                        </SelectItem>
                        <SelectItem value="template_pdf">Uploaded template (PDF)</SelectItem>
                        <SelectItem value="static_text">Static text</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground"
                  onClick={() => removeDoc(index)}
                  aria-label={`Remove ${item.name || "acknowledgement"}`}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>

              {item.content_source === "html_template" ? (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">HTML template</Label>
                  <Select
                    value={item.template_key ?? "letter_of_offer"}
                    onValueChange={(value) =>
                      updateDoc(index, {
                        template_key: value as OfferAcknowledgementTemplateKey,
                        name:
                          value === "letter_of_offer"
                            ? "Letter of Offer"
                            : "Guarantee Acknowledgement",
                        key: value,
                      })
                    }
                  >
                    <SelectTrigger className={INPUT_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="letter_of_offer">Letter of Offer</SelectItem>
                      <SelectItem value="guarantee_acknowledgement">
                        Guarantee Acknowledgement
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Shows a hardcoded HTML placeholder in the issuer modal. Replace with the real
                    templated copy later — keep the same template key.
                  </p>
                </div>
              ) : null}

              {item.content_source === "static_text" ? (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Text shown in modal</Label>
                  <Textarea
                    className="min-h-[100px] rounded-xl"
                    value={item.static_text ?? ""}
                    placeholder="Paste the acknowledgement wording…"
                    onChange={(e) => updateDoc(index, { static_text: e.target.value })}
                  />
                </div>
              ) : null}

              {item.content_source === "template_pdf" ? (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Template PDF</Label>
                  {item.template?.file_name || pendingFiles[index] ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {pendingFiles[index]?.name ?? item.template?.file_name}
                      </span>
                      <Button type="button" variant="outline" size="sm" onClick={() => removeTemplate(index)}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Input
                      type="file"
                      accept=".pdf,application/pdf"
                      className={INPUT_CLASS}
                      onChange={(e) => handleTemplateSelect(index, e)}
                    />
                  )}
                </div>
              ) : null}

              {item.content_source === "generated_offer_letter" ? (
                <p className="text-sm text-muted-foreground">
                  Issuer will preview the system-generated offer letter PDF for this offer.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
