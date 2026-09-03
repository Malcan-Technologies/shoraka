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
  type OrganizationMember,
  type OrganizationMemberRole,
  type BankAccountDetails,
  type UpdateOrganizationProfileInput,
  MALAYSIAN_BANKS,
} from "@cashsouk/config";
import { useAuth } from "../../lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccountDocuments } from "../../hooks/use-account-documents";
import { useOrganizationMembers } from "../../hooks/use-organization-members";
import { useOrganizationInvitations } from "../../hooks/use-organization-invitations";
import { filterVisiblePeopleRows } from "@cashsouk/types";
import { DirectorShareholderAlertCard } from "../../components/director-shareholder-alert-card";
import { IssuerProfileCompletenessBanner } from "../../components/profile-completeness-banner";
import { AboutYourBusinessCard } from "../../components/about-your-business-card";
import { IssuerCompanyDetailsCard } from "../../components/issuer-company-details-card";
import { IssuerFinancialsCard } from "../../components/issuer-financials-card";
import { IssuerPeopleSection } from "../../components/issuer-people-section";
import { InviteMemberDialog } from "../../components/invite-member-dialog";
import { TransferOwnershipDialog } from "../../components/transfer-ownership-dialog";
import { toast } from "sonner";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import {
  ConfirmDialog,
  KeyValueGrid,
  PageShell,
  VerifiedBadge,
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
import { formInputDisabledClassName } from "@/app/(application-flow)/applications/components/form-control";
import {
  UserIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  EnvelopeIcon,
  ArrowPathIcon,
  PencilIcon,
  XMarkIcon,
  IdentificationIcon,
  BanknotesIcon,
  DocumentTextIcon,
  MapPinIcon,
  PhoneIcon,
  ArrowDownTrayIcon,
  UserPlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClipboardIcon,
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const roleConfig: Record<
  OrganizationMemberRole,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  ORGANIZATION_ADMIN: {
    label: "Organization Admin",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
  },
  ORGANIZATION_MEMBER: {
    label: "Organization Member",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
  },
};

function RoleBadge({ role }: { role: OrganizationMemberRole }) {
  const config = roleConfig[role];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${config.bgColor} border ${config.borderColor}`}
    >
      <ShieldCheckIcon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function MemberCard({ member, ownerId }: { member: OrganizationMember; ownerId?: string }) {
  const fullName = [member.firstName, member.lastName].filter(Boolean).join(" ") || "Unknown";
  const initials =
    [member.firstName?.[0], member.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const isOwner = ownerId && member.id === ownerId;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border bg-card transition-none">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">{fullName}</p>
          {isOwner && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200">
              <ShieldCheckIcon className="h-3 w-3" />
              Organization Owner
            </span>
          )}
          <RoleBadge role={member.role} />
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
          <EnvelopeIcon className="h-3.5 w-3.5" />
          <p className="text-xs truncate">{member.email}</p>
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className={issuerMainContentClassName}>
      <div className={cn(issuerContentMaxWidthClassName, "space-y-6", issuerPageGutterClassName)}>
        <PageShell title="Organisation" description="Company details, members, and documents.">
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
        <PageShell title="Organisation" description="Company details, members, and documents.">
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
              Create or select an organisation to view details and members.
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
  const [activeTab, setActiveTab] = React.useState("profile");
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);

  // Editing states
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [isEditingBanking, setIsEditingBanking] = React.useState(false);
  const [isEditingAddresses, setIsEditingAddresses] = React.useState(false);

  // Organization management hooks
  const {
    removeMember,
    changeRole,
    leave,
    transferOwnership,
    isRemoving,
    isChangingRole,
    isLeaving,
    isTransferringOwnership,
  } = useOrganizationMembers(activeOrganization?.id);

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

  const { invitations, resend, revoke } = useOrganizationInvitations(activeOrganization?.id, {
    enabled: isCurrentUserAdmin,
  });

  // Confirmation dialog states
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    type: "remove" | "leave" | "promote" | "demote" | null;
    memberId?: string;
    memberName?: string;
    memberRole?: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER";
  }>({
    open: false,
    type: null,
  });

  // Transfer ownership dialog state
  const [transferOwnershipOpen, setTransferOwnershipOpen] = React.useState(false);

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
        companyEmail?: string | null;
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

  const searchParams = useSearchParams();
  const focusDirectors = searchParams.get("focus") === "directors";
  const focusContact = searchParams.get("focus") === "contact";
  const focusAbout = searchParams.get("focus") === "about";
  const focusedPersonKey = searchParams.get("person");
  const directorsSectionRef = React.useRef<HTMLDivElement>(null);
  const contactSectionRef = React.useRef<HTMLDivElement>(null);
  const aboutSectionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!focusDirectors) return;
    setActiveTab("profile");
    const el = directorsSectionRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [focusDirectors, orgData, activeOrganization?.id]);

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
      toast.success("Profile updated successfully");
      setIsEditingProfile(false);
      setIsEditingBanking(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to update profile", { description: error.message });
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
      if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
        toast.error("Invalid phone number format");
        return;
      }

      updateProfileMutation.mutate({
        phoneNumber: phoneNumber || null,
        address: address.trim() || null,
      });
      return;
    }

    if (!contactName.trim() || !contactEmail.trim() || !contactPosition.trim() || !contactPhone) {
      toast.error("Please fill in all contact details");
      return;
    }
    if (!isValidPhoneNumber(contactPhone)) {
      toast.error("Invalid phone number format");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      toast.error("Invalid email address");
      return;
    }

    updateProfileMutation.mutate({
      contactPerson: {
        name: contactName.trim(),
        email: contactEmail.trim(),
        position: contactPosition.trim(),
        contact: contactPhone,
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
      toast.error("Failed to update addresses", { description: error.message });
    },
  });

  const handleSaveAddresses = () => {
    const businessAddress = {
      line1: businessLine1 || null,
      line2: businessLine2 || null,
      city: businessCity || null,
      postalCode: businessPostalCode || null,
      state: businessState || null,
      country: businessCountry || null,
    };

    const registeredAddress = sameAsBusinessAddress
      ? businessAddress
      : {
          line1: registeredLine1 || null,
          line2: registeredLine2 || null,
          city: registeredCity || null,
          postalCode: registeredPostalCode || null,
          state: registeredState || null,
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
          description="Company details, members, banking, and documents."
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
          />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl bg-muted p-1 sm:grid-cols-4">
              <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-background">
                Profile
              </TabsTrigger>
              <TabsTrigger value="banking" className="rounded-lg data-[state=active]:bg-background">
                Banking
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="rounded-lg data-[state=active]:bg-background"
              >
                Documents
              </TabsTrigger>
              <TabsTrigger value="members" className="rounded-lg data-[state=active]:bg-background">
                Members
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
                    <KeyValueGrid
                      items={[
                        { label: "Name", value: displayName },
                        { label: "Document type", value: formatDocumentType(orgData?.documentType) },
                        { label: "Document number", value: orgData?.documentNumber || "—" },
                        { label: "Issuing country", value: orgData?.idIssuingCountry || "—" },
                        ...(orgData?.onboardedAt
                          ? [
                              {
                                label: "Member since",
                                value: new Date(orgData.onboardedAt).toLocaleDateString("en-MY", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                }),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </div>
              )}

              {!isPersonal && activeOrganization?.id ? (
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
                    companyCategory: orgData?.companyCategory ?? activeOrganization.companyCategory,
                    companyEmail: orgData?.companyEmail ?? activeOrganization.companyEmail,
                    corporateOnboardingData: orgData?.corporateOnboardingData ?? null,
                  }}
                />
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
                      <KeyValueGrid
                        items={[{ label: "Full address", value: address.trim() || "—" }]}
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
                <div className="rounded-xl border bg-card">
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
                      <h3 className="text-sm font-semibold">Registered address</h3>
                      {!isEditingAddresses ? (
                        <KeyValueGrid
                          items={[
                            {
                              label: "Address",
                              value: [
                                orgData?.corporateOnboardingData?.addresses?.registered?.line1,
                                orgData?.corporateOnboardingData?.addresses?.registered?.line2,
                              ]
                                .filter((part) => part && part.trim())
                                .join(", ") || "—",
                            },
                            {
                              label: "State",
                              value: orgData?.corporateOnboardingData?.addresses?.registered?.state || "—",
                            },
                            {
                              label: "Postcode",
                              value: orgData?.corporateOnboardingData?.addresses?.registered?.postalCode || "—",
                            },
                          ]}
                        />
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
                              <Label>Address Line 1</Label>
                              <Input
                                value={registeredLine1}
                                onChange={(e) => setRegisteredLine1(e.target.value)}
                                placeholder="Street address"
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Address Line 2</Label>
                              <Input
                                value={registeredLine2}
                                onChange={(e) => setRegisteredLine2(e.target.value)}
                                placeholder="Apartment, suite, etc. (optional)"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>City</Label>
                              <Input
                                value={registeredCity}
                                onChange={(e) => setRegisteredCity(e.target.value)}
                                placeholder="City"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Postal Code</Label>
                              <Input
                                value={registeredPostalCode}
                                onChange={(e) => setRegisteredPostalCode(e.target.value)}
                                placeholder="Postal code"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>State</Label>
                              <Input
                                value={registeredState}
                                onChange={(e) => setRegisteredState(e.target.value)}
                                placeholder="State"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Country</Label>
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
                      <h3 className="text-sm font-semibold">Business address</h3>
                      {!isEditingAddresses ? (
                        <KeyValueGrid
                          items={[
                            {
                              label: "Address",
                              value: [
                                orgData?.corporateOnboardingData?.addresses?.business?.line1,
                                orgData?.corporateOnboardingData?.addresses?.business?.line2,
                              ]
                                .filter((part) => part && part.trim())
                                .join(", ") || "—",
                            },
                            {
                              label: "State",
                              value: orgData?.corporateOnboardingData?.addresses?.business?.state || "—",
                            },
                            {
                              label: "Postcode",
                              value: orgData?.corporateOnboardingData?.addresses?.business?.postalCode || "—",
                            },
                          ]}
                        />
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2 sm:col-span-2">
                            <Label>Address Line 1</Label>
                            <Input
                              value={businessLine1}
                              onChange={(e) => setBusinessLine1(e.target.value)}
                              placeholder="Street address"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>Address Line 2</Label>
                            <Input
                              value={businessLine2}
                              onChange={(e) => setBusinessLine2(e.target.value)}
                              placeholder="Apartment, suite, etc. (optional)"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>City</Label>
                            <Input
                              value={businessCity}
                              onChange={(e) => setBusinessCity(e.target.value)}
                              placeholder="City"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Postal Code</Label>
                            <Input
                              value={businessPostalCode}
                              onChange={(e) => setBusinessPostalCode(e.target.value)}
                              placeholder="Postal code"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>State</Label>
                            <Input
                              value={businessState}
                              onChange={(e) => setBusinessState(e.target.value)}
                              placeholder="State"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Country</Label>
                            <Input
                              value={businessCountry}
                              onChange={(e) => setBusinessCountry(e.target.value)}
                              placeholder="Country"
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
              <div ref={contactSectionRef} className="scroll-mt-24 rounded-xl border bg-card">
                <div className="flex items-center justify-between p-6 border-b">
                  <div>
                    <h2 className="text-lg font-semibold">Contact details</h2>
                    <p className="text-sm text-muted-foreground">
                      {isPersonal
                        ? "Phone number and email for this organisation"
                        : "Applicant contact used on applications. Seeded from onboarding; edit here to update."}
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
                      <KeyValueGrid
                        items={[
                          { label: "Phone number", value: phoneNumber || "—" },
                          {
                            label: "Email",
                            value:
                              activeOrganization.members?.find((m) => m.id === activeOrganization.ownerId)?.email ||
                              "—",
                          },
                        ]}
                      />
                    )
                  ) : isEditingProfile ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="eg. John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Position</Label>
                        <Input
                          value={contactPosition}
                          onChange={(e) => setContactPosition(e.target.value)}
                          placeholder="eg. CFO"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <EnvelopeIcon className="h-4 w-4" />
                          Email
                        </Label>
                        <Input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="eg. name@company.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <PhoneIcon className="h-4 w-4" />
                          Contact number
                        </Label>
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
                    <KeyValueGrid
                      items={[
                        { label: "Name", value: contactName || "—" },
                        { label: "Position", value: contactPosition || "—" },
                        { label: "Email", value: contactEmail || "—" },
                        { label: "Phone", value: contactPhone || "—" },
                      ]}
                    />
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

              {!isPersonal && activeOrganization?.id && orgData ? (
                <div ref={directorsSectionRef} className="scroll-mt-24">
                  <IssuerPeopleSection
                    organizationId={activeOrganization.id}
                    organizationOnboardingStatus={orgData.onboardingStatus}
                    people={orgData.people ?? []}
                    directorShareholderListSource={orgData.directorShareholderListSource ?? null}
                    ctosDirectorShareholderWarning={orgData.ctosDirectorShareholderWarning ?? null}
                    focusedMatchKey={focusedPersonKey}
                    canEdit={isCurrentUserAdmin}
                    onChanged={async () => {
                      await queryClient.invalidateQueries({
                        queryKey: ["corporate-entities", activeOrganization.id],
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["organization-detail", activeOrganization.id],
                      });
                    }}
                  />
                </div>
              ) : null}

              {!isPersonal && activeOrganization?.id ? (
                <IssuerFinancialsCard organizationId={activeOrganization.id} />
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
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <BanknotesIcon className="h-4 w-4" />
                        Bank name
                      </Label>
                      {isEditingBanking ? (
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
                      ) : (
                        <Input
                          value={bankName || "—"}
                          disabled
                          className={formInputDisabledClassName}
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <DocumentTextIcon className="h-4 w-4" />
                        Account type
                      </Label>
                      {isEditingBanking ? (
                        <Select value={accountType} onValueChange={setAccountType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Savings">Savings</SelectItem>
                            <SelectItem value="Checking">Checking</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={accountType || "—"}
                          disabled
                          className={formInputDisabledClassName}
                        />
                      )}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="flex items-center gap-2">
                        <IdentificationIcon className="h-4 w-4" />
                        Bank account number
                      </Label>
                      <Input
                        placeholder="Enter your bank account number"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                        disabled={!isEditingBanking}
                        maxLength={18}
                        className={cn(
                          "font-mono",
                          !isEditingBanking && formInputDisabledClassName
                        )}
                      />
                      {isEditingBanking && (
                        <p className="text-xs text-muted-foreground">
                          Enter 10-18 digit account number
                        </p>
                      )}
                    </div>
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

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-6 mt-6">
              <DocumentsTabContent apiClient={apiClient} />
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members" className="mt-6 space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {isPersonal ? "Account holder" : "Team members"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {isPersonal
                        ? "People with access to this account"
                        : `${activeOrganization.members?.length || 0} people with access to this organisation`}
                    </p>
                  </div>
                  {!isPersonal && isCurrentUserAdmin ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInviteDialogOpen(true)}
                        className="gap-2 rounded-xl"
                      >
                        <UserPlusIcon className="h-4 w-4" />
                        Invite member
                      </Button>
                      {activeOrganization.isOwner &&
                      activeOrganization.members &&
                      activeOrganization.members.length > 1 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTransferOwnershipOpen(true)}
                          disabled={isTransferringOwnership}
                          className="gap-2 rounded-xl border-status-action-text/30 text-status-action-text hover:bg-status-action-bg"
                        >
                          <ArrowPathIcon className="h-4 w-4" />
                          Transfer ownership
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {activeOrganization.members && activeOrganization.members.length > 0 ? (
                  <div className="grid gap-3">
                    {activeOrganization.members.map((member) => {
                      const isCurrentUser = currentUser && member.id === currentUser.userId;
                      const canManageMembers = !isPersonal && isCurrentUserAdmin && !isCurrentUser;
                      const isOwner = activeOrganization.isOwner && isCurrentUser;
                      const canLeave = !isPersonal && isCurrentUser && !isOwner;
                      const memberName =
                        [member.firstName, member.lastName].filter(Boolean).join(" ") ||
                        member.email;

                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-none"
                        >
                          <div className="flex-1">
                            <MemberCard member={member} ownerId={activeOrganization.ownerId} />
                          </div>
                          {canManageMembers ? (
                            <div className="ml-auto flex items-center gap-2">
                              {member.role === "ORGANIZATION_MEMBER" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setConfirmDialog({
                                      open: true,
                                      type: "promote",
                                      memberId: member.id,
                                      memberName,
                                      memberRole: member.role,
                                    })
                                  }
                                  disabled={isChangingRole}
                                  className="gap-1"
                                >
                                  <ArrowUpIcon className="h-4 w-4" />
                                  Make admin
                                </Button>
                              ) : !isCurrentUser ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setConfirmDialog({
                                      open: true,
                                      type: "demote",
                                      memberId: member.id,
                                      memberName,
                                      memberRole: member.role,
                                    })
                                  }
                                  disabled={isChangingRole}
                                  className="gap-1"
                                >
                                  <ArrowDownIcon className="h-4 w-4" />
                                  Make member
                                </Button>
                              ) : null}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setConfirmDialog({
                                    open: true,
                                    type: "remove",
                                    memberId: member.id,
                                    memberName,
                                  })
                                }
                                disabled={isRemoving}
                                className="gap-1 text-destructive hover:text-destructive"
                              >
                                <TrashIcon className="h-4 w-4" />
                                Remove
                              </Button>
                            </div>
                          ) : null}
                          {canLeave ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setConfirmDialog({
                                  open: true,
                                  type: "leave",
                                })
                              }
                              disabled={isLeaving}
                              className="ml-auto gap-1 text-destructive hover:text-destructive"
                            >
                              Leave
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
                    <p>No members yet</p>
                  </div>
                )}
              </div>

              {!isPersonal && isCurrentUserAdmin && invitations.length > 0 ? (
                <div className="rounded-xl border bg-card">
                  <div className="flex items-center justify-between border-b p-6">
                    <div>
                      <h2 className="text-lg font-semibold">Pending invitations</h2>
                      <p className="text-sm text-muted-foreground">
                        Waiting for people to accept
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 p-6">
                    {invitations.map((invitation) => {
                      const isPlaceholderEmail =
                        invitation.email.startsWith("invitation-") &&
                        invitation.email.includes("@cashsouk.com");
                      return (
                        <div
                          key={invitation.id}
                          className="flex items-center justify-between rounded-lg border bg-muted/30 p-3"
                        >
                          <div>
                            <p className="font-medium">
                              {isPlaceholderEmail ? "Link-based invitation" : invitation.email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {invitation.role === "ORGANIZATION_ADMIN" ? "Admin" : "Member"} ·
                              Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const portalUrl =
                                  process.env.NEXT_PUBLIC_ISSUER_PORTAL_URL ||
                                  "http://localhost:3001";
                                const inviteLink = `${portalUrl}/accept-invitation?token=${invitation.token}`;
                                navigator.clipboard.writeText(inviteLink);
                                toast.success("Invitation link copied to clipboard");
                              }}
                              className="gap-1"
                            >
                              <ClipboardIcon className="h-4 w-4" />
                              Copy link
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resend(invitation.id)}
                              className="gap-1"
                            >
                              Resend
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => revoke(invitation.id)}
                              className="gap-1 text-destructive"
                            >
                              Revoke
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {activeOrganization?.id && isCurrentUserAdmin ? (
                <InviteMemberDialog
                  organizationId={activeOrganization.id}
                  open={inviteDialogOpen}
                  onOpenChange={setInviteDialogOpen}
                />
              ) : null}
            </TabsContent>
          </Tabs>
        </PageShell>
      </div>

      {/* Confirmation Dialogs */}
      {confirmDialog.type === "remove" && confirmDialog.memberId && (
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) =>
            setConfirmDialog({ ...confirmDialog, open })
          }
          title="Remove member"
          description={`Are you sure you want to remove ${confirmDialog.memberName} from this organisation? This cannot be undone.`}
          confirmText="Remove"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={async () => {
            if (confirmDialog.memberId) {
              removeMember(confirmDialog.memberId);
              setConfirmDialog({ open: false, type: null });
            }
          }}
          isLoading={isRemoving}
        />
      )}

      {confirmDialog.type === "leave" && (
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) =>
            setConfirmDialog({ ...confirmDialog, open })
          }
          title="Leave organisation"
          description="Are you sure you want to leave this organisation? You will lose access and need a new invitation to return."
          confirmText="Leave"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={async () => {
            try {
              await leave();
              setConfirmDialog({ open: false, type: null });
            } catch {
              // Error is handled by the hook
            }
          }}
          isLoading={isLeaving}
        />
      )}

      {confirmDialog.type === "promote" && confirmDialog.memberId && (
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) =>
            setConfirmDialog({ ...confirmDialog, open })
          }
          title="Make admin"
          description={`Give ${confirmDialog.memberName} admin access? They will be able to manage members and organisation settings.`}
          confirmText="Make admin"
          cancelText="Cancel"
          variant="default"
          onConfirm={async () => {
            if (confirmDialog.memberId) {
              changeRole({ userId: confirmDialog.memberId, role: "ORGANIZATION_ADMIN" });
              setConfirmDialog({ open: false, type: null });
            }
          }}
          isLoading={isChangingRole}
        />
      )}

      {confirmDialog.type === "demote" && confirmDialog.memberId && (
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) =>
            setConfirmDialog({ ...confirmDialog, open })
          }
          title="Make member"
          description={`Change ${confirmDialog.memberName} to a regular member? They will lose admin privileges.`}
          confirmText="Make member"
          cancelText="Cancel"
          variant="default"
          onConfirm={async () => {
            if (confirmDialog.memberId) {
              changeRole({ userId: confirmDialog.memberId, role: "ORGANIZATION_MEMBER" });
              setConfirmDialog({ open: false, type: null });
            }
          }}
          isLoading={isChangingRole}
        />
      )}

      {/* Transfer Ownership Dialog */}
      {activeOrganization && currentUser && (
        <TransferOwnershipDialog
          open={transferOwnershipOpen}
          onOpenChange={setTransferOwnershipOpen}
          members={activeOrganization.members || []}
          currentUserId={currentUser.userId}
          onConfirm={(newOwnerId) => {
            transferOwnership(newOwnerId);
            setTransferOwnershipOpen(false);
          }}
          isLoading={isTransferringOwnership}
        />
      )}
    </div>
  );
}
