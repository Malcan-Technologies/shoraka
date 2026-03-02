"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FunnelIcon } from "@heroicons/react/24/outline";
import { FileText, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { FilterButton } from "@/components/dashboard/financing-section";

/* ============================================================
   PAGE
============================================================ */

export default function ContractDetailsPage() {
  const router = useRouter();

  return (
    <div className="flex-1 px-8 pt-6 pb-12 space-y-8">

      {/* CONTRACT SUMMARY CARD */}
      <Card className="rounded-xl border border-gray-200 shadow-sm">
        <div className="px-8 py-7 space-y-6">

          {/* HEADER */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <p className="text-[15px] font-medium">
                Contract :{" "}
                <span className="font-semibold">
                  Mining Rig Repair 12654
                </span>
              </p>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                Active
              </Badge>
            </div>

            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>

          {/* CONTRACT INFO + FACILITY */}
          <div className="grid grid-cols-[1fr_420px] gap-10">

            {/* LEFT */}
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Product :{" "}
                <span className="text-foreground font-medium">
                  Contract Financing
                </span>
              </p>
              <p>
                Customer :{" "}
                <span className="text-foreground font-medium">
                  Petronas Chemical Bhd
                </span>
              </p>
              <p>
                Contract period :{" "}
                <span className="text-foreground font-medium">
                  01/01/2026 to 31/12/2026
                </span>
              </p>
            </div>

            {/* RIGHT */}
            <div className="space-y-4">

              <p className="text-xs text-right text-muted-foreground">
                Available facility : RM 40,000
              </p>

              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-black rounded-full"
                  style={{ width: "20%" }}
                />
              </div>

              <div className="flex justify-between text-sm">
                <div>
                  <p className="font-medium text-foreground">RM 10,000</p>
                  <p className="text-xs text-muted-foreground">
                    (Utilized facility)
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-medium text-foreground">RM 50,000</p>
                  <p className="text-xs text-muted-foreground">
                    (Approved facility)
                  </p>
                </div>
              </div>

            </div>
          </div>

          <Separator />

          {/* METRICS SECTION */}
          <div className="grid grid-cols-2 gap-10 items-start">

            {/* TOTAL + METRIC CARDS */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Total no. of invoices : 15
              </p>

              <div className="grid grid-cols-3 gap-4">
                <MetricBox label="Approved" value="10" />
                <MetricBox label="Rejected" value="2" />
                <MetricBox label="Unfinanced" value="3" />
              </div>
            </div>

            {/* BREAKDOWN — 3x2 GRID */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Breakdown of approved invoices
              </p>

              <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-xs text-muted-foreground">
                <BreakdownItem label="Funding in progress" value="2" />
                <BreakdownItem label="Active notes" value="4" />
                <BreakdownItem label="Completed notes" value="1" />
                <BreakdownItem label="Unsuccessful raise" value="2" />
                <BreakdownItem label="Disputed notes" value="1" />
              </div>
            </div>

          </div>

        </div>
      </Card>

      {/* INVOICE SECTION */}
      <div className="space-y-4">

        {/* HEADER WITH FILTERS */}
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">Invoices</h3>

          <div className="flex items-center gap-3">
            <FilterButton label="Status" />
            <FilterButton label="Submission date" />
          </div>
        </div>

        {/* INVOICE CARDS */}
        <InvoiceCard />
        <InvoiceCard />
        <InvoiceCard />
        <InvoiceCard />
        <InvoiceCard />

      </div>

    </div>
  );
}

/* ============================================================
   COMPONENTS
============================================================ */

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function BreakdownItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

// function FilterButton({ label }: { label: string }) {
//   return (
//     <Button
//       variant="outline"
//       size="sm"
//       className="h-8 text-xs font-medium gap-1 px-3"
//     >
//       <FunnelIcon className="h-3.5 w-3.5" />
//       {label}
//     </Button>
//   );
// }

// please import from other pages
function InvoiceCard() {
  return (
    <Card className="rounded-xl border border-gray-200 shadow-sm">
      <div className="px-8 py-6 space-y-5">

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">
              Invoice no : <span className="font-semibold">INV-11110</span>
            </p>
            <Badge variant="secondary">Draft</Badge>
          </div>

          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-[1fr_420px] gap-10">

          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Note no : <span className="text-foreground font-medium">-</span>
            </p>
            <p>
              Invoice value :{" "}
              <span className="text-foreground font-medium">RM 40,000</span>
            </p>
            <p>
              Financing amount :{" "}
              <span className="text-foreground font-medium">RM 30,000</span>
            </p>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Submission date :{" "}
              <span className="text-foreground font-medium">
                03/02/2026
              </span>
            </p>
            <p>
              Funding deadline :{" "}
              <span className="text-foreground font-medium">NA</span>
            </p>
            <p>
              Maturity date :{" "}
              <span className="text-foreground font-medium">
                31/07/2026
              </span>
            </p>

            <div className="space-y-2 pt-2">
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div className="h-2 bg-black rounded-full w-0" />
              </div>
              <p className="text-xs text-muted-foreground">
                Funding status (Not yet started)
              </p>
            </div>

          </div>

        </div>
      </div>
    </Card>
  );
}