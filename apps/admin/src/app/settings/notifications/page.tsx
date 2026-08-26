"use client";

import { useState } from "react";
import { useAdminNotifications } from "@cashsouk/config";
import { usePermissions } from "../../../hooks/use-permissions";
import type {
  AdminNotificationType,
  AdminNotificationGroup,
  AdminNotificationLog,
  AdminSeedTypesResponse,
  NotificationLogSource,
} from "@cashsouk/types";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ListToolbar,
  ListToolbarFilterTrigger,
  type FilterChip,
} from "@cashsouk/ui";
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
  RotateCcw,
} from "lucide-react";
import { EyeIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Skeleton } from "../../../components/ui/skeleton";
import { RequirePermission } from "../../../components/require-permission";
import { AdminPageHeader } from "../../../components/admin-page-header";
import { AuditDetailDrawer } from "@/components/audit/audit-detail-drawer";
import { notificationLogToAuditDetail } from "@/components/audit/audit-adapters";
import { formatAuditDateTime } from "@/components/audit/audit-presentation";
import { buildAuditCsv, downloadAuditCsv } from "@/components/audit/audit-csv";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const TARGET_CONFIG: Record<string, { label: string; color: string }> = {
  ALL_USERS: { label: "All Users", color: "bg-blue-500" },
  INVESTORS: { label: "Investors", color: "bg-blue-500" },
  ISSUERS: { label: "Issuers", color: "bg-purple-500" },
  SPECIFIC_USERS: { label: "Specific Users", color: "bg-emerald-500" },
  GROUP: { label: "Group", color: "bg-orange-500" },
};

const LOG_TARGET_OPTIONS = [
  { value: "ALL_USERS", label: "All Users" },
  { value: "INVESTORS", label: "Investors" },
  { value: "ISSUERS", label: "Issuers" },
  { value: "SPECIFIC_USERS", label: "Specific Users" },
  { value: "GROUP", label: "Group" },
] as const;

const COLOR_MAP: Record<string, string> = {
  "bg-blue-500": "rgb(59 130 246)",
  "bg-purple-500": "rgb(168 85 247)",
  "bg-emerald-500": "rgb(16 185 129)",
  "bg-orange-500": "rgb(249 115 22)",
  "bg-gray-500": "rgb(107 114 128)",
};

