"use client";

import * as React from "react";
import type { OfferAcknowledgementDocument } from "@cashsouk/types";
import { resolveOfferAcknowledgementHtml } from "@cashsouk/types";
import { Checkbox } from "@cashsouk/ui";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type OfferAcknowledgementStepProps = {
  applicationId: string;
  offerType: "contract" | "invoice";
  invoiceId?: string | null;
  documents: OfferAcknowledgementDocument[];
  checkedKeys: Set<string>;
  onCheckedChange: (key: string, checked: boolean) => void;
  readOnly?: boolean;
  /** Object URL or remote URL for generated offer letter PDF preview */
  offerLetterPreviewUrl?: string | null;
  /** Resolve a template PDF preview URL for template_pdf rows */
  getTemplatePreviewUrl?: (doc: OfferAcknowledgementDocument) => string | null | undefined;
};

function PreviewPane({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="max-h-[320px] overflow-auto rounded-xl border border-border bg-muted/30 p-3">
        {children}
      </div>
    </div>
  );
}

function HtmlPreview({ html, title }: { html: string; title: string }) {
  return (
    <PreviewPane title={title}>
      <div
        className="prose prose-neutral max-w-none text-[17px] leading-7 text-foreground [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3"
        // Controlled placeholder HTML from product template_key — not user-authored input.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </PreviewPane>
  );
}

function escapePlainTextAsHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

export function OfferAcknowledgementStep({
  documents,
  checkedKeys,
  onCheckedChange,
  readOnly = false,
  offerLetterPreviewUrl,
  getTemplatePreviewUrl,
}: OfferAcknowledgementStepProps) {
  return (
    <div className="space-y-6">
      {documents.map((doc) => {
        const checked = checkedKeys.has(doc.key);
        const templateUrl = getTemplatePreviewUrl?.(doc) ?? null;
        const htmlBody = resolveOfferAcknowledgementHtml(doc);

        return (
          <div
            key={doc.key}
            className={cn(
              "space-y-3 rounded-xl border border-border bg-card p-4",
              checked && "border-primary/30"
            )}
          >
            <h3 className="text-base font-semibold text-foreground">{doc.name}</h3>

            {doc.content_source === "html_template" ? (
              htmlBody ? (
                <HtmlPreview title="Document preview" html={htmlBody} />
              ) : (
                <p className="text-sm text-muted-foreground">No HTML template configured.</p>
              )
            ) : null}

            {doc.content_source === "static_text" ? (
              htmlBody ? (
                <HtmlPreview title="Document text" html={`<p>${escapePlainTextAsHtml(htmlBody)}</p>`} />
              ) : (
                <p className="text-sm text-muted-foreground">No text configured.</p>
              )
            ) : null}

            {doc.content_source === "generated_offer_letter" ? (
              <PreviewPane title="Letter of Offer preview">
                {offerLetterPreviewUrl ? (
                  <iframe
                    title={`${doc.name} preview`}
                    src={offerLetterPreviewUrl}
                    className="h-[280px] w-full rounded-lg bg-white"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading offer letter…</p>
                )}
              </PreviewPane>
            ) : null}

            {doc.content_source === "template_pdf" ? (
              <PreviewPane title="Document preview">
                {templateUrl ? (
                  <iframe
                    title={`${doc.name} preview`}
                    src={templateUrl}
                    className="h-[280px] w-full rounded-lg bg-white"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {doc.template?.file_name
                      ? `Template: ${doc.template.file_name} (preview unavailable)`
                      : "No template uploaded."}
                  </p>
                )}
              </PreviewPane>
            ) : null}

            <div className="flex items-start gap-3 pt-1">
              <Checkbox
                id={`ack-${doc.key}`}
                checked={checked}
                disabled={readOnly}
                onCheckedChange={(value) => onCheckedChange(doc.key, value === true)}
                className="mt-1"
              />
              <Label htmlFor={`ack-${doc.key}`} className="text-[17px] leading-7 font-normal">
                I have read and accept the {doc.name}
                {doc.required === false ? " (optional)" : ""}
              </Label>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function areRequiredAcknowledgementsChecked(
  documents: OfferAcknowledgementDocument[],
  checkedKeys: Set<string>
): boolean {
  return documents
    .filter((doc) => doc.required !== false)
    .every((doc) => checkedKeys.has(doc.key));
}
