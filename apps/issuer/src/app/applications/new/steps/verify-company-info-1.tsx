"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PencilIcon } from "@heroicons/react/24/outline";
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

  const contactPerson = companyData.contactPerson || {
    name: "",
    position: "",
    icNo: "",
    contact: "",
  };
  
  const [isEditCompanyInfoOpen, setIsEditCompanyInfoOpen] = React.useState(false);
  const [isEditAddressOpen, setIsEditAddressOpen] = React.useState(false);
  const [isEditBankingOpen, setIsEditBankingOpen] = React.useState(false);
  const [isEditContactOpen, setIsEditContactOpen] = React.useState(false);
  
  React.useEffect(() => {
    if (companyData && applicationId && onDataChange) {
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditCompanyInfoOpen(true)}
            className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Edit
            <PencilIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="text-sm text-muted-foreground">Company name</div>
          <Input
            value={companyData.companyName}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
          <div className="text-sm text-muted-foreground">Type of entity</div>
          <Input
            value={companyData.entityType}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
          <div className="text-sm text-muted-foreground">SSM no</div>
          <Input
            value={companyData.registrationNumber}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
          <div className="text-sm text-muted-foreground">Industry</div>
          <Input
            value={companyData.industry}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
          <div className="text-sm text-muted-foreground">Nature of business</div>
          <Input
            value={companyData.natureOfBusiness}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
          <div className="text-sm text-muted-foreground">Number of employees</div>
          <Input
            value={companyData.numberOfEmployees}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Address</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditAddressOpen(true)}
            className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Edit
            <PencilIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="text-sm text-muted-foreground">Business address</div>
          <Input
            value={formatAddress(companyData.businessAddress)}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
          <div className="text-sm text-muted-foreground">Registered address</div>
          <Input
            value={formatAddress(companyData.registeredAddress)}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Director & Shareholders</h3>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          {companyData.directors.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-3">No directors found</p>
          ) : (
            <>
              {companyData.directors.map((director, index) => (
                <React.Fragment key={index}>
                  <div className="text-sm text-muted-foreground">Director</div>
                  <div className="text-sm font-medium">{director.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {director.ownership}
                    {director.kycStatus === "verified" && (
                      <span className="ml-2 text-green-600">● KYC</span>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditBankingOpen(true)}
            className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Edit
            <PencilIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="text-sm text-muted-foreground">Bank name</div>
          <Input
            value={companyData.bankName}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
          <div className="text-sm text-muted-foreground">Bank account number</div>
          <Input
            value={companyData.bankAccountNumber}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Contact Person</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditContactOpen(true)}
            className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Edit
            <PencilIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="text-sm text-muted-foreground">Applicant name</div>
          <Input
            value={contactPerson.name}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
          <div className="text-sm text-muted-foreground">Applicant position</div>
          <Input
            value={contactPerson.position}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
          <div className="text-sm text-muted-foreground">Applicant IC no</div>
          <Input
            value={contactPerson.icNo}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
          <div className="text-sm text-muted-foreground">Applicant contact</div>
          <Input
            value={contactPerson.contact}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
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
        contactPerson={contactPerson}
        onSave={(contactPerson) => {
          console.log("Save contact:", contactPerson);
          setIsEditContactOpen(false);
        }}
      />
    </div>
  );
}
