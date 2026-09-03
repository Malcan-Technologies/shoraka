"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
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
import type { ApplicationPersonRow } from "@cashsouk/types";
import {
  filterVisiblePeopleRows,
  SC_GENDER_LABELS,
  SC_INVESTOR_CATEGORY_LABELS,
  type ScGender,
  type ScInvestorCategory,
} from "@cashsouk/types";
import { useAuth } from "../../lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccountDocuments } from "../../hooks/use-account-documents";
import { useOrganizationMembers } from "../../hooks/use-organization-members";
import { useOrganizationInvitations } from "../../hooks/use-organization-invitations";
import { InvestorCompanyDetailsCard } from "../../components/investor-company-details-card";
import { InvestorProfileCompletenessBanner } from "../../components/profile-completeness-banner";
import { InviteMemberDialog } from "../../components/invite-member-dialog";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { TransferOwnershipDialog } from "../../components/transfer-ownership-dialog";
import { toast } from "sonner";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import {
  useHeader,
  DirectorShareholderAlertCard,
  INVESTOR_DIRECTOR_SHAREHOLDER_ALERT_COPY,
  DirectorShareholdersUnifiedSection,
  KeyValueGrid,
  portalContentMaxWidthClassName,
  StatusBadge,
  VerifiedBadge,
} from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import {
  isProfileTab,
  profileTabFromSearchParam,
  PROFILE_PATH,
  PROFILE_TAB_PROFILE,
  type ProfileTab,
} from "@/app/profile/profile-tabs";
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
    <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
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
  const { setTitle } = useHeader();

  React.useEffect(() => {
    setTitle("Profile");
  }, [setTitle]);

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className={cn(portalContentMaxWidthClassName, "space-y-6 px-2 py-8 md:px-4")}>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
          <div className="space-y-4 mt-8">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </>
  );
}

