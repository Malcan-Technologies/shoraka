 "use client";

 import * as React from "react";
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from "@/components/ui/table";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Plus, Trash2, CloudUpload } from "lucide-react";
 import { XMarkIcon } from "@heroicons/react/24/outline";
 import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
 import { cn } from "@/lib/utils";

 /**
  * MOCK-FIRST INVOICE DETAILS STEP
  *
  * This mock implementation preserves the component API used by the parent page:
  *  - props: { applicationId, onDataChange }
  *  - onDataChange receives the same shaped payload as the real step.
  *
  * It uses in-file mock data and local state only. Replace with real hooks and
  * API calls when backend is ready.
  */

 interface InvoiceDetailsStepProps {
   applicationId: string;
   onDataChange?: (data: any) => void;
 }

 /** MOCK DATA — replace after backend is built */
 const MOCK_APPLICATION: any = {
   contract: {
     id: "contract-mock-1",
     contract_details: {
       title: "Mining Rig Repair 12654",
       value: 5000000,
       approved_facility: 2000000,
       utilized_facility: 500000,
       available_facility: 1500000,
     },
     customer_details: { name: "Petronas Chemical Bhd" },
   },
 };

const MOCK_INVOICES = [
   {
     id: "inv-1",
     number: "#3066",
     value: 10000,
     maturity_date: "2025-01-06",
     status: "DRAFT",
     document: null,
     isReadOnly: false,
   },
   {
     id: "inv-2",
     number: "#3065",
     value: 20000,
     maturity_date: "2025-02-12",
     status: "DRAFT",
     document: null,
     isReadOnly: false,
   },
];

