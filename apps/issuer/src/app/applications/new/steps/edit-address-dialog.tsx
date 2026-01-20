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
import { Checkbox } from "@cashsouk/ui";

interface Address {
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  state: string;
  country: string;
}

interface EditAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessAddress: Address;
  registeredAddress: Address;
  registeredAddressSameAsBusiness: boolean;
  onSave: (businessAddress: Address, registeredAddress: Address, registeredAddressSameAsBusiness: boolean) => void;
}

export function EditAddressDialog({
  open,
  onOpenChange,
  businessAddress: initialBusinessAddress,
  registeredAddress: initialRegisteredAddress,
  registeredAddressSameAsBusiness: initialRegisteredAddressSameAsBusiness,
  onSave,
}: EditAddressDialogProps) {
  const [businessAddress, setBusinessAddress] = React.useState<Address>(initialBusinessAddress);
  const [registeredAddress, setRegisteredAddress] = React.useState<Address>(initialRegisteredAddress);
  const [registeredAddressSameAsBusiness, setRegisteredAddressSameAsBusiness] = React.useState(
    initialRegisteredAddressSameAsBusiness
  );

  React.useEffect(() => {
    if (open) {
      setBusinessAddress({ ...initialBusinessAddress, country: "Malaysia" });
      setRegisteredAddress({ ...initialRegisteredAddress, country: "Malaysia" });
      setRegisteredAddressSameAsBusiness(initialRegisteredAddressSameAsBusiness);
    }
  }, [open, initialBusinessAddress, initialRegisteredAddress, initialRegisteredAddressSameAsBusiness]);

  React.useEffect(() => {
    if (registeredAddressSameAsBusiness) {
      setRegisteredAddress(businessAddress);
    }
  }, [registeredAddressSameAsBusiness, businessAddress]);

  const handleSave = () => {
    const finalRegisteredAddress = registeredAddressSameAsBusiness ? businessAddress : registeredAddress;
    onSave(businessAddress, finalRegisteredAddress, registeredAddressSameAsBusiness);
  };

  const handleCancel = () => {
    setBusinessAddress(initialBusinessAddress);
    setRegisteredAddress(initialRegisteredAddress);
    setRegisteredAddressSameAsBusiness(initialRegisteredAddressSameAsBusiness);
    onOpenChange(false);
  };

  const updateBusinessAddress = (field: keyof Address, value: string) => {
    setBusinessAddress((prev) => ({ ...prev, [field]: value }));
  };

  const updateRegisteredAddress = (field: keyof Address, value: string) => {
    setRegisteredAddress((prev) => ({ ...prev, [field]: value }));
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
                <Label htmlFor="business-line1">
                  Address line 1 <span className="text-destructive">*</span>
                </Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-city">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="business-city"
                    value={businessAddress.city}
                    onChange={(e) => updateBusinessAddress("city", e.target.value)}
                    placeholder="Enter city"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business-postal-code">
                    Postal code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="business-postal-code"
                    value={businessAddress.postalCode}
                    onChange={(e) => updateBusinessAddress("postalCode", e.target.value)}
                    placeholder="Enter postal code"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-state">
                    State <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="business-state"
                    value={businessAddress.state}
                    onChange={(e) => updateBusinessAddress("state", e.target.value)}
                    placeholder="Enter state"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business-country">
                    Country <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="business-country"
                    value="Malaysia"
                    disabled
                    className="h-11 rounded-xl bg-muted"
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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="registered-line1">
                      Address line 1 <span className="text-destructive">*</span>
                    </Label>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="registered-city">
                        City <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="registered-city"
                        value={registeredAddress.city}
                        onChange={(e) => updateRegisteredAddress("city", e.target.value)}
                        placeholder="Enter city"
                        className="h-11 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="registered-postal-code">
                        Postal code <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="registered-postal-code"
                        value={registeredAddress.postalCode}
                        onChange={(e) => updateRegisteredAddress("postalCode", e.target.value)}
                        placeholder="Enter postal code"
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="registered-state">
                        State <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="registered-state"
                        value={registeredAddress.state}
                        onChange={(e) => updateRegisteredAddress("state", e.target.value)}
                        placeholder="Enter state"
                        className="h-11 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="registered-country">
                        Country <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="registered-country"
                        value="Malaysia"
                        disabled
                        className="h-11 rounded-xl bg-muted"
                      />
                    </div>
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
