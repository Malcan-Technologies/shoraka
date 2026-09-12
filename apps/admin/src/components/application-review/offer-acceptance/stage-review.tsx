"use client";

import { ContractSection, type ContractSectionProps } from "../sections/contract-section";
import { CustomerSection, type CustomerSectionProps } from "../sections/customer-section";
import { InvoiceSection, type InvoiceSectionProps } from "../sections/invoice-section";

export function StageFacilityReview(props: ContractSectionProps) {
  return (
    <ContractSection
      {...props}
      contentMode="review"
      embedded
      hideSectionComments
    />
  );
}

export function StageFacilityReference(props: ContractSectionProps) {
  return (
    <ContractSection
      {...props}
      contentMode="reference"
      embedded
      hideSectionComments
      isReviewable={false}
    />
  );
}

export function StageCustomerReview(props: CustomerSectionProps) {
  return <CustomerSection {...props} embedded hideSectionComments />;
}

export function StageInvoiceReview(props: InvoiceSectionProps) {
  return (
    <InvoiceSection
      {...props}
      contentMode="review"
      embedded
      hideCapacity
      hideSwitcher
      hideSectionComments
    />
  );
}
