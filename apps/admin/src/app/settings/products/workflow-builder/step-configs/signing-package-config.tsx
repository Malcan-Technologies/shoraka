"use client";

import * as React from "react";
import {
  SIGNING_ROLE_REGISTRY,
  createDefaultRoleFromRegistry,
  parseSigningPackagesConfig,
  parseSigningTemplateConfig,
  sanitizeSigningTemplateConfig,
  type SigningDocumentSource,
  type SigningPackageOfferKind,
  type SigningPackagesConfig,
  type SigningRoleKey,
  type SigningTemplateConfig,
  type SigningTemplateDocument,
  type SigningTemplateRole,
} from "@cashsouk/types";
import { cn } from "@/lib/utils";
import { Input } from "../../../../../components/ui/input";
import { Button } from "../../../../../components/ui/button";
import { Switch } from "../../../../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../components/ui/select";
import { INPUT_CLASS, SELECT_TRIGGER_CLASS, SECTION_GAP } from "../product-form-input-styles";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

const SYSTEM_SIGNING_TEMPLATES = [
  {
    templateKey: "offer_letter",
    label: "Offer letter",
    description: "Generated from the system offer letter template",
    source: "GENERATED_OFFER_LETTER" as SigningDocumentSource,
    defaultName: "Offer letter",
  },
  {
    templateKey: "guarantor_agreement",
    label: "Guarantor Agreement",
    description: "Placeholder guarantor agreement PDF until a template file is uploaded",
    source: "TEMPLATE" as SigningDocumentSource,
    defaultName: "Guarantor Agreement",
  },
] as const;

type SystemTemplateKey = (typeof SYSTEM_SIGNING_TEMPLATES)[number]["templateKey"];

function defaultRole(roleIndex: number, roleKey: SigningRoleKey = "issuer_director"): SigningTemplateRole {
  return createDefaultRoleFromRegistry(roleKey, roleIndex);
}

function createDocumentFromSystemTemplate(
  templateKey: SystemTemplateKey,
  order: number,
  initialRole: SigningTemplateRole
): SigningTemplateDocument {
  const systemTemplate = SYSTEM_SIGNING_TEMPLATES.find((item) => item.templateKey === templateKey);
  if (!systemTemplate) {
    throw new Error(`Unknown system template: ${templateKey}`);
  }
  return {
    key: systemTemplate.templateKey,
    name: systemTemplate.defaultName,
    source: systemTemplate.source,
    required: true,
    order,
    signer_role_keys: [initialRole.key],
  };
}

function normalizeSigningTemplate(next: SigningTemplateConfig): SigningTemplateConfig {
  const sorted = {
    ...next,
    documents: [...next.documents]
      .sort((a, b) => a.order - b.order)
      .map((doc, index) => ({ ...doc, order: index })),
  };
  return sanitizeSigningTemplateConfig(sorted);
}

function availableSignerRolesForDocument(document: SigningTemplateDocument) {
  const assignedKeys = new Set(document.signer_role_keys);
  return SIGNING_ROLE_REGISTRY.filter((role) => !assignedKeys.has(role.key));
}

function collectReferencedRoleKeys(template: SigningTemplateConfig): Set<string> {
  return new Set(template.documents.flatMap((doc) => doc.signer_role_keys));
}

function pruneUnusedRoles(
  template: SigningTemplateConfig,
  roles: SigningTemplateRole[]
): SigningTemplateRole[] {
  const referencedKeys = collectReferencedRoleKeys(template);
  return roles.filter((role) => referencedKeys.has(role.key));
}

function rolesForDocument(template: SigningTemplateConfig, document: SigningTemplateDocument) {
  const keySet = new Set(document.signer_role_keys);
  return template.roles.filter((role) => keySet.has(role.key));
}

