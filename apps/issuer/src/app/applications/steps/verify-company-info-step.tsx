"use client";

import * as React from "react";
import { useOrganization, createApiClient, useAuthToken } from "@cashsouk/config";
import { useCorporateInfo } from "@/hooks/use-corporate-info";
import { useCorporateEntities } from "@/hooks/use-corporate-entities";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircleIcon, PencilIcon } from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

/**
 * VERIFY COMPANY INFO STEP
 * 
 * Read-only display of organization information.
 * User reviews their company details before submitting application.
 * 
 * Data Flow:
 * 1. Load organization data from database using hooks
 * 2. Display in read-only format
 * 3. Pass organization ID to parent for saving
 * 
 * Database format: { issuer_organization_id: "clx123" }
 */

interface VerifyCompanyInfoStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
}

/**
 * Helper function to get bank field value from bank details object
 */
function getBankField(bankDetails: any, fieldName: string): string {
  if (!bankDetails?.content) return "";
  const field = bankDetails.content.find((f: any) => f.fieldName === fieldName);
  return field?.fieldValue || "";
}

/**
 * Helper function to format address object into a single string
 */
function formatAddress(addr: any): string {
  if (!addr) return "—";
  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.postalCode,
    addr.state,
    addr.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

/**
 * Helper function to normalize name for deduplication
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const inputClassName = "bg-muted rounded-xl border border-border";
const labelClassName = "text-sm md:text-base leading-6 text-muted-foreground";
const sectionHeaderClassName = "text-base sm:text-lg md:text-xl font-semibold";
const gridClassName = "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-6 sm:gap-y-4 mt-4 pl-3 sm:pl-4 md:pl-6";
const sectionGridClassName = "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-6 sm:gap-y-4 mt-4 sm:mt-6 pl-3 sm:pl-4 md:pl-6";

export function VerifyCompanyInfoStep({
  applicationId: _applicationId,
  onDataChange,
}: VerifyCompanyInfoStepProps) {
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id;
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();

  const apiClient = React.useMemo(
    () => createApiClient(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000", getAccessToken),
    [getAccessToken]
  );

  /**
   * MODAL OPEN/CLOSE STATES
   */
  const [isEditCompanyInfoOpen, setIsEditCompanyInfoOpen] = React.useState(false);
  const [isEditAddressOpen, setIsEditAddressOpen] = React.useState(false);
  const [isEditBankingOpen, setIsEditBankingOpen] = React.useState(false);
  const [isEditContactOpen, setIsEditContactOpen] = React.useState(false);

  /**
   * PENDING CHANGES STATES
   * 
   * Store edits locally until user clicks "Save and Continue".
   * These are NOT saved to database yet.
   */
  const [pendingCompanyInfo, setPendingCompanyInfo] = React.useState<{ industry?: string; numberOfEmployees?: string } | null>(null);
  const [pendingAddress, setPendingAddress] = React.useState<{ businessAddress?: any; registeredAddress?: any } | null>(null);
  const [pendingBanking, setPendingBanking] = React.useState<{ bankName?: string; bankAccountNumber?: string } | null>(null);
  const [pendingContact, setPendingContact] = React.useState<{ firstName?: string; middleName?: string; lastName?: string; phoneNumber?: string } | null>(null);

  /**
   * LOAD CORPORATE INFO
   * 
   * useCorporateInfo loads:
   * - basicInfo (company name, entity type, SSM, industry, employees)
   * - addresses (business and registered)
   * - bankAccountDetails
   * - contact person (first/middle/last name, IC, phone)
   */
  const {
    corporateInfo,
    bankAccountDetails,
    firstName,
    middleName,
    lastName,
    documentNumber,
    phoneNumber,
    isLoading: isLoadingInfo,
  } = useCorporateInfo(organizationId);

  /**
   * LOAD CORPORATE ENTITIES
   * 
   * useCorporateEntities loads:
   * - directorsDisplay (directors with KYC status and ownership)
   * - shareholdersDisplay (shareholders with KYC status and ownership)
   * - corporateShareholders (corporate entities with KYB status and ownership)
   */
  const { data: entitiesData, isLoading: isLoadingEntities } = useCorporateEntities(organizationId);
  const isLoading = isLoadingInfo || isLoadingEntities;

  /**
   * SAVE ALL PENDING CHANGES TO DATABASE
   * 
   * This function is called by the parent when user clicks "Save and Continue".
   * It updates the issuer organization table with all pending changes.
   */
  const saveAllPendingChanges = React.useCallback(async () => {
    if (!organizationId) {
      return;
    }

    try {
      const updates: any = {};

      // Save company info if there are pending changes
      if (pendingCompanyInfo) {
        updates.industry = pendingCompanyInfo.industry || null;
        updates.numberOfEmployees = pendingCompanyInfo.numberOfEmployees
          ? Number.parseInt(pendingCompanyInfo.numberOfEmployees, 10)
          : null;
      }

      // Save address if there are pending changes
      if (pendingAddress) {
        updates.businessAddress = pendingAddress.businessAddress;
        updates.registeredAddress = pendingAddress.registeredAddress;
      }

      // Only make API call if there are updates
      if (Object.keys(updates).length > 0) {
        const result = await apiClient.patch(`/v1/organizations/issuer/${organizationId}/corporate-info`, updates);
        if (!result.success) {
          throw new Error(result.error.message);
        }
        queryClient.invalidateQueries({ queryKey: ["corporate-info", organizationId] });
      }

      // Save banking if there are pending changes
      if (pendingBanking) {
        const bankAccountDetails = {
          content: [
            { cn: false, fieldName: "Bank", fieldType: "picklist", fieldValue: pendingBanking.bankName },
            { cn: false, fieldName: "Bank account number", fieldType: "number", fieldValue: pendingBanking.bankAccountNumber },
          ],
          displayArea: "Operational Information",
        };
        const result = await apiClient.patch(`/v1/organizations/issuer/${organizationId}`, {
          bankAccountDetails,
        });
        if (!result.success) {
          throw new Error(result.error.message);
        }
        queryClient.invalidateQueries({ queryKey: ["corporate-info", organizationId] });
        queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      }

      // Save contact if there are pending changes
      if (pendingContact) {
        const result = await apiClient.patch(`/v1/organizations/issuer/${organizationId}`, {
          firstName: pendingContact.firstName || null,
          middleName: pendingContact.middleName || null,
          lastName: pendingContact.lastName || null,
          phoneNumber: pendingContact.phoneNumber || null,
        });
        if (!result.success) {
          throw new Error(result.error.message);
        }
        queryClient.invalidateQueries({ queryKey: ["corporate-info", organizationId] });
        queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      }

      // Clear all pending changes after successful save
      setPendingCompanyInfo(null);
      setPendingAddress(null);
      setPendingBanking(null);
      setPendingContact(null);
    } catch (error) {
      toast.error("Failed to save changes", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
      throw error;
    }
  }, [organizationId, apiClient, queryClient, pendingCompanyInfo, pendingAddress, pendingBanking, pendingContact]);

  /**
   * PASS ORGANIZATION ID AND SAVE FUNCTION TO PARENT
   * 
   * Parent will call saveFunction when user clicks "Save and Continue".
   */
  React.useEffect(() => {
    if (!onDataChange || !organizationId) return;

    onDataChange({
      issuer_organization_id: organizationId,
      saveFunction: saveAllPendingChanges,
    });
  }, [organizationId, onDataChange, saveAllPendingChanges]);

  /**
   * BUILD COMBINED LIST OF DIRECTORS AND SHAREHOLDERS
   * 
   * Logic:
   * 1. Show directors first
   * 2. If a director has ownership (not "—"), label them as "Director, Shareholder"
   * 3. Show shareholders who are NOT already shown as directors
   * 4. Show corporate shareholders with KYB status instead of KYC
   * 5. Deduplicate by normalized name
   */
  const directorsDisplay = entitiesData?.directorsDisplay ?? [];
  const shareholdersDisplay = entitiesData?.shareholdersDisplay ?? [];
  const corporateShareholders = entitiesData?.corporateShareholders ?? [];
  
  const combinedList = React.useMemo(() => {
    const seen = new Set<string>();
    const result: any[] = [];

    // Process directors first
    directorsDisplay.forEach((d) => {
      const normalized = normalizeName(d.name);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        
        // If director has ownership (not "—"), they're also a shareholder
        const isAlsoShareholder = d.ownershipLabel !== "—";
        
        result.push({
          type: "director",
          name: d.name,
          roleLabel: isAlsoShareholder ? "Director, Shareholder" : "Director",
          ownership: d.ownershipLabel,
          statusType: "kyc",
          statusVerified: d.kycVerified,
          key: `dir-${normalized}`,
        });
      }
    });

    // Process shareholders who are NOT directors
    shareholdersDisplay.forEach((s) => {
      const normalized = normalizeName(s.name);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push({
          type: "shareholder",
          name: s.name,
          roleLabel: "Shareholder",
          ownership: s.ownershipLabel,
          statusType: "kyc",
          statusVerified: s.kycVerified,
          key: `sh-${normalized}`,
        });
      }
    });

    // Process corporate shareholders
    corporateShareholders.forEach((corp: any) => {
      // Extract ownership percentage from formContent
      const shareField = corp.formContent?.displayAreas?.[0]?.content?.find(
        (f: any) => f.fieldName === "% of Shares"
      );
      const sharePercentage = shareField?.fieldValue ? Number(shareField.fieldValue) : null;
      const ownershipLabel = sharePercentage != null ? `${sharePercentage}% ownership` : "—";
      
      // Check KYB approval status
      const kybApproved = corp.approveStatus === "APPROVED";
      
      result.push({
        type: "corporate_shareholder",
        name: corp.businessName || corp.companyName || "—",
        roleLabel: "Corporate Shareholder",
        ownership: ownershipLabel,
        statusType: "kyb",
        statusVerified: kybApproved,
        key: `corp-${corp.requestId}`,
      });
    });

    return result;
  }, [directorsDisplay, shareholdersDisplay, corporateShareholders]);

  const hasDirectorsOrShareholders = combinedList.length > 0;

  /**
   * LOADING STATE
   * 
   * Show skeleton loaders while data is being fetched
   */
  if (isLoading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="space-y-4">
          <div>
            <h3 className={sectionHeaderClassName}>Company info</h3>
            <div className="mt-2 h-px bg-border" />
          </div>
          <div className={gridClassName}>
            <div className={labelClassName}>Company name</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Type of entity</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>SSM no</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Industry</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Number of employees</div>
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className={sectionHeaderClassName}>Address</h3>
            <div className="mt-2 h-px bg-border" />
          </div>
          <div className={sectionGridClassName}>
            <div className={labelClassName}>Business address</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Registered address</div>
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-semibold text-xl">Director & Shareholders</h3>
          </div>
          <div className={sectionGridClassName}>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 rounded" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 rounded" />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className={sectionHeaderClassName}>Banking details</h3>
            <div className="mt-2 h-px bg-border" />
          </div>
          <div className={gridClassName}>
            <div className={labelClassName}>Bank name</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Bank account number</div>
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className={sectionHeaderClassName}>Contact Person</h3>
            <div className="mt-2 h-px bg-border" />
          </div>
          <div className={gridClassName}>
            <div className={labelClassName}>Applicant name</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Applicant IC no</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Applicant contact</div>
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  /**
   * NO ORGANIZATION SELECTED STATE
   */
  if (!organizationId) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Please select an organization to continue.
      </div>
    );
  }

  /**
   * EXTRACT DATA FROM HOOKS
   * 
   * Get all the data we need to display from the hooks
   */
  const basicInfo = corporateInfo?.basicInfo;
  const businessAddress = corporateInfo?.addresses?.business;
  const registeredAddress = corporateInfo?.addresses?.registered;
  const bankDetails: any = bankAccountDetails || null;
  const bankName = getBankField(bankDetails, "Bank");
  const accountNumber = getBankField(bankDetails, "Bank account number");

  /**
   * DISPLAY VALUES - show pending changes if they exist, otherwise show original data
   */
  const displayIndustry = pendingCompanyInfo?.industry !== undefined ? pendingCompanyInfo.industry : basicInfo?.industry;
  const displayNumberOfEmployees = pendingCompanyInfo?.numberOfEmployees !== undefined ? pendingCompanyInfo.numberOfEmployees : basicInfo?.numberOfEmployees;
  const displayBusinessAddress = pendingAddress?.businessAddress || businessAddress;
  const displayRegisteredAddress = pendingAddress?.registeredAddress || registeredAddress;
  const displayBankName = pendingBanking?.bankName !== undefined ? pendingBanking.bankName : bankName;
  const displayAccountNumber = pendingBanking?.bankAccountNumber !== undefined ? pendingBanking.bankAccountNumber : accountNumber;
  const displayFirstName = pendingContact?.firstName !== undefined ? pendingContact.firstName : firstName;
  const displayMiddleName = pendingContact?.middleName !== undefined ? pendingContact.middleName : middleName;
  const displayLastName = pendingContact?.lastName !== undefined ? pendingContact.lastName : lastName;
  const displayPhoneNumber = pendingContact?.phoneNumber !== undefined ? pendingContact.phoneNumber : phoneNumber;
  const displayApplicantName = [displayFirstName, displayMiddleName, displayLastName].filter(Boolean).join(" ").trim() || "—";

  /**
   * EDIT HANDLERS - store changes in pending state
   */
  const handleSaveCompanyInfo = (industry: string, numberOfEmployees: string) => {
    setPendingCompanyInfo({ industry, numberOfEmployees });
    setIsEditCompanyInfoOpen(false);
  };

  const handleSaveAddress = (businessAddress: any, registeredAddress: any) => {
    setPendingAddress({ businessAddress, registeredAddress });
    setIsEditAddressOpen(false);
  };

  const handleSaveBanking = (bankName: string, bankAccountNumber: string) => {
    setPendingBanking({ bankName, bankAccountNumber });
    setIsEditBankingOpen(false);
  };

  const handleSaveContact = (firstName: string, middleName: string, lastName: string, phoneNumber: string) => {
    setPendingContact({ firstName, middleName, lastName, phoneNumber });
    setIsEditContactOpen(false);
  };

  /**
   * MAIN UI
   * 
   * Display all company information in read-only format
   */
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Company Info Section */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center">
            <h3 className={sectionHeaderClassName}>Company info</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditCompanyInfoOpen(true)}
              className="h-6 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 text-sm"
            >
              Edit
              <PencilIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={gridClassName}>
          <div className={labelClassName}>Company name</div>
          <Input
            value={basicInfo?.businessName || "—"}
            disabled
            className={inputClassName}
          />
          <div className={labelClassName}>Type of entity</div>
          <Input
            value={basicInfo?.entityType || "—"}
            disabled
            className={inputClassName}
          />
          <div className={labelClassName}>SSM no</div>
          <Input
            value={basicInfo?.ssmRegisterNumber || "—"}
            disabled
            className={inputClassName}
          />
          <div className={labelClassName}>Industry</div>
          <Input
            value={displayIndustry || "—"}
            disabled
            className={inputClassName}
          />
          <div className={labelClassName}>Number of employees</div>
          <Input
            value={displayNumberOfEmployees?.toString() || "—"}
            disabled
            className={inputClassName}
          />
        </div>
      </div>

      {/* Address Section */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center">
            <h3 className={sectionHeaderClassName}>Address</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditAddressOpen(true)}
              className="h-6 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 text-sm"
            >
              Edit
              <PencilIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={sectionGridClassName}>
          <div className={labelClassName}>Business address</div>
          <Input
            value={formatAddress(displayBusinessAddress)}
            disabled
            className={inputClassName}
          />
          <div className={labelClassName}>Registered address</div>
          <Input
            value={formatAddress(displayRegisteredAddress)}
            disabled
            className={inputClassName}
          />
        </div>
      </div>

      {/* Directors & Shareholders Section */}
      <div className="space-y-4">
        <div>
          <h3 className={sectionHeaderClassName}>Director & Shareholders</h3>
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={sectionGridClassName}>
          {!hasDirectorsOrShareholders ? (
            <p className="text-[17px] leading-7 text-muted-foreground col-span-2">
              No directors or shareholders found
            </p>
          ) : (
            <>
              {combinedList.map((item) => (
                <React.Fragment key={item.key}>
                  <div className={labelClassName}>{item.roleLabel}</div>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
                    <div className="text-[17px] leading-7 font-medium whitespace-nowrap">
                      {item.name}
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <div className="text-[17px] leading-7 text-muted-foreground whitespace-nowrap">
                      {item.ownership}
                    </div>
                    <div className="h-4 w-px bg-border" />
                    {item.statusVerified ? (
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                        <span className="text-[17px] leading-7 text-green-600">
                          {item.statusType === "kyb" ? "KYB" : "KYC"}
                        </span>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                </React.Fragment>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Banking Details Section */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center">
            <h3 className={sectionHeaderClassName}>Banking details</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditBankingOpen(true)}
              className="h-6 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 text-sm"
            >
              Edit
              <PencilIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={gridClassName}>
          <div className={labelClassName}>Bank name</div>
          <Input value={displayBankName || "—"} disabled className={inputClassName} />
          <div className={labelClassName}>Bank account number</div>
          <Input value={displayAccountNumber || "—"} disabled className={inputClassName} />
        </div>
      </div>

      {/* Contact Person Section */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center">
            <h3 className={sectionHeaderClassName}>Contact Person</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditContactOpen(true)}
              className="h-6 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 text-sm"
            >
              Edit
              <PencilIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={gridClassName}>
          <div className={labelClassName}>Applicant name</div>
          <Input value={displayApplicantName} disabled className={inputClassName} />
          <div className={labelClassName}>Applicant IC no</div>
          <Input value={documentNumber || "—"} disabled className={inputClassName} />
          <div className={labelClassName}>Applicant contact</div>
          <Input value={displayPhoneNumber || "—"} disabled className={inputClassName} />
        </div>
      </div>

      {/* Edit Dialogs */}
      <EditCompanyInfoDialog
        open={isEditCompanyInfoOpen}
        onOpenChange={setIsEditCompanyInfoOpen}
        industry={displayIndustry || ""}
        numberOfEmployees={displayNumberOfEmployees?.toString() || ""}
        onSave={handleSaveCompanyInfo}
      />

      <EditAddressDialog
        open={isEditAddressOpen}
        onOpenChange={setIsEditAddressOpen}
        businessAddress={{
          line1: displayBusinessAddress?.line1 || "",
          line2: displayBusinessAddress?.line2 || "",
          city: displayBusinessAddress?.city || "",
          postalCode: displayBusinessAddress?.postalCode || "",
          state: displayBusinessAddress?.state || "",
          country: displayBusinessAddress?.country || "Malaysia",
        }}
        registeredAddress={{
          line1: displayRegisteredAddress?.line1 || "",
          line2: displayRegisteredAddress?.line2 || "",
          city: displayRegisteredAddress?.city || "",
          postalCode: displayRegisteredAddress?.postalCode || "",
          state: displayRegisteredAddress?.state || "",
          country: displayRegisteredAddress?.country || "Malaysia",
        }}
        onSave={handleSaveAddress}
      />

      <EditBankingDialog
        open={isEditBankingOpen}
        onOpenChange={setIsEditBankingOpen}
        bankName={displayBankName || ""}
        bankAccountNumber={displayAccountNumber || ""}
        onSave={handleSaveBanking}
      />

      <EditContactDialog
        open={isEditContactOpen}
        onOpenChange={setIsEditContactOpen}
        firstName={displayFirstName || ""}
        middleName={displayMiddleName || ""}
        lastName={displayLastName || ""}
        phoneNumber={displayPhoneNumber || ""}
        onSave={handleSaveContact}
      />
    </div>
  );
}

/**
 * EDIT COMPANY INFO DIALOG
 * 
 * Modal to edit industry and number of employees.
 * Shows pending values if they exist, otherwise original values.
 */
function EditCompanyInfoDialog({
  open,
  onOpenChange,
  industry: initialIndustry,
  numberOfEmployees: initialNumberOfEmployees,
  onSave,
}: any) {
  const [industry, setIndustry] = React.useState(initialIndustry);
  const [numberOfEmployees, setNumberOfEmployees] = React.useState(initialNumberOfEmployees);

  React.useEffect(() => {
    if (open) {
      setIndustry(initialIndustry);
      setNumberOfEmployees(initialNumberOfEmployees);
    }
  }, [open, initialIndustry, initialNumberOfEmployees]);

  const handleSave = () => {
    onSave(industry, numberOfEmployees);
  };

  const handleCancel = () => {
    setIndustry(initialIndustry);
    setNumberOfEmployees(initialNumberOfEmployees);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Company Info</DialogTitle>
          <DialogDescription className="text-[15px]">
            Update your company&apos;s industry and number of employees.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Enter industry"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="number-of-employees">Number of employees</Label>
            <Input
              id="number-of-employees"
              value={numberOfEmployees}
              onChange={(e) => setNumberOfEmployees(e.target.value)}
              placeholder="Enter number of employees"
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * EDIT ADDRESS DIALOG
 * 
 * Modal to edit business and registered addresses.
 * Shows pending values if they exist, otherwise original values.
 */
function EditAddressDialog({
  open,
  onOpenChange,
  businessAddress: initialBusinessAddress,
  registeredAddress: initialRegisteredAddress,
  onSave,
}: any) {
  const [businessAddress, setBusinessAddress] = React.useState(initialBusinessAddress);
  const [registeredAddress, setRegisteredAddress] = React.useState(initialRegisteredAddress);
  const [registeredAddressSameAsBusiness, setRegisteredAddressSameAsBusiness] = React.useState(
    JSON.stringify(initialBusinessAddress) === JSON.stringify(initialRegisteredAddress)
  );

  React.useEffect(() => {
    if (open) {
      setBusinessAddress({ ...initialBusinessAddress, country: initialBusinessAddress.country || "Malaysia" });
      setRegisteredAddress({ ...initialRegisteredAddress, country: initialRegisteredAddress.country || "Malaysia" });
      setRegisteredAddressSameAsBusiness(
        JSON.stringify(initialBusinessAddress) === JSON.stringify(initialRegisteredAddress)
      );
    }
  }, [open, initialBusinessAddress, initialRegisteredAddress]);

  React.useEffect(() => {
    if (registeredAddressSameAsBusiness) {
      setRegisteredAddress(businessAddress);
    }
  }, [registeredAddressSameAsBusiness, businessAddress]);

  const handleSave = () => {
    const finalRegisteredAddress = registeredAddressSameAsBusiness ? businessAddress : registeredAddress;
    onSave(businessAddress, finalRegisteredAddress);
  };

  const handleCancel = () => {
    setBusinessAddress(initialBusinessAddress);
    setRegisteredAddress(initialRegisteredAddress);
    setRegisteredAddressSameAsBusiness(
      JSON.stringify(initialBusinessAddress) === JSON.stringify(initialRegisteredAddress)
    );
    onOpenChange(false);
  };

  const updateBusinessAddress = (field: string, value: string) => {
    setBusinessAddress((prev: any) => ({ ...prev, [field]: value }));
  };

  const updateRegisteredAddress = (field: string, value: string) => {
    setRegisteredAddress((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Address</DialogTitle>
          <DialogDescription className="text-[15px]">
            Update your business address and registered address.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-8 py-4">
          <div className="space-y-4">
            <h4 className="text-base font-semibold">Business address</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-line1">Address line 1</Label>
                <Input
                  id="business-line1"
                  value={businessAddress.line1}
                  onChange={(e) => updateBusinessAddress("line1", e.target.value)}
                  placeholder="Street Address"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-line2">Address line 2</Label>
                <Input
                  id="business-line2"
                  value={businessAddress.line2}
                  onChange={(e) => updateBusinessAddress("line2", e.target.value)}
                  placeholder="Apartment, suite, etc. (optional)"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-city">City</Label>
                  <Input
                    id="business-city"
                    value={businessAddress.city}
                    onChange={(e) => updateBusinessAddress("city", e.target.value)}
                    placeholder="Enter city"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-postal-code">Postal code</Label>
                  <Input
                    id="business-postal-code"
                    value={businessAddress.postalCode}
                    onChange={(e) => updateBusinessAddress("postalCode", e.target.value)}
                    placeholder="Enter postal code"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-state">State</Label>
                  <Input
                    id="business-state"
                    value={businessAddress.state}
                    onChange={(e) => updateBusinessAddress("state", e.target.value)}
                    placeholder="Enter state"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-country">Country</Label>
                  <Input
                    id="business-country"
                    value={businessAddress.country}
                    onChange={(e) => updateBusinessAddress("country", e.target.value)}
                    placeholder="Enter country"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">Registered address</h4>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="registered-same-as-business"
                  checked={registeredAddressSameAsBusiness}
                  onCheckedChange={(checked) => setRegisteredAddressSameAsBusiness(checked === true)}
                />
                <Label htmlFor="registered-same-as-business" className="text-sm font-medium cursor-pointer">
                  Same as business address
                </Label>
              </div>
            </div>
            {!registeredAddressSameAsBusiness && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="registered-line1">Address line 1</Label>
                  <Input
                    id="registered-line1"
                    value={registeredAddress.line1}
                    onChange={(e) => updateRegisteredAddress("line1", e.target.value)}
                    placeholder="Street Address"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registered-line2">Address line 2</Label>
                  <Input
                    id="registered-line2"
                    value={registeredAddress.line2}
                    onChange={(e) => updateRegisteredAddress("line2", e.target.value)}
                    placeholder="Apartment, suite, etc. (optional)"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registered-city">City</Label>
                    <Input
                      id="registered-city"
                      value={registeredAddress.city}
                      onChange={(e) => updateRegisteredAddress("city", e.target.value)}
                      placeholder="Enter city"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registered-postal-code">Postal code</Label>
                    <Input
                      id="registered-postal-code"
                      value={registeredAddress.postalCode}
                      onChange={(e) => updateRegisteredAddress("postalCode", e.target.value)}
                      placeholder="Enter postal code"
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registered-state">State</Label>
                    <Input
                      id="registered-state"
                      value={registeredAddress.state}
                      onChange={(e) => updateRegisteredAddress("state", e.target.value)}
                      placeholder="Enter state"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registered-country">Country</Label>
                    <Input
                      id="registered-country"
                      value={registeredAddress.country}
                      onChange={(e) => updateRegisteredAddress("country", e.target.value)}
                      placeholder="Enter country"
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * EDIT BANKING DIALOG
 * 
 * Modal to edit bank name and account number.
 * Shows pending values if they exist, otherwise original values.
 */
function EditBankingDialog({
  open,
  onOpenChange,
  bankName: initialBankName,
  bankAccountNumber: initialBankAccountNumber,
  onSave,
}: any) {
  const [bankName, setBankName] = React.useState(initialBankName);
  const [bankAccountNumber, setBankAccountNumber] = React.useState(initialBankAccountNumber);

  React.useEffect(() => {
    if (open) {
      setBankName(initialBankName);
      setBankAccountNumber(initialBankAccountNumber);
    }
  }, [open, initialBankName, initialBankAccountNumber]);

  const handleSave = () => {
    onSave(bankName, bankAccountNumber);
  };

  const handleCancel = () => {
    setBankName(initialBankName);
    setBankAccountNumber(initialBankAccountNumber);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Banking Details</DialogTitle>
          <DialogDescription className="text-[15px]">
            Update your bank name and account number.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="bank-name">Bank name</Label>
            <Input
              id="bank-name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Enter bank name"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bank-account">Bank account number</Label>
            <Input
              id="bank-account"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder="Enter account number"
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * EDIT CONTACT DIALOG
 * 
 * Modal to edit contact person information.
 * Shows pending values if they exist, otherwise original values.
 */
function EditContactDialog({
  open,
  onOpenChange,
  firstName: initialFirstName,
  middleName: initialMiddleName,
  lastName: initialLastName,
  phoneNumber: initialPhoneNumber,
  onSave,
}: any) {
  const [firstName, setFirstName] = React.useState(initialFirstName);
  const [middleName, setMiddleName] = React.useState(initialMiddleName);
  const [lastName, setLastName] = React.useState(initialLastName);
  const [phoneNumber, setPhoneNumber] = React.useState(initialPhoneNumber);

  React.useEffect(() => {
    if (open) {
      setFirstName(initialFirstName);
      setMiddleName(initialMiddleName);
      setLastName(initialLastName);
      setPhoneNumber(initialPhoneNumber);
    }
  }, [open, initialFirstName, initialMiddleName, initialLastName, initialPhoneNumber]);

  const handleSave = () => {
    onSave(firstName, middleName, lastName, phoneNumber);
  };

  const handleCancel = () => {
    setFirstName(initialFirstName);
    setMiddleName(initialMiddleName);
    setLastName(initialLastName);
    setPhoneNumber(initialPhoneNumber);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription className="text-[15px]">
            Update the applicant&apos;s name and contact information.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="applicant-first-name">First Name</Label>
            <Input
              id="applicant-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter first name"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="applicant-middle-name">Middle Name</Label>
            <Input
              id="applicant-middle-name"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              placeholder="Enter middle name (optional)"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="applicant-last-name">Last Name</Label>
            <Input
              id="applicant-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter last name"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="applicant-phone">Applicant Contact</Label>
            <Input
              id="applicant-phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter phone number"
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