function NotificationLogsTableSkeleton() {
  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-sm font-semibold">Timestamp</TableHead>
            <TableHead className="text-sm font-semibold">Source</TableHead>
            <TableHead className="text-sm font-semibold">Target</TableHead>
            <TableHead className="text-sm font-semibold">Type</TableHead>
            <TableHead className="text-sm font-semibold">Message</TableHead>
            <TableHead className="text-sm font-semibold" title="Attempted recipients">
              Recipients
            </TableHead>
            <TableHead
              className="text-sm font-semibold"
              title="Selected channel deliveries, not confirmed receipt"
            >
              Delivery
            </TableHead>
            <TableHead className="text-sm font-semibold">IP Address</TableHead>
            <TableHead className="text-sm font-semibold">Device</TableHead>
            <TableHead className="text-sm font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton className="h-5 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-56" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-8 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function getTargetBadge(targetType: string) {
  const config = TARGET_CONFIG[targetType] || {
    label: targetType.replace("_", " "),
    color: "bg-gray-500",
  };
  const cssColor = COLOR_MAP[config.color] || "rgb(107 114 128)";

  return (
    <Badge
      variant="outline"
      className="text-xs font-medium px-2 py-0.5 flex items-center gap-1.5 w-fit whitespace-nowrap"
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

function LogSourceCell({ log }: { log: AdminNotificationLog }) {
  if (log.source === "SYSTEM" || !log.admin) {
    return (
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-ui font-medium">System</span>
        <span className="truncate text-meta text-muted-foreground">Automated delivery</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      <span
        className="truncate text-ui font-medium"
        title={`${log.admin.first_name} ${log.admin.last_name}`}
      >
        {log.admin.first_name} {log.admin.last_name}
      </span>
      <span className="truncate text-meta text-muted-foreground">
        Custom message · {log.admin.email}
      </span>
    </div>
  );
}

function LogDeliveryCell({
  platformCount,
  emailCount,
}: {
  platformCount: number;
  emailCount: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="whitespace-nowrap text-meta text-muted-foreground">
        Platform {platformCount}
      </span>
      <span className="whitespace-nowrap text-meta text-muted-foreground">Email {emailCount}</span>
    </div>
  );
}

export default function NotificationsAdminPage() {
  const { can } = usePermissions();
  const canManage = can("notifications.manage");
  const { getAccessToken } = useAuthToken();
  const [page, setPage] = useState(1);
  const [logSearchQuery, setLogSearchQuery] = useState<string>("");
  const [logTypeFilter, setLogTypeFilter] = useState<string>("all");
  const [logTargetFilter, setLogTargetFilter] = useState<string>("all");
  const [logSourceFilter, setLogSourceFilter] = useState<"all" | NotificationLogSource>("all");
  const [configPortalFilter, setConfigPortalFilter] = useState<"INVESTOR" | "ISSUER" | "BOTH">(
    "ISSUER"
  );
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
    seedTypes,
    isSeeding,
  } = useAdminNotifications({
    limit,
    offset: (page - 1) * limit,
    search: logSearchQuery || undefined,
    type: logTypeFilter !== "all" ? logTypeFilter : undefined,
    target: logTargetFilter !== "all" ? logTargetFilter : undefined,
    source: logSourceFilter !== "all" ? logSourceFilter : undefined,
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

  // Log View State
  const [selectedLog, setSelectedLog] = useState<AdminNotificationLog | null>(null);
  const [isLogDetailsOpen, setIsLogDetailsOpen] = useState(false);
  const [exportingLogs, setExportingLogs] = useState(false);
  const [isResetDefaultsOpen, setIsResetDefaultsOpen] = useState(false);
  const [isSendConfirmOpen, setIsSendConfirmOpen] = useState(false);

  const getPortalTargetsLabel = (targets: string[]) => {
    if (targets.includes("INVESTOR") && targets.includes("ISSUER")) return "Investor + Issuer";
    if (targets.includes("INVESTOR")) return "Investor";
    if (targets.includes("ISSUER")) return "Issuer";
    return "Unscoped";
  };

  const selectedTargetPortal =
    targetType === "INVESTORS" ? "INVESTOR" : targetType === "ISSUERS" ? "ISSUER" : null;

  const handleTogglePlatform = (typeId: string, enabled: boolean) => {
    updateType({ id: typeId, data: { enabled_platform: enabled } });
  };

  const handleToggleEmail = (typeId: string, enabled: boolean) => {
    updateType({ id: typeId, data: { enabled_email: enabled } });
  };

  const selectedTypeName =
    types.find((type: AdminNotificationType) => type.id === selectedType)?.name || "Custom";
  const selectedGroup = groups.find(
    (group: AdminNotificationGroup) => group.id === selectedGroupId
  );
  const specificUserCount = userIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean).length;
  const sendAudienceLabel =
    targetType === "SPECIFIC_USERS"
      ? `${specificUserCount} specific user${specificUserCount === 1 ? "" : "s"}`
      : targetType === "GROUP"
        ? selectedGroup
          ? `${selectedGroup.name} (${selectedGroup.user_ids.length} users)`
          : "Saved group"
        : (TARGET_CONFIG[targetType]?.label ?? targetType);
  const sendChannelLabel = [sendToPlatform ? "Platform" : null, sendToEmail ? "Email" : null]
    .filter(Boolean)
    .join(" and ");

  const handleExportNotificationLogs = async () => {
    setExportingLogs(true);
    try {
      const apiClient = createApiClient(undefined, getAccessToken);
      const pageSize = 100;
      const all: AdminNotificationLog[] = [];
      let offset = 0;
      while (true) {
        const response = await apiClient.getAdminNotificationLogs({
          limit: pageSize,
          offset,
          search: logSearchQuery || undefined,
          type: logTypeFilter !== "all" ? logTypeFilter : undefined,
          target: logTargetFilter !== "all" ? logTargetFilter : undefined,
          source: logSourceFilter !== "all" ? logSourceFilter : undefined,
        });
        if ("error" in response) throw new Error(response.error.message);
        all.push(...response.data.items);
        if (all.length >= response.data.pagination.total || response.data.items.length === 0) break;
        offset += pageSize;
      }
      const csv = buildAuditCsv(
        all.map((log) => ({
          timestamp: log.created_at,
          event: log.notification_type?.name || log.notification_type_id,
          eventType: log.notification_type_id,
          actor: log.admin ? `${log.admin.first_name} ${log.admin.last_name}` : "System",
          actorType: log.source === "SYSTEM" || !log.admin ? "SYSTEM" : "ADMIN",
          actorEmail: log.admin?.email,
          source: log.source,
          targetType: log.target_type,
          targetReference: log.target_group_id,
          reason: log.message,
          metadata: log.metadata,
          extra: {
            "Notification Type": log.notification_type?.name || log.notification_type_id,
            "Platform Delivered": log.delivered_platform_count,
            "Email Delivered": log.delivered_email_count,
            "Idempotency Key": log.idempotency_key,
            Title: log.title,
          },
        })),
        ["Notification Type", "Platform Delivered", "Email Delivered", "Idempotency Key", "Title"]
      );
      downloadAuditCsv(`notification-logs-${new Date().toISOString().split("T")[0]}.csv`, csv);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export notification logs");
    } finally {
      setExportingLogs(false);
    }
  };

  const hasLogFilters =
    Boolean(logSearchQuery) ||
    logTypeFilter !== "all" ||
    logTargetFilter !== "all" ||
    logSourceFilter !== "all";

  const logFilterChips: FilterChip[] = [];
  if (logTypeFilter !== "all") {
    logFilterChips.push({
      id: "type",
      label: `Type: ${types.find((type: AdminNotificationType) => type.id === logTypeFilter)?.name ?? logTypeFilter}`,
      onRemove: () => {
        setLogTypeFilter("all");
        setPage(1);
      },
    });
  }
  if (logTargetFilter !== "all") {
    logFilterChips.push({
      id: "target",
      label: `Audience: ${LOG_TARGET_OPTIONS.find((option) => option.value === logTargetFilter)?.label ?? logTargetFilter}`,
      onRemove: () => {
        setLogTargetFilter("all");
        setPage(1);
      },
    });
  }
  if (logSourceFilter !== "all") {
    logFilterChips.push({
      id: "source",
      label: `Source: ${logSourceFilter === "SYSTEM" ? "System" : "Admin"}`,
      onRemove: () => {
        setLogSourceFilter("all");
        setPage(1);
      },
    });
  }

  const clearLogFilters = () => {
    setLogSearchQuery("");
    setLogTypeFilter("all");
    setLogTargetFilter("all");
    setLogSourceFilter("all");
    setPage(1);
  };

  const openLogDetails = (log: AdminNotificationLog) => {
    setSelectedLog(log);
    setIsLogDetailsOpen(true);
  };

  const handleSendNotification = (e: React.FormEvent) => {
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

    setIsSendConfirmOpen(true);
  };

  const confirmSendNotification = () => {
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
          void refetchLogs();
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
          <AdminPageHeader
            title="Notifications"
            description="Manage system-wide notification settings and send custom alerts."
          />

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
                        onClick={() => setIsResetDefaultsOpen(true)}
                        disabled={isSeeding || !canManage}
                        title={
                          !canManage
                            ? "You do not have permission to perform this action."
                            : undefined
                        }
                      >
                        <RotateCcw className={`h-4 w-4 ${isSeeding ? "animate-spin" : ""}`} />
                        {isSeeding ? "Resetting..." : "Reset to default"}
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
                          .map((type: AdminNotificationType) => {
                            const isAuthType = type.category === "AUTHENTICATION";
                            const authHintId = `auth-channel-hint-${type.id}`;
                            const permissionTitle = !canManage
                              ? "You do not have permission to perform this action."
                              : undefined;
                            return (
                              <div
                                key={type.id}
                                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{type.name}</span>
                                    {isAuthType ? (
                                      <span
                                        id={authHintId}
                                        className="text-meta text-muted-foreground"
                                      >
                                        Always on for security
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {type.description}
                                  </p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-meta text-muted-foreground">
                                      Platform
                                    </span>
                                    <Switch
                                      checked={isAuthType ? true : type.enabled_platform}
                                      onCheckedChange={
                                        isAuthType
                                          ? undefined
                                          : (checked) => handleTogglePlatform(type.id, checked)
                                      }
                                      disabled={isAuthType || !canManage}
                                      aria-describedby={isAuthType ? authHintId : undefined}
                                      title={
                                        isAuthType ? "Always on for security" : permissionTitle
                                      }
                                    />
                                  </div>
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-meta text-muted-foreground">Email</span>
                                    <Switch
                                      checked={isAuthType ? true : type.enabled_email}
                                      onCheckedChange={
                                        isAuthType
                                          ? undefined
                                          : (checked) => handleToggleEmail(type.id, checked)
                                      }
                                      disabled={isAuthType || !canManage}
                                      aria-describedby={isAuthType ? authHintId : undefined}
                                      title={
                                        isAuthType ? "Always on for security" : permissionTitle
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
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
                        <Select
                          value={targetType}
                          onValueChange={(value) => {
                            setTargetType(value);
                            const portal =
                              value === "INVESTORS"
                                ? "INVESTOR"
                                : value === "ISSUERS"
                                  ? "ISSUER"
                                  : null;
                            if (!portal || !selectedType) return;
                            const selected = types.find(
                              (type: AdminNotificationType) => type.id === selectedType
                            );
                            if (selected && !selected.portal_targets?.includes(portal)) {
                              setSelectedType("");
                            }
                          }}
                        >
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
                        <p className="text-meta text-muted-foreground">
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
                              className={`text-meta px-2 py-1 rounded-md transition-colors ${
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
                              className={`text-meta px-2 py-1 rounded-md transition-colors ${
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
                        <p className="text-meta text-muted-foreground">
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
                          <Switch
                            id="send-email"
                            checked={sendToEmail}
                            onCheckedChange={setSendToEmail}
                          />
                          <Label htmlFor="send-email" className="cursor-pointer">
                            Send to Email
                          </Label>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSending || !canManage}
                        title={
                          !canManage
                            ? "You do not have permission to perform this action."
                            : undefined
                        }
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
                      title={
                        !canManage
                          ? "You do not have permission to perform this action."
                          : undefined
                      }
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
                                  <Badge variant="secondary" className="text-meta">
                                    {group.user_ids.length} users
                                  </Badge>
                                </div>
                                {group.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {group.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditGroup(group)}
                                  disabled={!canManage}
                                  title={
                                    !canManage
                                      ? "You do not have permission to perform this action."
                                      : undefined
                                  }
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  disabled={!canManage}
                                  title={
                                    !canManage
                                      ? "You do not have permission to perform this action."
                                      : undefined
                                  }
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
              <p className="text-ui text-muted-foreground">
                Each row is one send. Custom messages from Custom & Groups appear as a single Admin
                row with the audience size — not one line per recipient. Delivery counts are what
                actually happened, not the channel switches on Configuration.
              </p>
              <ListToolbar
                searchValue={logSearchQuery}
                onSearchChange={(value) => {
                  setLogSearchQuery(value);
                  setPage(1);
                }}
                searchPlaceholder="Search title, message, type, or admin..."
                appliedFilters={logFilterChips}
                onClearFilters={hasLogFilters ? clearLogFilters : undefined}
                onReload={() => refetchLogs()}
                isLoading={isLoadingLogs}
                countLabel={`${paginationLogs?.total || 0} ${paginationLogs?.total === 1 ? "log" : "logs"}`}
                filterGroups={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <ListToolbarFilterTrigger
                        label="Filters"
                        count={
                          [logTypeFilter !== "all", logTargetFilter !== "all", logSourceFilter !== "all"].filter(
                            Boolean
                          ).length
                        }
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Notification type</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={logTypeFilter}
                        onValueChange={(value) => {
                          setLogTypeFilter(value);
                          setPage(1);
                        }}
                      >
                        <DropdownMenuRadioItem value="all">All types</DropdownMenuRadioItem>
                        {types.map((type: AdminNotificationType) => (
                          <DropdownMenuRadioItem key={type.id} value={type.id}>
                            {type.name}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Audience</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={logTargetFilter}
                        onValueChange={(value) => {
                          setLogTargetFilter(value);
                          setPage(1);
                        }}
                      >
                        <DropdownMenuRadioItem value="all">All audiences</DropdownMenuRadioItem>
                        {LOG_TARGET_OPTIONS.map((option) => (
                          <DropdownMenuRadioItem key={option.value} value={option.value}>
                            {option.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Source</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={logSourceFilter}
                        onValueChange={(value) => {
                          setLogSourceFilter(value as "all" | NotificationLogSource);
                          setPage(1);
                        }}
                      >
                        <DropdownMenuRadioItem value="all">All sources</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="ADMIN">Admin</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="SYSTEM">System</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              >
                <Button
                  variant="outline"
                  onClick={() => void handleExportNotificationLogs()}
                  disabled={exportingLogs || (paginationLogs?.total ?? 0) === 0}
                  className="h-11 gap-2 rounded-xl bg-card"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  {exportingLogs ? "Exporting..." : "Export CSV"}
                </Button>
              </ListToolbar>

              <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0">
                  {isLoadingLogs ? (
                    <NotificationLogsTableSkeleton />
                  ) : logs.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground bg-white border rounded-2xl">
                      <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">No logs found</p>
                      <p className="text-sm">
                        Try adjusting your search or send a new notification.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-sm font-semibold">Timestamp</TableHead>
                              <TableHead className="text-sm font-semibold">Source</TableHead>
                              <TableHead className="text-sm font-semibold">Target</TableHead>
                              <TableHead className="text-sm font-semibold">Type</TableHead>
                              <TableHead className="text-sm font-semibold">Message</TableHead>
                              <TableHead
                                className="text-sm font-semibold"
                                title="Attempted recipients"
                              >
                                Recipients
                              </TableHead>
                              <TableHead
                                className="text-sm font-semibold"
                                title="Selected channel deliveries, not confirmed receipt"
                              >
                                Delivery
                              </TableHead>
                              <TableHead className="text-sm font-semibold">IP Address</TableHead>
                              <TableHead className="text-sm font-semibold">Device</TableHead>
                              <TableHead className="text-sm font-semibold">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {logs.map((log: AdminNotificationLog) => (
                              <TableRow
                                key={log.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => openLogDetails(log)}
                              >
                                <TableCell className="whitespace-nowrap text-ui text-muted-foreground">
                                  {formatAuditDateTime(log.created_at)}
                                </TableCell>
                                <TableCell>
                                  <LogSourceCell log={log} />
                                </TableCell>
                                <TableCell>{getTargetBadge(log.target_type)}</TableCell>
                                <TableCell>
                                  <div
                                    className="text-xs font-bold text-slate-700 whitespace-normal break-words"
                                    title={log.notification_type?.name}
                                  >
                                    {log.notification_type?.name || "Custom"}
                                  </div>
                                  {log.notification_type?.portal_targets?.length ? (
                                    <Badge variant="outline" className="mt-1 text-meta">
                                      {getPortalTargetsLabel(log.notification_type.portal_targets)}
                                    </Badge>
                                  ) : null}
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-[300px]">
                                    <div
                                      className="text-sm font-medium truncate mb-0.5"
                                      title={log.title}
                                    >
                                      {log.title}
                                    </div>
                                    <div className="text-xs text-muted-foreground line-clamp-1">
                                      {log.message}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div
                                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-normal text-xs"
                                    title="Attempted recipients"
                                  >
                                    <Users className="h-3 w-3" />
                                    <span className="sr-only">Attempted recipients: </span>
                                    {log.recipient_count}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <LogDeliveryCell
                                    platformCount={log.delivered_platform_count}
                                    emailCount={log.delivered_email_count}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                  {log.ip_address || "—"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {log.device_info ? (
                                    <span
                                      title={log.user_agent ?? undefined}
                                      className="line-clamp-2 leading-snug"
                                    >
                                      {log.device_info}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openLogDetails(log);
                                    }}
                                  >
                                    <EyeIcon className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination for Logs */}
                      {paginationLogs && paginationLogs.pages > 1 && (
                        <div className="flex items-center justify-between border-t px-6 py-4">
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
                  <p className="text-meta text-muted-foreground">
                    Enter the internal user IDs of the users you want to include in this group.
                  </p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetGroupForm}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreatingGroup || !canManage}
                    title={
                      !canManage ? "You do not have permission to perform this action." : undefined
                    }
                  >
                    {editingGroupId ? "Update Group" : "Create Group"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AuditDetailDrawer
            open={isLogDetailsOpen}
            onOpenChange={setIsLogDetailsOpen}
            record={selectedLog ? notificationLogToAuditDetail(selectedLog) : null}
          />

          <AlertDialog open={isSendConfirmOpen} onOpenChange={setIsSendConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send this notification?</AlertDialogTitle>
                <AlertDialogDescription>
                  This sends one custom message to {sendAudienceLabel} via{" "}
                  {sendChannelLabel || "no channel"}. Recipients cannot undo it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
                <div className="space-y-1">
                  <p className="text-meta uppercase text-muted-foreground">Type</p>
                  <p className="text-ui font-medium">{selectedTypeName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-meta uppercase text-muted-foreground">Title</p>
                  <p className="text-ui font-medium">{title}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-meta uppercase text-muted-foreground">Message</p>
                  <p className="text-ui whitespace-pre-wrap line-clamp-4">{message}</p>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isSending || !canManage}
                  onClick={confirmSendNotification}
                >
                  {isSending ? "Sending..." : "Send notification"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={isResetDefaultsOpen} onOpenChange={setIsResetDefaultsOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset notifications to default?</AlertDialogTitle>
                <AlertDialogDescription>
                  This turns Platform and Email back on for every notification type, and adds any
                  types that are missing. Password-change alerts stay on and cannot be turned off.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    seedTypes(undefined, {
                      onSuccess: (response: AdminSeedTypesResponse) => {
                        const added = response.added || 0;
                        const reset = response.reset || 0;
                        if (added > 0) {
                          toast.success(
                            `Restored defaults and added ${added} notification type${added === 1 ? "" : "s"}.`
                          );
                        } else {
                          toast.success(
                            `Restored defaults for ${reset} notification type${reset === 1 ? "" : "s"}.`
                          );
                        }
                      },
                      onError: (error) =>
                        toast.error(error.message || "Failed to reset notification types"),
                    });
                  }}
                >
                  Reset to default
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </RequirePermission>
  );
}
