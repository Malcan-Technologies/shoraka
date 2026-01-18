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

interface EditBankingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankName: string;
  bankAccountNumber: string;
  onSave: (bankName: string, bankAccountNumber: string) => void;
}

export function EditBankingDialog({
  open,
  onOpenChange,
  bankName: initialBankName,
  bankAccountNumber: initialBankAccountNumber,
  onSave,
}: EditBankingDialogProps) {
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
