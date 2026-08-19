"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  buildAdminActivityCsv,
  downloadAdminActivityCsv,
  type AdminActivityCsvRow,
} from "@/components/admin-activity-csv";

export function AdminActivityCsvExportButton({
  fileName,
  rows,
  disabled = false,
}: {
  fileName: string;
  rows: AdminActivityCsvRow[] | (() => Promise<AdminActivityCsvRow[]>);
  disabled?: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const isEmpty = Array.isArray(rows) && rows.length === 0;

  const handleClick = async () => {
    setPending(true);
    try {
      const resolved = typeof rows === "function" ? await rows() : rows;
      downloadAdminActivityCsv(fileName, buildAdminActivityCsv(resolved));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export activity CSV");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled || pending || isEmpty}
      onClick={() => void handleClick()}
    >
      {pending ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
