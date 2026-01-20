"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { PencilIcon } from "@heroicons/react/24/outline";
import type { StepComponentProps } from "../step-components";
import { EditAddressDialog } from "./edit-address-dialog";
import { EditBankingDialog } from "./edit-banking-dialog";
import { EditContactDialog } from "./edit-contact-dialog";

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
    businessAddress: "24 Jalan Kiara, Kuala Lumpur 50480 Wilayah Persekutuan Kuala Lumpur, Malaysia",
    registeredAddress: "24 Jalan Kiara, Kuala Lumpur 50480 Wilayah Persekutuan Kuala Lumpur, Malaysia",
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
          <button className="text-accent text-sm font-medium flex items-center gap-1 cursor-pointer hover:opacity-80">
            Edit <PencilIcon className="h-3 w-3" />
          </button>
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
          <button 
            className="text-accent text-sm font-medium flex items-center gap-1 cursor-pointer hover:opacity-80"
            onClick={() => setIsEditAddressOpen(true)}
          >
            Edit <PencilIcon className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="text-sm text-muted-foreground">Business address</div>
          <Input
            value={companyData.businessAddress}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
          <div className="text-sm text-muted-foreground">Registered address</div>
          <Input
            value={companyData.registeredAddress}
            disabled
            className="bg-muted rounded-xl border border-border"
          />
        </div>
      </div>

      <div>
        <h3 className="font-semibold border-b border-border pb-2">Director & Shareholders</h3>
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
          <button 
            className="text-accent text-sm font-medium flex items-center gap-1 cursor-pointer hover:opacity-80"
            onClick={() => setIsEditBankingOpen(true)}
          >
            Edit <PencilIcon className="h-3 w-3" />
          </button>
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
          <button 
            className="text-accent text-sm font-medium flex items-center gap-1 cursor-pointer hover:opacity-80"
            onClick={() => setIsEditContactOpen(true)}
          >
            Edit <PencilIcon className="h-3 w-3" />
          </button>
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

      <EditAddressDialog
        open={isEditAddressOpen}
        onOpenChange={setIsEditAddressOpen}
        businessAddress={companyData.businessAddress}
        registeredAddress={companyData.registeredAddress}
        onSave={(businessAddress, registeredAddress) => {
          console.log("Save addresses:", { businessAddress, registeredAddress });
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
