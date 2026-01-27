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
import { Send, Settings2, Users, Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";

export default function NotificationsAdminPage() {
  const { types, isLoadingTypes, updateType, sendNotification, isSending, groups, isLoadingGroups, createGroup, isCreatingGroup, updateGroup, deleteGroup } = useAdminNotifications();
  const [selectedType, setSelectedType] = useState<string>("");
  const [targetType, setTargetType] = useState<string>("ALL_USERS");
  const [userIds, setUserIds] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [linkPath, setLinkPath] = useState<string>("");

  // Group Management State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupUserIds, setGroupUserIds] = useState("");
  const [editingGroupId, setGroupEditingId] = useState<string | null>(null);

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

    const ids = userIds.split(",").map((id) => id.trim()).filter(Boolean);

    sendNotification(
      {
        targetType,
        userIds: targetType === "SPECIFIC_USERS" ? ids : undefined,
        groupId: targetType === "GROUP" ? selectedGroupId : undefined,
        typeId: selectedType,
        title,
        message,
        linkPath: linkPath || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Notifications sent successfully");
          setTitle("");
          setMessage("");
          setUserIds("");
          setLinkPath("");
          setSelectedGroupId("");
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

    const userIdsArray = groupUserIds.split(",").map(id => id.trim()).filter(Boolean);

    if (editingGroupId) {
      updateGroup({
        id: editingGroupId,
        data: { name: groupName, description: groupDescription, userIds: userIdsArray }
      }, {
        onSuccess: () => {
          toast.success("Group updated successfully");
          resetGroupForm();
        }
      });
    } else {
      createGroup({
        name: groupName,
        description: groupDescription,
        userIds: userIdsArray
      }, {
        onSuccess: () => {
          toast.success("Group created successfully");
          resetGroupForm();
        }
      });
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
            {isLoadingGroups ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
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
                  <div key={group.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditGroup(group)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                        if (confirm("Are you sure you want to delete this group?")) {
                          deleteGroup(group.id);
                        }
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
