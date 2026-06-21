"use client";

import * as React from "react";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LedgerBucketAccountsConfig,
  PlatformAccountsConfig,
  TrusteeAccountDetails,
  TrusteeLetterConfig,
} from "@cashsouk/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const EMPTY_ACCOUNT: TrusteeAccountDetails = {
  displayName: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  remarks: "",
};

const DEFAULT_TRUSTEE_LETTER: TrusteeLetterConfig = {
  trusteeName: "RHB Trustees Berhad",
  trusteeAddressLine1: "Level 11 Tower 3 RHB Centre",
  trusteeAddressLine2: "Jalan Tun Razak",
  trusteeAddressLine3: "50400 Kuala Lumpur",
  attentionPerson: "Ms Lim Bee Fang",
  defaultContactPerson: "CashSouk Finance Team",
  authorisedSignatoryLabel: "Authorised Signatories",
  platformDisplayName: "CashSouk Sdn Bhd",
  defaultValueDateBehavior: "T+1",
  defaultLetterRefPrefix: "CSK",
};

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
  disabled,
}: {
  title: string;
  value: TrusteeAccountDetails;
  onChange: (next: TrusteeAccountDetails) => void;
  disabled?: boolean;
}) {
  const set = (key: keyof TrusteeAccountDetails, fieldValue: string) =>
    onChange({ ...value, [key]: fieldValue });

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["displayName", "Display name"],
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
  const [trusteeLetter, setTrusteeLetter] = React.useState<TrusteeLetterConfig>(DEFAULT_TRUSTEE_LETTER);
  const [platformAccounts, setPlatformAccounts] =
    React.useState<PlatformAccountsConfig>(emptyPlatformAccounts());
  const [bucketAccounts, setBucketAccounts] =
    React.useState<LedgerBucketAccountsConfig>(emptyBucketAccounts());

  const latePaymentFields: Array<{
    key: keyof Omit<typeof latePayment, "platformFeeRateCapPercent">;
    label: string;
  }> = [
    { key: "gracePeriodDays", label: "Grace period days" },
    { key: "arrearsThresholdDays", label: "Arrears threshold days" },
    { key: "tawidhRateCapPercent", label: "Ta'widh rate cap %" },
    { key: "defaultTawidhRatePercent", label: "Default Ta'widh rate %" },
    { key: "gharamahRateCapPercent", label: "Gharamah rate cap %" },
    { key: "defaultGharamahRatePercent", label: "Default Gharamah rate %" },
  ];

  const trusteeFields: Array<{ key: keyof TrusteeLetterConfig; label: string }> = [
    { key: "trusteeName", label: "Trustee name" },
    { key: "trusteeAddressLine1", label: "Trustee address line 1" },
    { key: "trusteeAddressLine2", label: "Trustee address line 2" },
    { key: "trusteeAddressLine3", label: "Trustee address line 3" },
    { key: "attentionPerson", label: "Attention person" },
    { key: "defaultContactPerson", label: "Default contact person" },
    { key: "authorisedSignatoryLabel", label: "Authorised signatory label" },
    { key: "platformDisplayName", label: "Platform display name" },
    { key: "defaultValueDateBehavior", label: "Default value date" },
    { key: "defaultLetterRefPrefix", label: "Default reference prefix" },
  ];

  const moneyFlowSections: Array<{
    key: keyof LedgerBucketAccountsConfig;
    title: string;
  }> = [
    {
      key: "INVESTOR_POOL",
      title: "Investor Pool",
    },
    {
      key: "REPAYMENT_POOL",
      title: "Repayment Pool",
    },
    {
      key: "OPERATING_ACCOUNT",
      title: "Operating Account",
    },
    {
      key: "TAWIDH_ACCOUNT",
      title: "Ta'widh Account",
    },
    {
      key: "GHARAMAH_ACCOUNT",
      title: "Gharamah Account",
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
    setTrusteeLetter({ ...DEFAULT_TRUSTEE_LETTER, ...(data.trusteeLetterConfig ?? {}) });
    setPlatformAccounts({ ...emptyPlatformAccounts(), ...(data.platformAccountsConfig ?? {}) });
    setBucketAccounts({ ...emptyBucketAccounts(), ...(data.ledgerBucketAccountsConfig ?? {}) });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await apiClient.updatePlatformFinanceSettings(payload);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-finance-settings"] });
      toast.success("Platform finance settings updated");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to update settings"),
  });

  const disabled = isLoading || !canManage;

  return (
    <RequirePermission permission="platform_settings.view">
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold">Platform Finance Settings</h1>
          <div className="ml-auto">
            <SystemHealthIndicator />
          </div>
        </header>

        <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
          <Tabs defaultValue="late-payment" className="space-y-6">
            <TabsList className="grid h-auto w-full max-w-[760px] grid-cols-1 gap-2 md:grid-cols-3">
              <TabsTrigger value="late-payment">Late Payment</TabsTrigger>
              <TabsTrigger value="trustee-letter">Trustee Letter</TabsTrigger>
              <TabsTrigger value="money-flow-accounts">Money Flow Accounts</TabsTrigger>
            </TabsList>

            <TabsContent value="late-payment">
              <Card className="rounded-2xl p-6 shadow-sm md:p-8">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Late Payment Settings</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 px-0 md:grid-cols-2">
                  {latePaymentFields.map(({ key, label }) => (
                    <div key={key} className="space-y-2">
                      <label className="text-sm font-medium">{label}</label>
                      <Input
                        type="number"
                        value={latePayment[key]}
                        disabled={disabled}
                        className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-primary"
                        onChange={(event) =>
                          setLatePayment((prev) => ({ ...prev, [key]: event.target.value }))
                        }
                      />
                    </div>
                  ))}
                  <div className="md:col-span-2">
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

            <TabsContent value="trustee-letter" className="space-y-4">
              <Card className="rounded-2xl p-6 shadow-sm md:p-8">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Trustee Letter Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 px-0 md:grid-cols-2">
                  {trusteeFields.map(({ key, label }) => (
                    <div key={key} className="space-y-2">
                      <label className="text-sm font-medium">{label}</label>
                      <Input
                        value={trusteeLetter[key] ?? ""}
                        disabled={disabled}
                        className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-primary"
                        onChange={(event) =>
                          setTrusteeLetter((prev) => ({ ...prev, [key]: event.target.value }))
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Button
                disabled={disabled || saveMutation.isPending}
                className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                onClick={() => saveMutation.mutate({ trusteeLetterConfig: trusteeLetter })}
              >
                Save Trustee Letter
              </Button>
            </TabsContent>

            <TabsContent value="money-flow-accounts" className="space-y-4">
              {moneyFlowSections.map(({ key, title }) => (
                <AccountFields
                  key={key}
                  title={title}
                  value={bucketAccounts[key]}
                  disabled={disabled}
                  onChange={(next) => setBucketAccounts((prev) => ({ ...prev, [key]: next }))}
                />
              ))}
              <Button
                disabled={disabled || saveMutation.isPending}
                className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                onClick={() => {
                  const operating = bucketAccounts.OPERATING_ACCOUNT;
                  const operatingFields = {
                    displayName: operating.displayName,
                    bankName: operating.bankName,
                    accountName: operating.accountName,
                    accountNumber: operating.accountNumber,
                  };
                  saveMutation.mutate({
                    ledgerBucketAccountsConfig: bucketAccounts,
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
            </TabsContent>

          </Tabs>
        </div>
      </>
    </RequirePermission>
  );
}
