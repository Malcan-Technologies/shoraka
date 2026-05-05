"use client"

import { MoreVertical, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useOrganization } from "@cashsouk/config";
import { useOrganizationApplications } from "@/hooks/use-applications";
import type { Application, Invoice, InvoiceDetails } from "@cashsouk/types";
import { InvoiceStatus } from "@cashsouk/types";

type Status =
  | "Draft"
  | "In progress"
  | "Funded"
  | "Completed"
  | "Unsuccessful"

type ApplicationWithInvoices = Application & { invoices?: Invoice[] };

type InvoiceDashboardRow = Invoice & {
  invoiceNo: string | number | null;
  invoiceValue: unknown;
  financingAmount: unknown;
  noteNo?: string;
  submissionDate?: string;
  fundingDeadline?: string;
  maturityDate?: string;
  fundingProgress?: number;
  fundingLabel?: string;
};

// Gather invoices from applications for the active organization
function useOrgInvoiceList() {
  const { activeOrganization } = useOrganization();
  const { data: applications = [] } = useOrganizationApplications(activeOrganization?.id);
  const invoices = (applications as ApplicationWithInvoices[]).flatMap((app) =>
    (app.invoices ?? []).map(
      (inv): InvoiceDashboardRow => ({
        ...inv,
        invoiceNo: inv.details?.number ?? inv.id,
        invoiceValue: inv.details?.value ?? null,
        financingAmount:
          (inv.details as InvoiceDetails & { financing_amount?: number }).financing_amount ?? null,
      })
    )
  );
  return invoices;
}

function invoiceApiStatusToDisplay(status: Invoice["status"] | undefined): Status {
  switch (status) {
    case InvoiceStatus.DRAFT:
      return "Draft";
    case InvoiceStatus.SUBMITTED:
    case InvoiceStatus.OFFER_SENT:
    case InvoiceStatus.AMENDMENT_REQUESTED:
      return "In progress";
    case InvoiceStatus.APPROVED:
      return "Funded";
    case InvoiceStatus.REJECTED:
    case InvoiceStatus.WITHDRAWN:
      return "Unsuccessful";
    default:
      return "In progress";
  }
}

function getStatusBadge(status: Status) {
  switch (status) {
    case "Draft":
      return <Badge variant="secondary">Draft</Badge>
    case "In progress":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">In progress</Badge>
    case "Funded":
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Funded</Badge>
    case "Completed":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>
    case "Unsuccessful":
      return <Badge className="bg-red-100 text-red-600 hover:bg-red-100">Unsuccessful</Badge>
  }
}