export function InvoiceDetailsStep({ applicationId: _applicationId, onDataChange }: InvoiceDetailsStepProps) {
  /**
   * Component inputs
   *
   * - applicationId: kept for API parity with the real step (unused in mock)
   * - onDataChange: callback invoked with the step state/validation info
   */

  // Use the mock application data in place of real hook
  const application = MOCK_APPLICATION;
  const contractDetails = (application as any).contract.contract_details || {};

  /**
   * Local state
   *
   * localInvoices: Array<{ id, number, value, maturity_date, status, document?, isReadOnly? }>
   * - document (when present) shape: { file_name: string, file_size: number, s3_key: string }
   *
   * pendingInvoiceFiles: Record<invoiceId, File>
   * - Tracks files selected by the user that are not yet uploaded.
   *
   * localValidationError: string | null - step-level validation message shown to user.
   */
  const [localInvoices, setInvoices] = React.useState<any[]>(MOCK_INVOICES);
  const [pendingInvoiceFiles, setPendingInvoiceFiles] = React.useState<Record<string, File>>({});
  const [localValidationError, setLocalValidationError] = React.useState<string | null>(null);
  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  /**
   * initialInvoicesRef
   *
   * - Stores a JSON snapshot of the invoices on initial load/save.
   * - Used to detect hasPendingChanges by comparing current state to this snapshot.
   */
  const initialInvoicesRef = React.useRef<string>(JSON.stringify(MOCK_INVOICES));

  /**
   * totalFinancingAmount
   *
   * - Business rule: maximum financing per invoice is 80% of its value.
   * - This value is derived live from localInvoices and used in validations and display.
   */
  const totalFinancingAmount = localInvoices.reduce((acc, inv) => acc + ((inv.value || 0) * 0.8), 0);

  /**
   * formatCurrency
   *
   * - Formats numeric values into Malaysian Ringgit string: "RM 1,234.00"
   */
  const formatCurrency = (value: any) => {
     const num =
       typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.]/g, "")) || 0;
     return `RM ${num.toLocaleString(undefined, {
       minimumFractionDigits: 2,
       maximumFractionDigits: 2,
     })}`;
   };

   const StatusBadge = ({ status }: { status?: string }) => {
     if (!status) return null;
     const colors: Record<string, string> = {
       DRAFT: "bg-slate-100 text-slate-700",
       SUBMITTED: "bg-blue-100 text-blue-700",
       APPROVED: "bg-green-100 text-green-700",
       REJECTED: "bg-red-100 text-red-700",
     };
     return (
       <span
         className={cn(
           "px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
           colors[status] || colors.DRAFT
         )}
       >
         {status}
       </span>
     );
   };

  /**
   * Local helpers
   *
   * - handleAddInvoice(): append a new draft invoice to localInvoices
   * - handleDeleteInvoice(id): remove an invoice and clear any pending file
   * - handleUpdateInvoiceLocal(id, field, value): optimistic local update of a field
   * - handleFileUpload(id, file): basic validation and mark local document as pending
   */
  const handleAddInvoice = () => {
     const newInvoice = {
       id: `inv-${Date.now()}`,
       number: "",
       value: 0,
       maturity_date: "",
       status: "DRAFT",
       document: null,
       isReadOnly: false,
     };
     setInvoices((prev) => [...prev, newInvoice]);
   };

   const handleDeleteInvoice = (id: string) => {
     setInvoices((prev) => prev.filter((i) => i.id !== id));
     setPendingInvoiceFiles((prev) => {
       const copy = { ...prev };
       delete copy[id];
       return copy;
     });
   };

   const handleUpdateInvoiceLocal = (id: string, field: string, value: any) => {
     setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv)));
   };

  const handleFileUpload = (invoiceId: string, file: File) => {
    /**
     * handleFileUpload
     *
     * - Validates file type/size in the mock.
     * - Stores the File in pendingInvoiceFiles and sets a local document marker:
     *   { file_name, file_size, s3_key: "pending" }
     *
     * Real implementation will request an upload URL and PUT the file to S3.
     */
    // Basic validation (mock)
    if (file.type !== "application/pdf") {
      // eslint-disable-next-line no-console
      console.warn("Only PDF allowed in mock");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      // eslint-disable-next-line no-console
      console.warn("File too large in mock");
      return;
    }

    setPendingInvoiceFiles((prev) => ({ ...prev, [invoiceId]: file }));
    handleUpdateInvoiceLocal(invoiceId, "document", {
      file_name: file.name,
      file_size: file.size,
      s3_key: "pending",
    });
  };

  /**
   * saveFunction (mock)
   *
   * - Returned to parent via onDataChange.
   * - In mock: clears pending files and updates the initial snapshot.
   * - In real implementation: should upload files, update invoices, and return the updated data.
   */
  const saveFunction = async () => {
    // In a real implementation this would upload pendingInvoiceFiles and update server
    initialInvoicesRef.current = JSON.stringify(localInvoices);
    setPendingInvoiceFiles({});
    return Promise.resolve(true);
  };

  /**
   * Validation & notify parent
   *
   * - Validates invoices and facility limits.
   * - Computes hasPendingChanges and isUploading.
   * - Calls onDataChange with the exact payload parent expects:
   *   { invoices, totalFinancingAmount, isValid, validationError, available_facility, utilized_facility, hasPendingChanges, saveFunction, isUploading }
   */
  React.useEffect(() => {
     let validationError: string | null = null;
     if (localInvoices.length === 0) {
       validationError = "Please add at least one invoice.";
     }

     if (!validationError) {
       const invalid = localInvoices.find((inv) => {
         const hasNumber = inv.number && inv.number.toString().trim() !== "";
         const hasValue = inv.value && inv.value > 0;
         const hasDate = inv.maturity_date && inv.maturity_date.toString().trim() !== "";
         const hasDocument =
           (inv.document && inv.document.s3_key && inv.document.s3_key !== "pending") ||
           Boolean(pendingInvoiceFiles[inv.id]);
         return !hasNumber || !hasValue || !hasDate || !hasDocument;
       });
       if (invalid) {
         validationError = "Each invoice must have a number, value, maturity date, and uploaded document.";
       }
     }

     // Facility validation (mock)
     const approvedFacilityAmt = contractDetails.approved_facility || 0;
     const contractValueAmt = contractDetails.value || 0;
     if (!validationError) {
       if (approvedFacilityAmt > 0) {
         if (totalFinancingAmount > approvedFacilityAmt) {
           validationError = "Total financing amount exceeds approved facility limit. Please adjust invoice values.";
         }
       } else {
         if (totalFinancingAmount > contractValueAmt) {
           validationError = "Total financing amount exceeds contract value. Please adjust invoice values.";
         }
       }
     }

     setLocalValidationError(validationError);

     const currentState = JSON.stringify(localInvoices);
     const hasPendingFileUploads = Object.keys(pendingInvoiceFiles).length > 0;
     const hasPendingChanges = currentState !== initialInvoicesRef.current || hasPendingFileUploads;

     const isValid = !validationError;
     const isUploadingAny = hasPendingFileUploads;

     onDataChangeRef.current?.({
       invoices: localInvoices,
       totalFinancingAmount,
       isValid,
       validationError,
       available_facility: contractDetails.available_facility,
       utilized_facility: contractDetails.utilized_facility,
       hasPendingChanges,
       saveFunction,
       isUploading: isUploadingAny,
     });
   }, [localInvoices, pendingInvoiceFiles, totalFinancingAmount, contractDetails, onDataChangeRef]);

  /**
   * Display helpers
   *
   * - approvedFacilityAmt: numeric approved facility on contract
   * - displayAvailableFacility: computed available facility after subtracting totals
   */
  const approvedFacilityAmt = contractDetails.approved_facility || 0;
  const displayAvailableFacility =
    approvedFacilityAmt > 0 ? approvedFacilityAmt - totalFinancingAmount : (contractDetails.value || 0) - totalFinancingAmount;

   return (
     <div className="space-y-12 pb-8">
       <section className="space-y-6">
         <h2 className="text-base sm:text-lg md:text-xl font-semibold">Contract</h2>
         <div className="space-y-4 border rounded-xl px-4 py-4 bg-card/50">
           <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
             <div className="text-muted-foreground">Contract title</div>
             <div className="font-medium text-foreground">{contractDetails.title || "-"}</div>
           </div>
           <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
             <div className="text-muted-foreground">Customer</div>
             <div className="font-medium text-foreground">{(application?.contract?.customer_details as any)?.name || "-"}</div>
           </div>
           <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
             <div className="text-muted-foreground">Contract value</div>
             <div className="font-medium text-foreground">{formatCurrency(contractDetails.value)}</div>
           </div>
           <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
             <div className="text-muted-foreground">Approved facility</div>
             <div className="font-medium text-foreground">{formatCurrency(contractDetails.approved_facility)}</div>
           </div>
           <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
             <div className="text-muted-foreground">Utilised facility</div>
             <div className="font-medium text-foreground">{formatCurrency(contractDetails.utilized_facility)}</div>
           </div>
           <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
             <div className="text-muted-foreground">Available facility</div>
             <div className="flex items-center gap-2">
               <span className={cn(displayAvailableFacility < 0 && "text-destructive font-bold")}>
                 {formatCurrency(displayAvailableFacility)}
               </span>
             </div>
           </div>
         </div>
       </section>

       <section className="space-y-6">
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div className="max-w-2xl">
             <h2 className="text-base sm:text-lg md:text-xl font-semibold">Invoices</h2>
             <p className="text-sm text-muted-foreground mt-1">
               You may include multiple invoices in a single financing request, provided all invoices
               relate to the same underlying contract with the buyer
             </p>
           </div>
           <Button onClick={handleAddInvoice} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center gap-2 w-full sm:w-auto justify-center">
             <Plus className="h-4 w-4" />
             Add invoice
           </Button>
         </div>

         <div className="border rounded-xl overflow-hidden bg-card">
           <div className="overflow-x-auto">
             <Table>
               <TableHeader className="bg-muted/30">
                 <TableRow className="hover:bg-transparent border-b">
                   <TableHead className="w-[180px] min-w-[150px]">Invoice</TableHead>
                   <TableHead className="w-[100px]">Status</TableHead>
                   <TableHead className="w-[180px] min-w-[140px]">Invoice value</TableHead>
                   <TableHead className="w-[180px] min-w-[160px]">Maturity date</TableHead>
                   <TableHead className="min-w-[180px]">Max financing amount (80%)</TableHead>
                   <TableHead className="w-[180px] min-w-[150px]">Documents</TableHead>
                   <TableHead className="w-[60px]"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {localInvoices.map((invoice) => {
                   const isApproved = invoice.status === "APPROVED";
                   const isDisabled = invoice.isReadOnly || isApproved;
                   const maxFinancing = (invoice.value || 0) * 0.8;

                   return (
                     <TableRow key={invoice.id} className={cn("border-b last:border-0 h-[72px]", isDisabled && "bg-muted/30 opacity-70")}>
                       <TableCell>
                         <div className="flex flex-col gap-1">
                           {!isDisabled ? (
                             <Input
                               value={invoice.number}
                               onChange={(e) => handleUpdateInvoiceLocal(invoice.id, "number", e.target.value)}
                               className="h-9 rounded-md border border-input bg-background text-foreground"
                               placeholder="#Invoice number"
                             />
                           ) : (
                             <span className="font-medium text-muted-foreground">{invoice.number}</span>
                           )}
                         </div>
                       </TableCell>
                       <TableCell>
                         <StatusBadge status={invoice.status} />
                       </TableCell>
                       <TableCell>
                         {!isDisabled ? (
                           <Input
                             min={0}
                             value={invoice.value || ""}
                             onChange={(e) =>
                               handleUpdateInvoiceLocal(invoice.id, "value", Math.max(0, parseFloat(e.target.value) || 0))
                             }
                             className="h-9 rounded-md border border-input bg-background text-foreground"
                             placeholder="0"
                           />
                         ) : (
                           <span className="text-muted-foreground">{formatCurrency(invoice.value)}</span>
                         )}
                       </TableCell>
                       <TableCell>
                         {!isDisabled ? (
                           <Input
                             type="date"
                             value={invoice.maturity_date}
                             onChange={(e) => handleUpdateInvoiceLocal(invoice.id, "maturity_date", e.target.value)}
                             className="h-9 rounded-md border border-input bg-background text-foreground"
                           />
                         ) : (
                           <span className="text-muted-foreground">
                             {invoice.maturity_date ? new Date(invoice.maturity_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"}
                           </span>
                         )}
                       </TableCell>
                       <TableCell>
                         <span className={cn("font-medium", isDisabled ? "text-muted-foreground" : "text-foreground")}>
                           {formatCurrency(maxFinancing)}
                         </span>
                       </TableCell>
                       <TableCell>
                         <div className="flex items-center gap-2">
                           {invoice.document ? (
                             <div className={cn("inline-flex items-center gap-2 bg-background text-foreground border-2 border-border rounded-sm px-2 py-1 max-w-full", isDisabled && "opacity-70 bg-muted/30")}>
                               <div className="w-3.5 h-3.5 rounded flex items-center justify-center bg-foreground shrink-0">
                                 <CheckIconSolid className="h-3 w-3 text-background" />
                               </div>
                               <span className="text-sm truncate max-w-[120px] sm:max-w-[200px]">{invoice.document.file_name}</span>
                               {!isDisabled && (
                                 <button className="hover:text-destructive transition-colors cursor-pointer shrink-0 ml-1" type="button" onClick={() => { handleUpdateInvoiceLocal(invoice.id, "document", null); setPendingInvoiceFiles((prev) => { const newFiles = { ...prev }; delete newFiles[invoice.id]; return newFiles; }); }}>
                                   <XMarkIcon className="h-4 w-4" />
                                 </button>
                               )}
                             </div>
                           ) : (
                             !isDisabled && (
                               <label className="flex items-center gap-2 text-[#800000] font-medium hover:underline text-sm cursor-pointer">
                                 <CloudUpload className="h-4 w-4" />
                                 Upload file
                                 <input type="file" className="hidden" accept=".pdf,application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(invoice.id, file); }} />
                               </label>
                             )
                           )}
                         </div>
                       </TableCell>
                       <TableCell>
                         <div className="flex items-center justify-end gap-2 pr-2">
                           {!isDisabled && (
                             <button onClick={() => handleDeleteInvoice(invoice.id)} className="p-1 text-muted-foreground hover:text-destructive hover:bg-muted rounded-md transition-colors">
                               <Trash2 className="h-4 w-4" />
                             </button>
                           )}
                         </div>
                       </TableCell>
                     </TableRow>
                   );
                 })}
                 <TableRow className="bg-muted/10 font-bold border-t-2 h-[72px]">
                   <TableCell colSpan={4}></TableCell>
                   <TableCell>
                     <div className="space-y-1">
                       <div className="text-foreground">{formatCurrency(totalFinancingAmount)}</div>
                       <div className="text-sm text-muted-foreground font-normal">Total financing amount</div>
                     </div>
                   </TableCell>
                   <TableCell colSpan={2}></TableCell>
                 </TableRow>
               </TableBody>
             </Table>
           </div>
         </div>

         {localValidationError && (
           <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 mt-6">
             <XMarkIcon className="h-5 w-5" />
             {localValidationError}
           </div>
         )}

         <p className="text-right text-sm italic text-muted-foreground mt-4">
           Estimated fees based on 15% p.a. but exact amount will only be decided in offer letter
         </p>
       </section>
     </div>
   );
 }

