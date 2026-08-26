"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@cashsouk/ui";
import { StatusBadge } from "@cashsouk/ui";
import { AuditActorBadge } from "./audit-actor-badge";
import { AuditBeforeAfterDiff } from "./audit-before-after-diff";
import type { AuditDetailField, AuditDetailRecord } from "./audit-detail-model";
import { AuditEventBadge } from "./audit-event-badge";
import { AuditMetadataView } from "./audit-metadata-view";
import { AuditSourceBadge } from "./audit-source-badge";
import { formatAuditDateTime, formatAuditSourceLabel } from "./audit-presentation";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-ui font-medium text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function FieldList({ fields }: { fields: AuditDetailField[] }) {
  if (fields.length === 0) return null;
  return (
    <dl className="space-y-2">
      {fields.map((field) => (
        <div key={field.label} className="grid grid-cols-[minmax(7rem,9rem)_1fr] gap-x-3 text-ui">
          <dt className="text-muted-foreground">{field.label}</dt>
          <dd className="min-w-0 break-words">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function nonEmpty(value: string | null | undefined): value is string {
  return Boolean(value && value.trim());
}

export function AuditDetailDrawer({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AuditDetailRecord | null;
}) {
  const actor = record?.actor;
  const target = record?.target;
  const financial = record?.financial;
  const delivery = record?.delivery;

  const overview = record
    ? [
        { label: "Event", value: record.eventLabel },
        { label: "Description", value: record.description },
        { label: "Timestamp", value: formatAuditDateTime(record.timestamp) },
        { label: "Status", value: record.status },
      ].filter((field): field is AuditDetailField => nonEmpty(field.value))
    : [];

  const actorFields = actor
    ? [
        { label: "Actor name", value: actor.name },
        { label: "Actor email", value: actor.email },
        { label: "Organisation", value: actor.organisation },
        { label: "Source", value: actor.source ? formatAuditSourceLabel(actor.source) : null },
      ].filter((field): field is AuditDetailField => nonEmpty(field.value))
    : [];

  const targetFields = target
    ? [
        { label: "Target type", value: target.type },
        { label: "Target ID", value: target.id },
        { label: "Application reference", value: target.applicationReference },
        { label: "Note reference", value: target.noteReference },
        { label: "Investment reference", value: target.investmentReference },
        { label: "Withdrawal reference", value: target.withdrawalReference },
        { label: "Payment reference", value: target.paymentReference },
        { label: "Gateway reference", value: target.gatewayReference },
        { label: "Trustee instruction", value: target.trusteeInstructionReference },
        { label: "Envelope reference", value: target.envelopeReference },
        ...(target.extra ?? []),
      ].filter((field): field is AuditDetailField => nonEmpty(field.value))
    : [];

  const financialFields = financial
    ? [
        { label: "Amount", value: financial.amount },
        { label: "Currency", value: financial.currency },
        { label: "Previous amount", value: financial.previousAmount },
        { label: "New amount", value: financial.newAmount },
        { label: "Payment status", value: financial.paymentStatus },
        { label: "Settlement status", value: financial.settlementStatus },
        ...(financial.extra ?? []),
      ].filter((field): field is AuditDetailField => nonEmpty(field.value))
    : [];

  const deliveryFields = delivery
    ? [
        { label: "Notification type", value: delivery.notificationType },
        { label: "Title", value: delivery.title },
        { label: "Message", value: delivery.message },
        { label: "Recipient / audience", value: delivery.audience },
        { label: "Source", value: delivery.source },
        { label: "Platform delivered", value: delivery.platformDelivered },
        { label: "Email delivered", value: delivery.emailDelivered },
        { label: "Idempotency key", value: delivery.idempotencyKey },
      ].filter((field): field is AuditDetailField => nonEmpty(field.value))
    : [];

  const reasonFields = record
    ? [
        { label: "Reason", value: record.reason },
        { label: "Remark", value: record.remark },
      ].filter((field): field is AuditDetailField => nonEmpty(field.value))
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{record?.title ?? "Event details"}</SheetTitle>
          <SheetDescription>Read-only operational evidence for this event.</SheetDescription>
        </SheetHeader>

        {record ? (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <AuditEventBadge eventType={record.eventType} label={record.eventLabel} status={record.status} />
              {record.status ? (
                <StatusBadge
                  label={record.status}
                  status={
                    record.status.toLowerCase() === "failed" ||
                    record.status.toLowerCase() === "rejected"
                      ? "rejected"
                      : record.status.toLowerCase() === "success" ||
                          record.status.toLowerCase() === "completed"
                        ? "success"
                        : "neutral"
                  }
                />
              ) : null}
            </div>

            {overview.length > 0 ? (
              <Section title="Overview">
                <FieldList fields={overview} />
              </Section>
            ) : null}

            {actor && (actorFields.length > 0 || actor.type || actor.source) ? (
              <Section title="Actor">
                <div className="flex flex-wrap gap-2">
                  <AuditActorBadge type={actor.type} />
                  <AuditSourceBadge source={actor.source} />
                </div>
                <FieldList fields={actorFields} />
              </Section>
            ) : null}

            {targetFields.length > 0 ? (
              <Section title="Target / reference">
                <FieldList fields={targetFields} />
              </Section>
            ) : null}

            {financialFields.length > 0 ? (
              <Section title="Financial details">
                <FieldList fields={financialFields} />
              </Section>
            ) : null}

            {record.changedFields && record.changedFields.length > 0 ? (
              <Section title="Change details">
                <AuditBeforeAfterDiff fields={record.changedFields} />
              </Section>
            ) : null}

            {reasonFields.length > 0 ? (
              <Section title="Reason / remark">
                <FieldList fields={reasonFields} />
              </Section>
            ) : null}

            {deliveryFields.length > 0 ? (
              <Section title="Delivery">
                <FieldList fields={deliveryFields} />
              </Section>
            ) : null}

            {(record.technical && record.technical.length > 0) ||
            record.metadata != null ||
            record.previousValues != null ||
            record.nextValues != null ? (
              <Section title="Technical details">
                <FieldList fields={record.technical ?? []} />
                {record.previousValues != null ? (
                  <AuditMetadataView title="Previous values" value={record.previousValues} />
                ) : null}
                {record.nextValues != null ? (
                  <AuditMetadataView title="New values" value={record.nextValues} />
                ) : null}
                <AuditMetadataView title="Raw metadata" value={record.metadata} />
              </Section>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
