"use client";

import { ContractSection, type ContractSectionProps } from "../sections/contract-section";
import { InvoiceSection, type InvoiceSectionProps } from "../sections/invoice-section";

export function StageFacilitySendOffer(props: ContractSectionProps) {
  return (
    <ContractSection
      {...props}
      contentMode="offer"
      embedded
      hideSectionComments
    />
  );
}

export function StageInvoiceSendOffer(props: InvoiceSectionProps) {
  return (
    <InvoiceSection
      {...props}
      contentMode="offer"
      embedded
      hideCapacity
      hideSwitcher
      hideSectionComments
    />
  );
}
