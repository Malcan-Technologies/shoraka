"use client";

import { useState, useEffect } from "react";
import { useAdminNotifications } from "@cashsouk/config";
import { usePermissions } from "../../../hooks/use-permissions";
import type {
  AdminNotificationType,
  AdminNotificationGroup,
  AdminSeedTypesResponse,
  AdminSendNotificationResult,
} from "@cashsouk/types";
import Link from "next/link";
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
import { Tabs, TabsContent, TabsList, TabsTrigger, useHeader } from "@cashsouk/ui";
import { toast } from "sonner";
import {
  Send,
  Settings2,
  Users,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { RequirePermission } from "../../../components/require-permission";

export default function NotificationsAdminPage() {
  const { setTitle: setHeaderTitle } = useHeader();
  useEffect(() => {
    setHeaderTitle("Notification Management");
    return () => setHeaderTitle("");
  }, [setHeaderTitle]);

  const { can } = usePermissions();
  const canManage = can("notifications.manage");
  const [configPortalFilter, setConfigPortalFilter] = useState<"INVESTOR" | "ISSUER" | "BOTH">(
    "ISSUER"
  );
  const {
    types,
    isLoadingTypes,
    updateType,
    sendNotification,
    isSending,
    groups,
    isLoadingGroups,
    createGroup,
    isCreatingGroup,
    updateGroup,
    deleteGroup,
    seedTypes,
    isSeeding,
  } = useAdminNotifications({
    includeLogs: false,
  });
  const [selectedType, setSelectedType] = useState<string>("");
  const [targetType, setTargetType] = useState<string>("ALL_USERS");
  const [userIds, setUserIds] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [linkPath, setLinkPath] = useState<string>("");
  const [sendToPlatform, setSendToPlatform] = useState<boolean>(true);
  const [sendToEmail, setSendToEmail] = useState<boolean>(false);
  const [expirationMode, setExpirationType] = useState<"presets" | "custom">("presets");
  const [retentionDays, setRetentionDays] = useState<string>("30");
  const [customExpirationDate, setCustomExpirationDate] = useState<string>(() =>
    format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
  );

  // Group Management State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupUserIds, setGroupUserIds] = useState("");
  const [editingGroupId, setGroupEditingId] = useState<string | null>(null);

  const selectedTargetPortal =
    targetType === "INVESTORS" ? "INVESTOR" : targetType === "ISSUERS" ? "ISSUER" : null;

  const handleTogglePlatform = (typeId: string, enabled: boolean) => {
    updateType({ id: typeId, data: { enabled_platform: enabled } });
  };

  const handleToggleEmail = (typeId: string, enabled: boolean) => {
    updateType({ id: typeId, data: { enabled_email: enabled } });
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !title || !message) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (targetType === "SPECIFIC_USERS" && !userIds) {
      toast.error("Please provide at least one User ID");
      return;
    }

    if (targetType === "GROUP" && !selectedGroupId) {
      toast.error("Please select a target group");
      return;
    }

    if (!sendToPlatform && !sendToEmail) {
      toast.error("Please select at least one delivery channel (Platform or Email)");
      return;
    }

    const ids = userIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const expiresAt =
      expirationMode === "presets"
        ? retentionDays !== "0"
          ? new Date(Date.now() + parseInt(retentionDays, 10) * 24 * 60 * 60 * 1000)
          : undefined
        : new Date(customExpirationDate);

    sendNotification(
      {
        targetType,
        userIds: targetType === "SPECIFIC_USERS" ? ids : undefined,
        groupId: targetType === "GROUP" ? selectedGroupId : undefined,
        typeId: selectedType,
        title,
        message,
        linkPath: linkPath || undefined,
        sendToPlatform,
        sendToEmail,
        expiresAt: expiresAt?.toISOString(),
      },
      {
        onSuccess: (result: AdminSendNotificationResult) => {
          if (result.failedCount === 0) {
            toast.success("Notification broadcast processed successfully");
          } else if (result.createdCount === 0) {
            toast.error("Broadcast processed but no notifications were created");
          } else {
            toast.warning("Broadcast processed with some failures");
          }
          setTitle("");
          setMessage("");
          setUserIds("");
          setLinkPath("");
          setSelectedGroupId("");
          setSendToPlatform(true);
          setSendToEmail(false);
          setRetentionDays("30");
          setCustomExpirationDate(
            format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
          );
          setExpirationType("presets");
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to send notifications");
        },
      }
    );
  };

  const handleCreateOrUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || !groupUserIds) {
      toast.error("Name and User IDs are required");
      return;
    }

    const userIdsArray = groupUserIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (editingGroupId) {
      updateGroup(
        {
          id: editingGroupId,
          data: { name: groupName, description: groupDescription, userIds: userIdsArray },
        },
        {
          onSuccess: () => {
            toast.success("Group updated successfully");
            resetGroupForm();
          },
        }
      );
    } else {
      createGroup(
        {
          name: groupName,
          description: groupDescription,
          userIds: userIdsArray,
        },
        {
          onSuccess: () => {
            toast.success("Group created successfully");
            resetGroupForm();
          },
        }
      );
    }
  };

  const resetGroupForm = () => {
    setGroupName("");
    setGroupDescription("");
    setGroupUserIds("");
    setGroupEditingId(null);
    setIsGroupModalOpen(false);
  };

  const handleEditGroup = (group: AdminNotificationGroup) => {
    setGroupName(group.name);
    setGroupDescription(group.description || "");
    setGroupUserIds(group.user_ids.join(", "));
    setGroupEditingId(group.id);
    setIsGroupModalOpen(true);
  };

  return (
    <RequirePermission permission="notifications.view">
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full px-2 md:px-4 py-8 space-y-6">
          <p className="text-muted-foreground -mt-4">
            Manage system-wide notification settings and send custom alerts. Broadcast history is in{" "}
            <Link href="/audit?tab=notifications" className="font-medium text-foreground underline underline-offset-4">
              Audit Logs → Notifications
            </Link>
            .
          </p>

          <Tabs defaultValue="config" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Custom & Groups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-1">
            {/* Notification Types Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Settings2 className="h-5 w-5" />
                      System Notification Types
                    </CardTitle>
                    <CardDescription>
                      Enable or disable notifications globally across the platform.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (confirm("This will add any missing notification types. Existing types will not be modified. Continue?")) {
                        seedTypes(undefined, {
                          onSuccess: (response: AdminSeedTypesResponse) => {
                            const added = response.added || 0;
                            if (added > 0) {
                              toast.success(`Successfully added ${added} new notification types`);
                            } else {
                              toast.info("All notification types are already up to date");
                            }
                          },
                          onError: (error) => toast.error(error.message || "Failed to seed types"),
                        });
                      }
                    }}
                    disabled={isSeeding || !canManage}
                    title={!canManage ? "You do not have permission to perform this action." : undefined}
                  >
                    <RotateCcw className={`h-4 w-4 ${isSeeding ? "animate-spin" : ""}`} />
                    {isSeeding ? "Seeding..." : "Add Missing Types"}
                  </Button>
                </div>
                <div className="flex items-center gap-2 pt-3">
                  <Label className="text-xs text-muted-foreground">Portal Scope</Label>
                  <Tabs
                    value={configPortalFilter}
                    onValueChange={(value) =>
                      setConfigPortalFilter(value as "INVESTOR" | "ISSUER" | "BOTH")
                    }
                    className="w-auto"
                  >
                    <TabsList className="grid w-full grid-cols-3 max-w-[320px]">
                      <TabsTrigger value="INVESTOR">Investor</TabsTrigger>
                      <TabsTrigger value="ISSUER">Issuer</TabsTrigger>
                      <TabsTrigger value="BOTH">Both</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingTypes ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 w-full bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="divide-y">
                    {types
                      .filter(
                        (type: AdminNotificationType) =>
                          type.category === "SYSTEM" || type.category === "AUTHENTICATION"
                      )
                      .filter((type: AdminNotificationType) => {
                        const targets = type.portal_targets || [];
                        const hasInvestor = targets.includes("INVESTOR");
                        const hasIssuer = targets.includes("ISSUER");
                        if (configPortalFilter === "INVESTOR") return hasInvestor && !hasIssuer;
                        if (configPortalFilter === "ISSUER") return hasIssuer && !hasInvestor;
                        return hasInvestor && hasIssuer;
                      })
                      .map((type: AdminNotificationType) => (
                        <div
                          key={type.id}
                          className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                        >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{type.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{type.description}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">Platform</span>
                            <Switch
                              checked={type.enabled_platform}
                              onCheckedChange={(checked) => handleTogglePlatform(type.id, checked)}
                              disabled={!canManage}
                              title={!canManage ? "You do not have permission to perform this action." : undefined}
                            />
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">Email</span>
                            <Switch
                              checked={type.enabled_email}
                              onCheckedChange={(checked) => handleToggleEmail(type.id, checked)}
                              disabled={!canManage}
                              title={!canManage ? "You do not have permission to perform this action." : undefined}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 items-start">
            {/* Custom Notification Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Send Custom Notification
                </CardTitle>
                <CardDescription>Send a one-time notification to specific users.</CardDescription>
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
                        {types
                          .filter(
                            (type: AdminNotificationType) =>
                              type.category === "MARKETING" || type.category === "ANNOUNCEMENT"
                          )
                          .filter((type: AdminNotificationType) =>
                            selectedTargetPortal
                              ? type.portal_targets?.includes(selectedTargetPortal)
                              : true
                          )
                          .map((type: AdminNotificationType) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target">Target Recipients</Label>
                    <Select value={targetType} onValueChange={setTargetType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL_USERS">All Users</SelectItem>
                        <SelectItem value="INVESTORS">Investors Only</SelectItem>
                        <SelectItem value="ISSUERS">Issuers Only</SelectItem>
                        <SelectItem value="SPECIFIC_USERS">Specific User IDs</SelectItem>
                        <SelectItem value="GROUP">Saved Group</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {targetType === "GROUP" && (
                    <div className="space-y-2">
                      <Label htmlFor="groupId">Target Group</Label>
                      <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a group" />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((group: AdminNotificationGroup) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name} ({group.user_ids.length} users)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {targetType === "SPECIFIC_USERS" && (
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
                  )}

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

                  <div className="space-y-2">
                    <Label htmlFor="linkPath">Redirect Link (Optional)</Label>
                    <Input
                      id="linkPath"
                      placeholder="/investments or https://..."
                      value={linkPath}
                      onChange={(e) => setLinkPath(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      The page the user will be taken to when they click the notification.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="retention">Expiration</Label>
                      <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setExpirationType("presets")}
                          className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                            expirationMode === "presets"
                              ? "bg-white shadow-sm font-medium"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Presets
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpirationType("custom")}
                          className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                            expirationMode === "custom"
                              ? "bg-white shadow-sm font-medium"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Custom Date
                        </button>
                      </div>
                    </div>

                    {expirationMode === "presets" ? (
                      <Select value={retentionDays} onValueChange={setRetentionDays}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Day</SelectItem>
                          <SelectItem value="7">7 Days</SelectItem>
                          <SelectItem value="14">14 Days</SelectItem>
                          <SelectItem value="30">30 Days</SelectItem>
                          <SelectItem value="90">90 Days</SelectItem>
                          <SelectItem value="365">1 Year</SelectItem>
                          <SelectItem value="0">Never (Manual Cleanup)</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type="date"
                        value={customExpirationDate}
                        onChange={(e) => setCustomExpirationDate(e.target.value)}
                        min={format(new Date(), "yyyy-MM-dd")}
                      />
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {expirationMode === "presets"
                        ? "Choose a standard retention period."
                        : "Select a specific date for this notification to expire."}
                    </p>
                  </div>

                  <div className="flex items-center gap-8 py-2 border-y">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="send-platform"
                        checked={sendToPlatform}
                        onCheckedChange={setSendToPlatform}
                      />
                      <Label htmlFor="send-platform" className="cursor-pointer">
                        Send to Platform
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="send-email" checked={sendToEmail} onCheckedChange={setSendToEmail} />
                      <Label htmlFor="send-email" className="cursor-pointer">
                        Send to Email
                      </Label>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isSending || !canManage}
                    title={!canManage ? "You do not have permission to perform this action." : undefined}
                  >
                    {isSending ? "Sending..." : "Send Notification"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Notification Groups Management */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Saved Notification Groups
                  </CardTitle>
                  <CardDescription>
                    Create and manage reusable sets of target users.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsGroupModalOpen(true)}
                  disabled={!canManage}
                  title={!canManage ? "You do not have permission to perform this action." : undefined}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-[600px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-200">
                  {isLoadingGroups ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-12 w-full bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      No saved groups found. Create one to get started.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {groups.map((group: AdminNotificationGroup) => (
                        <div
                          key={group.id}
                          className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{group.name}</span>
                              <Badge variant="secondary" className="text-[10px]">
                                {group.user_ids.length} users
                              </Badge>
                            </div>
                            {group.description && (
                              <p className="text-xs text-muted-foreground">{group.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditGroup(group)}
                              disabled={!canManage}
                              title={!canManage ? "You do not have permission to perform this action." : undefined}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              disabled={!canManage}
                              title={!canManage ? "You do not have permission to perform this action." : undefined}
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this group?")) {
                                  deleteGroup(group.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Group Management Modal */}
      <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingGroupId ? "Edit Group" : "Create New Group"}</DialogTitle>
            <DialogDescription>
              Define a group of users to send targeted notifications to.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateOrUpdateGroup} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                placeholder="e.g. VIP Investors"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupDescription">Description (Optional)</Label>
              <Input
                id="groupDescription"
                placeholder="Briefly describe what this group is for"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupUserIds">User IDs (comma separated)</Label>
              <Input
                id="groupUserIds"
                placeholder="USR-123, USR-456"
                value={groupUserIds}
                onChange={(e) => setGroupUserIds(e.target.value)}
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Enter the internal user IDs of the users you want to include in this group.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetGroupForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingGroup || !canManage}
                title={!canManage ? "You do not have permission to perform this action." : undefined}
              >
                {editingGroupId ? "Update Group" : "Create Group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  </div>
</RequirePermission>
  );
}
