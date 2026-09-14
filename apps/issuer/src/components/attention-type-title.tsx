import type { ReactNode } from "react";
import { BanknotesIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import {
  ATTENTION_KIND_LABELS,
  type AttentionFinancingKind,
} from "@/components/attention-type";

const ICONS = {
  facility: BanknotesIcon,
  invoice: DocumentTextIcon,
} as const;

function AttentionTypeEyebrow({ kind }: { kind: AttentionFinancingKind }) {
  const Icon = ICONS[kind];
  return (
    <p className="flex items-center gap-1.5 text-meta font-medium text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{ATTENTION_KIND_LABELS[kind]}</span>
    </p>
  );
}

/** Attention carousel heading: type eyebrow (icon + Facility/Invoice), then the task. */
export function AttentionCardHeading({
  kind,
  children,
}: {
  kind: AttentionFinancingKind | null;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 min-w-0">
      {kind ? <AttentionTypeEyebrow kind={kind} /> : null}
      <h3 className={kind ? "mt-2 min-w-0 text-section-title" : "min-w-0 text-section-title"}>
        <span className="line-clamp-2 min-h-14 min-w-0 leading-7 md:min-h-16 md:leading-8">{children}</span>
      </h3>
    </div>
  );
}
