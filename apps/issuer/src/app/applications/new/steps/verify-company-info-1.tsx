"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PencilIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import type { StepComponentProps } from "../step-components";
import { EditAddressDialog } from "./edit-address-dialog";
import { EditBankingDialog } from "./edit-banking-dialog";

// ============================================================================
// FUTURE API INTEGRATION - Add these imports when connecting to API:
// ============================================================================
// import { useOrganization } from "@cashsouk/config";
// import { Skeleton } from "@/components/ui/skeleton";
// import { toast } from "sonner";
// ============================================================================

/**
 * Verify Company Details Step Component
 * 
 * This component displays company information from the active organization.
 * The data comes from RegTank corporate onboarding and is read-only.
 * 
 * Step ID: "verify-company-info-1" or "company-info-1"
 * File name: verify-company-info-1.tsx
 */
export default function VerifyCompanyInfoStep({
  applicationId,
  onDataChange,
}: StepComponentProps) {
  // ============================================================================
  // SECTION 1: DATA FETCHING
  // ============================================================================
  // CURRENT: Using static dummy data (hardcoded values)
  // FUTURE: Replace this entire section with useOrganization() hook
  // ============================================================================
  
  // STATIC DUMMY DATA - Replace with API calls later
  const [companyData] = React.useState({
    // Company info (read-only from onboarding)
    companyName: "ABC Sdn Bhd",
    entityType: "Private Limited Company (Sdn. Bhd.)",
    registrationNumber: "201612345678",
    industry: "Textile",
    natureOfBusiness: "Private",
    numberOfEmployees: "50",
    
    // Addresses (editable)
    businessAddress: "24 Jalan Kiara, Kuala Lumpur 50480 Wilayah Persekutuan Kuala Lumpur, Malaysia",
    registeredAddress: "24 Jalan Kiara, Kuala Lumpur 50480 Wilayah Persekutuan Kuala Lumpur, Malaysia",
    
    // Directors (read-only from onboarding)
    directors: [
      { name: "Nur Hidayah", ownership: "30% ownership", kycStatus: "verified" as const },
      { name: "Nazrin", ownership: "45% ownership", kycStatus: "verified" as const },
      { name: "Riaz Ali", ownership: "25% ownership", kycStatus: "verified" as const },
    ],
    
    // Banking (editable)
    bankName: "Maybank",
    bankAccountNumber: "1234 1234 1234 1234",
  });

  // ============================================================================
  // FUTURE API INTEGRATION - Replace the useState above with this:
  // ============================================================================
  // // Step 1: Get organization data from API
  // const { activeOrganization, isLoading: isOrgLoading } = useOrganization();
  //
  // // Step 2: Extract and transform data from organization
  // const companyData = React.useMemo(() => {
  //   if (!activeOrganization || activeOrganization.type !== "COMPANY") {
  //     return null;
  //   }
  //   // ... extract data from activeOrganization
  //   // See HOW_TO_CONNECT_API.md for full example
  // }, [activeOrganization]);
  //
  // // Step 3: Add loading state check (before the return statement)
  // if (isOrgLoading) {
  //   return <Skeleton />;
  // }
  //
  // // Step 4: Add empty state check (before the return statement)
  // if (!companyData) {
  //   return <p>Company information not available</p>;
  // }
  // ============================================================================

  // ============================================================================
  // SECTION 2: UI STATE (Edit Dialogs)
  // ============================================================================
  // These control when the edit dialogs are open/closed
  // No changes needed here when connecting to API
  // ============================================================================
  
  // Edit dialog states
  const [isEditAddressOpen, setIsEditAddressOpen] = React.useState(false);
  const [isEditBankingOpen, setIsEditBankingOpen] = React.useState(false);

  // ============================================================================
  // SECTION 3: SAVE DATA TO APPLICATION
  // ============================================================================
  // This sends the company data to the parent component (application wizard)
  // No changes needed here when connecting to API
  // ============================================================================
  
  // Save company info to application when component mounts
  React.useEffect(() => {
    if (companyData && applicationId && onDataChange) {
      onDataChange({
        companyInfo: companyData,
      });
    }
  }, [companyData, applicationId, onDataChange]);

  // ============================================================================
  // SECTION 4: RENDER UI
  // ============================================================================
  // This section displays all the cards with company information
  // No changes needed here when connecting to API (just uses companyData)
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Company Info Section - Read-only (from onboarding) */}
      <Card>
        <CardHeader>
          <CardTitle>Company info</CardTitle>
          <CardDescription>Information from corporate onboarding (read-only)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Company name</p>
              <p className="text-sm font-medium mt-1">{companyData.companyName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Type of entity</p>
              <p className="text-sm font-medium mt-1">{companyData.entityType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">SSM no</p>
              <p className="text-sm font-medium mt-1">{companyData.registrationNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Industry</p>
              <p className="text-sm font-medium mt-1">{companyData.industry}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nature of business</p>
              <p className="text-sm font-medium mt-1">{companyData.natureOfBusiness}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Number of employees</p>
              <p className="text-sm font-medium mt-1">{companyData.numberOfEmployees}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Section - Editable */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Address</CardTitle>
              <CardDescription>Can be edited</CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsEditAddressOpen(true)}
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Business address</p>
            <p className="text-sm font-medium mt-1">{companyData.businessAddress}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground">Registered address</p>
            <p className="text-sm font-medium mt-1">{companyData.registeredAddress}</p>
          </div>
        </CardContent>
      </Card>

      {/* Director & Shareholders Section - Read-only (from onboarding) */}
      <Card>
        <CardHeader>
          <CardTitle>Director & Shareholders</CardTitle>
          <CardDescription>Information from corporate onboarding (read-only)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {companyData.directors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No directors found</p>
            ) : (
              companyData.directors.map((director, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Director: {director.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{director.ownership} ownership</p>
                  </div>
                  {director.kycStatus === "verified" && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                      KYC
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Banking Details Section - Editable (from onboarding but can be edited) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Banking details</CardTitle>
              <CardDescription>Information from onboarding (can be edited)</CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsEditBankingOpen(true)}
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Bank name</p>
            <p className="text-sm font-medium mt-1">{companyData.bankName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Bank account number</p>
            <p className="text-sm font-medium mt-1">{companyData.bankAccountNumber}</p>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================================
          SECTION 5: EDIT DIALOGS
          ============================================================================
          These dialogs let users edit addresses and banking details
          FUTURE: Update onSave callbacks to call API endpoints
          ============================================================================ */}
      
      <EditAddressDialog
        open={isEditAddressOpen}
        onOpenChange={setIsEditAddressOpen}
        businessAddress={companyData.businessAddress}
        registeredAddress={companyData.registeredAddress}
        onSave={(businessAddress, registeredAddress) => {
          // ============================================================================
          // CURRENT: Just logs to console (static mode)
          // FUTURE: Replace with API call to save addresses
          // ============================================================================
          console.log("Save addresses:", { businessAddress, registeredAddress });
          
          // FUTURE API INTEGRATION - Replace console.log with:
          // try {
          //   await updateOrganizationAddresses({ businessAddress, registeredAddress });
          //   toast.success("Addresses updated successfully");
          //   setIsEditAddressOpen(false);
          // } catch (error) {
          //   toast.error("Failed to update addresses");
          //   console.error(error);
          // }
          
          setIsEditAddressOpen(false);
        }}
      />

      <EditBankingDialog
        open={isEditBankingOpen}
        onOpenChange={setIsEditBankingOpen}
        bankName={companyData.bankName}
        bankAccountNumber={companyData.bankAccountNumber}
        onSave={(bankName: string, bankAccountNumber: string) => {
          // ============================================================================
          // CURRENT: Just logs to console (static mode)
          // FUTURE: Replace with API call to save banking details
          // ============================================================================
          console.log("Save banking:", { bankName, bankAccountNumber });
          
          // FUTURE API INTEGRATION - Replace console.log with:
          // try {
          //   await updateOrganizationBanking({ bankName, bankAccountNumber });
          //   toast.success("Banking details updated successfully");
          //   setIsEditBankingOpen(false);
          // } catch (error) {
          //   toast.error("Failed to update banking details");
          //   console.error(error);
          // }
          
          setIsEditBankingOpen(false);
        }}
      />
    </div>
  );
}
