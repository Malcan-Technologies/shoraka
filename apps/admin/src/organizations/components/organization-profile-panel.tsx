"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { BANK_ACCOUNT_TYPES, MALAYSIAN_BANKS, malaysianBankLabel } from "@cashsouk/config";
import {
  ABOUT_YOUR_BUSINESS_LIMITS,
  SC_COMPANY_TYPE_LABELS,
  SC_COMPANY_TYPES,
  SC_GENDER_LABELS,
  SC_GENDERS,
  allowedScInvestorCategories,
  SC_INVESTOR_CATEGORY_DEFINITIONS,
  SC_INVESTOR_CATEGORY_LABELS,
  scInvestorCategoryHelp,
  scInvestorCategoryAfterSophisticatedChange,
  SELECT_SOPHISTICATED_INVESTOR_FIRST_MESSAGE,
  isSophisticatedInvestorSelected,
  typeOfInvestorValidationMessage,
  SC_MALAYSIAN_STATES,
  SC_MONTHLY_INVESTOR,
  SC_MONTHLY_ISSUER,
  displayScCompanyTypeLabel,
  firstIssueMessage,
  humanizeApiValidationMessage,
  isProfileValidationError,
  issuesByField,
  restrictScPostcodeInput,
  shouldShowOrganizationPersonalKycCard,
  validateInvestorPersonalForm,
  validateIssuerAddressForm,
  validateIssuerCompanyForm,
  type OrganizationDetailResponse,
  type PortalType,
  type ScGender,
  type ScInvestorCategory,
} from "@cashsouk/types";
import { YesNoRadioDisplay } from "@cashsouk/ui";
import {
  ArrowTopRightOnSquareIcon,
  BanknotesIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  FaceSmileIcon,
  IdentificationIcon,
  LinkIcon,
  PhoneIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import {
  AdminCollapsibleCard,
  AdminDetailCardHeader,
} from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { OrganizationCardEditActions } from "./organization-card-edit-actions";
import { useUpdateOrganizationProfile } from "@/organizations/hooks/use-update-organization-profile";
import {
  EditableAddressFields,
  EditableDateField,
  EditableField,
  EditablePhoneField,
  EditableSelect,
  EditableYesNo,
  adminOnboardingEvidenceCards,
  formatAddressDisplay,
  formatMasterDate,
  isUrl,
  JsonFields,
  ReadField,
  shortenUrl,
} from "./organization-profile-helpers";
import { ADMIN_ORG_ADDRESS_FIELD_LABELS } from "@/organizations/utils/admin-org-display";
import { missingFieldKeys } from "@/organizations/utils/organization-profile-overview";
import { OrganizationFinancialsPanel } from "./organization-financials-panel";
import { OrganizationMarcCard } from "./organization-marc-card";
import { OrganizationPicCard } from "./organization-pic-card";
import {
  addressesEqual,
  buildDraft,
  buildSectionPayload,
  isValidEmployeeCountInput,
  SECTION_LABEL,
  type EditableSection,
  type OrgProfileDraft,
} from "./organization-profile-payload";

export function OrganizationProfilePanel({
  org,
  portal,
  organizationId,
  displayName,
}: {
  org: OrganizationDetailResponse;
  portal: PortalType;
  organizationId: string;
  displayName: string;
}) {
  const { can } = usePermissions();
  const canManage = can("organizations.manage");
  const updateProfile = useUpdateOrganizationProfile();

  const [editingSection, setEditingSection] = React.useState<EditableSection | null>(null);
  const [draft, setDraft] = React.useState<OrgProfileDraft>(() => buildDraft(org));
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [sameAsBusiness, setSameAsBusiness] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!editingSection) setDraft(buildDraft(org));
  }, [org, editingSection]);

  const handleStartEdit = (section: EditableSection) => {
    if (updateProfile.isPending || (editingSection && editingSection !== section)) return;
    const nextDraft = buildDraft(org);
    setDraft(nextDraft);
    setEditingSection(section);
    setFieldErrors({});
    if (section === "addresses") {
      setSameAsBusiness(
        addressesEqual(nextDraft.businessAddress, nextDraft.registeredAddress) &&
          Boolean(nextDraft.businessAddress.line1)
      );
    }
  };

  const handleCancel = () => {
    setDraft(buildDraft(org));
    setEditingSection(null);
    setSameAsBusiness(false);
    setFieldErrors({});
  };

  const requestSave = () => {
    if (editingSection === "company" && !isValidEmployeeCountInput(draft.numberOfEmployees)) {
      toast.error("Number of employees must be a whole number");
      return;
    }
    if (editingSection === "company" && portal === "issuer" && org.type === "COMPANY") {
      const issues = validateIssuerCompanyForm({
        name: draft.name,
        includeName: true,
        scCompanyType: draft.scCompanyType,
        dateOfIncorporation: draft.dateOfIncorporation,
        dateOfCommencement: draft.dateOfCommencement,
        countryOfIncorporation: draft.countryOfIncorporation,
        phoneNumber: draft.phoneNumber,
      });
      if (issues.length > 0) {
        setFieldErrors(issuesByField(issues));
        toast.error(firstIssueMessage(issues));
        return;
      }
    }
    if (editingSection === "addresses" && portal === "issuer" && org.type === "COMPANY") {
      const issues = validateIssuerAddressForm({
        registeredLine1: draft.registeredAddress.line1,
        registeredState: draft.registeredAddress.state,
        registeredPostalCode: draft.registeredAddress.postalCode,
        businessLine1: draft.businessAddress.line1,
        businessState: draft.businessAddress.state,
        businessPostalCode: draft.businessAddress.postalCode,
      });
      if (issues.length > 0) {
        setFieldErrors(issuesByField(issues));
        toast.error(firstIssueMessage(issues));
        return;
      }
    }
    if (editingSection === "personal" && portal === "investor" && org.type !== "COMPANY") {
      const issues = validateInvestorPersonalForm({
        gender: draft.gender,
        nationality: draft.nationality,
        state: draft.residentialState,
        postalCode: draft.residentialPostalCode,
      });
      if (issues.length > 0) {
        setFieldErrors(issuesByField(issues));
        toast.error(firstIssueMessage(issues));
        return;
      }
    }
    if (editingSection === "classification" && portal === "investor") {
      if (!isSophisticatedInvestorSelected(draft.isSophisticatedInvestor)) {
        setFieldErrors({ isSophisticatedInvestor: "Sophisticated Investor is required." });
        toast.error("Sophisticated Investor is required.");
        return;
      }
      const message = typeOfInvestorValidationMessage(draft.scInvestorCategory, {
        organizationType: org.type === "COMPANY" ? "COMPANY" : "PERSONAL",
        isSophisticatedInvestor: draft.isSophisticatedInvestor,
      });
      if (message) {
        setFieldErrors({ scInvestorCategory: message });
        toast.error(message);
        return;
      }
    }
    if (
      editingSection === "bank" &&
      Boolean(draft.bankName || draft.accountType || draft.accountNumber) &&
      !/^\d{10,18}$/.test(draft.accountNumber)
    ) {
      toast.error("Bank account number must be 10-18 digits");
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    if (!editingSection) return;
    const data = buildSectionPayload(org, draft, editingSection);
    if (Object.keys(data).length === 0) {
      toast.error("No profile changes to save");
      return;
    }
    try {
      await updateProfile.mutateAsync({
        portal,
        id: organizationId,
        data,
      });
      toast.success("Organization profile updated");
      setShowConfirm(false);
      setEditingSection(null);
      setFieldErrors({});
    } catch (error) {
      if (isProfileValidationError(error) && Object.keys(error.fieldErrors).length > 0) {
        setFieldErrors(error.fieldErrors);
        setShowConfirm(false);
      }
      toast.error(
        error instanceof Error ? humanizeApiValidationMessage(error.message) : "Failed to update organization"
      );
    }
  };

  const hasPersonal = Boolean(org.firstName || org.lastName || org.nationality || org.dateOfBirth);
  const hasContact = Boolean(org.phoneNumber || org.owner.email);
  const showPersonal =
    shouldShowOrganizationPersonalKycCard(org.type === "COMPANY" ? "COMPANY" : "PERSONAL") &&
    (canManage || hasPersonal);
  const showContact = canManage || hasContact;
  const showClassification = portal === "investor";
  const showAbout = org.type === "COMPANY" && portal === "issuer";
  const showPersonalAddress =
    org.type !== "COMPANY" && (canManage || Boolean(org.address || org.residentialAddress?.state));
  const basic = org.corporateOnboardingData?.basicInfo;
  const ssmNumber = org.registrationNumber || basic?.ssmRegisterNumber;
  const hasAddresses =
    Boolean(org.corporateOnboardingData?.addresses?.business) ||
    Boolean(org.corporateOnboardingData?.addresses?.registered);
  const showAddresses = org.type === "COMPANY" && (canManage || hasAddresses);
  const requiredFieldKeys = new Set([
    ...missingFieldKeys(org.profileCompleteness, "company"),
    ...missingFieldKeys(org.profileCompleteness, "identity"),
  ]);
  const companyTypeLabel = displayScCompanyTypeLabel(org.scCompanyType, basic?.entityType);
  const investorCategoryScope = {
    organizationType: (org.type === "COMPANY" ? "COMPANY" : "PERSONAL") as "PERSONAL" | "COMPANY",
    isSophisticatedInvestor:
      editingSection === "classification" ? draft.isSophisticatedInvestor : org.isSophisticatedInvestor,
  };
  const investorCategoryOptions = allowedScInvestorCategories(investorCategoryScope);
  const investorCategoryHelp = scInvestorCategoryHelp(investorCategoryOptions);
  const investorCategoryLabel =
    org.scInvestorCategory && org.scInvestorCategory in SC_INVESTOR_CATEGORY_LABELS
      ? SC_INVESTOR_CATEGORY_LABELS[org.scInvestorCategory as ScInvestorCategory]
      : null;
  const genderLabel =
    draft.gender && draft.gender in SC_GENDER_LABELS
      ? SC_GENDER_LABELS[draft.gender as ScGender]
      : org.gender;
  const hasDocumentInfo = Boolean(
    org.documentType || org.documentNumber || org.idIssuingCountry || org.kycId
  );
  const corporateDocuments = Array.isArray(org.corporateRequiredDocuments)
    ? (org.corporateRequiredDocuments as Record<string, unknown>[])
    : [];
  const showDocuments = hasDocumentInfo || corporateDocuments.length > 0 || org.type === "COMPANY";
  const isEditingBank = editingSection === "bank";
  const bankOptions: Array<{ value: string; label: string }> = MALAYSIAN_BANKS.some(
    (bank) => bank.value === draft.bankName
  )
    ? [...MALAYSIAN_BANKS]
    : draft.bankName
      ? [...MALAYSIAN_BANKS, { value: draft.bankName, label: draft.bankName }]
      : [...MALAYSIAN_BANKS];

  const evidenceCards = adminOnboardingEvidenceCards({
    wealthDeclaration: org.wealthDeclaration,
    documentInfo: org.documentInfo,
    livenessCheckInfo: org.livenessCheckInfo,
    complianceDeclaration: org.complianceDeclaration as Record<string, unknown> | null,
  });
  const evidenceIcon = {
    wealth: DocumentTextIcon,
    documentInfo: DocumentTextIcon,
    liveness: FaceSmileIcon,
    compliance: ShieldCheckIcon,
  } as const;
  const sectionHasChanges = editingSection
    ? Object.keys(buildSectionPayload(org, draft, editingSection)).length > 0
    : false;

  const sectionActions = (section: EditableSection) => (
    <OrganizationCardEditActions
      canEdit={canManage && (editingSection === null || editingSection === section)}
      isEditing={editingSection === section}
      canSave={editingSection === section && sectionHasChanges}
      isSaving={updateProfile.isPending}
      onEdit={() => handleStartEdit(section)}
      onCancel={handleCancel}
      onSave={requestSave}
    />
  );

  const issuerCompany = portal === "issuer";
  const companyNameLabel = issuerCompany ? SC_MONTHLY_ISSUER.nameOfIssuer.label : SC_MONTHLY_INVESTOR.investorName.label;
  const companyRocLabel = issuerCompany ? SC_MONTHLY_ISSUER.issuerRoc.label : SC_MONTHLY_INVESTOR.investorIdentification.label;
  const companyRocHelp = issuerCompany ? SC_MONTHLY_ISSUER.issuerRoc.help : SC_MONTHLY_INVESTOR.investorIdentification.help;
  const companyTypeLabelSc = SC_MONTHLY_ISSUER.typeOfCompany.label;
  const incorporationLabel = issuerCompany
    ? SC_MONTHLY_ISSUER.dateOfIncorporation.label
    : SC_MONTHLY_INVESTOR.dateOfBirthIncorporation.label;
  const commencementLabel = SC_MONTHLY_ISSUER.dateOfCommencement.label;
  const countryIncorpLabel = issuerCompany
    ? SC_MONTHLY_ISSUER.countryOfIncorporation.label
    : SC_MONTHLY_INVESTOR.nationalityCountry.label;
  const phoneLabel = issuerCompany ? "Company phone" : "Phone Number";
  const websiteLabel = SC_MONTHLY_ISSUER.website.label;

  const classificationCard = showClassification ? (
    <Card id="profile-classification" className="rounded-2xl">
          <AdminDetailCardHeader
            icon={IdentificationIcon}
            title="Investor Classification"
            description="Sophisticated Investor and Type of Investor are required. Type of Investor is used for regulatory reporting and does not change product eligibility."
            actions={sectionActions("classification")}
          />
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editingSection === "classification" ? (
                <EditableYesNo
                  label="Sophisticated Investor"
                  name={`sophisticated-investor-${organizationId}`}
                  value={draft.isSophisticatedInvestor}
                  required
                  onChange={(isSophisticatedInvestor) =>
                    setDraft((current) => {
                      const kept = scInvestorCategoryAfterSophisticatedChange(
                        current.scInvestorCategory,
                        {
                          organizationType: org.type === "COMPANY" ? "COMPANY" : "PERSONAL",
                          isSophisticatedInvestor,
                        }
                      );
                      return {
                        ...current,
                        isSophisticatedInvestor,
                        scInvestorCategory: kept ?? "",
                      };
                    })
                  }
                />
              ) : (
                <ReadField
                  label="Sophisticated Investor"
                  value={
                    org.isSophisticatedInvestor === true
                      ? "Yes"
                      : org.isSophisticatedInvestor === false
                        ? "No"
                        : null
                  }
                  missing={requiredFieldKeys.has("isSophisticatedInvestor")}
                  required
                />
              )}
              {editingSection === "classification" ? (
                <div className="space-y-2">
                  <EditableSelect
                    label={SC_MONTHLY_INVESTOR.typeOfInvestor.label}
                    value={draft.scInvestorCategory}
                    onChange={(scInvestorCategory) =>
                      setDraft((current) => ({ ...current, scInvestorCategory }))
                    }
                    options={investorCategoryOptions.map((value) => ({
                      value,
                      label: SC_INVESTOR_CATEGORY_LABELS[value],
                      title: SC_INVESTOR_CATEGORY_DEFINITIONS[value],
                    }))}
                    help={investorCategoryHelp || undefined}
                    required
                    disabled={!isSophisticatedInvestorSelected(draft.isSophisticatedInvestor)}
                  />
                  {!isSophisticatedInvestorSelected(draft.isSophisticatedInvestor) ? (
                    <p className="text-meta text-muted-foreground">
                      {SELECT_SOPHISTICATED_INVESTOR_FIRST_MESSAGE}
                    </p>
                  ) : null}
                </div>
              ) : (
                <ReadField
                  label={SC_MONTHLY_INVESTOR.typeOfInvestor.label}
                  value={investorCategoryLabel}
                  missing={requiredFieldKeys.has("scInvestorCategory")}
                  help={investorCategoryHelp}
                  required
                />
              )}
            </div>
          </CardContent>
        </Card>
  ) : null;

  return (
    <div className="space-y-6">
      {org.type === "COMPANY" ? (
        <Card id="profile-company" className="rounded-2xl">
          <AdminDetailCardHeader
            icon={BuildingOffice2Icon}
            title="Company Details"
            description="Company registration and contact details"
            actions={sectionActions("company")}
          />
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editingSection === "company" ? (
                <>
                  <EditableField
                    label={companyNameLabel}
                    value={draft.name}
                    onChange={(name) => setDraft((current) => ({ ...current, name }))}
                    required={issuerCompany}
                  />
                  <ReadField label={companyRocLabel} value={ssmNumber} locked help={companyRocHelp} required={issuerCompany} />
                  <EditableField
                    label="TIN"
                    value={draft.tinNumber}
                    onChange={(tinNumber) => setDraft((current) => ({ ...current, tinNumber }))}
                  />
                  <EditableSelect
                    label={companyTypeLabelSc}
                    value={draft.scCompanyType}
                    onChange={(scCompanyType) => setDraft((current) => ({ ...current, scCompanyType }))}
                    options={SC_COMPANY_TYPES.map((value) => ({
                      value,
                      label: SC_COMPANY_TYPE_LABELS[value],
                    }))}
                    required={issuerCompany}
                  />
                  <EditableDateField
                    label={incorporationLabel}
                    value={draft.dateOfIncorporation}
                    onChange={(dateOfIncorporation) =>
                      setDraft((current) => ({ ...current, dateOfIncorporation }))
                    }
                    required
                  />
                  {portal === "issuer" ? (
                    <EditableDateField
                      label={commencementLabel}
                      value={draft.dateOfCommencement}
                      onChange={(dateOfCommencement) =>
                        setDraft((current) => ({ ...current, dateOfCommencement }))
                      }
                      required
                    />
                  ) : null}
                  <EditableField
                    label={countryIncorpLabel}
                    value={draft.countryOfIncorporation}
                    onChange={(countryOfIncorporation) =>
                      setDraft((current) => ({ ...current, countryOfIncorporation }))
                    }
                    required
                  />
                  <EditableField
                    label="Industry"
                    value={draft.industry}
                    onChange={(industry) => setDraft((current) => ({ ...current, industry }))}
                  />
                  <EditableField
                    label="Employees"
                    value={draft.numberOfEmployees}
                    onChange={(numberOfEmployees) =>
                      setDraft((current) => ({
                        ...current,
                        numberOfEmployees: numberOfEmployees.replace(/\D/g, ""),
                      }))
                    }
                    inputMode="numeric"
                  />
                  <EditableField
                    label="Annual Revenue (RM)"
                    value={draft.annualRevenue}
                    onChange={(annualRevenue) => setDraft((current) => ({ ...current, annualRevenue }))}
                  />
                  <EditableField
                    label={websiteLabel}
                    value={draft.website}
                    onChange={(website) => setDraft((current) => ({ ...current, website }))}
                  />
                  <EditablePhoneField
                    label={phoneLabel}
                    value={draft.phoneNumber}
                    onChange={(phoneNumber) => setDraft((current) => ({ ...current, phoneNumber }))}
                    error={fieldErrors.phoneNumber}
                  />
                </>
              ) : (
                <>
                  <ReadField
                    label={companyNameLabel}
                    value={org.name}
                    missing={requiredFieldKeys.has("name")}
                    required
                  />
                  <ReadField
                    label={companyRocLabel}
                    help={companyRocHelp}
                    value={ssmNumber}
                    missing={requiredFieldKeys.has("registrationNumber")}
                    locked
                  />
                  <ReadField label="TIN" value={basic?.tinNumber} />
                  <ReadField
                    label={companyTypeLabelSc}
                    value={companyTypeLabel}
                    missing={requiredFieldKeys.has("scCompanyType")}
                    required={issuerCompany}
                  />
                  <ReadField
                    label={incorporationLabel}
                    value={formatMasterDate(org.dateOfIncorporation)}
                    missing={requiredFieldKeys.has("dateOfIncorporation")}
                    required
                  />
                  {portal === "issuer" ? (
                    <ReadField
                      label={commencementLabel}
                      value={formatMasterDate(org.dateOfCommencement)}
                      missing={requiredFieldKeys.has("dateOfCommencement")}
                      required
                    />
                  ) : null}
                  <ReadField
                    label={countryIncorpLabel}
                    value={org.countryOfIncorporation}
                    missing={requiredFieldKeys.has("countryOfIncorporation")}
                    required
                  />
                  <ReadField label="Industry" value={basic?.industry} />
                  <ReadField
                    label="Employees"
                    value={
                      basic?.numberOfEmployees !== undefined ? String(basic.numberOfEmployees) : null
                    }
                  />
                  <ReadField label="Annual Revenue (RM)" value={basic?.annualRevenue} />
                  <ReadField
                    label={websiteLabel}
                    value={
                      basic?.website ? (
                        isUrl(basic.website) ? (
                          <a
                            href={basic.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <LinkIcon className="h-3.5 w-3.5" />
                            <span>{shortenUrl(basic.website)}</span>
                            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          basic.website
                        )
                      ) : null
                    }
                  />
                  <ReadField
                    label={phoneLabel}
                    value={org.phoneNumber}
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showAbout ? (
        <Card id="profile-about" className="rounded-2xl">
          <AdminDetailCardHeader
            icon={BriefcaseIcon}
            title="About the Business"
            description="What the company does and who it serves"
            actions={sectionActions("about")}
          />
          <CardContent className="space-y-4">
            {editingSection === "about" ? (
              <>
                <EditableField
                  label="Company Activities"
                  value={draft.whatDoesCompanyDo}
                  onChange={(whatDoesCompanyDo) =>
                    setDraft((current) => ({ ...current, whatDoesCompanyDo }))
                  }
                  multiline
                  maxLength={ABOUT_YOUR_BUSINESS_LIMITS.whatDoesCompanyDo}
                />
                <EditableField
                  label="Who Are Your Main Customers?"
                  value={draft.mainCustomers}
                  onChange={(mainCustomers) => setDraft((current) => ({ ...current, mainCustomers }))}
                  multiline
                  maxLength={ABOUT_YOUR_BUSINESS_LIMITS.mainCustomers}
                />
                <EditableYesNo
                  label="Does Any Single Customer Make Up More Than 50% of Your Revenue?"
                  name="admin-about-single-customer"
                  value={draft.singleCustomerOver50Revenue}
                  onChange={(singleCustomerOver50Revenue) =>
                    setDraft((current) => ({ ...current, singleCustomerOver50Revenue }))
                  }
                />
                <EditableField
                  label="Which Accounting Software Does the Issuer Use?"
                  value={draft.accountingSoftware}
                  onChange={(accountingSoftware) =>
                    setDraft((current) => ({ ...current, accountingSoftware }))
                  }
                  maxLength={ABOUT_YOUR_BUSINESS_LIMITS.accountingSoftware}
                />
              </>
            ) : (
              <>
                <ReadField
                  label="Company Activities"
                  value={draft.whatDoesCompanyDo}
                  missing={requiredFieldKeys.has("companyActivities")}
                  multiline
                />
                <ReadField
                  label="Who Are Your Main Customers?"
                  value={draft.mainCustomers}
                  multiline
                />
                <div className="space-y-2">
                  <p className="text-ui font-medium leading-none text-foreground">
                    Does Any Single Customer Make Up More Than 50% of Your Revenue?
                  </p>
                  <div className="flex min-h-11 items-center rounded-md border border-input bg-muted px-3">
                    <YesNoRadioDisplay value={draft.singleCustomerOver50Revenue} />
                  </div>
                </div>
                <ReadField
                  label="Which Accounting Software Does the Issuer Use?"
                  value={draft.accountingSoftware}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {showAddresses ? (
        <Card id="profile-addresses" className="rounded-2xl">
          <AdminDetailCardHeader
            icon={BuildingOffice2Icon}
            title="Addresses"
            description="Where the business operates and is registered"
            actions={sectionActions("addresses")}
          />
          <CardContent className="space-y-6">
            {editingSection === "addresses" ? (
              <>
                <EditableAddressFields
                  label={SC_MONTHLY_ISSUER.businessAddress.label}
                  lineLabel={ADMIN_ORG_ADDRESS_FIELD_LABELS.address}
                  stateLabel={ADMIN_ORG_ADDRESS_FIELD_LABELS.state}
                  postcodeLabel={ADMIN_ORG_ADDRESS_FIELD_LABELS.postcode}
                  value={draft.businessAddress}
                  onChange={(businessAddress) => {
                    setDraft((current) => ({
                      ...current,
                      businessAddress,
                      registeredAddress: sameAsBusiness ? businessAddress : current.registeredAddress,
                    }));
                  }}
                  errors={{
                    line1: fieldErrors["businessAddress.line1"],
                    state: fieldErrors["businessAddress.state"],
                    postalCode: fieldErrors["businessAddress.postalCode"],
                  }}
                />
                <div className="space-y-4 border-t pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-meta font-medium text-muted-foreground">{SC_MONTHLY_ISSUER.registeredAddress.label}</p>
                    <label className="flex items-center gap-2 text-ui">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={sameAsBusiness}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSameAsBusiness(checked);
                          if (checked) {
                            setDraft((current) => ({
                              ...current,
                              registeredAddress: current.businessAddress,
                            }));
                          }
                        }}
                      />
                      Same as business address
                    </label>
                  </div>
                  {sameAsBusiness ? (
                    <p className="text-ui text-muted-foreground">
                      {formatAddressDisplay(draft.businessAddress)}
                    </p>
                  ) : (
                    <EditableAddressFields
                      label={SC_MONTHLY_ISSUER.registeredAddress.label}
                      lineLabel={ADMIN_ORG_ADDRESS_FIELD_LABELS.address}
                      stateLabel={ADMIN_ORG_ADDRESS_FIELD_LABELS.state}
                      postcodeLabel={ADMIN_ORG_ADDRESS_FIELD_LABELS.postcode}
                      showHeading={false}
                      value={draft.registeredAddress}
                      onChange={(registeredAddress) =>
                        setDraft((current) => ({ ...current, registeredAddress }))
                      }
                      errors={{
                        line1: fieldErrors["registeredAddress.line1"],
                        state: fieldErrors["registeredAddress.state"],
                        postalCode: fieldErrors["registeredAddress.postalCode"],
                      }}
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <p className="text-ui font-medium">{SC_MONTHLY_ISSUER.registeredAddress.label}</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ReadField
                      className="sm:col-span-2"
                      label={ADMIN_ORG_ADDRESS_FIELD_LABELS.address}
                      value={
                        [
                          org.corporateOnboardingData?.addresses?.registered?.line1,
                          org.corporateOnboardingData?.addresses?.registered?.line2,
                        ]
                          .filter((part) => part && part.trim())
                          .join(", ") || null
                      }
                      missing={requiredFieldKeys.has("registeredAddress.line1")}
                    />
                    <ReadField
                      label={ADMIN_ORG_ADDRESS_FIELD_LABELS.state}
                      value={org.corporateOnboardingData?.addresses?.registered?.state}
                      missing={requiredFieldKeys.has("registeredAddress.state")}
                      help={SC_MONTHLY_ISSUER.registeredAddressState.help}
                    />
                    <ReadField
                      label={ADMIN_ORG_ADDRESS_FIELD_LABELS.postcode}
                      value={org.corporateOnboardingData?.addresses?.registered?.postalCode}
                      missing={requiredFieldKeys.has("registeredAddress.postalCode")}
                      help={SC_MONTHLY_ISSUER.registeredAddressPostcode.help}
                    />
                  </div>
                </div>
                <div className="space-y-4 border-t pt-6">
                  <p className="text-ui font-medium">{SC_MONTHLY_ISSUER.businessAddress.label}</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ReadField
                      className="sm:col-span-2"
                      label={ADMIN_ORG_ADDRESS_FIELD_LABELS.address}
                      value={
                        [
                          org.corporateOnboardingData?.addresses?.business?.line1,
                          org.corporateOnboardingData?.addresses?.business?.line2,
                        ]
                          .filter((part) => part && part.trim())
                          .join(", ") || null
                      }
                      missing={requiredFieldKeys.has("businessAddress.line1")}
                      help={SC_MONTHLY_ISSUER.businessAddress.help}
                    />
                    <ReadField
                      label={ADMIN_ORG_ADDRESS_FIELD_LABELS.state}
                      value={org.corporateOnboardingData?.addresses?.business?.state}
                      missing={
                        requiredFieldKeys.has("businessAddress.state") ||
                        requiredFieldKeys.has("businessState")
                      }
                      help={SC_MONTHLY_ISSUER.businessAddressState.help}
                    />
                    <ReadField
                      label={ADMIN_ORG_ADDRESS_FIELD_LABELS.postcode}
                      value={org.corporateOnboardingData?.addresses?.business?.postalCode}
                      missing={
                        requiredFieldKeys.has("businessAddress.postalCode") ||
                        requiredFieldKeys.has("businessPostalCode")
                      }
                      help={SC_MONTHLY_ISSUER.businessAddressPostcode.help}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {org.type === "COMPANY" ? classificationCard : null}

      {showPersonal ? (
        <Card id="profile-personal" className="rounded-2xl">
          <AdminDetailCardHeader
            icon={IdentificationIcon}
            title="Personal Details"
            description="Identity details verified during onboarding"
            actions={sectionActions("personal")}
          />
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editingSection === "personal" ? (
                <>
                  {org.type !== "COMPANY" ? (
                    <EditableField
                      label={SC_MONTHLY_INVESTOR.investorName.label}
                      value={draft.name}
                      onChange={(name) => setDraft((current) => ({ ...current, name }))}
                    />
                  ) : null}
                  <EditableField
                    label="First Name"
                    value={draft.firstName}
                    onChange={(firstName) => setDraft((current) => ({ ...current, firstName }))}
                  />
                  <EditableField
                    label="Last Name"
                    value={draft.lastName}
                    onChange={(lastName) => setDraft((current) => ({ ...current, lastName }))}
                  />
                  <EditableField
                    label="Middle Name"
                    value={draft.middleName}
                    onChange={(middleName) => setDraft((current) => ({ ...current, middleName }))}
                  />
                  <ReadField
                    label={SC_MONTHLY_INVESTOR.investorIdentification.label}
                    value={[org.documentType, org.documentNumber].filter(Boolean).join(" · ") || null}
                    missing={
                      requiredFieldKeys.has("identityNumber") || requiredFieldKeys.has("identityPrefix")
                    }
                    help={SC_MONTHLY_INVESTOR.investorIdentification.help}
                    required
                  />
                  <EditableSelect
                    label="Gender"
                    value={draft.gender}
                    onChange={(gender) => setDraft((current) => ({ ...current, gender }))}
                    options={SC_GENDERS.filter(
                      (value) => org.type === "COMPANY" || value !== "NOT_APPLICABLE"
                    ).map((value) => ({ value, label: SC_GENDER_LABELS[value] }))}
                  />
                  <ReadField
                    label={SC_MONTHLY_INVESTOR.dateOfBirthIncorporation.label}
                    value={org.dateOfBirth ? format(new Date(org.dateOfBirth), "PP") : null}
                    missing={requiredFieldKeys.has("dateOfBirth")}
                  />
                  <EditableField
                    label={SC_MONTHLY_INVESTOR.nationalityCountry.label}
                    value={draft.nationality}
                    onChange={(nationality) => setDraft((current) => ({ ...current, nationality }))}
                  />
                  <ReadField label="Country" value={org.country} />
                </>
              ) : (
                <>
                  {org.type !== "COMPANY" ? (
                    <ReadField label={SC_MONTHLY_INVESTOR.investorName.label} value={org.name} missing={requiredFieldKeys.has("name")} />
                  ) : null}
                  <ReadField label="First Name" value={org.firstName} />
                  <ReadField label="Last Name" value={org.lastName} />
                  <ReadField label="Middle Name" value={org.middleName} />
                  <ReadField
                    label={SC_MONTHLY_INVESTOR.investorIdentification.label}
                    value={[org.documentType, org.documentNumber].filter(Boolean).join(" · ") || null}
                    missing={
                      requiredFieldKeys.has("identityNumber") || requiredFieldKeys.has("identityPrefix")
                    }
                    help={SC_MONTHLY_INVESTOR.investorIdentification.help}
                    required
                  />
                  <ReadField
                    label="Gender"
                    value={genderLabel}
                    missing={requiredFieldKeys.has("gender")}
                  />
                  <ReadField
                    label={SC_MONTHLY_INVESTOR.dateOfBirthIncorporation.label}
                    value={org.dateOfBirth ? format(new Date(org.dateOfBirth), "PP") : null}
                    missing={requiredFieldKeys.has("dateOfBirth")}
                  />
                  <ReadField
                    label={SC_MONTHLY_INVESTOR.nationalityCountry.label}
                    value={org.nationality}
                    missing={requiredFieldKeys.has("nationality")}
                  />
                  <ReadField label="Country" value={org.country} />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showPersonalAddress ? (
        <Card id="profile-address" className="rounded-2xl">
          <AdminDetailCardHeader
            icon={BuildingOffice2Icon}
            title="Residential Address"
            description="Residential address"
            actions={sectionActions("addresses")}
          />
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editingSection === "addresses" ? (
                <>
                  <div className="sm:col-span-2">
                    <EditableField
                      label="Residential Address"
                      value={draft.address}
                      multiline
                      onChange={(address) => setDraft((current) => ({ ...current, address }))}
                    />
                  </div>
                  <EditableSelect
                    label={SC_MONTHLY_INVESTOR.businessResidentialAddressState.label}
                    value={draft.residentialState}
                    onChange={(residentialState) =>
                      setDraft((current) => ({ ...current, residentialState }))
                    }
                    options={SC_MALAYSIAN_STATES.map((state) => ({ value: state, label: state }))}
                  />
                  <EditableField
                    label={SC_MONTHLY_INVESTOR.businessResidentialAddressPostcode.label}
                    value={draft.residentialPostalCode}
                    onChange={(residentialPostalCode) =>
                      setDraft((current) => ({
                        ...current,
                        residentialPostalCode: restrictScPostcodeInput(
                          draft.residentialState,
                          residentialPostalCode
                        ),
                      }))
                    }
                    error={fieldErrors.postalCode}
                  />
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <ReadField label="Residential Address" value={org.address} />
                  </div>
                  <ReadField
                    label={SC_MONTHLY_INVESTOR.businessResidentialAddressState.label}
                    value={org.residentialAddress?.state}
                    missing={requiredFieldKeys.has("state")}
                  />
                  <ReadField
                    label={SC_MONTHLY_INVESTOR.businessResidentialAddressPostcode.label}
                    value={org.residentialAddress?.postalCode}
                    missing={requiredFieldKeys.has("postalCode")}
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showContact ? (
        <Card id={portal === "investor" ? "profile-contact" : "profile-account-owner"} className="rounded-2xl">
          <AdminDetailCardHeader
            icon={PhoneIcon}
            title="Account Owner"
            description="Login email for the organisation owner. This is not the company e-mail."
            actions={sectionActions("contact")}
          />
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editingSection === "contact" ? (
                <>
                  {org.type !== "COMPANY" ? (
                    <EditablePhoneField
                      label="Phone Number"
                      value={draft.phoneNumber}
                      onChange={(phoneNumber) => setDraft((current) => ({ ...current, phoneNumber }))}
                      error={fieldErrors.phoneNumber}
                    />
                  ) : null}
                  <ReadField label="Account owner email" value={org.owner.email} locked />
                </>
              ) : (
                <>
                  {org.type !== "COMPANY" ? (
                    <ReadField label="Phone Number" value={org.phoneNumber} />
                  ) : null}
                  <ReadField label="Account owner email" value={org.owner.email} locked />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {org.type === "COMPANY" ? (
        <OrganizationPicCard
          org={org}
          portal={portal}
          organizationId={organizationId}
          displayName={displayName}
        />
      ) : null}

      {org.type !== "COMPANY" ? classificationCard : null}

      <Card className="rounded-2xl">
        <AdminDetailCardHeader
          icon={BanknotesIcon}
          title="Bank Account"
          description="Where disbursements and payouts are sent"
          actions={sectionActions("bank")}
        />
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 py-2">
              <Label className="text-meta text-muted-foreground">Bank name</Label>
              {isEditingBank && canManage ? (
                <Select
                  value={draft.bankName || undefined}
                  onValueChange={(bankName) => setDraft((current) => ({ ...current, bankName }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankOptions.map((bank) => (
                      <SelectItem key={bank.value} value={bank.value}>
                        {bank.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-ui font-medium">{malaysianBankLabel(draft.bankName) || "—"}</p>
              )}
            </div>
            <div className="space-y-1.5 py-2">
              <Label className="text-meta text-muted-foreground">Account type</Label>
              {isEditingBank && canManage ? (
                <Select
                  value={draft.accountType || undefined}
                  onValueChange={(accountType) => setDraft((current) => ({ ...current, accountType }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-ui font-medium">{draft.accountType || "—"}</p>
              )}
            </div>
            <div className="space-y-1.5 py-2 sm:col-span-2">
              <Label className="text-meta text-muted-foreground">Bank account number</Label>
              {isEditingBank && canManage ? (
                <>
                  <Input
                    className="font-mono text-ui"
                    inputMode="numeric"
                    maxLength={18}
                    value={draft.accountNumber}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        accountNumber: event.target.value.replace(/\D/g, ""),
                      }))
                    }
                    placeholder="Enter bank account number"
                  />
                  <p className="text-meta text-muted-foreground">Enter 10-18 digit account number</p>
                </>
              ) : (
                <p className="font-mono text-ui font-medium">{draft.accountNumber || "—"}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {portal === "issuer" && org.type === "COMPANY" ? (
        <OrganizationFinancialsPanel org={org} organizationId={organizationId} />
      ) : null}

      {portal === "issuer" && org.type === "COMPANY" ? (
        <div id="marc-assessment">
          <OrganizationMarcCard org={org} organizationId={organizationId} portal={portal} />
        </div>
      ) : null}

      {showDocuments ? (
        <Card className="rounded-2xl">
          <AdminDetailCardHeader
            icon={DocumentTextIcon}
            title="Documents"
            description="Onboarding evidence collected for this organisation. Users cannot upload documents from their profile."
          />
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadField label="Document Type" value={org.documentType} />
              <ReadField label="Document Number" value={org.documentNumber} />
              <ReadField label="ID Issuing Country" value={org.idIssuingCountry} />
              <ReadField label="KYC ID" value={org.kycId} />
            </div>
            {corporateDocuments.length > 0 ? (
              <div className="space-y-3">
                {corporateDocuments.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <DocumentTextIcon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-ui font-medium">
                          {String(doc.fieldName || doc.fileName || `Document ${idx + 1}`)}
                        </p>
                        {typeof doc.fileType === "string" ? (
                          <p className="text-meta text-muted-foreground">{doc.fileType}</p>
                        ) : null}
                      </div>
                    </div>
                    {typeof doc.url === "string" ? (
                      <Button variant="outline" size="sm" asChild className="shrink-0 gap-1.5">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                          View
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : org.type === "COMPANY" && !hasDocumentInfo ? (
              <p className="text-ui text-muted-foreground">No documents available yet.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {evidenceCards.map((card) => {
        const Icon = evidenceIcon[card.id];
        return (
          <AdminCollapsibleCard key={card.id} title={card.label} icon={Icon}>
            <JsonFields data={card.data} />
          </AdminCollapsibleCard>
        );
      })}

      <AlertDialog
        open={showConfirm}
        onOpenChange={(open) => {
          if (!updateProfile.isPending) setShowConfirm(open);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save changes to{" "}
              {editingSection ? SECTION_LABEL[editingSection] : "this section"} for{" "}
              <strong>{displayName}</strong>? This will update the organization profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateProfile.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmSave();
              }}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? "Saving..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
