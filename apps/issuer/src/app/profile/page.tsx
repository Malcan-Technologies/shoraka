"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  useOrganization,
  useAuthToken,
  createApiClient,
  type BankAccountDetails,
  type UpdateOrganizationProfileInput,
  MALAYSIAN_BANKS,
} from "@cashsouk/config";
import { useAuth } from "../../lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccountDocuments } from "../../hooks/use-account-documents";
import { useOrganizationInvitations } from "../../hooks/use-organization-invitations";
import { filterVisiblePeopleRows, firstIssueMessage, humanizeApiValidationMessage, isOrganisationProfileTab, isScPostcodeRequired, isValidProfilePhone, organisationProfileTabFromSearchParam, PROFILE_ADDRESS_FIELD_LABELS, PROFILE_ADDRESS_HELP, PROFILE_HELP, PROFILE_LABEL, PROFILE_PATH, PROFILE_TAB_PEOPLE, PROFILE_TAB_PROFILE, restrictScPostcodeInput, SC_MALAYSIAN_STATES, storedProfilePhone, validateIssuerAddressForm, validateIssuerContactPersonForm } from "@cashsouk/types";
import { DirectorShareholderAlertCard } from "../../components/director-shareholder-alert-card";
import { IssuerProfileCompletenessBanner } from "../../components/profile-completeness-banner";
import { AboutYourBusinessCard } from "../../components/about-your-business-card";
import { IssuerCompanyDetailsCard } from "../../components/issuer-company-details-card";
import { IssuerFinancialsCard } from "../../components/issuer-financials-card";
import { toast } from "sonner";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import {
  PageShell,
  PeopleAccessSection,
  ProfileFieldGrid,
  ProfileReadField,
  VerifiedBadge,
  ComRepFieldLabel,
} from "@cashsouk/ui";
import {
  issuerContentMaxWidthClassName,
  issuerMainContentClassName,
  issuerPageGutterClassName,
} from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";
import {
  issuerFieldChromeClassName,
  issuerFieldFocusWithinOpenClassName,
} from "@/lib/issuer-input-chrome";
import {
  UserIcon,
  BuildingOffice2Icon,
  ArrowPathIcon,
  PencilIcon,
  XMarkIcon,
  DocumentTextIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function ProfileSkeleton() {
  return (
    <div className={issuerMainContentClassName}>
      <div className={cn(issuerContentMaxWidthClassName, "space-y-6", issuerPageGutterClassName)}>
        <PageShell title="Organisation" description="Company details, people and access, banking, and documents.">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
          <div className="mt-8 space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </PageShell>
      </div>
    </div>
  );
}

function NoOrganizationState({ showOnboardingPrompt = true }: { showOnboardingPrompt?: boolean }) {
  const router = useRouter();

  return (
    <div className={issuerMainContentClassName}>
      <div className={cn(issuerContentMaxWidthClassName, issuerPageGutterClassName)}>
        <PageShell title="Organisation" description="Company details, people and access, banking, and documents.">
          <div className="rounded-xl border bg-card p-8 text-center opacity-60">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <UserIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-muted-foreground">
              No organisation selected
            </h2>
            <p className="mb-6 text-muted-foreground">
              Create or select an organisation to view company details, people and access, banking, and documents.
            </p>
            {showOnboardingPrompt && (
              <Button variant="outline" onClick={() => router.push("/onboarding/account")}>
                Create organisation
              </Button>
            )}
          </div>
        </PageShell>
      </div>
    </div>
  );
}

// Helper to format document type for display
function formatDocumentType(type: string | null | undefined): string {
  if (!type) return "—";
  const typeMap: Record<string, string> = {
    NATIONAL_ID: "National ID (NRIC)",
    PASSPORT: "Passport",
    DRIVING_LICENSE: "Driving License",
  };
  return typeMap[type] || type.replace(/_/g, " ");
}

// Helper to extract field value from RegTank bank account details
function getBankField(
  bankDetails: BankAccountDetails | null | undefined,
  fieldName: string
): string {
  if (!bankDetails?.content) return "";
  const field = bankDetails.content.find((f) => f.fieldName === fieldName);
  return field?.fieldValue || "";
}

// Helper to build RegTank format bank account details
function buildBankAccountDetails(
  bankName: string,
  accountNumber: string,
  accountType: string
): BankAccountDetails {
  return {
    content: [
      { cn: false, fieldName: "Bank", fieldType: "picklist", fieldValue: bankName },
      {
        cn: false,
        fieldName: "Bank account number",
        fieldType: "number",
        fieldValue: accountNumber,
      },
      { cn: false, fieldName: "Account type", fieldType: "picklist", fieldValue: accountType },
    ],
    displayArea: "Bank Account Details",
  };
}

// Helper to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Documents Tab Content Component
function DocumentsTabContent({ apiClient }: { apiClient: ReturnType<typeof createApiClient> }) {
  const { data: documents, isLoading, error } = useAccountDocuments("ISSUER");
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const handleDownload = async (doc: { id: string }) => {
    setDownloadingId(doc.id);
    try {
      const response = await apiClient.getLegalDocumentDownloadUrl(doc.id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      window.open(response.data.downloadUrl, "_blank");
    } catch {
      toast.error("Failed to download document");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">View and download your account documents</p>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-xl border bg-muted/30"
              >
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-10 w-32" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Failed to load documents</p>
            <p className="text-sm mt-1">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : !documents || documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No documents available yet</p>
            <p className="text-sm mt-1">Documents will appear here once available.</p>
          </div>
        ) : (
          <>
            {documents.map((doc) => (
              <div
                key={`${doc.source}-${doc.id}`}
                className="flex items-center justify-between p-4 rounded-xl border bg-muted/30"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <DocumentTextIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(doc.fileSize)} • {doc.fileName}
                    </p>
                  </div>
                </div>
                <Button
                  variant="default"
                  className="gap-2 rounded-xl"
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                >
                  {downloadingId === doc.id ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      Download
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { isAuthenticated } = useAuth();
  const { getAccessToken } = useAuthToken();
  const router = useRouter();
  const {
    activeOrganization,
    isLoading,
    refreshOrganizations,
    organizations,
    updateOrganizationProfile,
  } = useOrganization();

  const visiblePeopleForDsAlert = React.useMemo(
    () => filterVisiblePeopleRows(activeOrganization?.people ?? []),
    [activeOrganization?.people]
  );

  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Editing states
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [isEditingBanking, setIsEditingBanking] = React.useState(false);
  const [isEditingAddresses, setIsEditingAddresses] = React.useState(false);

  // Fetch current user ID
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const result = await apiClient.get<{
        userId: string;
        user: {
          first_name: string | null;
          last_name: string | null;
        };
      }>("/v1/auth/me");
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Check if current user is admin (owner or has ORGANIZATION_ADMIN role)
  const isCurrentUserAdmin = React.useMemo(() => {
    if (!activeOrganization || !currentUser) return false;
    if (activeOrganization.isOwner) return true;
    // Check if current user member has admin role
    const currentUserMember = activeOrganization.members?.find(
      (m) => m.id === currentUser.userId
    );
    return currentUserMember?.role === "ORGANIZATION_ADMIN";
  }, [activeOrganization, currentUser]);

  const { invitations } = useOrganizationInvitations(activeOrganization?.id, {
    enabled: isCurrentUserAdmin,
  });

  // Form states for profile (phone + address)
  const [phoneNumber, setPhoneNumber] = React.useState<string | undefined>(undefined);
  const [address, setAddress] = React.useState("");

  // Editable Contact details (company applications source of truth)
  const [contactName, setContactName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPosition, setContactPosition] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState<string | undefined>(undefined);

  // Form states for banking (matches RegTank format values)
  const [bankName, setBankName] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [accountType, setAccountType] = React.useState("Savings");

  // Form states for addresses
  const [businessLine1, setBusinessLine1] = React.useState("");
  const [businessLine2, setBusinessLine2] = React.useState("");
  const [businessCity, setBusinessCity] = React.useState("");
  const [businessPostalCode, setBusinessPostalCode] = React.useState("");
  const [businessState, setBusinessState] = React.useState("");
  const [businessCountry, setBusinessCountry] = React.useState("");

  const [registeredLine1, setRegisteredLine1] = React.useState("");
  const [registeredLine2, setRegisteredLine2] = React.useState("");
  const [registeredCity, setRegisteredCity] = React.useState("");
  const [registeredPostalCode, setRegisteredPostalCode] = React.useState("");
  const [registeredState, setRegisteredState] = React.useState("");
  const [registeredCountry, setRegisteredCountry] = React.useState("");

  const [sameAsBusinessAddress, setSameAsBusinessAddress] = React.useState(false);

  // Fetch detailed organization data
  const { data: orgData } = useQuery({
    queryKey: ["organization-detail", activeOrganization?.id],
    queryFn: async () => {
      if (!activeOrganization?.id) return null;
      const result = await apiClient.get<{
        id: string;
        firstName: string | null;
        lastName: string | null;
        middleName: string | null;
        nationality: string | null;
        country: string | null;
        idIssuingCountry: string | null;
        gender: string | null;
        dateOfBirth: string | null;
        documentType: string | null;
        documentNumber: string | null;
        phoneNumber: string | null;
        address: string | null;
        bankAccountDetails: BankAccountDetails | null;
        onboardingStatus: string;
        onboardedAt: string | null;
        dateOfIncorporation?: string | null;
        dateOfCommencement?: string | null;
        countryOfIncorporation?: string | null;
        scCompanyType?: string | null;
        companyCategory?: string | null;
        corporateOnboardingData?: {
          basicInfo?: {
            tinNumber?: string;
            industry?: string;
            entityType?: string;
            businessName?: string;
            numberOfEmployees?: number;
            ssmRegisterNumber?: string;
            annualRevenue?: string;
            website?: string;
            phoneNumber?: string;
          };
          addresses?: {
            business?: {
              line1?: string | null;
              line2?: string | null;
              city?: string | null;
              postalCode?: string | null;
              state?: string | null;
              country?: string | null;
            };
            registered?: {
              line1?: string | null;
              line2?: string | null;
              city?: string | null;
              postalCode?: string | null;
              state?: string | null;
              country?: string | null;
            };
            businessAddress?: string;
            registeredAddress?: string;
          };
          personInCharge?: {
            name?: string | null;
            position?: string | null;
            email?: string | null;
            contactNumber?: string | null;
          };
          contactPerson?: {
            name?: string | null;
            position?: string | null;
            email?: string | null;
            contact?: string | null;
          };
          aboutYourBusiness?: {
            whatDoesCompanyDo?: string;
            mainCustomers?: string;
            singleCustomerOver50Revenue?: boolean | null;
            accountingSoftware?: string;
          };
        };
        corporateEntities?: {
          directors?: Array<Record<string, unknown>>;
          shareholders?: Array<Record<string, unknown>>;
          corporateShareholders?: Array<Record<string, unknown>>;
        };
        people?: import("@cashsouk/types").ApplicationPersonRow[];
        directorShareholderListSource?: import("@cashsouk/types").DirectorShareholderListSource;
        ctosDirectorShareholderWarning?: string | null;
      }>(`/v1/organizations/issuer/${activeOrganization.id}`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: !!activeOrganization?.id,
    staleTime: 1000 * 60 * 5,
  });

  const completenessQuery = useQuery({
    queryKey: ["issuer", "profile-completeness", activeOrganization?.id],
    enabled: !!activeOrganization?.id,
    queryFn: async () => {
      const result = await apiClient.getProfileCompleteness("issuer", activeOrganization!.id);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
  const missingFieldKeys = React.useMemo(
    () => new Set((completenessQuery.data?.missing ?? []).map((item) => item.field)),
    [completenessQuery.data]
  );

  const searchParams = useSearchParams();
  const urlTab = organisationProfileTabFromSearchParam(searchParams.get("tab"), true);
  const [activeTab, setActiveTab] = React.useState(urlTab);
  React.useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);
  function handleTabChange(next: string) {
    if (!isOrganisationProfileTab(next, true)) return;
    setActiveTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === PROFILE_TAB_PROFILE) params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${PROFILE_PATH}?${query}` : PROFILE_PATH, { scroll: false });
  }
  const focusDirectors = searchParams.get("focus") === "directors" || searchParams.get("focus") === "people";
  const focusContact = searchParams.get("focus") === "contact";
  const focusAbout = searchParams.get("focus") === "about";
  const focusCompany = searchParams.get("focus") === "company";
  const focusAddresses = searchParams.get("focus") === "addresses";
  const focusFinancials = searchParams.get("focus") === "financials";
  const focusedPersonKey = searchParams.get("person");
  const contactSectionRef = React.useRef<HTMLDivElement>(null);
  const aboutSectionRef = React.useRef<HTMLDivElement>(null);
  const companySectionRef = React.useRef<HTMLDivElement>(null);
  const addressesSectionRef = React.useRef<HTMLDivElement>(null);
  const financialsSectionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!focusDirectors) return;
    setActiveTab(PROFILE_TAB_PEOPLE);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", PROFILE_TAB_PEOPLE);
    params.delete("focus");
    router.replace(`${PROFILE_PATH}?${params.toString()}`, { scroll: false });
  }, [focusDirectors, router, searchParams]);

  React.useEffect(() => {
    if (!focusContact) return;
    setActiveTab("profile");
    const el = contactSectionRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [focusContact, orgData, activeOrganization?.id]);

  React.useEffect(() => {
    if (!focusAbout) return;
    setActiveTab("profile");
    const el = aboutSectionRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [focusAbout, orgData, activeOrganization?.id]);

  React.useEffect(() => {
    if (!focusCompany && !focusAddresses && !focusFinancials) return;
    setActiveTab("profile");
    const el = focusCompany
      ? companySectionRef.current
      : focusAddresses
        ? addressesSectionRef.current
        : financialsSectionRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [focusCompany, focusAddresses, focusFinancials, orgData, activeOrganization?.id]);

  // Initialize form values when orgData loads
  React.useEffect(() => {
    if (orgData) {
      setPhoneNumber(orgData.phoneNumber || undefined);
      setAddress(orgData.address || "");

      const contact =
        orgData.corporateOnboardingData?.contactPerson ??
        (orgData.corporateOnboardingData?.personInCharge
          ? {
              name: orgData.corporateOnboardingData.personInCharge.name,
              email: orgData.corporateOnboardingData.personInCharge.email,
              position: orgData.corporateOnboardingData.personInCharge.position,
              contact: orgData.corporateOnboardingData.personInCharge.contactNumber,
            }
          : null);
      setContactName(contact?.name || "");
      setContactEmail(contact?.email || "");
      setContactPosition(contact?.position || "");
      setContactPhone(contact?.contact || undefined);

      // Extract values from RegTank format
      setBankName(getBankField(orgData.bankAccountDetails, "Bank"));
      setAccountNumber(getBankField(orgData.bankAccountDetails, "Bank account number"));
      setAccountType(getBankField(orgData.bankAccountDetails, "Account type") || "Savings");

      // Initialize addresses
      const addresses = orgData.corporateOnboardingData?.addresses;
      const business = addresses?.business;
      setBusinessLine1(business?.line1 || "");
      setBusinessLine2(business?.line2 || "");
      setBusinessCity(business?.city || "");
      setBusinessPostalCode(business?.postalCode || "");
      setBusinessState(business?.state || "");
      setBusinessCountry(business?.country || "");

      const registered = addresses?.registered;
      setRegisteredLine1(registered?.line1 || "");
      setRegisteredLine2(registered?.line2 || "");
      setRegisteredCity(registered?.city || "");
      setRegisteredPostalCode(registered?.postalCode || "");
      setRegisteredState(registered?.state || "");
      setRegisteredCountry(registered?.country || "");
    }
  }, [orgData]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (input: UpdateOrganizationProfileInput) => {
      if (!activeOrganization?.id) throw new Error("No organization selected");
      return updateOrganizationProfile(activeOrganization.id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-detail", activeOrganization?.id] });
      queryClient.invalidateQueries({ queryKey: ["issuer", "profile-completeness", activeOrganization?.id] });
      toast.success("Profile updated successfully");
      setIsEditingProfile(false);
      setIsEditingBanking(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to update profile", {
        description: humanizeApiValidationMessage(error.message),
      });
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshOrganizations();
    queryClient.invalidateQueries({ queryKey: ["organization-detail", activeOrganization?.id] });
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleSaveProfile = () => {
    if (isPersonal) {
      if (phoneNumber && !isValidProfilePhone(phoneNumber)) {
        toast.error("Enter a valid phone number.");
        return;
      }

      updateProfileMutation.mutate({
        phoneNumber: storedProfilePhone(phoneNumber) || null,
        address: address.trim() || null,
      });
      return;
    }

    const issues = validateIssuerContactPersonForm({
      name: contactName,
      position: contactPosition,
      email: contactEmail,
      contact: contactPhone,
    });
    if (issues.length > 0) {
      toast.error(firstIssueMessage(issues) ?? "Enter the Person in Charge contact details.");
      return;
    }

    updateProfileMutation.mutate({
      contactPerson: {
        name: contactName.trim(),
        email: contactEmail.trim(),
        position: contactPosition.trim(),
        contact: storedProfilePhone(contactPhone) || contactPhone,
      },
    });
  };

  const handleSaveBanking = () => {
    if (accountNumber && !/^\d{10,18}$/.test(accountNumber)) {
      toast.error("Bank account number must be 10-18 digits");
      return;
    }

    const hasData = bankName || accountNumber || accountType;
    const bankAccountDetails = hasData
      ? buildBankAccountDetails(bankName, accountNumber, accountType)
      : null;

    updateProfileMutation.mutate({ bankAccountDetails });
  };

  const handleCancelProfileEdit = () => {
    if (orgData) {
      setPhoneNumber(orgData.phoneNumber || undefined);
      setAddress(orgData.address || "");

      const contact =
        orgData.corporateOnboardingData?.contactPerson ??
        (orgData.corporateOnboardingData?.personInCharge
          ? {
              name: orgData.corporateOnboardingData.personInCharge.name,
              email: orgData.corporateOnboardingData.personInCharge.email,
              position: orgData.corporateOnboardingData.personInCharge.position,
              contact: orgData.corporateOnboardingData.personInCharge.contactNumber,
            }
          : null);
      setContactName(contact?.name || "");
      setContactEmail(contact?.email || "");
      setContactPosition(contact?.position || "");
      setContactPhone(contact?.contact || undefined);
    }
    setIsEditingProfile(false);
  };

  const handleCancelBankingEdit = () => {
    setBankName(getBankField(orgData?.bankAccountDetails, "Bank"));
    setAccountNumber(getBankField(orgData?.bankAccountDetails, "Bank account number"));
    setAccountType(getBankField(orgData?.bankAccountDetails, "Account type") || "Savings");
    setIsEditingBanking(false);
  };

  // Address update mutation
  const updateAddressesMutation = useMutation({
    mutationFn: async (input: {
      businessAddress: {
        line1: string | null;
        line2: string | null;
        city: string | null;
        postalCode: string | null;
        state: string | null;
        country: string | null;
      };
      registeredAddress: {
        line1: string | null;
        line2: string | null;
        city: string | null;
        postalCode: string | null;
        state: string | null;
        country: string | null;
      };
    }) => {
      if (!activeOrganization?.id) throw new Error("No organization selected");
      const result = await apiClient.patch(
        `/v1/organizations/issuer/${activeOrganization.id}/corporate-info`,
        input
      );
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-detail", activeOrganization?.id] });
      toast.success("Addresses updated successfully");
      setIsEditingAddresses(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to update addresses", {
        description: humanizeApiValidationMessage(error.message),
      });
    },
  });

  const handleSaveAddresses = () => {
    const registeredLine = sameAsBusinessAddress ? businessLine1 : registeredLine1;
    const registeredSt = sameAsBusinessAddress ? businessState : registeredState;
    const registeredPc = sameAsBusinessAddress ? businessPostalCode : registeredPostalCode;
    const issues = validateIssuerAddressForm({
      registeredLine1: registeredLine,
      registeredState: registeredSt,
      registeredPostalCode: registeredPc,
      businessLine1,
      businessState,
      businessPostalCode,
    });
    if (issues.length > 0) {
      toast.error(firstIssueMessage(issues));
      return;
    }

    const businessAddress = {
      line1: businessLine1.trim(),
      line2: businessLine2 || null,
      city: businessCity || null,
      postalCode: businessPostalCode.trim() || null,
      state: businessState.trim(),
      country: businessCountry || null,
    };

    const registeredAddress = sameAsBusinessAddress
      ? businessAddress
      : {
          line1: registeredLine1.trim(),
          line2: registeredLine2 || null,
          city: registeredCity || null,
          postalCode: registeredPostalCode.trim() || null,
          state: registeredState.trim(),
          country: registeredCountry || null,
        };

    updateAddressesMutation.mutate({ businessAddress, registeredAddress });
  };

  const handleCancelAddressesEdit = () => {
    if (orgData) {
      const addresses = orgData.corporateOnboardingData?.addresses;
      const business = addresses?.business;
      setBusinessLine1(business?.line1 || "");
      setBusinessLine2(business?.line2 || "");
      setBusinessCity(business?.city || "");
      setBusinessPostalCode(business?.postalCode || "");
      setBusinessState(business?.state || "");
      setBusinessCountry(business?.country || "");

      const registered = addresses?.registered;
      setRegisteredLine1(registered?.line1 || "");
      setRegisteredLine2(registered?.line2 || "");
      setRegisteredCity(registered?.city || "");
      setRegisteredPostalCode(registered?.postalCode || "");
      setRegisteredState(registered?.state || "");
      setRegisteredCountry(registered?.country || "");

      setSameAsBusinessAddress(false);
    }
    setIsEditingAddresses(false);
  };

  // Show loading state
  if (isAuthenticated === null || isLoading) {
    return <ProfileSkeleton />;
  }

  // Show no organization state
  if (!activeOrganization || organizations.length === 0) {
    return <NoOrganizationState />;
  }

  const isPersonal = activeOrganization.type === "PERSONAL";
  const accountName = isPersonal
    ? "Personal Account"
    : activeOrganization.name || "Company Account";
  const accountIcon = isPersonal ? UserIcon : BuildingOffice2Icon;
  const AccountIcon = accountIcon;
  const displayName = isPersonal
    ? [orgData?.firstName, orgData?.lastName].filter(Boolean).join(" ") || "—"
    : orgData?.corporateOnboardingData?.basicInfo?.businessName || accountName;

  return (
    <div className={issuerMainContentClassName}>
      <div className={cn(issuerContentMaxWidthClassName, "space-y-6", issuerPageGutterClassName)}>
        <PageShell
          title="Organisation"
          description="Company details, people and access, banking, and documents."
          action={
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-11 gap-2 rounded-xl"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        >
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <AccountIcon className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{displayName}</h2>
              <p className="mt-1 text-muted-foreground">
                {isPersonal ? "Issuer (Individual)" : accountName}
              </p>
            </div>
          </div>

          {!isPersonal ? (
            <DirectorShareholderAlertCard
              visiblePeople={visiblePeopleForDsAlert}
              enabled={activeOrganization?.onboardingStatus === "COMPLETED"}
            />
          ) : null}

          <IssuerProfileCompletenessBanner
            organizationId={activeOrganization?.id}
            onboarded={activeOrganization?.onboardingStatus === "COMPLETED"}
            expandOnPage
            initialExpanded={searchParams.get("focus") === "completeness"}
          />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl bg-muted p-1 sm:grid-cols-4">
              <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-background">
                Profile
              </TabsTrigger>
              <TabsTrigger value="banking" className="rounded-lg data-[state=active]:bg-background">
                Banking
              </TabsTrigger>
              <TabsTrigger value="people" className="rounded-lg data-[state=active]:bg-background">
                People & Access
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="rounded-lg data-[state=active]:bg-background"
              >
                Documents
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6 mt-6">
              {/* Personal Info Section (Read-only) - Only for PERSONAL accounts */}
              {isPersonal && (
                <div className="rounded-xl border bg-card">
                  <div className="flex items-center justify-between p-6 border-b">
                    <div>
                      <h2 className="text-lg font-semibold">Your details</h2>
                      <p className="text-sm text-muted-foreground">
                        Identity details verified during onboarding
                      </p>
                    </div>
                    <VerifiedBadge />
                  </div>
                  <div className="p-6">
                    <ProfileFieldGrid>
                      <ProfileReadField label="Name" value={displayName} locked />
                      <ProfileReadField
                        label="Document type"
                        value={formatDocumentType(orgData?.documentType)}
                        locked
                      />
                      <ProfileReadField
                        label="Document number"
                        value={orgData?.documentNumber || "—"}
                        locked
                      />
                      <ProfileReadField
                        label="Issuing country"
                        value={orgData?.idIssuingCountry || "—"}
                        locked
                      />
                      {orgData?.onboardedAt ? (
                        <ProfileReadField
                          label="Member since"
                          value={new Date(orgData.onboardedAt).toLocaleDateString("en-MY", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          locked
                        />
                      ) : null}
                    </ProfileFieldGrid>
                  </div>
                </div>
              )}

              {!isPersonal && activeOrganization?.id ? (
                <div ref={companySectionRef}>
                <IssuerCompanyDetailsCard
                  organizationId={activeOrganization.id}
                  canEdit={isCurrentUserAdmin}
                  org={{
                    name: activeOrganization.name,
                    registrationNumber: activeOrganization.registrationNumber,
                    phoneNumber: orgData?.phoneNumber ?? activeOrganization.phoneNumber,
                    dateOfIncorporation:
                      orgData?.dateOfIncorporation ?? activeOrganization.dateOfIncorporation,
                    dateOfCommencement:
                      orgData?.dateOfCommencement ?? activeOrganization.dateOfCommencement,
                    countryOfIncorporation:
                      orgData?.countryOfIncorporation ?? activeOrganization.countryOfIncorporation,
                    scCompanyType: orgData?.scCompanyType ?? activeOrganization.scCompanyType,
                    corporateOnboardingData: orgData?.corporateOnboardingData ?? null,
                  }}
                />
                </div>
              ) : null}

              {!isPersonal && activeOrganization?.id && (
                <div ref={aboutSectionRef}>
                  <AboutYourBusinessCard
                    organizationId={activeOrganization.id}
                    canEdit={isCurrentUserAdmin}
                  />
                </div>
              )}

              {/* 2. Address Section - Moved before Contact Details */}
              {/* Address Section (Editable) */}
              {isPersonal ? (
                <div className="rounded-xl border bg-card">
                  <div className="flex items-center justify-between p-6 border-b">
                    <div>
                      <h2 className="text-lg font-semibold">Address</h2>
                      <p className="text-sm text-muted-foreground">
                        Ensure your primary address is up to date
                      </p>
                    </div>
                    {!isEditingProfile && isCurrentUserAdmin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingProfile(true)}
                        className="gap-2 rounded-xl"
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit
                      </Button>
                    ) : null}
                  </div>
                  <div className="p-6 space-y-4">
                    {!isEditingProfile ? (
                      <ProfileReadField
                        label="Full address"
                        value={address.trim() || "—"}
                      />
                    ) : (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4" />
                        Full address
                      </Label>
                      <Textarea
                        placeholder="Enter your full address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={!isEditingProfile}
                        rows={3}
                        maxLength={500}
                        className={`resize-none ${!isEditingProfile ? "bg-muted" : ""}`}
                      />
                      {isEditingProfile && (
                        <p className="text-xs text-muted-foreground">Maximum 500 characters</p>
                      )}
                    </div>
                    )}

                    {isEditingProfile && isCurrentUserAdmin && (
                      <div className="flex justify-end gap-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={handleCancelProfileEdit}
                          disabled={updateProfileMutation.isPending}
                          className="gap-2 rounded-xl"
                        >
                          <XMarkIcon className="h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveProfile}
                          disabled={updateProfileMutation.isPending}
                          className="gap-2 rounded-xl"
                        >
                          {updateProfileMutation.isPending ? "Saving..." : "Save changes"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  ref={addressesSectionRef}
                  id="profile-addresses"
                  className="scroll-mt-24 rounded-xl border bg-card"
                >
                  <div className="flex items-center justify-between p-6 border-b">
                    <div>
                      <h2 className="text-lg font-semibold">Addresses</h2>
                      <p className="text-sm text-muted-foreground">
                        Where your business operates and is registered
                      </p>
                    </div>
                    {!isEditingAddresses && isCurrentUserAdmin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingAddresses(true)}
                        className="gap-2 rounded-xl"
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit
                      </Button>
                    ) : null}
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="space-y-4 pt-2">
                      <h3 className="text-sm font-semibold">{PROFILE_LABEL.registeredAddress}</h3>
                      {!isEditingAddresses ? (
                        <ProfileFieldGrid>
                          <ProfileReadField
                            className="sm:col-span-2"
                            label={PROFILE_ADDRESS_FIELD_LABELS.address}
                            value={[
                              orgData?.corporateOnboardingData?.addresses?.registered?.line1,
                              orgData?.corporateOnboardingData?.addresses?.registered?.line2,
                            ]
                              .filter((part) => part && part.trim())
                              .join(", ") || "—"}
                            required
                            missing={missingFieldKeys.has("registeredAddress.line1")}
                          />
                          <ProfileReadField
                            label={PROFILE_ADDRESS_FIELD_LABELS.state}
                            value={orgData?.corporateOnboardingData?.addresses?.registered?.state || "—"}
                            required
                            missing={missingFieldKeys.has("registeredAddress.state")}
                          />
                          <ProfileReadField
                            label={PROFILE_ADDRESS_FIELD_LABELS.postcode}
                            value={
                              orgData?.corporateOnboardingData?.addresses?.registered?.postalCode || "—"
                            }
                            required={isScPostcodeRequired(
                              orgData?.corporateOnboardingData?.addresses?.registered?.state
                            )}
                            missing={missingFieldKeys.has("registeredAddress.postalCode")}
                          />
                        </ProfileFieldGrid>
                      ) : (
                        <div className="flex items-center justify-end gap-2 pb-2">
                          <Checkbox
                            id="sameAsBusinessAddress"
                            checked={sameAsBusinessAddress}
                            onCheckedChange={(checked) => setSameAsBusinessAddress(checked === true)}
                          />
                          <Label htmlFor="sameAsBusinessAddress" className="text-sm font-normal cursor-pointer">
                            Same as business address
                          </Label>
                        </div>
                      )}
                      {isEditingAddresses && !sameAsBusinessAddress ? (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                              <ComRepFieldLabel label={PROFILE_ADDRESS_FIELD_LABELS.address} required />
                              <Input
                                value={registeredLine1}
                                onChange={(e) => setRegisteredLine1(e.target.value)}
                                aria-required
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <ComRepFieldLabel label={PROFILE_ADDRESS_FIELD_LABELS.addressLine2} optional />
                              <Input
                                value={registeredLine2}
                                onChange={(e) => setRegisteredLine2(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <ComRepFieldLabel label={PROFILE_ADDRESS_FIELD_LABELS.city} optional />
                              <Input
                                value={registeredCity}
                                onChange={(e) => setRegisteredCity(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <ComRepFieldLabel
                                label={PROFILE_ADDRESS_FIELD_LABELS.postcode}
                                required={registeredState !== "Outside Malaysia"}
                                optional={registeredState === "Outside Malaysia"}
                                help={PROFILE_ADDRESS_HELP.postcode}
                              />
                              <Input
                                value={registeredPostalCode}
                                onChange={(e) =>
                                  setRegisteredPostalCode(
                                    restrictScPostcodeInput(registeredState, e.target.value)
                                  )
                                }
                                aria-required={registeredState !== "Outside Malaysia"}
                              />
                            </div>
                            <div className="space-y-2">
                              <ComRepFieldLabel
                                label={PROFILE_ADDRESS_FIELD_LABELS.state}
                                required
                                help={PROFILE_ADDRESS_HELP.state}
                              />
                              <Select
                                value={registeredState || undefined}
                                onValueChange={setRegisteredState}
                              >
                                <SelectTrigger className="h-11 text-ui">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SC_MALAYSIAN_STATES.map((state) => (
                                    <SelectItem key={state} value={state}>
                                      {state}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <ComRepFieldLabel label={PROFILE_ADDRESS_FIELD_LABELS.country} optional />
                              <Input
                                value={registeredCountry}
                                onChange={(e) => setRegisteredCountry(e.target.value)}
                                placeholder="Country"
                              />
                            </div>
                          </div>
                      ) : null}
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-sm font-semibold">{PROFILE_LABEL.businessAddress}</h3>
                      {!isEditingAddresses ? (
                        <ProfileFieldGrid>
                          <ProfileReadField
                            className="sm:col-span-2"
                            label={PROFILE_ADDRESS_FIELD_LABELS.address}
                            value={[
                              orgData?.corporateOnboardingData?.addresses?.business?.line1,
                              orgData?.corporateOnboardingData?.addresses?.business?.line2,
                            ]
                              .filter((part) => part && part.trim())
                              .join(", ") || "—"}
                            required
                            missing={missingFieldKeys.has("businessAddress.line1")}
                          />
                          <ProfileReadField
                            label={PROFILE_ADDRESS_FIELD_LABELS.state}
                            value={orgData?.corporateOnboardingData?.addresses?.business?.state || "—"}
                            required
                            missing={missingFieldKeys.has("businessAddress.state")}
                          />
                          <ProfileReadField
                            label={PROFILE_ADDRESS_FIELD_LABELS.postcode}
                            value={
                              orgData?.corporateOnboardingData?.addresses?.business?.postalCode || "—"
                            }
                            required={isScPostcodeRequired(
                              orgData?.corporateOnboardingData?.addresses?.business?.state
                            )}
                            missing={missingFieldKeys.has("businessAddress.postalCode")}
                          />
                        </ProfileFieldGrid>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2 sm:col-span-2">
                            <ComRepFieldLabel label={PROFILE_ADDRESS_FIELD_LABELS.address} required />
                            <Input
                              value={businessLine1}
                              onChange={(e) => setBusinessLine1(e.target.value)}
                              aria-required
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <ComRepFieldLabel label={PROFILE_ADDRESS_FIELD_LABELS.addressLine2} optional />
                            <Input
                              value={businessLine2}
                              onChange={(e) => setBusinessLine2(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <ComRepFieldLabel label={PROFILE_ADDRESS_FIELD_LABELS.city} optional />
                            <Input
                              value={businessCity}
                              onChange={(e) => setBusinessCity(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <ComRepFieldLabel
                              label={PROFILE_ADDRESS_FIELD_LABELS.postcode}
                              required={businessState !== "Outside Malaysia"}
                              optional={businessState === "Outside Malaysia"}
                              help={PROFILE_ADDRESS_HELP.postcode}
                            />
                            <Input
                              value={businessPostalCode}
                              onChange={(e) =>
                                setBusinessPostalCode(
                                  restrictScPostcodeInput(businessState, e.target.value)
                                )
                              }
                              aria-required={businessState !== "Outside Malaysia"}
                            />
                          </div>
                          <div className="space-y-2">
                            <ComRepFieldLabel
                              label={PROFILE_ADDRESS_FIELD_LABELS.state}
                              required
                              help={PROFILE_ADDRESS_HELP.state}
                            />
                            <Select value={businessState || undefined} onValueChange={setBusinessState}>
                              <SelectTrigger className="h-11 text-ui">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {SC_MALAYSIAN_STATES.map((state) => (
                                  <SelectItem key={state} value={state}>
                                    {state}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <ComRepFieldLabel label={PROFILE_ADDRESS_FIELD_LABELS.country} optional />
                            <Input
                              value={businessCountry}
                              onChange={(e) => setBusinessCountry(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {isEditingAddresses && isCurrentUserAdmin && (
                      <div className="flex justify-end gap-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={handleCancelAddressesEdit}
                          disabled={updateAddressesMutation.isPending}
                          className="gap-2 rounded-xl"
                        >
                          <XMarkIcon className="h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveAddresses}
                          disabled={updateAddressesMutation.isPending}
                          className="gap-2 rounded-xl"
                        >
                          {updateAddressesMutation.isPending ? "Saving..." : "Save changes"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. Contact Details Section (Editable) */}
              <div ref={contactSectionRef} id="profile-contact" className="scroll-mt-24 rounded-xl border bg-card">
                <div className="flex items-center justify-between p-6 border-b">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {isPersonal ? "Contact details" : "Person in Charge"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {isPersonal
                        ? "Phone number and email for this organisation"
                        : "Main contact person for this company."}
                    </p>
                  </div>
                  {!isEditingProfile && isCurrentUserAdmin ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingProfile(true)}
                      className="gap-2 rounded-xl"
                    >
                      <PencilIcon className="h-4 w-4" />
                      Edit
                    </Button>
                  ) : null}
                </div>
                <div className="p-6 space-y-4">
                  {isPersonal ? (
                    isEditingProfile ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <PhoneIcon className="h-4 w-4" />
                          Phone number
                        </Label>
                          <PhoneInput
                            international
                            defaultCountry="MY"
                            value={phoneNumber}
                            onChange={setPhoneNumber}
                            className={cn(
                              issuerFieldChromeClassName,
                              issuerFieldFocusWithinOpenClassName,
                              "h-11 px-4 transition-none [&_*]:transition-none [&>input]:border-0 [&>input]:bg-transparent [&>input]:text-sm [&>input]:focus-visible:outline-none [&>input]:focus-visible:ring-0 [&_*]:focus-visible:outline-none [&_*]:focus-visible:ring-0"
                            )}
                          />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <EnvelopeIcon className="h-4 w-4" />
                          Email
                        </Label>
                        <p className="text-ui">
                            {activeOrganization.members?.find((m) => m.id === activeOrganization.ownerId)?.email || "—"}
                        </p>
                      </div>
                    </div>
                    ) : (
                      <ProfileFieldGrid>
                        <ProfileReadField label="Phone number" value={phoneNumber || "—"} />
                        <ProfileReadField
                          label="Email"
                          value={
                            activeOrganization.members?.find((m) => m.id === activeOrganization.ownerId)
                              ?.email || "—"
                          }
                          locked
                        />
                      </ProfileFieldGrid>
                    )
                  ) : isEditingProfile ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <ComRepFieldLabel label={PROFILE_LABEL.fullName} required />
                        <Input
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="eg. John Doe"
                          aria-required
                        />
                      </div>
                      <div className="space-y-2">
                        <ComRepFieldLabel label={PROFILE_LABEL.position} required />
                        <Input
                          value={contactPosition}
                          onChange={(e) => setContactPosition(e.target.value)}
                          placeholder="eg. CFO"
                          aria-required
                        />
                      </div>
                      <div className="space-y-2">
                        <ComRepFieldLabel
                          label={PROFILE_LABEL.personEmail}
                          required
                          help={PROFILE_HELP.personEmail}
                        />
                        <Input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="eg. name@company.com"
                          aria-required
                        />
                      </div>
                      <div className="space-y-2">
                        <ComRepFieldLabel label={PROFILE_LABEL.phone} required />
                          <PhoneInput
                            international
                            defaultCountry="MY"
                            value={contactPhone}
                            onChange={setContactPhone}
                            className={cn(
                              issuerFieldChromeClassName,
                              issuerFieldFocusWithinOpenClassName,
                              "h-11 px-4 transition-none [&_*]:transition-none [&>input]:border-0 [&>input]:bg-transparent [&>input]:text-sm [&>input]:focus-visible:outline-none [&>input]:focus-visible:ring-0 [&_*]:focus-visible:outline-none [&_*]:focus-visible:ring-0"
                            )}
                          />
                      </div>
                    </div>
                  ) : (
                    <ProfileFieldGrid>
                      <ProfileReadField
                        label={PROFILE_LABEL.fullName}
                        value={contactName || "—"}
                        required
                        missing={missingFieldKeys.has("contactPersonName")}
                      />
                      <ProfileReadField
                        label={PROFILE_LABEL.position}
                        value={contactPosition || "—"}
                        required
                        missing={missingFieldKeys.has("contactPersonPosition")}
                      />
                      <ProfileReadField
                        label={PROFILE_LABEL.personEmail}
                        value={contactEmail || "—"}
                        required
                        missing={missingFieldKeys.has("contactPersonEmail")}
                      />
                      <ProfileReadField
                        label={PROFILE_LABEL.phone}
                        value={contactPhone || "—"}
                        required
                        missing={missingFieldKeys.has("contactPersonPhone")}
                      />
                    </ProfileFieldGrid>
                  )}

                  {isEditingProfile && (
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleCancelProfileEdit}
                        disabled={updateProfileMutation.isPending}
                        className="gap-2 rounded-xl"
                      >
                        <XMarkIcon className="h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveProfile}
                        disabled={updateProfileMutation.isPending}
                        className="gap-2 rounded-xl"
                      >
                        {updateProfileMutation.isPending ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {!isPersonal && activeOrganization?.id ? (
                <div ref={financialsSectionRef}>
                  <IssuerFinancialsCard organizationId={activeOrganization.id} />
                </div>
              ) : null}

            </TabsContent>

            {/* Banking Tab */}
            <TabsContent value="banking" className="space-y-6 mt-6">
              <div className="rounded-xl border bg-card">
                <div className="flex items-center justify-between p-6 border-b">
                  <div>
                    <h2 className="text-lg font-semibold">Bank account</h2>
                    <p className="text-sm text-muted-foreground">
                      Where disbursements and payouts are sent
                    </p>
                  </div>
                  {!isEditingBanking && isCurrentUserAdmin ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingBanking(true)}
                      className="gap-2 rounded-xl"
                    >
                      <PencilIcon className="h-4 w-4" />
                      Edit
                    </Button>
                  ) : null}
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {isEditingBanking ? (
                      <>
                        <div className="space-y-2">
                          <ComRepFieldLabel label={PROFILE_LABEL.bankName} optional />
                          <Select value={bankName} onValueChange={setBankName}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select bank" />
                            </SelectTrigger>
                            <SelectContent>
                              {MALAYSIAN_BANKS.map((bank) => (
                                <SelectItem key={bank.value} value={bank.value}>
                                  {bank.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <ComRepFieldLabel label={PROFILE_LABEL.accountType} optional />
                          <Select value={accountType} onValueChange={setAccountType}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select account type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Savings">Savings</SelectItem>
                              <SelectItem value="Checking">Checking</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <ComRepFieldLabel
                            label={PROFILE_LABEL.bankAccountNumber}
                            optional
                            help="Enter a 10–18 digit account number if you add banking details."
                          />
                          <Input
                            placeholder="Enter your bank account number"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                            maxLength={18}
                            className="font-mono"
                          />
                        </div>
                      </>
                    ) : (
                      <ProfileFieldGrid className="sm:col-span-2">
                        <ProfileReadField label={PROFILE_LABEL.bankName} value={bankName || "—"} />
                        <ProfileReadField label={PROFILE_LABEL.accountType} value={accountType || "—"} />
                        <ProfileReadField
                          className="sm:col-span-2"
                          label={PROFILE_LABEL.bankAccountNumber}
                          value={accountNumber || "—"}
                        />
                      </ProfileFieldGrid>
                    )}
                  </div>

                  {isEditingBanking && isCurrentUserAdmin && (
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleCancelBankingEdit}
                        disabled={updateProfileMutation.isPending}
                        className="gap-2 rounded-xl"
                      >
                        <XMarkIcon className="h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveBanking}
                        disabled={updateProfileMutation.isPending}
                        className="gap-2 rounded-xl"
                      >
                        {updateProfileMutation.isPending ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="people" className="mt-6 space-y-6">
                {activeOrganization?.id ? (
                  <PeopleAccessSection
                    portal="issuer"
                    organizationId={activeOrganization.id}
                    organizationOnboardingStatus={orgData?.onboardingStatus}
                    people={orgData?.people ?? activeOrganization.people ?? []}
                    directorShareholderListSource={orgData?.directorShareholderListSource ?? null}
                    ctosDirectorShareholderWarning={orgData?.ctosDirectorShareholderWarning ?? null}
                    focusedMatchKey={focusedPersonKey}
                    canEdit={isCurrentUserAdmin}
                    canInactivate={isCurrentUserAdmin}
                    currentUserId={currentUser?.userId}
                    ownerUserId={activeOrganization.ownerId}
                    members={activeOrganization.members ?? []}
                    invitations={invitations}
                    invitePortalUrl={process.env.NEXT_PUBLIC_ISSUER_PORTAL_URL || "http://localhost:3001"}
                    onViewPerson={(partyId) => router.push(`/profile/people/${partyId}`)}
                    onChanged={async () => {
                      await queryClient.invalidateQueries({
                        queryKey: ["corporate-entities", activeOrganization.id],
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["organization-detail", activeOrganization.id],
                      });
                      await queryClient.invalidateQueries({ queryKey: ["party-profiles"] });
                      await queryClient.invalidateQueries({ queryKey: ["organization-invitations"] });
                    }}
                  />
                ) : null}
              </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-6 mt-6">
              <DocumentsTabContent apiClient={apiClient} />
            </TabsContent>
          </Tabs>
        </PageShell>
      </div>

    </div>
  );
}
