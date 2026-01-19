"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PencilIcon, XMarkIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { useCorporateInfo, type Address } from "../hooks/use-corporate-info";
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
  
  // Business address state
  const [businessLine1, setBusinessLine1] = React.useState("");
  const [businessLine2, setBusinessLine2] = React.useState("");
  const [businessCity, setBusinessCity] = React.useState("");
  const [businessPostalCode, setBusinessPostalCode] = React.useState("");
  const [businessState, setBusinessState] = React.useState("");
  const [businessCountry, setBusinessCountry] = React.useState("");
  
  // Registered address state
  const [registeredLine1, setRegisteredLine1] = React.useState("");
  const [registeredLine2, setRegisteredLine2] = React.useState("");
  const [registeredCity, setRegisteredCity] = React.useState("");
  const [registeredPostalCode, setRegisteredPostalCode] = React.useState("");
  const [registeredState, setRegisteredState] = React.useState("");
  const [registeredCountry, setRegisteredCountry] = React.useState("");
  
  // Checkbox for same as business address
  const [sameAsBusinessAddress, setSameAsBusinessAddress] = React.useState(false);

  // Helper function to format address for display
  const formatAddressDisplay = (address?: Address | null): string => {
    if (!address) return "-";
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.postalCode,
      address.state,
      address.country,
    ].filter((part) => part && part.trim() !== "");
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  // Initialize form values
  React.useEffect(() => {
    if (corporateInfo) {
      setTinNumber(corporateInfo.basicInfo?.tinNumber || "");
      setIndustry(corporateInfo.basicInfo?.industry || "");
      setEntityType(corporateInfo.basicInfo?.entityType || "");
      setBusinessName(corporateInfo.basicInfo?.businessName || "");
      setNumberOfEmployees(corporateInfo.basicInfo?.numberOfEmployees?.toString() || "");
      setSsmRegisterNumber(corporateInfo.basicInfo?.ssmRegisterNumber || "");
      
      // Initialize business address
      const business = corporateInfo.addresses?.business;
      setBusinessLine1(business?.line1 || "");
      setBusinessLine2(business?.line2 || "");
      setBusinessCity(business?.city || "");
      setBusinessPostalCode(business?.postalCode || "");
      setBusinessState(business?.state || "");
      setBusinessCountry(business?.country || "");
      
      // Initialize registered address
      const registered = corporateInfo.addresses?.registered;
      setRegisteredLine1(registered?.line1 || "");
      setRegisteredLine2(registered?.line2 || "");
      setRegisteredCity(registered?.city || "");
      setRegisteredPostalCode(registered?.postalCode || "");
      setRegisteredState(registered?.state || "");
      setRegisteredCountry(registered?.country || "");
    }
  }, [corporateInfo]);

  const handleSave = () => {
    const businessAddress: Address = {
      line1: businessLine1 || null,
      line2: businessLine2 || null,
      city: businessCity || null,
      postalCode: businessPostalCode || null,
      state: businessState || null,
      country: businessCountry || null,
    };
    
    const registeredAddress: Address = sameAsBusinessAddress
      ? businessAddress
      : {
          line1: registeredLine1 || null,
          line2: registeredLine2 || null,
          city: registeredCity || null,
          postalCode: registeredPostalCode || null,
          state: registeredState || null,
          country: registeredCountry || null,
        };
    
    update({
      tinNumber: tinNumber || null,
      industry: industry || null,
      entityType: entityType || null,
      businessName: businessName || null,
      numberOfEmployees: numberOfEmployees ? parseInt(numberOfEmployees, 10) : null,
      ssmRegisterNumber: ssmRegisterNumber || null,
      businessAddress,
      registeredAddress,
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
      
      // Reset business address
      const business = corporateInfo.addresses?.business;
      setBusinessLine1(business?.line1 || "");
      setBusinessLine2(business?.line2 || "");
      setBusinessCity(business?.city || "");
      setBusinessPostalCode(business?.postalCode || "");
      setBusinessState(business?.state || "");
      setBusinessCountry(business?.country || "");
      
      // Reset registered address
      const registered = corporateInfo.addresses?.registered;
      setRegisteredLine1(registered?.line1 || "");
      setRegisteredLine2(registered?.line2 || "");
      setRegisteredCity(registered?.city || "");
      setRegisteredPostalCode(registered?.postalCode || "");
      setRegisteredState(registered?.state || "");
      setRegisteredCountry(registered?.country || "");
      
      setSameAsBusinessAddress(false);
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
            <Label>TIN Number</Label>
            <Input
              value={tinNumber}
              onChange={(e) => setTinNumber(e.target.value)}
              disabled={!isEditing}
              className={!isEditing ? "bg-muted" : ""}
            />
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
            <Label>Entity Type</Label>
            <Input
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              disabled={!isEditing}
              className={!isEditing ? "bg-muted" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              disabled={!isEditing}
              className={!isEditing ? "bg-muted" : ""}
            />
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
            <Label>SSM Register Number</Label>
            <Input
              value={ssmRegisterNumber}
              onChange={(e) => setSsmRegisterNumber(e.target.value)}
              disabled={!isEditing}
              className={!isEditing ? "bg-muted" : ""}
            />
          </div>
        </div>

        {/* Business Address Section */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-semibold">Business Address</h3>
          {!isEditing ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {formatAddressDisplay(corporateInfo?.addresses?.business)}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Address Line 1</Label>
                <Input
                  value={businessLine1}
                  onChange={(e) => setBusinessLine1(e.target.value)}
                  placeholder="Street address"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Address Line 2</Label>
                <Input
                  value={businessLine2}
                  onChange={(e) => setBusinessLine2(e.target.value)}
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={businessCity}
                  onChange={(e) => setBusinessCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label>Postal Code</Label>
                <Input
                  value={businessPostalCode}
                  onChange={(e) => setBusinessPostalCode(e.target.value)}
                  placeholder="Postal code"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={businessState}
                  onChange={(e) => setBusinessState(e.target.value)}
                  placeholder="State"
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={businessCountry}
                  onChange={(e) => setBusinessCountry(e.target.value)}
                  placeholder="Country"
                />
              </div>
            </div>
          )}
        </div>

        {/* Registered Address Section */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Registered Address</h3>
            {isEditing && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="sameAsBusinessAddress"
                  checked={sameAsBusinessAddress}
                  onCheckedChange={(checked) => setSameAsBusinessAddress(checked === true)}
                />
                <Label htmlFor="sameAsBusinessAddress" className="text-sm font-normal cursor-pointer">
                  Same as business address
                </Label>
              </div>
            )}
          </div>
          {!isEditing ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {formatAddressDisplay(corporateInfo?.addresses?.registered)}
              </p>
            </div>
          ) : (
            !sameAsBusinessAddress && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address Line 1</Label>
                  <Input
                    value={registeredLine1}
                    onChange={(e) => setRegisteredLine1(e.target.value)}
                    placeholder="Street address"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address Line 2</Label>
                  <Input
                    value={registeredLine2}
                    onChange={(e) => setRegisteredLine2(e.target.value)}
                    placeholder="Apartment, suite, etc. (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={registeredCity}
                    onChange={(e) => setRegisteredCity(e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postal Code</Label>
                  <Input
                    value={registeredPostalCode}
                    onChange={(e) => setRegisteredPostalCode(e.target.value)}
                    placeholder="Postal code"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={registeredState}
                    onChange={(e) => setRegisteredState(e.target.value)}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={registeredCountry}
                    onChange={(e) => setRegisteredCountry(e.target.value)}
                    placeholder="Country"
                  />
                </div>
              </div>
            )
          )}
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
