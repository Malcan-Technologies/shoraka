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
  const [name, setName] = React.useState(initialContactPerson.name);
  const [position, setPosition] = React.useState(initialContactPerson.position);
  const [icNo, setIcNo] = React.useState(initialContactPerson.icNo);
  const [contact, setContact] = React.useState(initialContactPerson.contact);

  React.useEffect(() => {
    if (open) {
      setName(initialContactPerson.name);
      setPosition(initialContactPerson.position);
      setIcNo(initialContactPerson.icNo);
      setContact(initialContactPerson.contact);
    }
  }, [open, initialContactPerson]);

  const handleSave = () => {
    onSave({
      name,
      position,
      icNo,
      contact,
    });
  };

  const handleCancel = () => {
    setName(initialContactPerson.name);
    setPosition(initialContactPerson.position);
    setIcNo(initialContactPerson.icNo);
    setContact(initialContactPerson.contact);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription className="text-[15px]">
            Update the contact person information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="applicant-name">Applicant name</Label>
            <Input
              id="applicant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter applicant name"
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="applicant-position">Applicant position</Label>
            <Input
              id="applicant-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Enter applicant position"
              className="h-11 rounded-xl"
            />
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="applicant-contact">Applicant contact</Label>
            <Input
              id="applicant-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Enter contact number"
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
