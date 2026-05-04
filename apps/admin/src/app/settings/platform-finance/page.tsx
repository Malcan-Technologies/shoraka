"use client";

import * as React from "react";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SystemHealthIndicator } from "@/components/system-health-indicator";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function PlatformFinanceSettingsPage() {
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
  const [form, setForm] = React.useState({
    gracePeriodDays: "7",
    arrearsThresholdDays: "14",
    tawidhRateCapPercent: "1",
    gharamahRateCapPercent: "9",
    defaultTawidhRatePercent: "0",
    defaultGharamahRatePercent: "0",
  });

  React.useEffect(() => {
    if (!data) return;
    setForm({
      gracePeriodDays: String(data.gracePeriodDays),
      arrearsThresholdDays: String(data.arrearsThresholdDays),
      tawidhRateCapPercent: String(data.tawidhRateCapPercent),
      gharamahRateCapPercent: String(data.gharamahRateCapPercent),
      defaultTawidhRatePercent: String(data.defaultTawidhRatePercent),
      defaultGharamahRatePercent: String(data.defaultGharamahRatePercent),
    });
  }, [data]);

  const updateSettings = useMutation({
    mutationFn: async () => {
      const response = await apiClient.updatePlatformFinanceSettings({
        gracePeriodDays: Number(form.gracePeriodDays),
        arrearsThresholdDays: Number(form.arrearsThresholdDays),
        tawidhRateCapPercent: Number(form.tawidhRateCapPercent),
        gharamahRateCapPercent: Number(form.gharamahRateCapPercent),
        defaultTawidhRatePercent: Number(form.defaultTawidhRatePercent),
        defaultGharamahRatePercent: Number(form.defaultGharamahRatePercent),
      });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-finance-settings"] });
      toast.success("Platform finance settings updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update settings"),
  });

  const setField = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Platform Finance Settings</h1>
        <div className="ml-auto"><SystemHealthIndicator /></div>
      </header>
      <div className="w-full p-6">
        <Card>
          <CardHeader>
            <CardTitle>Late Payment and Letter Defaults</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {Object.entries(form).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <label className="text-sm font-medium">{key.replace(/([A-Z])/g, " $1")}</label>
                <Input
                  value={value}
                  disabled={isLoading}
                  onChange={(event) => setField(key as keyof typeof form, event.target.value)}
                />
              </div>
            ))}
            <div className="md:col-span-2">
              <Button onClick={() => updateSettings.mutate()} disabled={updateSettings.isPending}>
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

