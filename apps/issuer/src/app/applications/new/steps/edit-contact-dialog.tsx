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

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactPerson: {
    name: string;
    position: string;
    icNo: string;
    contact: string;
  };
  onSave: (contactPerson: { name: string; position: string; icNo: string; contact: string }) => void;
}

export function EditContactDialog({
  open,
  onOpenChange,
  contactPerson: initialContactPerson,
  onSave,
}: EditContactDialogProps) {
  const [icNo, setIcNo] = React.useState(initialContactPerson.icNo);

  React.useEffect(() => {
    if (open) {
      setIcNo(initialContactPerson.icNo);
    }
  }, [open, initialContactPerson]);

  const handleSave = () => {
    onSave({
      name: initialContactPerson.name,
      position: initialContactPerson.position,
      icNo,
      contact: initialContactPerson.contact,
    });
  };

  const handleCancel = () => {
    setIcNo(initialContactPerson.icNo);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription className="text-[15px]">
            Update the applicant&apos;s IC number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="applicant-ic">Applicant IC no</Label>
            <Input
              id="applicant-ic"
              value={icNo}
              onChange={(e) => setIcNo(e.target.value)}
              placeholder="Enter IC number"
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
