"use client";

import * as React from "react";
import { useNotificationPreferences } from "@cashsouk/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Switch } from "./switch";
import { Label } from "./label";
import { Skeleton } from "./skeleton";
import { cn } from "../lib/utils";

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
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-6 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Filter only configurable preferences
  const configurablePrefs = preferences.filter((p: any) => p.user_configurable);

  // Group by category
  const categories = configurablePrefs.reduce((acc: any, pref: any) => {
    const category = pref.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(pref);
    return acc;
  }, {});

  // Map category keys to display names
  const categoryNames: Record<string, string> = {
    AUTHENTICATION: "Authentication",
    SYSTEM: "System",
    MARKETING: "Marketing",
  };

  return (
    <div className="space-y-6">
      {Object.entries(categoryNames).map(([key, label]) => {
        const types = categories[key] || [];
        if (types.length === 0) return null;

        return (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
              <CardDescription>
                Manage how you receive {label.toLowerCase()} notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {types.map((type: any) => (
                <div key={type.id} className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">{type.name}</Label>
                      <p className="text-sm text-muted-foreground">
                        {type.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`${type.id}-platform`}
                          checked={type.enabled_platform}
                          onCheckedChange={(checked) =>
                            handleToggle(type.id, "platform", checked)
                          }
                        />
                        <Label htmlFor={`${type.id}-platform`} className="text-sm">
                          In-app
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`${type.id}-email`}
                          checked={type.enabled_email}
                          onCheckedChange={(checked) =>
                            handleToggle(type.id, "email", checked)
                          }
                        />
                        <Label htmlFor={`${type.id}-email`} className="text-sm">
                          Email
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
