"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface EditCompanyInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyData: {
    companyName: string;
    entityType: string;
    registrationNumber: string;
    industry: string;
    natureOfBusiness: string;
    numberOfEmployees: string;
  };
  onSave: (data: {
    industry: string;
    numberOfEmployees: string;
  }) => void;
}

export function EditCompanyInfoDialog({
  open,
  onOpenChange,
  companyData: initialCompanyData,
  onSave,
}: EditCompanyInfoDialogProps) {
  const [industry, setIndustry] = React.useState(initialCompanyData.industry);
  const [numberOfEmployees, setNumberOfEmployees] = React.useState(initialCompanyData.numberOfEmployees);

  React.useEffect(() => {
    if (open) {
      setIndustry(initialCompanyData.industry);
      setNumberOfEmployees(initialCompanyData.numberOfEmployees);
    }
  }, [open, initialCompanyData]);

  const handleSave = () => {
    onSave({
      industry,
      numberOfEmployees,
    });
  };

  const handleCancel = () => {
    setIndustry(initialCompanyData.industry);
    setNumberOfEmployees(initialCompanyData.numberOfEmployees);
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
