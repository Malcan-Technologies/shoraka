"use client";

import type { AuditChangedField } from "./audit-presentation";

export function AuditBeforeAfterDiff({ fields }: { fields: AuditChangedField[] }) {
  if (fields.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-ui">
        <thead>
          <tr className="border-b bg-muted/30 text-left">
            <th className="px-3 py-2 font-medium text-muted-foreground">Field</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Before</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">After</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.field} className="border-b last:border-0">
              <td className="px-3 py-2 align-top font-medium">{field.field}</td>
              <td className="px-3 py-2 align-top break-all text-muted-foreground">{field.before}</td>
              <td className="px-3 py-2 align-top break-all">{field.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
