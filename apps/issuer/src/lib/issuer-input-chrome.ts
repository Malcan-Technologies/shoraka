/**
 * Issuer field chrome — source of truth: Notes → Note detail → “Confirm repayment” → **Payment reference**
 * (`components/ui/input` with default classes). Use for inputs, textareas, selects, date shells, and stepper
 * unvisited nodes so border weight, radius, fill, and shadow stay aligned.
 */
/** Default single-line control height (unchanged from pre-chrome pass). */
export const issuerFieldHeightClassName = "h-11";

export const issuerFieldChromeClassName =
  "rounded-md border border-input bg-background shadow-sm";

export const issuerFieldFocusClassName =
  "transition-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary";

export const issuerFieldFocusWithinOpenClassName =
  "transition-none focus-within:border-primary data-[state=open]:border-primary data-[state=open]:ring-0 data-[state=open]:outline-none";

/** Stepper: unvisited step circle — same 1px border + shadow as a default text field (not `border-2`). */
export const issuerStepperUnvisitedCircleClassName =
  "border border-input bg-background shadow-sm";

/** Connector segment before an unvisited step — same line color token as input border. */
export const issuerStepperUnvisitedConnectorClassName = "bg-input";

/** Chosen-file row shell (contract / business / invoice upload summary) — same chrome as a text field. */
export const issuerUploadFileRowClassName =
  "rounded-md border border-input bg-background shadow-sm transition-none";

/** Dashed file-upload tap target — same 1px border + shadow language as inputs. */
export const issuerUploadDropzoneClassName =
  "rounded-md border border-dashed border-input bg-card/50 shadow-sm transition-none";
