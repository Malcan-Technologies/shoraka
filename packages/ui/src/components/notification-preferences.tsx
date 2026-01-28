"use client";

import { useNotificationPreferences } from "@cashsouk/config";
import { Switch } from "./switch";
import { Label } from "./label";
import { Skeleton } from "./skeleton";

export function NotificationPreferences() {
  const { preferences, isLoading, updatePreference } = useNotificationPreferences();

  const handleToggle = (typeId: string, channel: "platform" | "email", checked: boolean) => {
    const pref = preferences.find((p: any) => p.id === typeId);
    if (!pref) return;

    updatePreference({
      typeId,
      data: {
        enabled_platform: channel === "platform" ? checked : pref.enabled_platform,
        enabled_email: channel === "email" ? checked : pref.enabled_email,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-10 rounded-full" />
                <Skeleton className="h-4 w-10" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-10 rounded-full" />
                <Skeleton className="h-4 w-10" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Filter only configurable marketing preferences
  const configurablePrefs = preferences.filter(
    (p: any) => p.user_configurable && p.category === "MARKETING"
  );

  return (
    <div className="space-y-6">
      {configurablePrefs.map((type: any) => (
        <div
          key={type.id}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-0.5">
            <Label className="text-base font-medium">{type.name}</Label>
            <p className="text-sm text-muted-foreground">{type.description}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2 whitespace-nowrap">
              <Switch
                id={`${type.id}-platform`}
                checked={type.enabled_platform}
                onCheckedChange={(checked) => handleToggle(type.id, "platform", checked)}
              />
              <Label htmlFor={`${type.id}-platform`} className="text-sm cursor-pointer">
                In-app
              </Label>
            </div>
            <div className="flex items-center space-x-2 whitespace-nowrap">
              <Switch
                id={`${type.id}-email`}
                checked={type.enabled_email}
                onCheckedChange={(checked) => handleToggle(type.id, "email", checked)}
              />
              <Label htmlFor={`${type.id}-email`} className="text-sm cursor-pointer">
                Email
              </Label>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
