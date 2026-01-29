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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import { toast } from "sonner";
import {
  Send,
  Settings2,
  Users,
  Plus,
  Pencil,
  Trash2,
  History,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCcw,
  Eye,
  Filter,
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

const TARGET_CONFIG: Record<string, { label: string; color: string }> = {
  ALL_USERS: { label: "All Users", color: "bg-blue-500" },
  INVESTORS: { label: "Investors", color: "bg-blue-500" },
  ISSUERS: { label: "Issuers", color: "bg-purple-500" },
  SPECIFIC_USERS: { label: "Specific Users", color: "bg-emerald-500" },
  GROUP: { label: "Group", color: "bg-orange-500" },
};

const COLOR_MAP: Record<string, string> = {
  "bg-blue-500": "rgb(59 130 246)",
  "bg-purple-500": "rgb(168 85 247)",
  "bg-emerald-500": "rgb(16 185 129)",
  "bg-orange-500": "rgb(249 115 22)",
  "bg-gray-500": "rgb(107 114 128)",
};

function getTargetBadge(targetType: string) {
  const config = TARGET_CONFIG[targetType] || {
    label: targetType.replace("_", " "),
    color: "bg-gray-500",
  };
  const cssColor = COLOR_MAP[config.color] || "rgb(107 114 128)";

  return (
    <Badge
      variant="outline"
      className="text-xs font-semibold px-2 py-0.5 flex items-center gap-1.5 w-fit whitespace-nowrap"
      style={{
        backgroundColor: `color-mix(in srgb, ${cssColor} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${cssColor} 30%, transparent)`,
        color: "rgb(15, 23, 42)", // slate-900 for dark text
      }}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${config.color}`} />
      {config.label}
    </Badge>
  );
}

export default function NotificationsAdminPage() {
  const [page, setPage] = useState(1);
  const [logSearchQuery, setLogSearchQuery] = useState<string>("");
  const [logTypeFilter, setLogTypeFilter] = useState<string>("all");
  const [logTargetFilter, setLogTargetFilter] = useState<string>("all");
  const limit = 10;
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
    logs,
    isLoadingLogs,
    paginationLogs,
    refetchLogs,
  } = useAdminNotifications({
    limit,
    offset: (page - 1) * limit,
    search: logSearchQuery || undefined,
    type: logTypeFilter !== "all" ? logTypeFilter : undefined,
    target: logTargetFilter !== "all" ? logTargetFilter : undefined,
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
  const [customExpirationDate, setCustomExpirationDate] = useState<string>(
    format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
  );

  // Group Management State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupUserIds, setGroupUserIds] = useState("");
  const [editingGroupId, setGroupEditingId] = useState<string | null>(null);

  // Log View State
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isLogDetailsOpen, setIsLogDetailsOpen] = useState(false);

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
        onSuccess: () => {
          toast.success("Notifications sent successfully");
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
        onError: (error: any) => {
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

  const handleEditGroup = (group: any) => {
    setGroupName(group.name);
    setGroupDescription(group.description || "");
    setGroupUserIds(group.user_ids.join(", "));
    setGroupEditingId(group.id);
    setIsGroupModalOpen(true);
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

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Custom & Groups
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Notification Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <div className="grid gap-8 md:grid-cols-1">
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
                    {types
                      .filter((type: any) => type.category === "SYSTEM" || type.category === "AUTHENTICATION")
                      .map((type: any) => (
                        <div
                          key={type.id}
                          className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
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
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          <div className="grid gap-8 md:grid-cols-2 items-start">
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
                            (type: any) =>
                              type.category === "MARKETING" || type.category === "ANNOUNCEMENT"
                          )
                          .map((type: any) => (
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
                          {groups.map((group: any) => (
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

                  <Button type="submit" className="w-full" disabled={isSending}>
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
                <Button size="sm" onClick={() => setIsGroupModalOpen(true)}>
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
                    <div className="space-y-4">
                      {groups.map((group: any) => (
                        <div
                          key={group.id}
                          className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
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
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
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

        <TabsContent value="logs" className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user name or email..."
                value={logSearchQuery}
                onChange={(e) => {
                  setLogSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-11 rounded-xl"
              />
            </div>

            <Select
              value={logTypeFilter}
              onValueChange={(value) => {
                setLogTypeFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px] h-11 rounded-xl">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Filter className="h-4 w-4 shrink-0" />
                  <div className="truncate">
                    <SelectValue placeholder="All Types" />
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {types.map((type: any) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={logTargetFilter}
              onValueChange={(value) => {
                setLogTargetFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px] h-11 rounded-xl">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Users className="h-4 w-4 shrink-0" />
                  <div className="truncate">
                    <SelectValue placeholder="All Targets" />
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Targets</SelectItem>
                <SelectItem value="ALL_USERS">All Users</SelectItem>
                <SelectItem value="INVESTORS">Investors</SelectItem>
                <SelectItem value="ISSUERS">Issuers</SelectItem>
                <SelectItem value="SPECIFIC_USERS">Specific Users</SelectItem>
                <SelectItem value="GROUP">Group</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => refetchLogs()}
              disabled={isLoadingLogs}
              className="gap-2 h-11 rounded-xl"
            >
              <RotateCcw className={`h-4 w-4 ${isLoadingLogs ? "animate-spin" : ""}`} />
              Reload
            </Button>

            <Badge variant="secondary" className="h-11 px-4 rounded-xl text-sm font-normal">
              {paginationLogs?.total || 0} {paginationLogs?.total === 1 ? "log" : "logs"}
            </Badge>
          </div>

          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0">
              {isLoadingLogs ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground bg-white border rounded-2xl">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">No notification logs found</p>
                  <p className="text-sm">Try adjusting your search or send a new notification.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                    <table className="w-full text-sm table-fixed">
                      <thead className="bg-muted/30 border-b">
                        <tr>
                          <th className="p-4 text-left font-semibold text-muted-foreground text-sm w-[110px]">
                            Timestamp
                          </th>
                          <th className="p-4 text-left font-semibold text-muted-foreground text-sm w-[140px]">
                            Admin
                          </th>
                          <th className="p-4 text-left font-semibold text-muted-foreground text-sm w-[140px]">
                            Target
                          </th>
                          <th className="p-4 text-left font-semibold text-muted-foreground text-sm w-[130px]">
                            Type
                          </th>
                          <th className="p-4 text-left font-semibold text-muted-foreground text-sm w-[250px]">
                            Message
                          </th>
                          <th className="p-4 text-center font-semibold text-muted-foreground text-sm w-[90px]">
                            Recipients
                          </th>
                          <th className="p-4 text-left font-semibold text-muted-foreground text-sm w-[110px]">
                            IP Address
                          </th>
                          <th className="p-4 text-left font-semibold text-muted-foreground text-sm w-[170px]">
                            Device
                          </th>
                          <th className="p-4 text-left font-semibold text-muted-foreground text-sm w-[80px]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {logs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                            <td className="p-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">
                                {format(new Date(log.created_at), "MMM d, yyyy")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(log.created_at), "HH:mm")}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col min-w-0">
                                <span
                                  className="text-sm font-medium truncate text-slate-900"
                                  title={`${log.admin.first_name} ${log.admin.last_name}`}
                                >
                                  {log.admin.first_name} {log.admin.last_name}
                                </span>
                                <span
                                  className="text-xs text-muted-foreground truncate lowercase"
                                  title={log.admin.email}
                                >
                                  {log.admin.email}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">{getTargetBadge(log.target_type)}</td>
                            <td className="p-4">
                              <div
                                className="text-xs font-medium text-slate-700 whitespace-normal break-words"
                                title={log.notification_type?.name}
                              >
                                {log.notification_type?.name || "Custom"}
                              </div>
                            </td>
                            <td className="p-4">
                              <div
                                className="font-medium text-slate-900 truncate mb-0.5 text-sm"
                                title={log.title}
                              >
                                {log.title}
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {log.message}
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-medium text-xs">
                                <Users className="h-3 w-3" />
                                {log.recipient_count}
                              </div>
                            </td>
                            <td className="p-4 font-mono text-sm text-muted-foreground">
                              {log.ip_address || "—"}
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">
                              {log.device_info ? (
                                <span
                                  title={log.user_agent}
                                  className="line-clamp-2 block leading-snug"
                                >
                                  {log.device_info}
                                </span>
                              ) : log.user_agent ? (
                                <span
                                  title={log.user_agent}
                                  className="line-clamp-2 block leading-snug"
                                >
                                  {log.user_agent.split("/")[0]}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-4">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1 text-sm"
                                onClick={() => {
                                  setSelectedLog(log);
                                  setIsLogDetailsOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination for Logs */}
                  {paginationLogs && paginationLogs.pages > 1 && (
                    <div className="flex items-center justify-between border-t pt-4 px-2">
                      <div className="text-sm text-muted-foreground">
                        Showing {Math.min((page - 1) * limit + 1, paginationLogs.total)}-
                        {Math.min(page * limit, paginationLogs.total)} of {paginationLogs.total}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl h-9"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: paginationLogs.pages }, (_, i) => i + 1).map(
                            (p) => {
                              if (
                                p === 1 ||
                                p === paginationLogs.pages ||
                                (p >= page - 1 && p <= page + 1)
                              ) {
                                return (
                                  <Button
                                    key={p}
                                    variant={p === page ? "default" : "outline"}
                                    size="sm"
                                    className="h-9 w-9 p-0 rounded-xl"
                                    onClick={() => setPage(p)}
                                  >
                                    {p}
                                  </Button>
                                );
                              }
                              if (p === 2 || p === paginationLogs.pages - 1) {
                                return (
                                  <span key={p} className="px-1 text-muted-foreground">
                                    ...
                                  </span>
                                );
                              }
                              return null;
                            }
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl h-9"
                          onClick={() => setPage((p) => Math.min(paginationLogs.pages, p + 1))}
                          disabled={page === paginationLogs.pages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
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
              <Button type="submit" disabled={isCreatingGroup}>
                {editingGroupId ? "Update Group" : "Create Group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Log Details Modal */}
      <Dialog open={isLogDetailsOpen} onOpenChange={setIsLogDetailsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
            <DialogDescription>
              Full content and metadata for the sent notification.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Timestamp</p>
                  <p className="text-sm">{format(new Date(selectedLog.created_at), "PPP p")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Admin</p>
                  <p className="text-sm font-medium">
                    {selectedLog.admin.first_name} {selectedLog.admin.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedLog.admin.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Target Type</p>
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {selectedLog.target_type.replace("_", " ")}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Type</p>
                  <p className="text-sm font-medium">
                    {selectedLog.notification_type?.name || selectedLog.notification_type_id}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Recipients</p>
                  <p className="text-sm font-medium">{selectedLog.recipient_count} users</p>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">Title</p>
                <p className="text-sm font-semibold text-slate-900">{selectedLog.title}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Message</p>
                <div className="rounded-xl bg-muted/50 p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {selectedLog.message}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">IP Address</p>
                  <p className="text-sm font-mono">{selectedLog.ip_address || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Device</p>
                  <p className="text-sm font-medium">{selectedLog.device_info || "—"}</p>
                  <p className="text-[10px] text-muted-foreground break-all leading-normal opacity-60">
                    {selectedLog.user_agent}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsLogDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
