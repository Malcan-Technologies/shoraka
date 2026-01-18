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

interface EditAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessAddress: string;
  registeredAddress: string;
  onSave: (businessAddress: string, registeredAddress: string) => void;
}

export function EditAddressDialog({
  open,
  onOpenChange,
  businessAddress: initialBusinessAddress,
  registeredAddress: initialRegisteredAddress,
  onSave,
}: EditAddressDialogProps) {
  const [businessAddress, setBusinessAddress] = React.useState(initialBusinessAddress);
  const [registeredAddress, setRegisteredAddress] = React.useState(initialRegisteredAddress);

  React.useEffect(() => {
    if (open) {
      setBusinessAddress(initialBusinessAddress);
      setRegisteredAddress(initialRegisteredAddress);
    }
  }, [open, initialBusinessAddress, initialRegisteredAddress]);

  const handleSave = () => {
    onSave(businessAddress, registeredAddress);
  };

  const handleCancel = () => {
    setBusinessAddress(initialBusinessAddress);
    setRegisteredAddress(initialRegisteredAddress);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Address</DialogTitle>
          <DialogDescription className="text-[15px]">
            Update your business address and registered address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="business-address">Business address</Label>
            <Input
              id="business-address"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="Enter business address"
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="registered-address">Registered address</Label>
            <Input
              id="registered-address"
              value={registeredAddress}
              onChange={(e) => setRegisteredAddress(e.target.value)}
              placeholder="Enter registered address"
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
