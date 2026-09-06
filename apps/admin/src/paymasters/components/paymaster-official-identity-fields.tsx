"use client";

import { PAYMASTER_ENTITY_TYPES } from "@cashsouk/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { paymasterCountryOptions } from "@/paymasters/utils/paymaster-country-options";

export type PaymasterOfficialIdentityFormValue = {
  legalName: string;
  registrationNumber: string;
  country: string;
  entityType: string;
};

export type PaymasterOfficialIdentityFormErrors = {
  legalName?: string;
  country?: string;
  entityType?: string;
};

export function validatePaymasterOfficialIdentity(
  value: PaymasterOfficialIdentityFormValue
): PaymasterOfficialIdentityFormErrors {
  const errors: PaymasterOfficialIdentityFormErrors = {};
  if (!value.legalName.trim()) errors.legalName = "Legal name is required.";
  if (!value.country.trim()) errors.country = "Country is required.";
  if (!value.entityType.trim()) errors.entityType = "Entity type is required.";
  return errors;
}

export function PaymasterOfficialIdentityFields({
  value,
  errors,
  onChange,
  disabled,
}: {
  value: PaymasterOfficialIdentityFormValue;
  errors: PaymasterOfficialIdentityFormErrors;
  onChange: (next: PaymasterOfficialIdentityFormValue) => void;
  disabled?: boolean;
}) {
  const countries = paymasterCountryOptions(value.country);
  const entityTypes = PAYMASTER_ENTITY_TYPES.includes(
    value.entityType as (typeof PAYMASTER_ENTITY_TYPES)[number]
  )
    ? [...PAYMASTER_ENTITY_TYPES]
    : value.entityType
      ? [value.entityType, ...PAYMASTER_ENTITY_TYPES]
      : [...PAYMASTER_ENTITY_TYPES];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="paymaster-official-legal-name" className="text-ui">
          Legal Name
        </Label>
        <Input
          id="paymaster-official-legal-name"
          className="h-10 rounded-xl text-ui"
          value={value.legalName}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, legalName: event.target.value })}
        />
        {errors.legalName ? <p className="text-meta text-destructive">{errors.legalName}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="paymaster-official-ssm" className="text-ui">
          Registration / SSM
        </Label>
        <Input
          id="paymaster-official-ssm"
          className="h-10 rounded-xl font-mono text-ui"
          value={value.registrationNumber}
          disabled
          readOnly
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="paymaster-official-country" className="text-ui">
          Country
        </Label>
        <Select
          value={value.country}
          onValueChange={(country) => onChange({ ...value, country })}
          disabled={disabled}
        >
          <SelectTrigger id="paymaster-official-country" className="h-10 rounded-xl text-ui">
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.country ? <p className="text-meta text-destructive">{errors.country}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="paymaster-official-entity-type" className="text-ui">
          Entity Type
        </Label>
        <Select
          value={value.entityType}
          onValueChange={(entityType) => onChange({ ...value, entityType })}
          disabled={disabled}
        >
          <SelectTrigger id="paymaster-official-entity-type" className="h-10 rounded-xl text-ui">
            <SelectValue placeholder="Select entity type" />
          </SelectTrigger>
          <SelectContent>
            {entityTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.entityType ? (
          <p className="text-meta text-destructive">{errors.entityType}</p>
        ) : null}
      </div>
    </div>
  );
}