/** Single package editor — documents and roles. Reused by contract and invoice sections. */
function SigningPackageSection({
  title,
  description,
  helperText,
  config,
  onChange,
}: {
  title: string;
  description: string;
  helperText?: string;
  config: SigningTemplateConfig;
  onChange: (config: SigningTemplateConfig) => void;
}) {
  const template = React.useMemo(() => parseSigningTemplateConfig(config), [config]);
  const [pendingTemplateKey, setPendingTemplateKey] = React.useState<SystemTemplateKey>(
    SYSTEM_SIGNING_TEMPLATES[0].templateKey
  );

  const persist = React.useCallback(
    (next: SigningTemplateConfig) => {
      onChange(normalizeSigningTemplate(next));
    },
    [onChange]
  );

  const availableTemplates = SYSTEM_SIGNING_TEMPLATES.filter(
    (item) => !template.documents.some((doc) => doc.key === item.templateKey)
  );

  React.useEffect(() => {
    if (availableTemplates.length === 0) return;
    if (!availableTemplates.some((item) => item.templateKey === pendingTemplateKey)) {
      setPendingTemplateKey(availableTemplates[0].templateKey);
    }
  }, [availableTemplates, pendingTemplateKey]);

  const addDocument = (templateKey: SystemTemplateKey) => {
    const initialRole = defaultRole(template.roles.length);
    const document = createDocumentFromSystemTemplate(
      templateKey,
      template.documents.length,
      initialRole
    );
    persist({
      ...template,
      enabled: true,
      roles: [...template.roles, initialRole],
      documents: [...template.documents, document],
    });
  };

  const removeDocument = (documentKey: string) => {
    const removed = template.documents.find((doc) => doc.key === documentKey);
    if (!removed) return;
    const remainingDocuments = template.documents.filter((doc) => doc.key !== documentKey);
    const remainingRoleKeys = new Set(remainingDocuments.flatMap((doc) => doc.signer_role_keys));
    persist({
      ...template,
      documents: remainingDocuments,
      roles: template.roles.filter((role) => remainingRoleKeys.has(role.key)),
    });
  };

  const updateDocument = (documentKey: string, updates: Partial<SigningTemplateDocument>) => {
    persist({
      ...template,
      documents: template.documents.map((doc) =>
        doc.key === documentKey ? { ...doc, ...updates } : doc
      ),
    });
  };

  const updateRole = (
    documentKey: string,
    roleKey: string,
    updates: Partial<SigningTemplateRole>
  ) => {
    if (updates.key && updates.key !== roleKey) {
      const nextRoleKey = updates.key as SigningRoleKey;
      const documents = template.documents.map((doc) =>
        doc.key === documentKey
          ? {
              ...doc,
              signer_role_keys: doc.signer_role_keys.map((key) =>
                key === roleKey ? nextRoleKey : key
              ),
            }
          : doc
      );

      let roles = template.roles;
      if (!roles.some((role) => role.key === nextRoleKey)) {
        roles = [...roles, defaultRole(roles.length, nextRoleKey)];
      }

      const nextTemplate = { ...template, documents };
      roles = pruneUnusedRoles(nextTemplate, roles);
      persist({ ...nextTemplate, roles });
      return;
    }

    const roles = template.roles.map((role) =>
      role.key === roleKey ? { ...role, ...updates } : role
    );
    persist({ ...template, roles });
  };

  const addRole = (documentKey: string) => {
    const document = template.documents.find((doc) => doc.key === documentKey);
    if (!document) return;

    const nextRegistryRole = availableSignerRolesForDocument(document)[0];
    if (!nextRegistryRole) return;

    const existingRole = template.roles.find((role) => role.key === nextRegistryRole.key);
    const role = existingRole ?? defaultRole(template.roles.length, nextRegistryRole.key);

    persist({
      ...template,
      roles: existingRole ? template.roles : [...template.roles, role],
      documents: template.documents.map((doc) =>
        doc.key === documentKey
          ? { ...doc, signer_role_keys: [...doc.signer_role_keys, role.key] }
          : doc
      ),
    });
  };

  const removeRole = (documentKey: string, roleKey: string) => {
    const document = template.documents.find((doc) => doc.key === documentKey);
    if (!document) return;
    const docRoles = rolesForDocument(template, document);
    if (docRoles.length <= 1) return;

    const documents = template.documents.map((doc) =>
      doc.key === documentKey
        ? { ...doc, signer_role_keys: doc.signer_role_keys.filter((key) => key !== roleKey) }
        : doc
    );
    const remainingRoleKeys = new Set(documents.flatMap((doc) => doc.signer_role_keys));
    persist({
      ...template,
      documents,
      roles: template.roles.filter((role) => remainingRoleKeys.has(role.key)),
    });
  };

  return (
    <div className={cn("grid rounded-xl border border-border bg-card p-4 text-sm leading-6", SECTION_GAP)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        {helperText ? <p className="mt-1 text-sm text-muted-foreground">{helperText}</p> : null}
      </div>

      {availableTemplates.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="grid min-w-0 flex-1 gap-2 sm:max-w-md">
            <label className="text-xs font-medium text-muted-foreground">Add document</label>
            <Select
              value={pendingTemplateKey}
              onValueChange={(value) => setPendingTemplateKey(value as SystemTemplateKey)}
            >
              <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Select a document" />
              </SelectTrigger>
              <SelectContent>
                {availableTemplates.map((item) => (
                  <SelectItem key={item.templateKey} value={item.templateKey}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 sm:mb-0.5"
            onClick={() => addDocument(pendingTemplateKey)}
          >
            <PlusIcon className="h-4 w-4" />
            Add document
          </Button>
        </div>
      ) : null}

      {template.documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No documents yet. Select a system template above and click Add document.
        </p>
      ) : (
        <ul className="grid gap-4">
          {template.documents.map((document) => {
            const systemTemplate = SYSTEM_SIGNING_TEMPLATES.find(
              (item) => item.templateKey === document.key
            );
            const documentRoles = rolesForDocument(template, document);
            const canAddSignerRole = availableSignerRolesForDocument(document).length > 0;

            return (
              <li
                key={document.key}
                className="grid gap-4 rounded-lg border border-border bg-muted/15 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      {systemTemplate?.label ?? document.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {systemTemplate?.description ?? "System template — not uploaded"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={document.required}
                        onCheckedChange={(required) =>
                          updateDocument(document.key, { required })
                        }
                      />
                      Required
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeDocument(document.key)}
                      aria-label={`Remove ${document.name}`}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Signers at offer time
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Roles the issuer fills in when accepting this offer.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => addRole(document.key)}
                      disabled={!canAddSignerRole}
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add signer
                    </Button>
                  </div>

                  {documentRoles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Add at least one signer.</p>
                  ) : (
                    <ul className="grid gap-3">
                      {documentRoles.map((role) => (
                        <li key={role.key} className="grid gap-2 rounded-lg bg-background p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={role.key}
                              onValueChange={(value) =>
                                updateRole(document.key, role.key, {
                                  key: value as SigningRoleKey,
                                })
                              }
                            >
                              <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, "h-8 w-[180px]")}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SIGNING_ROLE_REGISTRY.map((def) => {
                                  const takenOnSameDocument = document.signer_role_keys.some(
                                    (key) => key === def.key && key !== role.key
                                  );
                                  return (
                                    <SelectItem
                                      key={def.key}
                                      value={def.key}
                                      disabled={takenOnSameDocument}
                                    >
                                      {def.label}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeRole(document.key, role.key)}
                              aria-label="Remove signer"
                              disabled={documentRoles.length === 1}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <label className="flex items-center gap-1.5">
                              Min at offer
                              <Input
                                type="number"
                                min={0}
                                value={role.min_count}
                                onChange={(event) =>
                                  updateRole(document.key, role.key, {
                                    min_count: Math.max(
                                      0,
                                      Number.parseInt(event.target.value, 10) || 0
                                    ),
                                  })
                                }
                                className={cn(INPUT_CLASS, "h-8 w-20")}
                              />
                            </label>
                            <label className="flex items-center gap-1.5">
                              Max at offer
                              <Input
                                type="number"
                                min={1}
                                value={role.max_count ?? ""}
                                placeholder="No limit"
                                onChange={(event) => {
                                  const raw = event.target.value.trim();
                                  updateRole(document.key, role.key, {
                                    max_count:
                                      raw === ""
                                        ? null
                                        : Math.max(1, Number.parseInt(raw, 10) || 1),
                                  });
                                }}
                                className={cn(INPUT_CLASS, "h-8 w-24")}
                              />
                            </label>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const PACKAGE_SECTIONS: Array<{
  kind: SigningPackageOfferKind;
  title: string;
  description: string;
  helperText?: string;
}> = [
  {
    kind: "contract",
    title: "Contract offer signing package",
    description:
      "Envelope documents and signer roles for contract offers. Issuers assign people and send signing emails when accepting a contract offer.",
  },
  {
    kind: "invoice",
    title: "Invoice offer signing package",
    description:
      "Envelope documents and signer roles for invoice-only invoice offers. Issuers assign people and send signing emails when accepting those offers.",
    helperText:
      "Not used for contract-linked invoice offers — those Accept/Decline after the contract package is completed, with no envelope.",
  },
];

export function SigningPackageConfig({
  config,
  onChange,
}: {
  /** Financing-type step config (or packages object). Migrates legacy signing_template on read. */
  config: unknown;
  onChange: (packages: SigningPackagesConfig) => void;
}) {
  const packages = React.useMemo(() => parseSigningPackagesConfig(config), [config]);

  const handlePackageChange = React.useCallback(
    (kind: SigningPackageOfferKind, next: SigningTemplateConfig) => {
      onChange({
        ...packages,
        [kind]: next,
      });
    },
    [onChange, packages]
  );

  return (
    <div className={cn("grid", SECTION_GAP)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">Signing packages</h2>
        <p className="text-sm text-muted-foreground">
          Configure separate envelope templates for contract offers and invoice-only invoice offers.
          Acceptance documents (e.g. Board Resolution) are configured below — issuers upload them at
          offer time for admin review; they are not signed here.
        </p>
      </div>

      {PACKAGE_SECTIONS.map((section) => (
        <SigningPackageSection
          key={section.kind}
          title={section.title}
          description={section.description}
          helperText={section.helperText}
          config={packages[section.kind]}
          onChange={(next) => handlePackageChange(section.kind, next)}
        />
      ))}
    </div>
  );
}
