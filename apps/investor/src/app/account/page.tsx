"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
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
} from "@cashsouk/config";
import { useAuth } from "../../lib/auth";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccountDocuments } from "../../hooks/use-account-documents";
import { toast } from "sonner";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
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
  GlobeAltIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Malaysian banks list (values match RegTank format)
const MALAYSIAN_BANKS = [
  { value: "Affin Bank Berhad", label: "Affin Bank" },
  { value: "Alliance Bank Malaysia Berhad", label: "Alliance Bank" },
  { value: "AmBank / AmFinance Berhad", label: "AmBank" },
  { value: "Bangkok Bank Berhad", label: "Bangkok Bank" },
  { value: "Bank Islam Malaysia Berhad", label: "Bank Islam" },
  { value: "Bank Kerjasama Rakyat Malaysia Berhad (Bank Rakyat)", label: "Bank Rakyat" },
  { value: "Bank Muamalat Malaysia Berhad", label: "Bank Muamalat" },
  { value: "Bank Pertanian Malaysia Berhad (Agrobank)", label: "Agrobank" },
  { value: "Bank Simpanan Nasional Berhad (BSN)", label: "BSN" },
  { value: "Bank of America", label: "Bank of America" },
  { value: "Bank of China (Malaysia) Berhad", label: "Bank of China" },
  { value: "CIMB Bank Berhad", label: "CIMB Bank" },
  { value: "Co-operative Bank of Malaysia Berhad (Co-opbank Pertama)", label: "Co-opbank Pertama" },
  { value: "Deutsche Bank (Malaysia) Berhad", label: "Deutsche Bank" },
  { value: "Hong Leong Bank Berhad", label: "Hong Leong Bank" },
  { value: "JP Morgan Chase Bank Berhad", label: "JP Morgan Chase" },
  { value: "Maybank / Malayan Banking Berhad", label: "Maybank" },
  { value: "Public Bank Berhad", label: "Public Bank" },
  { value: "RHB Bank Berhad", label: "RHB Bank" },
  { value: "Standard Chartered Bank Malaysia Berhad", label: "Standard Chartered" },
  { value: "Sumitomo Mitsui Banking Corporation Malaysia Berhad", label: "Sumitomo Mitsui" },
  { value: "United Overseas Bank (Malaysia) Berhad", label: "UOB Malaysia" },
  { value: "UOB Bank Berhad", label: "UOB Bank" },
];

