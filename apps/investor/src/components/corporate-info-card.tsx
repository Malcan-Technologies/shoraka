"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PencilIcon, XMarkIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { useCorporateInfo } from "../hooks/use-corporate-info";
import { Skeleton } from "@/components/ui/skeleton";

interface CorporateInfoCardProps {
  organizationId: string;
}

export function CorporateInfoCard({ organizationId }: CorporateInfoCardProps) {
  const { corporateInfo, isLoading, update, isUpdating } = useCorporateInfo(organizationId);
  const [isEditing, setIsEditing] = React.useState(false);

  // Form state
  const [tinNumber, setTinNumber] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [entityType, setEntityType] = React.useState("");
  const [businessName, setBusinessName] = React.useState("");
  const [numberOfEmployees, setNumberOfEmployees] = React.useState("");
  const [ssmRegisterNumber, setSsmRegisterNumber] = React.useState("");

  // Initialize form values
  React.useEffect(() => {
    if (corporateInfo) {
      setTinNumber(corporateInfo.basicInfo?.tinNumber || "");
      setIndustry(corporateInfo.basicInfo?.industry || "");
      setEntityType(corporateInfo.basicInfo?.entityType || "");
      setBusinessName(corporateInfo.basicInfo?.businessName || "");
      setNumberOfEmployees(corporateInfo.basicInfo?.numberOfEmployees?.toString() || "");
      setSsmRegisterNumber(corporateInfo.basicInfo?.ssmRegisterNumber || "");
    }
  }, [corporateInfo]);

  const handleSave = () => {
    // Only save editable fields (Industry and Number of Employees)
    update({
      tinNumber: corporateInfo?.basicInfo?.tinNumber || null, // Keep existing value
      industry: industry || null,
      entityType: corporateInfo?.basicInfo?.entityType || null, // Keep existing value
      businessName: corporateInfo?.basicInfo?.businessName || null, // Keep existing value
      numberOfEmployees: numberOfEmployees ? parseInt(numberOfEmployees, 10) : null,
      ssmRegisterNumber: corporateInfo?.basicInfo?.ssmRegisterNumber || null, // Keep existing value
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (corporateInfo) {
      setTinNumber(corporateInfo.basicInfo?.tinNumber || "");
      setIndustry(corporateInfo.basicInfo?.industry || "");
      setEntityType(corporateInfo.basicInfo?.entityType || "");
      setBusinessName(corporateInfo.basicInfo?.businessName || "");
      setNumberOfEmployees(corporateInfo.basicInfo?.numberOfEmployees?.toString() || "");
      setSsmRegisterNumber(corporateInfo.basicInfo?.ssmRegisterNumber || "");
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="p-6 border-b">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-3">
          <BuildingOffice2Icon className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Company Info</h2>
            <p className="text-sm text-muted-foreground">Business and registration details</p>
          </div>
        </div>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2 rounded-xl">
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
        )}
      </div>
      <div className="p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-muted-foreground">TIN Number</Label>
            <Input
              value={tinNumber}
              disabled={true}
              className="bg-muted cursor-not-allowed opacity-60"
            />
            <p className="text-xs text-muted-foreground">This field cannot be edited</p>
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={!isEditing}
              className={!isEditing ? "bg-muted" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Entity Type</Label>
            <Input
              value={entityType}
              disabled={true}
              className="bg-muted cursor-not-allowed opacity-60"
            />
            <p className="text-xs text-muted-foreground">This field cannot be edited</p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Business Name</Label>
            <Input
              value={businessName}
              disabled={true}
              className="bg-muted cursor-not-allowed opacity-60"
            />
            <p className="text-xs text-muted-foreground">This field cannot be edited</p>
          </div>
          <div className="space-y-2">
            <Label>Number of Employees</Label>
            <Input
              type="number"
              value={numberOfEmployees}
              onChange={(e) => setNumberOfEmployees(e.target.value)}
              disabled={!isEditing}
              className={!isEditing ? "bg-muted" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">SSM Register Number</Label>
            <Input
              value={ssmRegisterNumber}
              disabled={true}
              className="bg-muted cursor-not-allowed opacity-60"
            />
            <p className="text-xs text-muted-foreground">This field cannot be edited</p>
          </div>
        </div>
        {isEditing && (
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleCancel} disabled={isUpdating} className="gap-2 rounded-xl">
              <XMarkIcon className="h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isUpdating} className="gap-2 rounded-xl">
              {isUpdating ? "Saving..." : "Save changes"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
