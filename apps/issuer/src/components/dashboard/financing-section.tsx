"use client"

import { useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  MoreVertical,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { FunnelIcon } from "@heroicons/react/24/outline"

/* ============================================================
   Mock Application Data (Application Level)
============================================================ */

const mockApplications = [
  {
    id: "app1",
    title: "Mining Rig Repair 12654",
    status: "Active",
    contracts: [
      {
        id: "c1",
        title: "Mining Rig Repair 12654",
        customer: "Petronas Chemical Bhd",
        period: "01/01/2026 to 31/12/2026",
        utilised: "RM 10,000",
        approved: "RM 50,000",
      },
    ],
    invoices: [
      {
        id: "i1",
        invoiceNo: "INV-11110",
        status: "Draft",
        submissionDate: "03/02/2026",
        maturityDate: "31/07/2026",
        invoiceValue: "RM 40,000",
        financingAmount: "RM 30,000",
        progress: 0,
      },
      {
        id: "i2",
        invoiceNo: "INV-11109",
        status: "In progress",
        submissionDate: "03/01/2026",
        maturityDate: "31/06/2026",
        invoiceValue: "RM 20,000",
        financingAmount: "RM 15,000",
        progress: 75,
      },
    ],
  },
]

/* ============================================================
   Status Badge Helpers
============================================================ */

function contractBadge(status: string) {
  return (
    <Badge className="bg-green-100 text-green-700">
      {status}
    </Badge>
  )
}

function invoiceBadge(status: string) {
  switch (status) {
    case "Draft":
      return <Badge variant="secondary">Draft</Badge>
    case "In progress":
      return <Badge className="bg-green-100 text-green-700">In progress</Badge>
    case "Funded":
      return <Badge className="bg-blue-100 text-blue-700">Funded</Badge>
    case "Completed":
      return <Badge className="bg-emerald-100 text-emerald-700">Completed</Badge>
    case "Unsuccessful":
      return <Badge className="bg-red-100 text-red-600">Unsuccessful</Badge>
    default:
      return null
  }
}

/* ============================================================
   Main Component
============================================================ */

export function FinancingSection() {
  const [openApplicationId, setOpenApplicationId] = useState<string | null>(
    mockApplications[0].id
  )

  return (
    <div className="space-y-6">

      {mockApplications.map((app) => {
        const isOpen = openApplicationId === app.id

        return (
          <Card
            key={app.id}
            className="rounded-xl border border-gray-200 shadow-sm"
          >
            {/* APPLICATION HEADER */}
            <div
              onClick={() => setOpenApplicationId(isOpen ? null : app.id)}
              className="flex items-center justify-between p-6 cursor-pointer select-none border-b border-muted"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-base">
                  {app.title}
                </h3>
                {contractBadge(app.status)}
              </div>

              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>

            {/* APPLICATION BODY */}
            {isOpen && (
              <div className="px-6 pb-6 space-y-10">

                {/* CONTRACT SECTION */}
                <CollapsibleCategory title="Contract financing" filters={["Status", "Date", "Customer"]} >
                  {app.contracts.map((c) => (
                    <Card
                      key={c.id}
                      className="p-6 rounded-xl border border-gray-200"
                    >
                      <div className="flex justify-between">
                        <div className="space-y-3">
                          <p className="text-sm font-semibold">
                            Contract : {c.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Customer : {c.customer}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Contract period : {c.period}
                          </p>
                        </div>

                        <div className="w-[320px] space-y-3">
                          <div className="h-2 bg-gray-200 rounded-full">
                            <div className="h-2 bg-black rounded-full w-[40%]" />
                          </div>
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>{c.utilised}</span>
                            <span>{c.approved}</span>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full h-9 w-9 ml-4"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </CollapsibleCategory>

                {/* INVOICE SECTION */}
                <CollapsibleCategory title="Invoice financing" filters={["Status", "Submission date"]}>
                  {app.invoices.map((inv) => (
                    <Card
                      key={inv.id}
                      className="p-6 rounded-xl border border-gray-200"
                    >
                      <div className="flex justify-between">
                        <div className="space-y-4 flex-1">
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-medium">
                              Invoice no :{" "}
                              <span className="font-semibold">
                                {inv.invoiceNo}
                              </span>
                            </p>
                            {invoiceBadge(inv.status)}
                          </div>

                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Invoice value : {inv.invoiceValue}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Financing amount : {inv.financingAmount}
                            </p>
                          </div>
                        </div>

                        <div className="w-[320px] space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Submission date: {inv.submissionDate}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Maturity date: {inv.maturityDate}
                          </p>

                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-2 bg-black rounded-full"
                              style={{ width: `${inv.progress}%` }}
                            />
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full h-9 w-9 ml-4"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </CollapsibleCategory>

              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

/* ============================================================
   Collapsible Category Component
============================================================ */

function CollapsibleCategory({
  title,
  children,
  filters,
}: {
  title: string
  children: React.ReactNode
  filters?: string[]
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="space-y-4">
      {/* HEADER (no underline) */}
      <div className="flex items-center justify-between">
        {/* LEFT: Title */}
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>

        {/* RIGHT: Filters + Separator + Chevron */}
        <div className="flex items-center">
          {/* Filters (do not toggle collapse) */}
          {filters && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {filters.map((filter) => (
                <FilterButton key={filter} label={filter} />
              ))}
            </div>
          )}

          {/* Vertical Separator */}
          <div className="mx-3 h-6 w-px bg-border" />

          {/* Chevron (toggles collapse) */}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition"
          >
            {open ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* BODY */}
      {open && <div className="space-y-4">{children}</div>}
    </div>
  )
}


function FilterButton({ label }: { label: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs font-medium gap-1 px-3"
    >
      <FunnelIcon className="h-3.5 w-3.5" />
      {label}
    </Button>
  )
}
// "use client"

// import { useState } from "react"
// import { ChevronDown, ChevronUp, MoreVertical, FileText } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { Card } from "@/components/ui/card"

// /* ============================================================
//    Types
// ============================================================ */

// type ContractStatus = "Active" | "Amendment required"
// type InvoiceStatus =
//   | "Draft"
//   | "In progress"
//   | "Funded"
//   | "Completed"
//   | "Unsuccessful"

// /* ============================================================
//    Mock Data
// ============================================================ */

// const mockContracts = [
//   {
//     id: "c1",
//     title: "Mining Rig Repair 12654",
//     customer: "Petronas Chemical Bhd",
//     period: "01/01/2026 to 31/12/2026",
//     utilised: "RM 10,000",
//     approved: "RM 50,000",
//     status: "Active" as ContractStatus,
//   },
//   {
//     id: "c2",
//     title: "Development of Gate Valve",
//     customer: "Petronas Chemical Bhd",
//     period: "01/01/2026 to 31/12/2026",
//     utilised: "RM 10,000",
//     approved: "RM 50,000",
//     status: "Active" as ContractStatus,
//   },
// ]

// const mockInvoices = [
//   {
//     id: "i1",
//     invoiceNo: "INV-11110",
//     status: "Draft" as InvoiceStatus,
//     submissionDate: "03/02/2026",
//     maturityDate: "31/07/2026",
//     invoiceValue: "RM 40,000",
//     financingAmount: "RM 30,000",
//     progress: 0,
//     label: "Funding status (Not yet started)",
//   },
//   {
//     id: "i2",
//     invoiceNo: "INV-11109",
//     status: "In progress" as InvoiceStatus,
//     submissionDate: "03/01/2026",
//     maturityDate: "31/06/2026",
//     invoiceValue: "RM 20,000",
//     financingAmount: "RM 15,000",
//     progress: 75,
//     label: "Funding status (75%)",
//   },
// ]

// /* ============================================================
//    Badge Helpers
// ============================================================ */

// function contractBadge(status: ContractStatus) {
//   if (status === "Active")
//     return <Badge className="bg-green-100 text-green-700">Active</Badge>

//   return (
//     <Badge className="bg-red-100 text-red-600">
//       Amendment required
//     </Badge>
//   )
// }

// function invoiceBadge(status: InvoiceStatus) {
//   switch (status) {
//     case "Draft":
//       return <Badge variant="secondary">Draft</Badge>
//     case "In progress":
//       return <Badge className="bg-green-100 text-green-700">In progress</Badge>
//     case "Funded":
//       return <Badge className="bg-blue-100 text-blue-700">Funded</Badge>
//     case "Completed":
//       return <Badge className="bg-emerald-100 text-emerald-700">Completed</Badge>
//     case "Unsuccessful":
//       return <Badge className="bg-red-100 text-red-600">Unsuccessful</Badge>
//   }
// }

// /* ============================================================
//    Component
// ============================================================ */

// export function FinancingSection() {
//   const [contractOpen, setContractOpen] = useState(true)
//   const [invoiceOpen, setInvoiceOpen] = useState(true)

//   return (
//     <div className="space-y-10">

//       {/* ======================================================
//          CONTRACT SECTION
//       ====================================================== */}

//       <div>
//         <SectionHeader
//           title="Contract financing"
//           open={contractOpen}
//           onToggle={() => setContractOpen(!contractOpen)}
//         />

//         {contractOpen && (
//           <div className="space-y-4 mt-4">
//             {mockContracts.map((c) => (
//               <Card
//                 key={c.id}
//                 className="p-6 rounded-xl border border-gray-200 shadow-sm"
//               >
//                 <div className="flex justify-between">
//                   <div className="space-y-3">
//                     <div className="flex items-center gap-3">
//                       <FileText className="h-4 w-4 text-muted-foreground" />
//                       <p className="font-semibold text-sm">
//                         Contract : {c.title}
//                       </p>
//                       {contractBadge(c.status)}
//                     </div>

//                     <p className="text-sm text-muted-foreground">
//                       Customer : {c.customer}
//                     </p>

//                     <p className="text-sm text-muted-foreground">
//                       Contract period : {c.period}
//                     </p>
//                   </div>

//                   <div className="w-[320px] space-y-3">
//                     <div className="h-2 bg-gray-200 rounded-full">
//                       <div className="h-2 bg-black rounded-full w-[40%]" />
//                     </div>

//                     <div className="flex justify-between text-sm">
//                       <span className="text-muted-foreground">
//                         {c.utilised}
//                       </span>
//                       <span className="text-muted-foreground">
//                         {c.approved}
//                       </span>
//                     </div>

//                     <div className="text-right">
//                       <Button variant="link" className="text-primary p-0">
//                         View details →
//                       </Button>
//                     </div>
//                   </div>

//                   <Button
//                     variant="ghost"
//                     size="icon"
//                     className="rounded-full h-9 w-9 ml-4"
//                   >
//                     <MoreVertical className="h-4 w-4" />
//                   </Button>
//                 </div>
//               </Card>
//             ))}
//           </div>
//         )}
//       </div>

//       {/* ======================================================
//          INVOICE SECTION
//       ====================================================== */}

//       <div>
//         <SectionHeader
//           title="Invoice financing"
//           open={invoiceOpen}
//           onToggle={() => setInvoiceOpen(!invoiceOpen)}
//         />

//         {invoiceOpen && (
//           <div className="space-y-4 mt-4">
//             {mockInvoices.map((inv) => (
//               <Card
//                 key={inv.id}
//                 className="p-6 rounded-xl border border-gray-200 shadow-sm"
//               >
//                 <div className="flex justify-between">
//                   <div className="space-y-4 flex-1">
//                     <div className="flex items-center gap-3">
//                       <FileText className="h-4 w-4 text-muted-foreground" />
//                       <p className="text-sm font-medium">
//                         Invoice no :{" "}
//                         <span className="font-semibold">
//                           {inv.invoiceNo}
//                         </span>
//                       </p>
//                       {invoiceBadge(inv.status)}
//                     </div>

//                     <div className="space-y-1">
//                       <p className="text-sm text-muted-foreground">
//                         Invoice value :{" "}
//                         <span className="font-medium text-foreground">
//                           {inv.invoiceValue}
//                         </span>
//                       </p>
//                       <p className="text-sm text-muted-foreground">
//                         Financing amount :{" "}
//                         <span className="font-medium text-foreground">
//                           {inv.financingAmount}
//                         </span>
//                       </p>
//                     </div>
//                   </div>

//                   <div className="w-[320px] space-y-3">
//                     <div className="text-sm text-muted-foreground space-y-1">
//                       <p>
//                         Submission date:{" "}
//                         <span className="text-foreground font-medium">
//                           {inv.submissionDate}
//                         </span>
//                       </p>
//                       <p>
//                         Maturity date:{" "}
//                         <span className="text-foreground font-medium">
//                           {inv.maturityDate}
//                         </span>
//                       </p>
//                     </div>

//                     <div className="space-y-2">
//                       <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
//                         <div
//                           className="h-2 bg-black rounded-full"
//                           style={{ width: `${inv.progress}%` }}
//                         />
//                       </div>
//                       <p className="text-xs text-muted-foreground">
//                         {inv.label}
//                       </p>
//                     </div>
//                   </div>

//                   <Button
//                     variant="ghost"
//                     size="icon"
//                     className="rounded-full h-9 w-9 ml-4"
//                   >
//                     <MoreVertical className="h-4 w-4" />
//                   </Button>
//                 </div>
//               </Card>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }

// /* ============================================================
//    Reusable Section Header
// ============================================================ */

// function SectionHeader({
//   title,
//   open,
//   onToggle,
// }: {
//   title: string
//   open: boolean
//   onToggle: () => void
// }) {
//   return (
//     <div
//       onClick={onToggle}
//       className="flex items-center justify-between cursor-pointer select-none"
//     >
//       <h3 className="text-lg font-semibold">{title}</h3>

//       {open ? (
//         <ChevronUp className="h-5 w-5 text-muted-foreground" />
//       ) : (
//         <ChevronDown className="h-5 w-5 text-muted-foreground" />
//       )}
//     </div>
//   )
// }