const roleConfig: Record<
  OrganizationMemberRole,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  OWNER: {
    label: "Owner",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
  },
  DIRECTOR: {
    label: "Director",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  MEMBER: {
    label: "Member",
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

function MemberCard({ member }: { member: OrganizationMember }) {
  const fullName = [member.firstName, member.lastName].filter(Boolean).join(" ") || "Unknown";
  const initials =
    [member.firstName?.[0], member.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{fullName}</p>
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

function AccountPageSkeleton() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Skeleton className="h-5 w-32" />
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-4xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
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

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold text-muted-foreground">Account</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-4xl mx-auto w-full px-2 md:px-4 py-8">
          <div className="rounded-xl border bg-card p-8 text-center opacity-60">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <UserIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">
              No Account Selected
            </h2>
            <p className="text-muted-foreground mb-6">
              Create or select an account to view account details and members.
            </p>
            {showOnboardingPrompt && (
              <Button variant="outline" onClick={() => router.push("/onboarding-start")}>
                Create Account
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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Documents Tab Content Component
function DocumentsTabContent({ apiClient }: { apiClient: ReturnType<typeof createApiClient> }) {
  const { data: documents, isLoading, error } = useAccountDocuments();
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const handleDownload = async (documentId: string) => {
    setDownloadingId(documentId);
    try {
      const response = await apiClient.getDocumentDownloadUrl(documentId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      // Open the presigned URL in a new tab to trigger download
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
                key={doc.id}
                className="flex items-center justify-between p-4 rounded-xl border bg-muted/30"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <DocumentTextIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(doc.file_size)} • {doc.file_name}
                    </p>
                  </div>
                </div>
                <Button
                  variant="default"
                  className="gap-2 rounded-xl"
                  onClick={() => handleDownload(doc.id)}
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

export default function AccountPage() {
  const { isAuthenticated } = useAuth();
  const { getAccessToken } = useAuthToken();
  const {
    activeOrganization,
    isLoading,
    refreshOrganizations,
    organizations,
    updateOrganizationProfile,
  } = useOrganization();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("profile");

  // Editing states
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [isEditingBanking, setIsEditingBanking] = React.useState(false);

  // Form states for profile (phone + address)
  const [phoneNumber, setPhoneNumber] = React.useState<string | undefined>(undefined);
  const [address, setAddress] = React.useState("");

  // Form states for banking (matches RegTank format values)
  const [bankName, setBankName] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [accountType, setAccountType] = React.useState("Savings");

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
        isSophisticatedInvestor: boolean;
      }>(`/v1/organizations/investor/${activeOrganization.id}`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: !!activeOrganization?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Initialize form values when orgData loads
  React.useEffect(() => {
    if (orgData) {
      setPhoneNumber(orgData.phoneNumber || undefined);
      setAddress(orgData.address || "");

      // Extract values from RegTank format
      setBankName(getBankField(orgData.bankAccountDetails, "Bank"));
      setAccountNumber(getBankField(orgData.bankAccountDetails, "Bank account number"));
      setAccountType(getBankField(orgData.bankAccountDetails, "Account type") || "Savings");
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

  // Show loading state
  if (isAuthenticated === null || isLoading) {
    return <AccountPageSkeleton />;
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
  const displayName = [orgData?.firstName, orgData?.lastName].filter(Boolean).join(" ") || "—";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Account</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-4xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Page Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <AccountIcon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{displayName}</h1>
                <p className="text-muted-foreground mt-1">
                  {isPersonal ? "Investor (Individual)" : accountName}
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

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
              {/* Personal Info Section (Read-only) */}
              <div className="rounded-xl border bg-card">
                <div className="flex items-center justify-between p-6 border-b">
                  <div>
                    <h2 className="text-lg font-semibold">Personal info</h2>
                    <p className="text-sm text-muted-foreground">
                      Your KYC-verified personal details
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    <ShieldCheckIcon className="h-3.5 w-3.5 mr-1" />
                    Verified
                  </Badge>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Name</Label>
                      <Input value={displayName} disabled className="bg-muted h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Document Type</Label>
                      <Input
                        value={formatDocumentType(orgData?.documentType)}
                        disabled
                        className="bg-muted h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <IdentificationIcon className="h-4 w-4" />
                        Document Number
                      </Label>
                      <Input
                        value={orgData?.documentNumber || "—"}
                        disabled
                        className="bg-muted h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <GlobeAltIcon className="h-4 w-4" />
                        Issuing Country
                      </Label>
                      <Input
                        value={orgData?.idIssuingCountry || "—"}
                        disabled
                        className="bg-muted h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <ShieldCheckIcon className="h-4 w-4" />
                        Investor Classification
                        <InfoTooltip
                          content={
                            orgData?.isSophisticatedInvestor
                              ? "Your total investment amount is unlimited."
                              : "Your total investment amount is limited to RM 50,000. Contact us to upgrade your account."
                          }
                        />
                      </Label>
                      <div className="flex items-center gap-2 h-11 px-4 rounded-xl border bg-muted">
                        {orgData?.isSophisticatedInvestor ? (
                          <span className="text-sm font-medium text-purple-600">
                            Sophisticated Investor
                          </span>
                        ) : (
                          <span className="text-sm">Retail Investor</span>
                        )}
                      </div>
                    </div>
                    {orgData?.onboardedAt && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          Member Since
                        </Label>
                        <Input
                          value={new Date(orgData.onboardedAt).toLocaleDateString("en-MY", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          disabled
                          className="bg-muted h-11 rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Details Section (Editable) */}
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
                        value={activeOrganization.members?.[0]?.email || "—"}
                        disabled
                        className="bg-muted h-11 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Address Section (Editable) */}
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
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPinIcon className="h-4 w-4" />
                      Full Address
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

              {/* Members Section */}
              {activeOrganization.members && activeOrganization.members.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">
                    {isPersonal ? "Account Holder" : "Members"} (
                    {activeOrganization.members?.length || 0})
                  </h2>
                  <div className="grid gap-3">
                    {activeOrganization.members.map((member) => (
                      <MemberCard key={member.id} member={member} />
                    ))}
                  </div>
                </div>
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
    </>
  );
}
