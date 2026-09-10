"use client";

import * as React from "react";
import {
  SHORAKA_SIGNING_PERSON_NO_SIGNATURE_MESSAGE,
  defaultDocumentSigningPersonId,
  type DocumentSigningOptions,
} from "@cashsouk/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useS3ViewUrl } from "@/hooks/use-s3";

function ImagePreview({ s3Key, alt }: { s3Key: string | null; alt: string }) {
  const { data: url } = useS3ViewUrl(s3Key);
  if (!s3Key) {
    return <p className="text-ui text-muted-foreground">Not configured.</p>;
  }
  if (!url) {
    return <p className="text-ui text-muted-foreground">Loading preview…</p>;
  }
  return (
    <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-md border bg-background p-1.5">
      <img src={url} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

export function DocumentSigningPersonFields({
  options,
  selectedId,
  onSelectedIdChange,
  disabled,
}: {
  options: DocumentSigningOptions | undefined;
  selectedId: string;
  onSelectedIdChange: (id: string) => void;
  disabled?: boolean;
}) {
  const people = options?.people ?? [];
  const selected = people.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border px-3 py-3">
      <div className="space-y-1.5">
        <Label htmlFor="document-signing-person">Signing person *</Label>
        {people.length === 0 ? (
          <p className="text-ui text-muted-foreground">
            Add an Authorised Signatory under Shoraka Profile → Signing & Authorisation.
          </p>
        ) : (
          <Select
            value={selectedId || undefined}
            onValueChange={onSelectedIdChange}
            disabled={disabled}
          >
            <SelectTrigger id="document-signing-person" className="h-10 text-ui">
              <SelectValue placeholder="Select signing person" />
            </SelectTrigger>
            <SelectContent>
              {people.map((person) => (
                <SelectItem key={person.id} value={person.id} className="text-ui">
                  {person.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {selected && !selected.hasSignature ? (
        <p className="text-ui text-destructive">{SHORAKA_SIGNING_PERSON_NO_SIGNATURE_MESSAGE}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-ui font-medium">Signature</p>
          <ImagePreview s3Key={selected?.signatureS3Key ?? null} alt="Selected signing person signature" />
        </div>
        <div className="space-y-1.5">
          <p className="text-ui font-medium">Company Stamp</p>
          <ImagePreview s3Key={options?.companyStampS3Key ?? null} alt="Shoraka company stamp" />
        </div>
      </div>
      <p className="text-meta text-muted-foreground">
        To change the signature or company stamp, go to Shoraka Profile → Signing & Authorisation.
      </p>
    </div>
  );
}

export function useDocumentSigningPersonSelection(options: DocumentSigningOptions | undefined) {
  const [selectedId, setSelectedId] = React.useState("");
  const people = options?.people;

  React.useEffect(() => {
    const next = defaultDocumentSigningPersonId(people);
    setSelectedId((current) => {
      if (current && people?.some((row) => row.id === current)) return current;
      return next;
    });
  }, [people]);

  const selected = people?.find((row) => row.id === selectedId) ?? null;
  return {
    selectedId,
    setSelectedId,
    selected,
    canSubmit: Boolean(selected?.hasSignature),
  };
}
