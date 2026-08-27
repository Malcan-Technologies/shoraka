export type SummaryField = {
  label: string;
  value: string;
};

export type SummaryInvoiceBlock = {
  heading: string;
  fields: SummaryField[];
  offerTerms: SummaryField[];
};

export type SummaryRemark = {
  subject: string;
  action: string;
  remark: string;
  authorName: string | null;
  at: string | null;
};

export type SummaryTimelineItem = {
  label: string;
  description: string | null;
  at: string | null;
};

export type ApplicationSummaryPdfModel = {
  title: string;
  disclaimer: string;
  generatedAtLabel: string;
  filename: string;
  identityFields: SummaryField[];
  facilityFields: SummaryField[];
  companyFields: SummaryField[];
  financingFields: SummaryField[];
  invoices: SummaryInvoiceBlock[];
  remarks: SummaryRemark[];
  timeline: SummaryTimelineItem[];
  documentNames: string[];
};

export type ApplicationSummaryLogInput = {
  id: string;
  event_type: string;
  remark?: string | null;
  activity?: string | null;
  created_at: Date | string;
};

export type ApplicationSummaryRemarkInput = {
  scope: string;
  scope_key: string;
  action_type: string;
  remark: string;
  author_user_id?: string | null;
  submitted_at?: Date | string | null;
  created_at?: Date | string | null;
};

export type ApplicationSummarySource = {
  id: string;
  display_reference?: string | null;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
  submitted_at?: Date | string | null;
  financing_type?: unknown;
  financing_structure?: unknown;
  company_details?: unknown;
  business_details?: unknown;
  supporting_documents?: unknown;
  acceptance_documents?: unknown;
  issuer_organization?: {
    name?: string | null;
    registration_number?: string | null;
    corporate_onboarding_data?: unknown;
  } | null;
  contract?: {
    id: string;
    display_reference?: string | null;
    status?: string | null;
    contract_details?: unknown;
    offer_details?: unknown;
    customer_details?: unknown;
    approved_facility?: unknown;
    available_facility?: unknown;
  } | null;
  invoices?: Array<{
    id: string;
    display_reference?: string | null;
    status?: string | null;
    details?: unknown;
    offer_details?: unknown;
    document?: unknown;
  }>;
  application_review_remarks?: ApplicationSummaryRemarkInput[];
};

export type ComposeApplicationSummaryInput = {
  application: ApplicationSummarySource;
  logs: ApplicationSummaryLogInput[];
  authorNames: Map<string, string> | Record<string, string>;
  generatedAt: Date;
};
