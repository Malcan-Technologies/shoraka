"use client";

import * as React from "react";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DocumentAuthorisationConfig,
  DocumentAuthorisationStampFields,
  LedgerBucketAccountsConfig,
  PlatformAccountsConfig,
  TrusteeAccountDetails,
  TrusteeLetterConfig,
} from "@cashsouk/types";
import { Checkbox, Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequirePermission } from "@/components/require-permission";
import { AdminPageHeader } from "@/components/admin-page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { useS3ViewUrl } from "@/hooks/use-s3";
import { uploadFileToS3 } from "@/lib/upload-file-to-s3";
import {
  buildTrusteeLetterConfigPayload,
  validateTrusteeLetterEmailSettings,
} from "@/lib/trustee-letter-settings";
import { notesKeys } from "@/notes/query-keys";
import { TrusteeLetterEmailFields } from "./trustee-letter-email-fields";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const EMPTY_ACCOUNT: TrusteeAccountDetails = {
  displayName: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  remarks: "",
};

type TrusteeLetterTextField = Exclude<
  {
    [K in keyof TrusteeLetterConfig]-?: TrusteeLetterConfig[K] extends string | undefined ? K : never;
  }[keyof TrusteeLetterConfig],
  undefined
>;

const DEFAULT_TRUSTEE_LETTER: TrusteeLetterConfig = {
  trusteeName: "RHB Trustees Berhad",
  trusteeAddressLine1: "Level 11 Tower 3 RHB Centre",
  trusteeAddressLine2: "Jalan Tun Razak",
  trusteeAddressLine3: "50400 Kuala Lumpur",
  attentionPerson: "Ms Lim Bee Fang",
  defaultContactPerson: "CashSouk Finance Team",
  authorisedSignatoryLabel: "Authorised Signatories",
  platformDisplayName: "CashSouk Sdn Bhd",
  autoSendTrusteeEmail: false,
};

const DEFAULT_DOCUMENT_AUTHORISATION: DocumentAuthorisationConfig = {
  authorisedSignatoryName: "",
  useSameCompanyStamp: true,
};

const ALLOWED_SIGNATURE_CONTENT_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_SIGNATURE_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const REMINDER_DELIVERY_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour);

function formatReminderDeliveryHourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

function emptyPlatformAccounts(): PlatformAccountsConfig {
  return {
    platformOperating: { ...EMPTY_ACCOUNT },
    serviceFee: { ...EMPTY_ACCOUNT },
    platformFee: { ...EMPTY_ACCOUNT },
    facilityFee: { ...EMPTY_ACCOUNT },
  };
}

function emptyBucketAccounts(): LedgerBucketAccountsConfig {
  return {
    INVESTOR_POOL: { ...EMPTY_ACCOUNT },
    REPAYMENT_POOL: { ...EMPTY_ACCOUNT },
    OPERATING_ACCOUNT: { ...EMPTY_ACCOUNT },
    ISSUER_PAYABLE: { ...EMPTY_ACCOUNT },
    TAWIDH_ACCOUNT: { ...EMPTY_ACCOUNT },
    GHARAMAH_ACCOUNT: { ...EMPTY_ACCOUNT },
  };
}

