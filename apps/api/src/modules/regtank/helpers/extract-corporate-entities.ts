/**
 * Shared helper to extract corporate entities from RegTank COD details.
 * Used by COD webhook handler and admin refresh endpoint.
 */
export function extractCorporateEntities(codDetails: {
  corpIndvDirectors?: unknown[];
  corpIndvShareholders?: unknown[];
  corpBizShareholders?: unknown[];
}) {
  const directors = (codDetails.corpIndvDirectors || []).map((director: unknown) => {
    const d = director as Record<string, unknown>;
    return {
    eodRequestId: (d.corporateIndividualRequest as Record<string, unknown>)?.requestId || null,
    personalInfo: {
      firstName: (d.corporateUserRequestInfo as Record<string, unknown>)?.firstName || null,
      lastName: (d.corporateUserRequestInfo as Record<string, unknown>)?.lastName || null,
      middleName: (d.corporateUserRequestInfo as Record<string, unknown>)?.middleName || null,
      fullName: (d.corporateUserRequestInfo as Record<string, unknown>)?.fullName || null,
      email: (d.corporateUserRequestInfo as Record<string, unknown>)?.email || null,
      formContent: (d.corporateUserRequestInfo as Record<string, unknown>)?.formContent || null,
    },
    documents: {
      documentType: (d.corporateDocumentInfo as Record<string, unknown>)?.documentType || null,
      countryCode: (d.corporateDocumentInfo as Record<string, unknown>)?.countryCode || null,
      ocrStatus: (d.corporateDocumentInfo as Record<string, unknown>)?.ocrStatus || null,
      frontDocumentUrl: (d.corporateDocumentInfo as Record<string, unknown>)?.frontDocumentUrl || null,
      backDocumentUrl: (d.corporateDocumentInfo as Record<string, unknown>)?.backDocumentUrl || null,
    },
    status: (d.corporateIndividualRequest as Record<string, unknown>)?.status || null,
    approveStatus: (d.corporateIndividualRequest as Record<string, unknown>)?.approveStatus || null,
    kycType: (d.corporateIndividualRequest as Record<string, unknown>)?.kycType || null,
    createdDate: (d.corporateIndividualRequest as Record<string, unknown>)?.createdDate || null,
    updatedDate: (d.corporateIndividualRequest as Record<string, unknown>)?.updatedDate || null,
  };
  });

  const shareholders = (codDetails.corpIndvShareholders || []).map((shareholder: unknown) => {
    const s = shareholder as Record<string, unknown>;
    return {
    eodRequestId: (s.corporateIndividualRequest as Record<string, unknown>)?.requestId || null,
    personalInfo: {
      firstName: (s.corporateUserRequestInfo as Record<string, unknown>)?.firstName || null,
      lastName: (s.corporateUserRequestInfo as Record<string, unknown>)?.lastName || null,
      middleName: (s.corporateUserRequestInfo as Record<string, unknown>)?.middleName || null,
      fullName: (s.corporateUserRequestInfo as Record<string, unknown>)?.fullName || null,
      email: (s.corporateUserRequestInfo as Record<string, unknown>)?.email || null,
      formContent: (s.corporateUserRequestInfo as Record<string, unknown>)?.formContent || null,
    },
    documents: {
      documentType: (s.corporateDocumentInfo as Record<string, unknown>)?.documentType || null,
      countryCode: (s.corporateDocumentInfo as Record<string, unknown>)?.countryCode || null,
      ocrStatus: (s.corporateDocumentInfo as Record<string, unknown>)?.ocrStatus || null,
      frontDocumentUrl: (s.corporateDocumentInfo as Record<string, unknown>)?.frontDocumentUrl || null,
      backDocumentUrl: (s.corporateDocumentInfo as Record<string, unknown>)?.backDocumentUrl || null,
    },
    status: (s.corporateIndividualRequest as Record<string, unknown>)?.status || null,
    approveStatus: (s.corporateIndividualRequest as Record<string, unknown>)?.approveStatus || null,
    kycType: (s.corporateIndividualRequest as Record<string, unknown>)?.kycType || null,
    createdDate: (s.corporateIndividualRequest as Record<string, unknown>)?.createdDate || null,
    updatedDate: (s.corporateIndividualRequest as Record<string, unknown>)?.updatedDate || null,
  };
  });

  const corporateShareholders = (codDetails.corpBizShareholders || []).map((corpShareholder: unknown) => ({
    ...(corpShareholder as Record<string, unknown>),
  }));

  return {
    directors,
    shareholders,
    corporateShareholders,
  };
}