function NoOrganizationState({ showOnboardingPrompt = true }: { showOnboardingPrompt?: boolean }) {
  const router = useRouter();
  const { setTitle } = useHeader();

  React.useEffect(() => {
    setTitle("Profile");
  }, [setTitle]);

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className={cn(portalContentMaxWidthClassName, "px-2 py-8 md:px-4")}>
          <div className="rounded-xl border bg-card p-8 text-center opacity-60">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <UserIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">
              No Profile Selected
            </h2>
            <p className="text-muted-foreground mb-6">
              Create or select a profile to view profile details and members.
            </p>
            {showOnboardingPrompt && (
              <Button variant="outline" onClick={() => router.push("/onboarding/account")}>
                Create Profile
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
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

function formatProfileDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-MY", { year: "numeric", month: "long", day: "numeric" });
}

function formatGender(value: string | null | undefined): string {
  if (!value) return "—";
  const key = value.trim().toUpperCase();
  if (key in SC_GENDER_LABELS) return SC_GENDER_LABELS[key as ScGender];
  return value;
}

function formatInvestorCategory(value: string | null | undefined): string {
  if (!value) return "—";
  if (value in SC_INVESTOR_CATEGORY_LABELS) {
    return SC_INVESTOR_CATEGORY_LABELS[value as ScInvestorCategory];
  }
  return value;
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
  const { data: documents, isLoading, error } = useAccountDocuments("INVESTOR");
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
  const { setTitle } = useHeader();

  React.useEffect(() => {
    setTitle("Profile");
  }, [setTitle]);

  const { isAuthenticated } = useAuth();
  const { getAccessToken } = useAuthToken();
  const searchParams = useSearchParams();
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
  const [activeTab, setActiveTab] = React.useState<ProfileTab>(() =>
    profileTabFromSearchParam(searchParams.get("tab"))
  );
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
        type: string;
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
        scInvestorCategory?: string | null;
        dateOfIncorporation?: string | null;
        countryOfIncorporation?: string | null;
        residentialAddress?: { state?: string | null; postalCode?: string | null } | null;
        phoneNumber: string | null;
        address: string | null;
        bankAccountDetails: BankAccountDetails | null;
        onboardingStatus: string;
        onboardedAt: string | null;
        isSophisticatedInvestor: boolean;
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
        };
        corporateEntities?: {
          directors?: Array<Record<string, unknown>>;
          shareholders?: Array<Record<string, unknown>>;
          corporateShareholders?: Array<Record<string, unknown>>;
        };
        people?: ApplicationPersonRow[];
        directorShareholderListSource?: import("@cashsouk/types").DirectorShareholderListSource;
        ctosDirectorShareholderWarning?: string | null;
      }>(`/v1/organizations/investor/${activeOrganization.id}`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: !!activeOrganization?.id,
    staleTime: 1000 * 60 * 5,
  });

  const urlTab = profileTabFromSearchParam(searchParams.get("tab"));
  const focusDirectors = searchParams.get("focus") === "directors";
  const focusedPersonKey = searchParams.get("person");
  const directorsSectionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  function handleTabChange(next: string) {
    if (!isProfileTab(next)) return;
    setActiveTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === PROFILE_TAB_PROFILE) params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${PROFILE_PATH}?${query}` : PROFILE_PATH, { scroll: false });
  }

  React.useEffect(() => {
    if (!focusDirectors) return;
    const el = directorsSectionRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [focusDirectors, orgData, activeOrganization?.id]);

  const handlePartyOnboardingSent = React.useCallback(async () => {
    if (!activeOrganization?.id) return;
    await queryClient.invalidateQueries({ queryKey: ["corporate-entities", activeOrganization.id] });
    await queryClient.invalidateQueries({ queryKey: ["organization-detail", activeOrganization.id] });
    await refreshOrganizations();
  }, [activeOrganization?.id, queryClient, refreshOrganizations]);

  // Initialize form values when orgData loads
  React.useEffect(() => {
    if (orgData) {
      setPhoneNumber(orgData.phoneNumber || undefined);
      setAddress(orgData.address || "");

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
    // Validate phone number if provided
    if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
      toast.error("Invalid phone number format");
      return;
    }

    updateProfileMutation.mutate({
      phoneNumber: phoneNumber || null,
      address: address.trim() || null,
    });
  };

  const handleSaveBanking = () => {
    // Validate account number (allow digits only, 10-18 chars)
    if (accountNumber && !/^\d{10,18}$/.test(accountNumber)) {
      toast.error("Bank account number must be 10-18 digits");
      return;
    }

    // Build RegTank format if any field is filled
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
    }
    setIsEditingProfile(false);
  };

  const handleCancelBankingEdit = () => {
    // Reset to values from RegTank format
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
        `/v1/organizations/investor/${activeOrganization.id}/corporate-info`,
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
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className={cn(portalContentMaxWidthClassName, "space-y-6 px-2 py-8 md:px-4")}>
          {/* Page Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <AccountIcon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{displayName}</h1>
                <p className="text-muted-foreground mt-1">
                  {isPersonal ? "Investor (Individual)" : "Investor (Corporate)"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2 h-11 rounded-xl"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {!isPersonal ? (
            <DirectorShareholderAlertCard
              visiblePeople={visiblePeopleForDsAlert}
              enabled={activeOrganization?.onboardingStatus === "COMPLETED"}
              copy={INVESTOR_DIRECTOR_SHAREHOLDER_ALERT_COPY}
            />
          ) : null}

          <InvestorProfileCompletenessBanner
            organizationId={activeOrganization?.id}
            onboarded={activeOrganization?.onboardingStatus === "COMPLETED"}
          />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-12 rounded-xl bg-muted p-1">
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
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6 mt-6">
              {/* Personal Info Section (Read-only) - Only for PERSONAL accounts */}
              {isPersonal && (
                <div className="rounded-xl border bg-card">
                  <div className="flex items-center justify-between p-6 border-b">
                    <div>
                      <h2 className="text-lg font-semibold">Personal Details</h2>
                      <p className="text-sm text-muted-foreground">Identity details verified during onboarding</p>
                    </div>
                    <VerifiedBadge />
                  </div>
                  <div className="p-6">
                    <KeyValueGrid
                      items={[
                        { label: "Name", value: displayName },
                        { label: "Identity", value: `${formatDocumentType(orgData?.documentType)} ${orgData?.documentNumber || ""}`.trim() },
                        { label: "Date of birth", value: formatProfileDate(orgData?.dateOfBirth) },
                        { label: "Gender", value: formatGender(orgData?.gender) },
                        { label: "Nationality", value: orgData?.nationality || "—" },
                      ]}
                    />
                  </div>
                </div>
              )}

              {!isPersonal && activeOrganization?.id ? (
                <InvestorCompanyDetailsCard
                  organizationId={activeOrganization.id}
                  name={activeOrganization.name}
                  registrationNumber={activeOrganization.registrationNumber}
                  dateOfIncorporation={
                    orgData?.dateOfIncorporation ?? activeOrganization.dateOfIncorporation
                  }
                  countryOfIncorporation={
                    orgData?.countryOfIncorporation ?? activeOrganization.countryOfIncorporation
                  }
                  canEdit={isCurrentUserAdmin}
                />
              ) : null}

              {/* For PERSONAL accounts: Address comes before Contact Details */}
              {isPersonal && (
                <>
                  {/* Address Section (Editable) - Personal */}
                  <div className="rounded-xl border bg-card">
                    <div className="flex items-center justify-between p-6 border-b">
                    <div>
                      <h2 className="text-lg font-semibold">Address</h2>
                      <p className="text-sm text-muted-foreground">
                        Ensure your primary address is up to date
                      </p>
                    </div>
                    {!isEditingProfile && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingProfile(true)}
                        className="gap-2 rounded-xl"
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit
                      </Button>
                    )}
                  </div>
                  <div className="p-6 space-y-4">
                    {!isEditingProfile ? (
                      <KeyValueGrid
                        items={[
                          { label: "Residential address", value: address.trim() || "—" },
                          { label: "State", value: orgData?.residentialAddress?.state || "—" },
                          { label: "Postcode", value: orgData?.residentialAddress?.postalCode || "—" },
                        ]}
                      />
                    ) : (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4" />
                        Residential address
                      </Label>
                      <Textarea
                        placeholder="Enter your full address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={3}
                        maxLength={500}
                        className="resize-none"
                      />
                        <p className="text-xs text-muted-foreground">Maximum 500 characters</p>
                    </div>
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

                  <div className="rounded-xl border bg-card">
                    <div className="border-b p-6">
                      <h2 className="text-lg font-semibold">Investor Classification</h2>
                    </div>
                    <div className="p-6">
                      <KeyValueGrid
                        items={[
                          { label: "Category", value: formatInvestorCategory(orgData?.scInvestorCategory) },
                          {
                            label: "Account class",
                            value: orgData?.isSophisticatedInvestor ? "Sophisticated" : "Retail",
                          },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card">
                    <div className="border-b p-6">
                      <h2 className="text-lg font-semibold">KYC / AML</h2>
                    </div>
                    <div className="p-6">
                      <KeyValueGrid
                        items={[
                          {
                            label: "KYC",
                            value: (
                              <StatusBadge
                                status={activeOrganization.onboardingApproved ? "success" : "action"}
                                label={activeOrganization.onboardingApproved ? "Approved" : "Pending"}
                              />
                            ),
                          },
                          {
                            label: "AML",
                            value: (
                              <StatusBadge
                                status={activeOrganization.amlApproved ? "success" : "action"}
                                label={activeOrganization.amlApproved ? "Approved" : "Pending"}
                              />
                            ),
                          },
                          { label: "Onboarding status", value: orgData?.onboardingStatus || "—" },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Contact Details Section (Editable) - Personal */}
                  <div className="rounded-xl border bg-card">
                    <div className="flex items-center justify-between p-6 border-b">
                      <div>
                        <h2 className="text-lg font-semibold">Contact details</h2>
                        <p className="text-sm text-muted-foreground">
                          Manage your phone number and email address
                        </p>
                      </div>
                      {!isEditingProfile && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingProfile(true)}
                          className="gap-2 rounded-xl"
                        >
                          <PencilIcon className="h-4 w-4" />
                          Edit
                        </Button>
                      )}
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <PhoneIcon className="h-4 w-4" />
                            Phone number
                          </Label>
                          {isEditingProfile ? (
                            <PhoneInput
                              international
                              defaultCountry="MY"
                              value={phoneNumber}
                              onChange={setPhoneNumber}
                              className="h-11 rounded-xl border border-input px-4 [&>input]:border-0 [&>input]:bg-transparent [&>input]:outline-none [&>input]:text-sm"
                            />
                          ) : (
                            <Input
                              value={phoneNumber || "—"}
                              disabled
                              className="bg-muted h-11 rounded-xl"
                            />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <EnvelopeIcon className="h-4 w-4" />
                            Email
                          </Label>
                          <Input
                            value={
                              activeOrganization.members?.find((m) => m.id === activeOrganization.ownerId)?.email || "—"
                            }
                            disabled
                            className="bg-muted h-11 rounded-xl"
                          />
                        </div>
                      </div>

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
                </>
              )}

              {/* 2. Address/Addresses Section - For COMPANY accounts only (Personal is handled above) */}
              {!isPersonal && (
                <div className="rounded-xl border bg-card">
                  <div className="flex items-center justify-between p-6 border-b">
                    <div>
                      <h2 className="text-lg font-semibold">Business Address</h2>
                      <p className="text-sm text-muted-foreground">
                        Where the company operates
                      </p>
                    </div>
                    {!isEditingAddresses && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingAddresses(true)}
                        className="gap-2 rounded-xl"
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit
                      </Button>
                    )}
                  </div>
                  <div className="p-6 space-y-4">
                    {/* Business Address */}
                    <div className="space-y-4 pt-2">
                      <h3 className="text-sm font-semibold">Business Address</h3>
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
                              className="h-11 rounded-xl"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>Address Line 2</Label>
                            <Input
                              value={businessLine2}
                              onChange={(e) => setBusinessLine2(e.target.value)}
                              placeholder="Apartment, suite, etc. (optional)"
                              className="h-11 rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>City</Label>
                            <Input
                              value={businessCity}
                              onChange={(e) => setBusinessCity(e.target.value)}
                              placeholder="City"
                              className="h-11 rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Postal Code</Label>
                            <Input
                              value={businessPostalCode}
                              onChange={(e) => setBusinessPostalCode(e.target.value)}
                              placeholder="Postal code"
                              className="h-11 rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>State</Label>
                            <Input
                              value={businessState}
                              onChange={(e) => setBusinessState(e.target.value)}
                              placeholder="State"
                              className="h-11 rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Country</Label>
                            <Input
                              value={businessCountry}
                              onChange={(e) => setBusinessCountry(e.target.value)}
                              placeholder="Country"
                              className="h-11 rounded-xl"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {isEditingAddresses ? (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Registered Address</h3>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="sameAsBusinessAddress"
                              checked={sameAsBusinessAddress}
                              onCheckedChange={(checked) => setSameAsBusinessAddress(checked === true)}
                            />
                            <Label htmlFor="sameAsBusinessAddress" className="text-sm font-normal cursor-pointer">
                              Same as business address
                            </Label>
                          </div>
                      </div>
                        {!sameAsBusinessAddress ? (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Address Line 1</Label>
                              <Input
                                value={registeredLine1}
                                onChange={(e) => setRegisteredLine1(e.target.value)}
                                placeholder="Street address"
                                className="h-11 rounded-xl"
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Address Line 2</Label>
                              <Input
                                value={registeredLine2}
                                onChange={(e) => setRegisteredLine2(e.target.value)}
                                placeholder="Apartment, suite, etc. (optional)"
                                className="h-11 rounded-xl"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>City</Label>
                              <Input
                                value={registeredCity}
                                onChange={(e) => setRegisteredCity(e.target.value)}
                                placeholder="City"
                                className="h-11 rounded-xl"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Postal Code</Label>
                              <Input
                                value={registeredPostalCode}
                                onChange={(e) => setRegisteredPostalCode(e.target.value)}
                                placeholder="Postal code"
                                className="h-11 rounded-xl"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>State</Label>
                              <Input
                                value={registeredState}
                                onChange={(e) => setRegisteredState(e.target.value)}
                                placeholder="State"
                                className="h-11 rounded-xl"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Country</Label>
                              <Input
                                value={registeredCountry}
                                onChange={(e) => setRegisteredCountry(e.target.value)}
                                placeholder="Country"
                                className="h-11 rounded-xl"
                              />
                            </div>
                          </div>
                        ) : null}
                    </div>
                    ) : null}

                    {isEditingAddresses && (
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

              {!isPersonal ? (
                <>
                  <div className="rounded-xl border bg-card">
                    <div className="border-b p-6">
                      <h2 className="text-lg font-semibold">Investor Classification</h2>
                    </div>
                    <div className="p-6">
                      <KeyValueGrid
                        items={[
                          { label: "Category", value: formatInvestorCategory(orgData?.scInvestorCategory) },
                          {
                            label: "Account class",
                            value: orgData?.isSophisticatedInvestor ? "Sophisticated" : "Non-sophisticated entity",
                          },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border bg-card">
                    <div className="border-b p-6">
                      <h2 className="text-lg font-semibold">KYC / AML</h2>
                    </div>
                    <div className="p-6">
                      <KeyValueGrid
                        items={[
                          {
                            label: "KYC",
                            value: (
                              <StatusBadge
                                status={activeOrganization.onboardingApproved ? "success" : "action"}
                                label={activeOrganization.onboardingApproved ? "Approved" : "Pending"}
                              />
                            ),
                          },
                          {
                            label: "AML",
                            value: (
                              <StatusBadge
                                status={activeOrganization.amlApproved ? "success" : "action"}
                                label={activeOrganization.amlApproved ? "Approved" : "Pending"}
                              />
                            ),
                          },
                          { label: "Onboarding status", value: orgData?.onboardingStatus || "—" },
                        ]}
                      />
                    </div>
                  </div>
                </>
              ) : null}

              {/* 3. Contact Details Section (Editable) - For COMPANY accounts only (Personal is handled above) */}
              {!isPersonal && (
                <div className="rounded-xl border bg-card">
                  <div className="flex items-center justify-between p-6 border-b">
                    <div>
                      <h2 className="text-lg font-semibold">Contact details</h2>
                      <p className="text-sm text-muted-foreground">
                        Manage your phone number and email address
                      </p>
                    </div>
                    {!isEditingProfile && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingProfile(true)}
                        className="gap-2 rounded-xl"
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit
                      </Button>
                    )}
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <PhoneIcon className="h-4 w-4" />
                          Phone number
                        </Label>
                        {isEditingProfile ? (
                          <PhoneInput
                            international
                            defaultCountry="MY"
                            value={phoneNumber}
                            onChange={setPhoneNumber}
                            className="h-11 rounded-xl border border-input px-4 [&>input]:border-0 [&>input]:bg-transparent [&>input]:outline-none [&>input]:text-sm"
                          />
                        ) : (
                          <Input
                            value={phoneNumber || "—"}
                            disabled
                            className="bg-muted h-11 rounded-xl"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <EnvelopeIcon className="h-4 w-4" />
                          Email
                        </Label>
                        <Input
                          value={
                            activeOrganization.members?.find((m) => m.id === activeOrganization.ownerId)?.email || "—"
                          }
                          disabled
                          className="bg-muted h-11 rounded-xl"
                        />
                      </div>
                    </div>

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
              )}

              {/* 4. Directors/Shareholders Section - Only for COMPANY accounts */}
              {!isPersonal && activeOrganization?.id && orgData?.type === "COMPANY" && (
                <div ref={directorsSectionRef} className="scroll-mt-24">
                  <DirectorShareholdersUnifiedSection
                    portal="investor"
                    organizationId={activeOrganization.id}
                    organizationOnboardingStatus={orgData.onboardingStatus}
                    people={orgData.people ?? []}
                    directorShareholderListSource={orgData.directorShareholderListSource ?? null}
                    ctosDirectorShareholderWarning={orgData.ctosDirectorShareholderWarning ?? null}
                    highlightActionRequiredRows
                    autoFocusFirstEmptyEmail={focusDirectors}
                    focusedMatchKey={focusedPersonKey}
                    onPartyOnboardingSent={handlePartyOnboardingSent}
                    title="People"
                    description="Directors and shareholders for this company"
                    grouped={false}
                  />
                </div>
              )}

              {/* 5. Members Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {isPersonal ? "Account Holder" : "Organization Members"} (
                    {activeOrganization.members?.length || 0})
                  </h2>
                  {!isPersonal && isCurrentUserAdmin && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInviteDialogOpen(true)}
                        className="gap-2 rounded-xl"
                      >
                        <UserPlusIcon className="h-4 w-4" />
                        Invite Member
                      </Button>
                      {activeOrganization.isOwner && activeOrganization.members && activeOrganization.members.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTransferOwnershipOpen(true)}
                          disabled={isTransferringOwnership}
                          className="gap-2 rounded-xl text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
                        >
                          <ArrowPathIcon className="h-4 w-4" />
                          Transfer Ownership
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {activeOrganization.members && activeOrganization.members.length > 0 ? (
                  <div className="grid gap-3">
                    {activeOrganization.members.map((member) => {
                      const isCurrentUser = currentUser && member.id === currentUser.userId;
                      const canManageMembers = !isPersonal && isCurrentUserAdmin && !isCurrentUser;
                      const isOwner = activeOrganization.isOwner && isCurrentUser;
                      const canLeave = !isPersonal && isCurrentUser && !isOwner;
                      const memberName = [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email;

                      return (
                        <div key={member.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                          <div className="flex-1">
                            <MemberCard member={member} ownerId={activeOrganization.ownerId} />
                          </div>
                          {canManageMembers && (
                            <div className="flex items-center gap-2 ml-auto">
                              {member.role === "ORGANIZATION_MEMBER" ? (
                                <Button
                                  variant="ghost"
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
                                  title="Promote to Admin"
                                >
                                  <ArrowUpIcon className="h-4 w-4" />
                                </Button>
                              ) : (
                                // Only show demote button if not demoting yourself
                                !isCurrentUser && (
                                  <Button
                                    variant="ghost"
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
                                    title="Demote to Member"
                                  >
                                    <ArrowDownIcon className="h-4 w-4" />
                                  </Button>
                                )
                              )}
                              <Button
                                variant="ghost"
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
                                title="Remove Member"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {canLeave && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setConfirmDialog({
                                  open: true,
                                  type: "leave",
                                })
                              }
                              disabled={isLeaving}
                              className="gap-1 text-destructive hover:text-destructive ml-auto"
                              title="Leave Organization"
                            >
                              Leave
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                    <p>No members found</p>
                  </div>
                )}
              </div>

              {/* Pending Invitations Section - Only for COMPANY accounts and admins */}
              {!isPersonal && isCurrentUserAdmin && invitations.length > 0 && (
                <div className="rounded-xl border bg-card">
                  <div className="flex items-center justify-between p-6 border-b">
                    <div>
                      <h2 className="text-lg font-semibold">Pending Invitations</h2>
                      <p className="text-sm text-muted-foreground">
                        Invitations awaiting acceptance
                      </p>
                    </div>
                  </div>
                  <div className="p-6 space-y-3">
                    {invitations.map((invitation) => {
                      const isPlaceholderEmail = invitation.email.startsWith('invitation-') &&
                                                invitation.email.includes('@cashsouk.com');
                      return (
                        <div key={invitation.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                          <div>
                            <p className="font-medium">
                              {isPlaceholderEmail ? 'Link-based invitation' : invitation.email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {invitation.role === "ORGANIZATION_ADMIN" ? "Admin" : "Member"} • Expires{" "}
                              {new Date(invitation.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const portalUrl = process.env.NEXT_PUBLIC_INVESTOR_PORTAL_URL || "http://localhost:3002";
                              const inviteLink = `${portalUrl}/accept-invitation?token=${invitation.token}`;
                              navigator.clipboard.writeText(inviteLink);
                              toast.success("Invitation link copied to clipboard");
                            }}
                            className="gap-1"
                          >
                            <ClipboardIcon className="h-4 w-4" />
                            Copy Link
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
              )}


              {/* Invite Member Dialog - only mount for org admins to avoid 403 on invitations API */}
              {activeOrganization?.id && isCurrentUserAdmin && (
                <InviteMemberDialog
                  organizationId={activeOrganization.id}
                  open={inviteDialogOpen}
                  onOpenChange={setInviteDialogOpen}
                />
              )}
            </TabsContent>

            {/* Banking Tab */}
            <TabsContent value="banking" className="space-y-6 mt-6">
              <div className="rounded-xl border bg-card">
                <div className="flex items-center justify-between p-6 border-b">
                  <div>
                    <h2 className="text-lg font-semibold">Banking details</h2>
                    <p className="text-sm text-muted-foreground">
                      View or update your bank account information
                    </p>
                  </div>
                  {!isEditingBanking && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingBanking(true)}
                      className="gap-2 rounded-xl"
                    >
                      <PencilIcon className="h-4 w-4" />
                      Edit
                    </Button>
                  )}
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
                          <SelectTrigger className="h-11 rounded-xl">
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
                          className="bg-muted h-11 rounded-xl"
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
                          <SelectTrigger className="h-11 rounded-xl">
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
                          className="bg-muted h-11 rounded-xl"
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
                        className={`h-11 rounded-xl font-mono ${!isEditingBanking ? "bg-muted" : ""}`}
                      />
                      {isEditingBanking && (
                        <p className="text-xs text-muted-foreground">
                          Enter 10-18 digit account number
                        </p>
                      )}
                    </div>
                  </div>

                  {isEditingBanking && (
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
          </Tabs>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      {confirmDialog.type === "remove" && confirmDialog.memberId && (
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) =>
            setConfirmDialog({ ...confirmDialog, open })
          }
          title="Remove Member"
          description={`Are you sure you want to remove ${confirmDialog.memberName} from this organization? This action cannot be undone.`}
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
          title="Leave Organization"
          description="Are you sure you want to leave this organization? You will lose access to all organization data and will need to be re-invited to regain access."
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
          title="Promote to Admin"
          description={`Are you sure you want to promote ${confirmDialog.memberName} to Organization Admin? They will be able to manage members and organization settings.`}
          confirmText="Promote"
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
          title="Demote to Member"
          description={`Are you sure you want to demote ${confirmDialog.memberName} to Organization Member? They will lose admin privileges.`}
          confirmText="Demote"
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
    </>
  );
}