function AccountFields({
  title,
  value,
  onChange,
  accountNamePlaceholder,
  disabled,
}: {
  title: string;
  value: TrusteeAccountDetails;
  onChange: (next: TrusteeAccountDetails) => void;
  accountNamePlaceholder: string;
  disabled?: boolean;
}) {
  const set = (key: keyof TrusteeAccountDetails, fieldValue: string) =>
    onChange({ ...value, [key]: fieldValue });

  return (
    <Card className="rounded-2xl p-6 shadow-sm md:p-8">
      <CardHeader className="px-0 pb-3 pt-0">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 px-0 md:grid-cols-2">
        {(
          [
            ["bankName", "Bank name"],
            ["accountName", "Account name"],
            ["accountNumber", "Account number"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-2">
            <label className="text-sm font-medium">{label}</label>
            <Input
              value={value[key]}
              disabled={disabled}
              placeholder={
                key === "bankName"
                  ? "e.g. RHB Bank Berhad"
                  : key === "accountName"
                    ? accountNamePlaceholder
                    : "e.g. 1234567890"
              }
              className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-primary"
              onChange={(event) => set(key, event.target.value)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function PlatformFinanceSettingsPage() {
  const { can } = usePermissions();
  const canManage = can("platform_settings.manage");
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["platform-finance-settings"],
    queryFn: async () => {
      const response = await apiClient.getPlatformFinanceSettings();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });

  const [latePayment, setLatePayment] = React.useState({
    gracePeriodDays: "7",
    arrearsThresholdDays: "14",
    tawidhRateCapPercent: "1",
    gharamahRateCapPercent: "9",
    platformFeeRateCapPercent: "3",
    defaultTawidhRatePercent: "0",
    defaultGharamahRatePercent: "0",
  });
  const [gatewayFees, setGatewayFees] = React.useState({
    issuerOnboardingFeeAmount: "150",
    applicationProcessingFeeAmount: "50",
    investorMinDepositAmount: "100",
    investorMaxDepositAmount: "30000",
    facilityFeeGatewayTxnMaxAmount: "30000",
    excessLateChargeGatewayTxnMaxAmount: "30000",
  });
  const [offerDeadlineReminderHour, setOfferDeadlineReminderHour] = React.useState("9");
  const [trusteeLetter, setTrusteeLetter] = React.useState<TrusteeLetterConfig>(DEFAULT_TRUSTEE_LETTER);
  const [trusteeCcDraft, setTrusteeCcDraft] = React.useState("");
  const [platformAccounts, setPlatformAccounts] =
    React.useState<PlatformAccountsConfig>(emptyPlatformAccounts());
  const [bucketAccounts, setBucketAccounts] =
    React.useState<LedgerBucketAccountsConfig>(emptyBucketAccounts());
  const [documentAuthorisation, setDocumentAuthorisation] =
    React.useState<DocumentAuthorisationConfig>(DEFAULT_DOCUMENT_AUTHORISATION);
  const signatureInputRef = React.useRef<HTMLInputElement | null>(null);
  const certificateStampInputRef = React.useRef<HTMLInputElement | null>(null);
  const receiptStampInputRef = React.useRef<HTMLInputElement | null>(null);
  const { data: signaturePreviewUrl } = useS3ViewUrl(
    trusteeLetter.authorisedSignatureImageKey ?? null
  );
  const { data: certificateStampPreviewUrl } = useS3ViewUrl(
    documentAuthorisation.certificateCompanyStamp?.s3Key ?? null
  );
  const { data: receiptStampPreviewUrl } = useS3ViewUrl(
    documentAuthorisation.useSameCompanyStamp
      ? null
      : documentAuthorisation.receiptCompanyStamp?.s3Key ?? null
  );

  const latePaymentFields: Array<{
    key: keyof Omit<typeof latePayment, "platformFeeRateCapPercent">;
    label: string;
    placeholder: string;
  }> = [
    { key: "gracePeriodDays", label: "Grace period days", placeholder: "e.g. 7" },
    { key: "arrearsThresholdDays", label: "Arrears threshold days", placeholder: "e.g. 30" },
    { key: "tawidhRateCapPercent", label: "Ta'widh rate cap %", placeholder: "e.g. 1.00" },
    {
      key: "defaultTawidhRatePercent",
      label: "Default Ta'widh rate %",
      placeholder: "e.g. 1.00",
    },
    { key: "gharamahRateCapPercent", label: "Gharamah rate cap %", placeholder: "e.g. 1.00" },
    {
      key: "defaultGharamahRatePercent",
      label: "Default Gharamah rate %",
      placeholder: "e.g. 1.00",
    },
  ];

  const gatewayFeeFields: Array<{
    key: keyof typeof gatewayFees;
    label: string;
    placeholder: string;
  }> = [
    {
      key: "issuerOnboardingFeeAmount",
      label: "Issuer onboarding fee (MYR)",
      placeholder: "e.g. 150",
    },
    {
      key: "applicationProcessingFeeAmount",
      label: "Application processing fee (MYR)",
      placeholder: "e.g. 50",
    },
    {
      key: "investorMinDepositAmount",
      label: "Minimum investor deposit (MYR)",
      placeholder: "e.g. 100",
    },
    {
      key: "investorMaxDepositAmount",
      label: "Maximum investor deposit (MYR)",
      placeholder: "e.g. 30000",
    },
    {
      key: "facilityFeeGatewayTxnMaxAmount",
      label: "Facility fee payment gateway transaction limit (MYR)",
      placeholder: "e.g. 30000",
    },
    {
      key: "excessLateChargeGatewayTxnMaxAmount",
      label: "Late charge payment gateway transaction limit (MYR)",
      placeholder: "e.g. 30000",
    },
  ];

  const trusteeFields: Array<{ key: TrusteeLetterTextField; label: string; placeholder: string }> = [
    { key: "trusteeName", label: "Trustee name", placeholder: "e.g. RHB Trustees Berhad" },
    {
      key: "trusteeAddressLine1",
      label: "Trustee address line 1",
      placeholder: "e.g. Level 11 Tower 3 RHB Centre",
    },
    {
      key: "trusteeAddressLine2",
      label: "Trustee address line 2",
      placeholder: "e.g. Jalan Tun Razak",
    },
    {
      key: "trusteeAddressLine3",
      label: "Trustee address line 3",
      placeholder: "e.g. 50400 Kuala Lumpur",
    },
    { key: "attentionPerson", label: "Attention person", placeholder: "e.g. Ms Lim Bee Fang" },
    {
      key: "defaultContactPerson",
      label: "Default contact person",
      placeholder: "e.g. CashSouk Finance Team",
    },
    {
      key: "authorisedSignatoryLabel",
      label: "Authorised signatory label",
      placeholder: "e.g. Authorised Signatories",
    },
    {
      key: "platformDisplayName",
      label: "Platform display name",
      placeholder: "e.g. CashSouk Sdn Bhd",
    },
  ];

  const moneyFlowSections: Array<{
    key: keyof LedgerBucketAccountsConfig;
    title: string;
    accountNamePlaceholder: string;
  }> = [
    {
      key: "INVESTOR_POOL",
      title: "Investor Pool",
      accountNamePlaceholder: "e.g. CashSouk Investor Pool Account",
    },
    {
      key: "REPAYMENT_POOL",
      title: "Repayment Pool",
      accountNamePlaceholder: "e.g. CashSouk Repayment Pool Account",
    },
    {
      key: "OPERATING_ACCOUNT",
      title: "Operating Account",
      accountNamePlaceholder: "e.g. CashSouk Operating Account",
    },
    {
      key: "TAWIDH_ACCOUNT",
      title: "Ta'widh Account",
      accountNamePlaceholder: "e.g. CashSouk Ta’widh Account",
    },
    {
      key: "GHARAMAH_ACCOUNT",
      title: "Gharamah Account",
      accountNamePlaceholder: "e.g. CashSouk Gharamah Account",
    },
  ];

  React.useEffect(() => {
    if (!data) return;
    setLatePayment({
      gracePeriodDays: String(data.gracePeriodDays),
      arrearsThresholdDays: String(data.arrearsThresholdDays),
      tawidhRateCapPercent: String(data.tawidhRateCapPercent),
      gharamahRateCapPercent: String(data.gharamahRateCapPercent),
      platformFeeRateCapPercent: String(data.platformFeeRateCapPercent),
      defaultTawidhRatePercent: String(data.defaultTawidhRatePercent),
      defaultGharamahRatePercent: String(data.defaultGharamahRatePercent),
    });
    setGatewayFees({
      issuerOnboardingFeeAmount: String(data.issuerOnboardingFeeAmount),
      applicationProcessingFeeAmount: String(data.applicationProcessingFeeAmount),
      investorMinDepositAmount: String(data.investorMinDepositAmount),
      investorMaxDepositAmount: String(data.investorMaxDepositAmount),
      facilityFeeGatewayTxnMaxAmount: String(data.facilityFeeGatewayTxnMaxAmount ?? 30000),
      excessLateChargeGatewayTxnMaxAmount: String(
        data.excessLateChargeGatewayTxnMaxAmount ?? 30000
      ),
    });
    setOfferDeadlineReminderHour(String(data.offerDeadlineReminderHour ?? 9));
    setTrusteeLetter({
      ...DEFAULT_TRUSTEE_LETTER,
      ...(data.trusteeLetterConfig ?? {}),
      autoSendTrusteeEmail: data.trusteeLetterConfig?.autoSendTrusteeEmail === true,
    });
    setTrusteeCcDraft("");
    setPlatformAccounts({ ...emptyPlatformAccounts(), ...(data.platformAccountsConfig ?? {}) });
    setBucketAccounts({ ...emptyBucketAccounts(), ...(data.ledgerBucketAccountsConfig ?? {}) });
    setDocumentAuthorisation({
      ...DEFAULT_DOCUMENT_AUTHORISATION,
      ...(data.documentAuthorisationConfig ?? {}),
      useSameCompanyStamp: data.documentAuthorisationConfig?.useSameCompanyStamp !== false,
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await apiClient.updatePlatformFinanceSettings(payload);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-finance-settings"] });
      queryClient.invalidateQueries({ queryKey: notesKeys.all });
      toast.success("Platform finance settings updated");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to update settings"),
  });

  const signatureUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const response = await apiClient.requestPlatformFinanceTrusteeSignatureUploadUrl({
        fileName: file.name,
        contentType: file.type as "image/png" | "image/jpeg" | "image/jpg" | "image/webp",
        fileSize: file.size,
      });
      if (!response.success) throw new Error(response.error.message);
      await uploadFileToS3(response.data.uploadUrl, file);
      return { ...response.data, file };
    },
    onSuccess: ({ s3Key, file }) => {
      setTrusteeLetter((prev) => ({
        ...prev,
        authorisedSignatureImageKey: s3Key,
        authorisedSignatureImageFileName: file.name,
        authorisedSignatureImageContentType: file.type,
        authorisedSignatureImageUrl: undefined,
      }));
      toast.success("Signature image uploaded");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to upload signature image"),
  });

  const stampUploadMutation = useMutation({
    mutationFn: async (input: {
      purpose: "CERTIFICATE_COMPANY_STAMP" | "RECEIPT_COMPANY_STAMP";
      file: File;
    }) => {
      const response = await apiClient.requestPlatformFinanceDocumentStampUploadUrl({
        purpose: input.purpose,
        fileName: input.file.name,
        contentType: input.file.type as "image/png" | "image/jpeg" | "image/jpg" | "image/webp",
        fileSize: input.file.size,
      });
      if (!response.success) throw new Error(response.error.message);
      await uploadFileToS3(response.data.uploadUrl, input.file);
      return { ...response.data, purpose: input.purpose, file: input.file };
    },
    onSuccess: ({ s3Key, purpose, file }) => {
      const stamp: DocumentAuthorisationStampFields = {
        s3Key,
        fileName: file.name,
        contentType: file.type,
      };
      setDocumentAuthorisation((prev) =>
        purpose === "RECEIPT_COMPANY_STAMP"
          ? { ...prev, receiptCompanyStamp: stamp }
          : { ...prev, certificateCompanyStamp: stamp }
      );
      toast.success("Company stamp uploaded");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to upload company stamp"),
  });

  const disabled = isLoading || !canManage;
  const trusteeEmailValidation = validateTrusteeLetterEmailSettings({
    autoSendTrusteeEmail: trusteeLetter.autoSendTrusteeEmail === true,
    trusteeEmail: trusteeLetter.trusteeEmail,
    trusteeCcEmails: trusteeLetter.trusteeCcEmails,
    ccDraft: trusteeCcDraft,
  });
  const trusteeLetterSaveDisabled =
    disabled ||
    saveMutation.isPending ||
    signatureUploadMutation.isPending ||
    !trusteeEmailValidation.canSave;

  const handleSelectSignatureImage = () => {
    if (!canManage || signatureUploadMutation.isPending) return;
    signatureInputRef.current?.click();
  };

  const handleSignatureFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_SIGNATURE_CONTENT_TYPES.includes(file.type.toLowerCase())) {
      toast.error("Only PNG, JPG/JPEG, or WEBP images are allowed.");
      return;
    }
    if (file.size > MAX_SIGNATURE_FILE_SIZE_BYTES) {
      toast.error("Signature image must be 5MB or less.");
      return;
    }
    await signatureUploadMutation.mutateAsync(file);
  };

  const validateStampFile = (file: File): boolean => {
    if (!ALLOWED_SIGNATURE_CONTENT_TYPES.includes(file.type.toLowerCase())) {
      toast.error("Only PNG, JPG/JPEG, or WEBP images are allowed.");
      return false;
    }
    if (file.size > MAX_SIGNATURE_FILE_SIZE_BYTES) {
      toast.error("Company stamp must be 5MB or less.");
      return false;
    }
    return true;
  };

  const handleStampFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    purpose: "CERTIFICATE_COMPANY_STAMP" | "RECEIPT_COMPANY_STAMP"
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !validateStampFile(file)) return;
    await stampUploadMutation.mutateAsync({ purpose, file });
  };

  return (
    <RequirePermission permission="platform_settings.view">
      <>
        
        <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
          <AdminPageHeader
            title="Platform Finance"
            description="Configure late-payment rules, gateway fees, trustee letters, document authorisation, and money-flow accounts."
          />
          <Tabs defaultValue="late-payment" className="space-y-6">
            <TabsList className="grid h-auto w-full max-w-[960px] grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <TabsTrigger value="late-payment">Late Payment</TabsTrigger>
              <TabsTrigger value="gateway-fees">Gateway Fees</TabsTrigger>
              <TabsTrigger value="offer-deadlines">Offer Deadlines</TabsTrigger>
              <TabsTrigger value="trustee-letter">Trustee Letter</TabsTrigger>
              <TabsTrigger value="document-authorisation">Document Authorisation</TabsTrigger>
              <TabsTrigger value="money-flow-accounts">Money Flow Accounts</TabsTrigger>
            </TabsList>

            <TabsContent value="late-payment">
              <Card className="rounded-2xl p-6 shadow-sm md:p-8">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Late Payment Settings</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 px-0 md:grid-cols-2">
                  {latePaymentFields.map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-2">
                      <label className="text-sm font-medium">{label}</label>
                      <Input
                        type="number"
                        value={latePayment[key]}
                        disabled={disabled}
                        placeholder={placeholder}
                        className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-primary"
                        onChange={(event) =>
                          setLatePayment((prev) => ({ ...prev, [key]: event.target.value }))
                        }
                      />
                    </div>
                  ))}
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      disabled={disabled || saveMutation.isPending}
                      className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                      onClick={() =>
                        saveMutation.mutate({
                          gracePeriodDays: Number(latePayment.gracePeriodDays),
                          arrearsThresholdDays: Number(latePayment.arrearsThresholdDays),
                          tawidhRateCapPercent: Number(latePayment.tawidhRateCapPercent),
                          gharamahRateCapPercent: Number(latePayment.gharamahRateCapPercent),
                          platformFeeRateCapPercent: Number(latePayment.platformFeeRateCapPercent),
                          defaultTawidhRatePercent: Number(latePayment.defaultTawidhRatePercent),
                          defaultGharamahRatePercent: Number(latePayment.defaultGharamahRatePercent),
                        })
                      }
                    >
                      Save Late Payment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gateway-fees">
              <Card className="rounded-2xl p-6 shadow-sm md:p-8">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Gateway Fees</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 px-0 md:grid-cols-2">
                  {gatewayFeeFields.map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-2">
                      <label className="text-sm font-medium" htmlFor={`gateway-fee-${key}`}>
                        {label}
                      </label>
                      <Input
                        id={`gateway-fee-${key}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={gatewayFees[key]}
                        disabled={disabled}
                        placeholder={placeholder}
                        className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-primary"
                        onChange={(event) =>
                          setGatewayFees((prev) => ({ ...prev, [key]: event.target.value }))
                        }
                      />
                      {key === "facilityFeeGatewayTxnMaxAmount" ? (
                        <p className="text-meta text-muted-foreground">
                          Caps each FPX facility-fee transaction, not the overall upfront amount
                          requested on a facility offer. Larger upfront amounts are paid across
                          multiple transactions.
                        </p>
                      ) : null}
                      {key === "excessLateChargeGatewayTxnMaxAmount" ? (
                        <p className="text-meta text-muted-foreground">
                          Caps each FPX late-charge transaction, not the overall amount billed after
                          settlement. Larger amounts are paid across multiple transactions.
                        </p>
                      ) : null}
                    </div>
                  ))}
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      disabled={disabled || saveMutation.isPending}
                      className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                      onClick={() => {
                        const investorMinDepositAmount = Number(
                          gatewayFees.investorMinDepositAmount
                        );
                        const investorMaxDepositAmount = Number(
                          gatewayFees.investorMaxDepositAmount
                        );
                        if (investorMinDepositAmount > investorMaxDepositAmount) {
                          toast.error("Minimum deposit cannot exceed maximum deposit");
                          return;
                        }
                        saveMutation.mutate({
                          issuerOnboardingFeeAmount: Number(gatewayFees.issuerOnboardingFeeAmount),
                          applicationProcessingFeeAmount: Number(
                            gatewayFees.applicationProcessingFeeAmount
                          ),
                          investorMinDepositAmount,
                          investorMaxDepositAmount,
                          facilityFeeGatewayTxnMaxAmount: Number(
                            gatewayFees.facilityFeeGatewayTxnMaxAmount
                          ),
                          excessLateChargeGatewayTxnMaxAmount: Number(
                            gatewayFees.excessLateChargeGatewayTxnMaxAmount
                          ),
                        });
                      }}
                    >
                      Save Gateway Fees
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="offer-deadlines">
              <Card className="rounded-2xl p-6 shadow-sm md:p-8">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Offer deadline reminders</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 px-0 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Reminder delivery hour</label>
                    <p className="text-sm text-muted-foreground">
                      Offer acceptance and signing reminders are sent on the configured
                      day at this hour. Deadlines expire at the end of the day (11:59 PM).
                    </p>
                    <Select
                      value={offerDeadlineReminderHour}
                      disabled={disabled}
                      onValueChange={setOfferDeadlineReminderHour}
                    >
                      <SelectTrigger className="h-11 w-full max-w-xs rounded-xl focus:ring-2 focus:ring-primary">
                        <SelectValue placeholder="Select delivery time" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {REMINDER_DELIVERY_HOUR_OPTIONS.map((hour) => (
                          <SelectItem key={hour} value={String(hour)}>
                            {formatReminderDeliveryHourLabel(hour)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Malaysia time (MYT). Reminders are sent on the selected hour.
                    </p>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      disabled={disabled || saveMutation.isPending}
                      className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                      onClick={() => {
                        const hour = Number.parseInt(offerDeadlineReminderHour, 10);
                        if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
                          toast.error("Reminder hour must be between 0 and 23");
                          return;
                        }
                        saveMutation.mutate({ offerDeadlineReminderHour: hour });
                      }}
                    >
                      Save Offer Deadlines
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trustee-letter" className="space-y-4">
              <Card className="rounded-2xl p-6 shadow-sm md:p-8">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Trustee Letter Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 px-0 md:grid-cols-2">
                  {trusteeFields.map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-2">
                      <label className="text-sm font-medium">{label}</label>
                      <Input
                        value={trusteeLetter[key] ?? ""}
                        disabled={disabled}
                        placeholder={placeholder}
                        className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-primary"
                        onChange={(event) =>
                          setTrusteeLetter((prev) => ({ ...prev, [key]: event.target.value }))
                        }
                      />
                    </div>
                  ))}
                  <TrusteeLetterEmailFields
                    autoSendTrusteeEmail={trusteeLetter.autoSendTrusteeEmail === true}
                    trusteeEmail={trusteeLetter.trusteeEmail ?? ""}
                    trusteeCcEmails={trusteeLetter.trusteeCcEmails ?? []}
                    ccDraft={trusteeCcDraft}
                    disabled={disabled}
                    trusteeEmailError={trusteeEmailValidation.trusteeEmailError}
                    trusteeCcError={trusteeEmailValidation.trusteeCcError}
                    onAutoSendChange={(enabled) =>
                      setTrusteeLetter((prev) => ({ ...prev, autoSendTrusteeEmail: enabled }))
                    }
                    onTrusteeEmailChange={(email) =>
                      setTrusteeLetter((prev) => ({ ...prev, trusteeEmail: email }))
                    }
                    onCcEmailsChange={(emails) =>
                      setTrusteeLetter((prev) => ({ ...prev, trusteeCcEmails: emails }))
                    }
                    onCcDraftChange={setTrusteeCcDraft}
                  />
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Authorised signature image</label>
                    <p className="text-xs text-muted-foreground">
                      Upload the signature image that will appear in newly generated trustee letters.
                    </p>
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(event) => void handleSignatureFileChange(event)}
                    />
                    <div className="rounded-xl border p-4">
                      {signaturePreviewUrl || trusteeLetter.authorisedSignatureImageUrl ? (
                        <img
                          src={signaturePreviewUrl ?? trusteeLetter.authorisedSignatureImageUrl ?? ""}
                          alt="Authorised signature preview"
                          className="max-h-24 w-auto rounded-md border bg-background p-2"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">No signature image uploaded.</p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {canManage ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={disabled || signatureUploadMutation.isPending}
                            onClick={handleSelectSignatureImage}
                          >
                            {signatureUploadMutation.isPending ? "Uploading..." : "Upload signature image"}
                          </Button>
                        ) : null}
                        {canManage &&
                        (trusteeLetter.authorisedSignatureImageKey ||
                          trusteeLetter.authorisedSignatureImageUrl) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={disabled || signatureUploadMutation.isPending}
                            onClick={() =>
                              setTrusteeLetter((prev) => ({
                                ...prev,
                                authorisedSignatureImageKey: undefined,
                                authorisedSignatureImageUrl: undefined,
                                authorisedSignatureImageFileName: undefined,
                                authorisedSignatureImageContentType: undefined,
                              }))
                            }
                          >
                            Remove image
                          </Button>
                        ) : null}
                        {trusteeLetter.authorisedSignatureImageFileName ? (
                          <span className="text-xs text-muted-foreground">
                            {trusteeLetter.authorisedSignatureImageFileName}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      disabled={trusteeLetterSaveDisabled}
                      className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                      onClick={() => {
                        if (!trusteeEmailValidation.canSave) {
                          toast.error(
                            trusteeEmailValidation.trusteeEmailError ??
                              trusteeEmailValidation.trusteeCcError ??
                              "Check trustee email settings"
                          );
                          return;
                        }
                        saveMutation.mutate({
                          trusteeLetterConfig: buildTrusteeLetterConfigPayload(
                            trusteeLetter,
                            trusteeCcDraft
                          ),
                        });
                      }}
                    >
                      Save Trustee Letter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="document-authorisation">
              <Card className="rounded-2xl p-6 shadow-sm md:p-8">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Document Authorisation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-0">
                  <section className="space-y-4">
                    <h3 className="text-base font-semibold">Islamic Investment Note Certificate</h3>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="authorised-signatory-name">
                        Authorised Signatory Name
                      </label>
                      <Input
                        id="authorised-signatory-name"
                        value={documentAuthorisation.authorisedSignatoryName}
                        disabled={disabled}
                        maxLength={200}
                        placeholder="e.g. Ahmad bin Ali"
                        className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-primary"
                        onChange={(event) =>
                          setDocumentAuthorisation((prev) => ({
                            ...prev,
                            authorisedSignatoryName: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Company Stamp</label>
                      <input
                        ref={certificateStampInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={(event) =>
                          void handleStampFileChange(event, "CERTIFICATE_COMPANY_STAMP")
                        }
                      />
                      <div className="rounded-xl border p-4">
                        {certificateStampPreviewUrl ? (
                          <img
                            src={certificateStampPreviewUrl}
                            alt="Islamic Investment Note Certificate company stamp preview"
                            className="max-h-24 w-auto rounded-md border bg-background p-2"
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">No company stamp uploaded.</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {canManage ? (
                            <Button
                              type="button"
                              variant="outline"
                              disabled={disabled || stampUploadMutation.isPending}
                              onClick={() => certificateStampInputRef.current?.click()}
                            >
                              {stampUploadMutation.isPending
                                ? "Uploading..."
                                : documentAuthorisation.certificateCompanyStamp?.s3Key
                                  ? "Replace"
                                  : "Upload"}
                            </Button>
                          ) : null}
                          {documentAuthorisation.certificateCompanyStamp?.fileName ? (
                            <span className="text-xs text-muted-foreground">
                              {documentAuthorisation.certificateCompanyStamp.fileName}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-base font-semibold">Settlement & Hibah Receipt</h3>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="use-same-company-stamp"
                        checked={documentAuthorisation.useSameCompanyStamp}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          setDocumentAuthorisation((prev) => ({
                            ...prev,
                            useSameCompanyStamp: checked === true,
                          }))
                        }
                      />
                      <label htmlFor="use-same-company-stamp" className="text-sm font-medium leading-5">
                        Use same company stamp as Islamic Investment Note Certificate
                      </label>
                    </div>
                    {documentAuthorisation.useSameCompanyStamp ? null : (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Settlement & Hibah Receipt Company Stamp
                        </label>
                        <input
                          ref={receiptStampInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          onChange={(event) =>
                            void handleStampFileChange(event, "RECEIPT_COMPANY_STAMP")
                          }
                        />
                        <div className="rounded-xl border p-4">
                          {receiptStampPreviewUrl ? (
                            <img
                              src={receiptStampPreviewUrl}
                              alt="Settlement and Hibah Receipt company stamp preview"
                              className="max-h-24 w-auto rounded-md border bg-background p-2"
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No company stamp uploaded.
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {canManage ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={disabled || stampUploadMutation.isPending}
                                onClick={() => receiptStampInputRef.current?.click()}
                              >
                                {stampUploadMutation.isPending
                                  ? "Uploading..."
                                  : documentAuthorisation.receiptCompanyStamp?.s3Key
                                    ? "Replace"
                                    : "Upload"}
                              </Button>
                            ) : null}
                            {documentAuthorisation.receiptCompanyStamp?.fileName ? (
                              <span className="text-xs text-muted-foreground">
                                {documentAuthorisation.receiptCompanyStamp.fileName}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  <div className="flex justify-end">
                    <Button
                      disabled={disabled || saveMutation.isPending || stampUploadMutation.isPending}
                      className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                      onClick={() =>
                        saveMutation.mutate({
                          documentAuthorisationConfig: {
                            authorisedSignatoryName:
                              documentAuthorisation.authorisedSignatoryName.trim(),
                            useSameCompanyStamp: documentAuthorisation.useSameCompanyStamp,
                            certificateCompanyStamp: documentAuthorisation.certificateCompanyStamp,
                            receiptCompanyStamp: documentAuthorisation.receiptCompanyStamp,
                          },
                        })
                      }
                    >
                      Save Document Authorisation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="money-flow-accounts" className="space-y-4">
              {moneyFlowSections.map(({ key, title, accountNamePlaceholder }) => (
                <AccountFields
                  key={key}
                  title={title}
                  value={bucketAccounts[key]}
                  accountNamePlaceholder={accountNamePlaceholder}
                  disabled={disabled}
                  onChange={(next) => setBucketAccounts((prev) => ({ ...prev, [key]: next }))}
                />
              ))}
              <div className="flex justify-end">
                <Button
                  disabled={disabled || saveMutation.isPending}
                  className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                  onClick={() => {
                    const normalizedBucketAccounts = moneyFlowSections.reduce((acc, section) => {
                      const current = bucketAccounts[section.key];
                      acc[section.key] = {
                        ...current,
                        displayName:
                          current.displayName.trim() !== "" ? current.displayName : section.title,
                      };
                      return acc;
                    }, { ...bucketAccounts });

                    const operating = normalizedBucketAccounts.OPERATING_ACCOUNT;
                    const operatingFields = {
                      displayName: operating.displayName,
                      bankName: operating.bankName,
                      accountName: operating.accountName,
                      accountNumber: operating.accountNumber,
                    };
                    saveMutation.mutate({
                      ledgerBucketAccountsConfig: normalizedBucketAccounts,
                      platformAccountsConfig: {
                        ...platformAccounts,
                        platformOperating: {
                          ...platformAccounts.platformOperating,
                          ...operatingFields,
                        },
                        serviceFee: { ...platformAccounts.serviceFee, ...operatingFields },
                        platformFee: { ...platformAccounts.platformFee, ...operatingFields },
                        facilityFee: { ...platformAccounts.facilityFee, ...operatingFields },
                      },
                    });
                  }}
                >
                  Save Money Flow Accounts
                </Button>
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </>
    </RequirePermission>
  );
}
