export interface TrusteePaymentRow {
  no: number;
  nameOfPayee: string;
  accountNo: string;
  banker: string;
  amount: number;
  remarks: string;
}

export interface RepaymentBorrowerEntry {
  name: string;
  amount: number;
  date: string;
}

export interface TrusteeLetterData {
  ourRef: string;
  date: string;
  trusteeName: string;
  trusteeAddressLines: string[];
  attentionPerson: string;
  platformDisplayName: string;
  instructionTitle: string;
  debitAccountNumber: string;
  debitAccountName: string;
  valueDate: string;
  purpose: string;
  openingParagraph: string;
  paymentRows: TrusteePaymentRow[];
  supportingParagraph: string;
  contactPerson: string;
  enclosingDocuments: boolean;
  authorisedSignatoryLabel: string;
}
