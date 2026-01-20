"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PencilIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import type { StepComponentProps } from "../step-components";
import { EditCompanyInfoDialog } from "./edit-company-info-dialog";
import { EditAddressDialog } from "./edit-address-dialog";
import { EditBankingDialog } from "./edit-banking-dialog";
import { EditContactDialog } from "./edit-contact-dialog";

function formatAddress(address: { line1: string; line2: string; city: string; postalCode: string; state: string; country: string }): string {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.postalCode,
    address.state,
    address.country,
  ].filter(Boolean);
  return parts.join(", ");
}

export default function VerifyCompanyInfoStep({
  applicationId,
  onDataChange,
}: StepComponentProps) {
  const [companyData] = React.useState({
    companyName: "ABC Sdn Bhd",
    entityType: "Private Limited Company (Sdn. Bhd.)",
    registrationNumber: "201612345678",
    industry: "Textile",
    natureOfBusiness: "Private",
    numberOfEmployees: "50",
    businessAddress: {
      line1: "24 Jalan Kiara",
      line2: "",
      city: "Kuala Lumpur",
      postalCode: "50480",
      state: "Wilayah Persekutuan Kuala Lumpur",
      country: "Malaysia",
    },
    registeredAddressSameAsBusiness: true,
    registeredAddress: {
      line1: "24 Jalan Kiara",
      line2: "",
      city: "Kuala Lumpur",
      postalCode: "50480",
      state: "Wilayah Persekutuan Kuala Lumpur",
      country: "Malaysia",
    },
    directors: [
      { name: "Nur Hidayah", ownership: "30% ownership", kycStatus: "verified" as const },
      { name: "Nazrin", ownership: "45% ownership", kycStatus: "verified" as const },
      { name: "Riaz Ali", ownership: "25% ownership", kycStatus: "verified" as const },
    ],
    bankName: "Maybank",
    bankAccountNumber: "1234 1234 1234 1234",
    contactPerson: {
      name: "Jalan Klara",
      position: "Owner",
      icNo: "345712-03-0987",
      contact: "017-1234567",
    },
  });

  const [isEditCompanyInfoOpen, setIsEditCompanyInfoOpen] = React.useState(false);
  const [isEditAddressOpen, setIsEditAddressOpen] = React.useState(false);
  const [isEditBankingOpen, setIsEditBankingOpen] = React.useState(false);
  const [isEditContactOpen, setIsEditContactOpen] = React.useState(false);
  const [isLoadingCompanyInfo] = React.useState(false);

  const inputClassName = "bg-muted rounded-xl border border-border";
  const editButtonClassName = "h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10";
  
  React.useEffect(() => {
    if (applicationId && onDataChange) {
      onDataChange({
        companyInfo: companyData,
      });
    }
  }, [companyData, applicationId, onDataChange]);

  return (
    <div className="space-y-12">
      <div>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Company info</h3>
          {!isLoadingCompanyInfo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditCompanyInfoOpen(true)}
              className={editButtonClassName}
            >
              Edit
              <PencilIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          {isLoadingCompanyInfo ? (
            <>
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Company name</div>
              <Skeleton className="h-10 rounded-xl" />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Type of entity</div>
              <Skeleton className="h-10 rounded-xl" />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">SSM no</div>
              <Skeleton className="h-10 rounded-xl" />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Industry</div>
              <Skeleton className="h-10 rounded-xl" />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Nature of business</div>
              <Skeleton className="h-10 rounded-xl" />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Number of employees</div>
              <Skeleton className="h-10 rounded-xl" />
            </>
          ) : (
            <>
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Company name</div>
              <Input value={companyData.companyName} disabled className={inputClassName} />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Type of entity</div>
              <Input value={companyData.entityType} disabled className={inputClassName} />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">SSM no</div>
              <Input value={companyData.registrationNumber} disabled className={inputClassName} />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Industry</div>
              <Input value={companyData.industry} disabled className={inputClassName} />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Nature of business</div>
              <Input value={companyData.natureOfBusiness} disabled className={inputClassName} />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Number of employees</div>
              <Input value={companyData.numberOfEmployees} disabled className={inputClassName} />
            </>
          )}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Address</h3>
          {!isLoadingCompanyInfo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditAddressOpen(true)}
              className={editButtonClassName}
            >
              Edit
              <PencilIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          {isLoadingCompanyInfo ? (
            <>
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Business address</div>
              <Skeleton className="h-10 rounded-xl" />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Registered address</div>
              <Skeleton className="h-10 rounded-xl" />
            </>
          ) : (
            <>
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Business address</div>
              <Input value={formatAddress(companyData.businessAddress)} disabled className={inputClassName} />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Registered address</div>
              <Input value={formatAddress(companyData.registeredAddress)} disabled className={inputClassName} />
            </>
          )}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Director & Shareholders</h3>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          {isLoadingCompanyInfo ? (
            <>
              <Skeleton className="h-5 w-24 pl-6" />
              <Skeleton className="h-5 rounded" />
              <Skeleton className="h-5 w-24 pl-6" />
              <Skeleton className="h-5 rounded" />
              <Skeleton className="h-5 w-24 pl-6" />
              <Skeleton className="h-5 rounded" />
            </>
          ) : companyData.directors.length === 0 ? (
            <p className="text-[17px] leading-7 text-muted-foreground pl-6">No directors found</p>
          ) : (
            <>
              {companyData.directors.map((director, index) => (
                <React.Fragment key={index}>
                  <div className="text-[17px] leading-7 text-muted-foreground pl-6">Director</div>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
                    <div className="text-[17px] leading-7 font-medium whitespace-nowrap">{director.name}</div>
                    <div className="h-4 w-px bg-border" />
                    <div className="text-[17px] leading-7 text-muted-foreground whitespace-nowrap">{director.ownership}</div>
                    <div className="h-4 w-px bg-border" />
                    {director.kycStatus === "verified" ? (
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                        <span className="text-[17px] leading-7 text-green-600">KYC</span>
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

      <div>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Banking details</h3>
          {!isLoadingCompanyInfo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditBankingOpen(true)}
              className={editButtonClassName}
            >
              Edit
              <PencilIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          {isLoadingCompanyInfo ? (
            <>
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Bank name</div>
              <Skeleton className="h-10 rounded-xl" />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Bank account number</div>
              <Skeleton className="h-10 rounded-xl" />
            </>
          ) : (
            <>
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Bank name</div>
              <Input value={companyData.bankName} disabled className={inputClassName} />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Bank account number</div>
              <Input value={companyData.bankAccountNumber} disabled className={inputClassName} />
            </>
          )}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Contact Person</h3>
          {!isLoadingCompanyInfo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditContactOpen(true)}
              className={editButtonClassName}
            >
              Edit
              <PencilIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          {isLoadingCompanyInfo ? (
            <>
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant name</div>
              <Skeleton className="h-10 rounded-xl" />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant position</div>
              <Skeleton className="h-10 rounded-xl" />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant IC no</div>
              <Skeleton className="h-10 rounded-xl" />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant contact</div>
              <Skeleton className="h-10 rounded-xl" />
            </>
          ) : (
            <>
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant name</div>
              <Input value={companyData.contactPerson.name} disabled className={inputClassName} />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant position</div>
              <Input value={companyData.contactPerson.position} disabled className={inputClassName} />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant IC no</div>
              <Input value={companyData.contactPerson.icNo} disabled className={inputClassName} />
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant contact</div>
              <Input value={companyData.contactPerson.contact} disabled className={inputClassName} />
            </>
          )}
        </div>
      </div>

      <EditCompanyInfoDialog
        open={isEditCompanyInfoOpen}
        onOpenChange={setIsEditCompanyInfoOpen}
        companyData={{
          companyName: companyData.companyName,
          entityType: companyData.entityType,
          registrationNumber: companyData.registrationNumber,
          industry: companyData.industry,
          natureOfBusiness: companyData.natureOfBusiness,
          numberOfEmployees: companyData.numberOfEmployees,
        }}
        onSave={(data) => {
          console.log("Save company info:", data);
          setIsEditCompanyInfoOpen(false);
        }}
      />

      <EditAddressDialog
        open={isEditAddressOpen}
        onOpenChange={setIsEditAddressOpen}
        businessAddress={companyData.businessAddress}
        registeredAddress={companyData.registeredAddress}
        registeredAddressSameAsBusiness={companyData.registeredAddressSameAsBusiness}
        onSave={(businessAddress, registeredAddress, registeredAddressSameAsBusiness) => {
          console.log("Save addresses:", { businessAddress, registeredAddress, registeredAddressSameAsBusiness });
          setIsEditAddressOpen(false);
        }}
      />

      <EditBankingDialog
        open={isEditBankingOpen}
        onOpenChange={setIsEditBankingOpen}
        bankName={companyData.bankName}
        bankAccountNumber={companyData.bankAccountNumber}
        onSave={(bankName: string, bankAccountNumber: string) => {
          console.log("Save banking:", { bankName, bankAccountNumber });
          setIsEditBankingOpen(false);
        }}
      />

      <EditContactDialog
        open={isEditContactOpen}
        onOpenChange={setIsEditContactOpen}
        contactPerson={companyData.contactPerson}
        onSave={(contactPerson) => {
          console.log("Save contact:", contactPerson);
          setIsEditContactOpen(false);
        }}
      />
    </div>
  );
}
