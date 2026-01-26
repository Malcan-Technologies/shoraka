"use client";

import { useState } from "react";
import { useAdminNotifications } from "@cashsouk/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Switch } from "../../../components/ui/switch";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Badge } from "../../../components/ui/badge";
import { toast } from "sonner";
import { Send, Settings2, Users } from "lucide-react";

export default function NotificationsAdminPage() {
  const { types, isLoadingTypes, updateType, sendNotification, isSending } = useAdminNotifications();
  const [selectedType, setSelectedType] = useState<string>("");
  const [userIds, setUserIds] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const handleTogglePlatform = (typeId: string, enabled: boolean) => {
    updateType({ id: typeId, data: { enabled_platform: enabled } });
  };

  const handleToggleEmail = (typeId: string, enabled: boolean) => {
    updateType({ id: typeId, data: { enabled_email: enabled } });
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !userIds || !title || !message) {
      toast.error("Please fill in all fields");
      return;
    }

    const ids = userIds.split(",").map((id) => id.trim()).filter(Boolean);

    sendNotification(
      {
        userIds: ids,
        typeId: selectedType,
        title,
        message,
      },
      {
        onSuccess: () => {
          toast.success("Notifications sent successfully");
          setTitle("");
          setMessage("");
          setUserIds("");
        },
        onError: (error: any) => {
          toast.error(error.message || "Failed to send notifications");
        },
      }
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notification Management</h1>
          <p className="text-muted-foreground">
            Manage system-wide notification settings and send custom alerts.
          </p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Notification Types Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              System Notification Types
            </CardTitle>
            <CardDescription>
              Enable or disable notifications globally across the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTypes ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 w-full bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {types.map((type: any) => (
                  <div key={type.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{type.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {type.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">Platform</span>
                        <Switch
                          checked={type.enabled_platform}
                          onCheckedChange={(checked) => handleTogglePlatform(type.id, checked)}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">Email</span>
                        <Switch
                          checked={type.enabled_email}
                          onCheckedChange={(checked) => handleToggleEmail(type.id, checked)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Notification Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Custom Notification
            </CardTitle>
            <CardDescription>
              Send a one-time notification to specific users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendNotification} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Notification Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((type: any) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="userIds" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  User IDs (comma separated)
                </Label>
                <Input
                  id="userIds"
                  placeholder="USR-123, USR-456"
                  value={userIds}
                  onChange={(e) => setUserIds(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Important Update"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Input
                  id="message"
                  placeholder="Enter notification message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSending}>
                {isSending ? "Sending..." : "Send Notification"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
