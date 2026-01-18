"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PencilIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Company name</Label>
              <Input
                value={companyData.companyName}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Type of entity</Label>
              <Input
                value={companyData.entityType}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">SSM no</Label>
              <Input
                value={companyData.registrationNumber}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Industry</Label>
              <Input
                value={companyData.industry}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Nature of business</Label>
              <Input
                value={companyData.natureOfBusiness}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Number of employees</Label>
              <Input
                value={companyData.numberOfEmployees}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Address</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0"
              onClick={() => setIsEditAddressOpen(true)}
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Business address</Label>
            <Input
              value={companyData.businessAddress}
              disabled
              className="bg-muted"
            />
          </div>
          <Separator />
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Registered address</Label>
            <Input
              value={companyData.registeredAddress}
              disabled
              className="bg-muted"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Director & Shareholders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {companyData.directors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No directors found</p>
            ) : (
              companyData.directors.map((director, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{director.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{director.ownership}</p>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Banking details</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0"
              onClick={() => setIsEditBankingOpen(true)}
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Bank name</Label>
            <Input
              value={companyData.bankName}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Bank account number</Label>
            <Input
              value={companyData.bankAccountNumber}
              disabled
              className="bg-muted"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Contact</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0"
              onClick={() => setIsEditContactOpen(true)}
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Applicant name</Label>
              <Input
                value={contactPerson.name}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Applicant position</Label>
              <Input
                value={contactPerson.position}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Applicant IC no</Label>
              <Input
                value={contactPerson.icNo}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Applicant contact</Label>
              <Input
                value={contactPerson.contact}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
