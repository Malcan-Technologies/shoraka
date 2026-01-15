"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { DirectorAmlStatus } from "@cashsouk/types";
import { CheckCircleIcon, ClockIcon, XCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface DirectorAmlListProps {
  directors: DirectorAmlStatus[];
}

export function DirectorAmlList({ directors }: DirectorAmlListProps) {
  const getAmlStatusBadge = (status: DirectorAmlStatus["amlStatus"]) => {
    switch (status) {
      case "Approved":
        return (
          <Badge variant="outline" className="border-green-500/30 text-foreground bg-green-500/10">
            <CheckCircleIcon className="h-3 w-3 mr-1 text-green-600" />
            Approved
          </Badge>
        );
      case "Unresolved":
        return (
          <Badge variant="outline" className="border-yellow-500/30 text-foreground bg-yellow-500/10">
            <ExclamationTriangleIcon className="h-3 w-3 mr-1 text-yellow-600" />
            Unresolved
          </Badge>
        );
      case "Rejected":
        return (
          <Badge variant="outline" className="border-destructive/30 text-foreground bg-destructive/10">
            <XCircleIcon className="h-3 w-3 mr-1 text-destructive" />
            Rejected
          </Badge>
        );
      case "Pending":
      default:
        return (
          <Badge variant="outline" className="border-gray-400/30 text-foreground bg-gray-400/10">
            <ClockIcon className="h-3 w-3 mr-1 text-gray-500" />
            Pending
          </Badge>
        );
    }
  };

  const getMessageStatusBadge = (messageStatus: DirectorAmlStatus["amlMessageStatus"]) => {
    switch (messageStatus) {
      case "DONE":
        return (
          <Badge variant="outline" className="border-green-500/30 text-foreground bg-green-500/10 text-xs">
            Done
          </Badge>
        );
      case "ERROR":
        return (
          <Badge variant="outline" className="border-destructive/30 text-foreground bg-destructive/10 text-xs">
            Error
          </Badge>
        );
      case "PENDING":
      default:
        return (
          <Badge variant="outline" className="border-gray-400/30 text-foreground bg-gray-400/10 text-xs">
            Pending
          </Badge>
        );
    }
  };

  const directorRoles = [
    "Director",
    "Managing",
    "CEO",
    "COO",
    "CTO",
    "CMO",
    "CFO",
    "President",
    "Vice President",
    "Controller",
    "Authorised Personnel",
  ];

  // Helper to normalize name for matching (case-insensitive, trim whitespace)
  const normalizeName = (name: string) => name.trim().toLowerCase();
  const normalizeEmail = (email: string) => email.trim().toLowerCase();

  // Separate directors and shareholders
  const directorsList = directors.filter((d) =>
    directorRoles.some((role) => d.role.includes(role))
  );
  const shareholdersList = directors.filter((d) => d.role.includes("Shareholder"));

  // Find people who are both directors and shareholders (match by name and email)
  const mergedPeople = new Map<string, DirectorAmlStatus & { roles: string[] }>();
  
  // Process directors first
  for (const director of directorsList) {
    const key = `${normalizeName(director.name)}|${normalizeEmail(director.email)}`;
    const existing = mergedPeople.get(key);
    
    if (existing) {
      // Person already exists, add director role if not already present
      if (!existing.roles.some(r => directorRoles.some(dr => r.includes(dr)))) {
        existing.roles.push(director.role);
      }
      // Use the most recent/complete AML status
      if (new Date(director.lastUpdated) > new Date(existing.lastUpdated)) {
        Object.assign(existing, director);
        existing.roles = [...new Set([...existing.roles, director.role])];
      }
    } else {
      mergedPeople.set(key, { ...director, roles: [director.role] });
    }
  }

  // Process shareholders and merge with directors if they match
  for (const shareholder of shareholdersList) {
    const key = `${normalizeName(shareholder.name)}|${normalizeEmail(shareholder.email)}`;
    const existing = mergedPeople.get(key);
    
    if (existing) {
      // Person is both director and shareholder - merge roles
      if (!existing.roles.some(r => r.includes("Shareholder"))) {
        existing.roles.push(shareholder.role);
      }
      // Use the most recent/complete AML status
      if (new Date(shareholder.lastUpdated) > new Date(existing.lastUpdated)) {
        Object.assign(existing, shareholder);
        existing.roles = [...new Set([...existing.roles, shareholder.role])];
      }
    } else {
      // Pure shareholder (not a director)
      mergedPeople.set(key, { ...shareholder, roles: [shareholder.role] });
    }
  }

  // Separate merged people into directors-only, shareholders-only, and both
  const directorsOnly: Array<DirectorAmlStatus & { roles: string[] }> = [];
  const shareholdersOnly: Array<DirectorAmlStatus & { roles: string[] }> = [];
  const bothRoles: Array<DirectorAmlStatus & { roles: string[] }> = [];

  for (const person of mergedPeople.values()) {
    const hasDirectorRole = person.roles.some(r => directorRoles.some(dr => r.includes(dr)));
    const hasShareholderRole = person.roles.some(r => r.includes("Shareholder"));
    
    if (hasDirectorRole && hasShareholderRole) {
      bothRoles.push(person);
    } else if (hasDirectorRole) {
      directorsOnly.push(person);
    } else if (hasShareholderRole) {
      shareholdersOnly.push(person);
    }
  }

  const renderPersonCard = (person: DirectorAmlStatus & { roles?: string[] }) => (
    <div
      key={person.kycId}
      className="p-3 rounded-lg border bg-muted/30"
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="font-medium text-sm">{person.name}</span>
        {getAmlStatusBadge(person.amlStatus)}
        {getMessageStatusBadge(person.amlMessageStatus)}
      </div>
      <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
        <div className="truncate">
          <span className="font-medium">Email:</span> {person.email}
        </div>
        <div>
          <span className="font-medium">Role:</span> {person.roles ? person.roles.join(", ") : person.role}
        </div>
        {person.amlRiskScore !== null && (
          <div>
            <span className="font-medium">Risk Score:</span> {person.amlRiskScore}
            {person.amlRiskLevel && ` (${person.amlRiskLevel})`}
          </div>
        )}
      </div>
    </div>
  );

  if (directors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Directors / Controllers / Authorised Personnel Section */}
      {directorsOnly.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Directors / Controllers / Authorised Personnel
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {directorsOnly.map(renderPersonCard)}
          </div>
        </div>
      )}

      {/* Directors who are also Shareholders */}
      {bothRoles.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Directors / Controllers who are also Shareholders
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {bothRoles.map(renderPersonCard)}
          </div>
        </div>
      )}

      {/* Individual Shareholders / Ultimate Beneficiaries Section */}
      {shareholdersOnly.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Individual Shareholders / Ultimate Beneficiaries
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {shareholdersOnly.map(renderPersonCard)}
          </div>
        </div>
      )}
    </div>
  );
}