export function FinancingRequestsList() {
  const invoices = useOrgInvoiceList();
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Invoices</h3>

      <div className="space-y-4">
        {invoices.map((item: InvoiceDashboardRow) => (
          <Card
            key={item.id}
            className="p-6 rounded-xl border border-gray-200 shadow-sm"
          >
            <div className="flex justify-between">
              {/* LEFT SIDE */}
              <div className="space-y-4 flex-1">
                {/* Top row */}
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Invoice no :{" "}
                    <span className="font-semibold">{item.invoiceNo}</span>
                  </p>
                  {getStatusBadge(invoiceApiStatusToDisplay(item.status))}
                </div>

                {item.noteNo && (
                  <p className="text-sm text-muted-foreground">
                    Note no : {item.noteNo}
                  </p>
                )}

                {/* Values */}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Invoice value :{" "}
                    <span className="font-medium text-foreground">
                      {item.invoiceValue != null ? String(item.invoiceValue) : "—"}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Financing amount :{" "}
                    <span className="font-medium text-foreground">
                      {item.financingAmount != null ? String(item.financingAmount) : "—"}
                    </span>
                  </p>
                </div>
              </div>

              {/* RIGHT SIDE */}
              <div className="w-[340px] space-y-3">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    Submission date:{" "}
                    <span className="font-medium text-foreground">
                      {item.submissionDate}
                    </span>
                  </p>

                  {item.fundingDeadline && (
                    <p>
                      Funding deadline:{" "}
                      <span className="font-medium text-foreground">
                        {item.fundingDeadline}
                      </span>
                    </p>
                  )}

                  <p>
                    Maturity date:{" "}
                    <span className="font-medium text-foreground">
                      {item.maturityDate}
                    </span>
                  </p>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-black rounded-full"
                      style={{ width: `${item.fundingProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.fundingLabel}
                  </p>
                </div>
              </div>

              {/* 3 DOT MENU */}
              <div className="pl-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-9 w-9"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
// "use client";

// import { useState } from "react";
// import { ChevronDown, MoreVertical } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Card } from "@/components/ui/card";
// import { Separator } from "@/components/ui/separator";

// /* ============================================================
//    Simple Status Types
// ============================================================ */

// type ApplicationStatus =
//   | "DRAFT"
//   | "UNDER_REVIEW"
//   | "AMENDMENT_REQUIRED"
//   | "FUNDRAISING"
//   | "FUNDED"
//   | "COMPLETED"
//   | "UNSUCCESSFUL";

// interface InvoiceItem {
//   id: string;
//   invoiceNo: string;
//   status: ApplicationStatus;
//   invoiceValue: number;
//   financingAmount: number;
//   fundingProgressPct: number;
// }

// interface ApplicationItem {
//   id: string;
//   title: string;
//   productType: "CONTRACT" | "INVOICE_ONLY";
//   customerName: string;
//   submissionDate: string;
//   status: ApplicationStatus;
//   amendmentReasons?: string[];
//   contract?: {
//     approvedFacility: number;
//     utilisedFacility: number;
//   };
//   invoices: InvoiceItem[];
// }

// /* ============================================================
//    Mock Data
// ============================================================ */

// const mockApplications: ApplicationItem[] = [
//   {
//     id: "1",
//     title: "Mining Rig Repair 12654",
//     productType: "CONTRACT",
//     customerName: "Petronas Chemical Bhd",
//     submissionDate: "03/02/2026",
//     status: "AMENDMENT_REQUIRED",
//     amendmentReasons: [
//       "Missing contract number",
//       "Incorrect customer name",
//     ],
//     contract: {
//       approvedFacility: 50000,
//       utilisedFacility: 10000,
//     },
//     invoices: [
//       {
//         id: "inv1",
//         invoiceNo: "INV-11110",
//         status: "DRAFT",
//         invoiceValue: 40000,
//         financingAmount: 30000,
//         fundingProgressPct: 0,
//       },
//     ],
//   },
//   {
//     id: "2",
//     title: "Invoice Financing Request",
//     productType: "INVOICE_ONLY",
//     customerName: "Berjaya Group Bhd",
//     submissionDate: "03/01/2026",
//     status: "FUNDRAISING",
//     invoices: [
//       {
//         id: "inv2",
//         invoiceNo: "INV-11109",
//         status: "FUNDRAISING",
//         invoiceValue: 20000,
//         financingAmount: 15000,
//         fundingProgressPct: 75,
//       },
//     ],
//   },
// ];

// /* ============================================================
//    Badge Mapper (Brand Compliant)
// ============================================================ */

// function getStatusBadge(status: ApplicationStatus) {
//   switch (status) {
//     case "DRAFT":
//       return <Badge variant="secondary">Draft</Badge>;

//     case "UNDER_REVIEW":
//       return <Badge className="bg-accent text-accent-foreground">Under review</Badge>;

//     case "AMENDMENT_REQUIRED":
//       return (
//         <Badge className="bg-primary/10 text-primary border border-primary">
//           Amendment required
//         </Badge>
//       );

//     case "FUNDRAISING":
//       return <Badge className="bg-secondary text-secondary-foreground">In progress</Badge>;

//     case "FUNDED":
//       return <Badge className="bg-secondary text-secondary-foreground">Funded</Badge>;

//     case "COMPLETED":
//       return <Badge variant="outline">Completed</Badge>;

//     case "UNSUCCESSFUL":
//       return <Badge variant="destructive">Unsuccessful</Badge>;

//     default:
//       return <Badge variant="outline">Unknown</Badge>;
//   }
// }

// /* ============================================================
//    Main Component
// ============================================================ */

// export function FinancingRequestsList() {
//   const [expandedId, setExpandedId] = useState<string | null>(null);

//   function toggleExpand(id: string) {
//     setExpandedId(prev => (prev === id ? null : id));
//   }

//   function getPrimaryCTA(status: ApplicationStatus) {
//     if (status === "DRAFT") return "Continue";
//     if (status === "AMENDMENT_REQUIRED") return "Make amendment";
//     return "View details";
//   }

//   return (
//     <section className="mt-12 space-y-6">
//       <h2 className="text-2xl font-bold">Your Financing Requests</h2>

//       {mockApplications.map(app => (
//         <Card key={app.id} className="p-6 rounded-2xl">
//           {/* ===== TOP ROW ===== */}
//           <div className="flex items-start justify-between">
//             <div className="space-y-2">
//               <div className="flex items-center gap-3">
//                 <h3 className="text-lg font-semibold">{app.title}</h3>
//                 {getStatusBadge(app.status)}
//               </div>

//               <p className="text-muted-foreground text-[15px]">
//                 Customer: {app.customerName}
//               </p>

//               <p className="text-muted-foreground text-[15px]">
//                 Submitted on {app.submissionDate}
//               </p>
//             </div>

//             <div className="flex items-center gap-2">
//               <Button variant="outline" onClick={() => toggleExpand(app.id)}>
//                 <ChevronDown className="h-4 w-4 mr-2" />
//                 {expandedId === app.id ? "Collapse" : "Expand"}
//               </Button>

//               <Button>{getPrimaryCTA(app.status)}</Button>

//               <Button variant="ghost" size="icon">
//                 <MoreVertical className="h-4 w-4" />
//               </Button>
//             </div>
//           </div>

//           {/* ===== EXPANDED PANEL ===== */}
//           {expandedId === app.id && (
//             <>
//               <Separator className="my-6" />

//               {/* Amendment Banner */}
//               {app.status === "AMENDMENT_REQUIRED" && app.amendmentReasons && (
//                 <div className="mb-6 rounded-xl border border-primary bg-primary/5 p-4">
//                   <p className="font-semibold text-primary mb-2">
//                     Amendment required
//                   </p>
//                   <ul className="list-disc pl-5 text-[15px] space-y-1">
//                     {app.amendmentReasons.map((reason, i) => (
//                       <li key={i}>{reason}</li>
//                     ))}
//                   </ul>
//                 </div>
//               )}

//               {/* Contract Info */}
//               {app.contract && (
//                 <div className="mb-6 space-y-2">
//                   <h4 className="font-semibold">Contract Summary</h4>
//                   <p className="text-[15px] text-muted-foreground">
//                     Approved facility: RM {app.contract.approvedFacility.toLocaleString()}
//                   </p>
//                   <p className="text-[15px] text-muted-foreground">
//                     Utilised facility: RM {app.contract.utilisedFacility.toLocaleString()}
//                   </p>
//                 </div>
//               )}

//               {/* Invoices */}
//               <div className="space-y-4">
//                 <h4 className="font-semibold">Invoices</h4>

//                 {app.invoices.map(inv => (
//                   <div
//                     key={inv.id}
//                     className="rounded-xl border p-4 space-y-2"
//                   >
//                     <div className="flex items-center justify-between">
//                       <p className="font-medium">{inv.invoiceNo}</p>
//                       {getStatusBadge(inv.status)}
//                     </div>

//                     <p className="text-[15px] text-muted-foreground">
//                       Invoice value: RM {inv.invoiceValue.toLocaleString()}
//                     </p>

//                     <p className="text-[15px] text-muted-foreground">
//                       Financing amount: RM {inv.financingAmount.toLocaleString()}
//                     </p>

//                     {inv.fundingProgressPct > 0 && (
//                       <div className="mt-2">
//                         <div className="h-2 rounded-full bg-muted">
//                           <div
//                             className="h-2 rounded-full bg-primary"
//                             style={{ width: `${inv.fundingProgressPct}%` }}
//                           />
//                         </div>
//                         <p className="text-xs text-muted-foreground mt-1">
//                           {inv.fundingProgressPct}% funded
//                         </p>
//                       </div>
//                     )}
//                   </div>
//                 ))}
//               </div>
//             </>
//           )}
//         </Card>
//       ))}
//     </section>
//   );
// }