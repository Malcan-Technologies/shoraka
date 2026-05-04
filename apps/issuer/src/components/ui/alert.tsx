import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full border px-4 py-3 shadow-sm [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "rounded-lg bg-card text-card-foreground border-border text-sm",
        destructive:
          "rounded-lg border-destructive/50 bg-destructive/5 text-destructive text-sm [&_[data-slot=alert-description]]:text-destructive/90",
        /** Brand callout: primary wash + primary frame (issuer notices, onboarding). */
        attention:
          "rounded-2xl border-2 border-primary/45 bg-primary/10 text-foreground [&_[data-slot=alert-title]]:text-primary [&_[data-slot=alert-description]]:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("mb-1 font-semibold leading-none tracking-tight text-[17px]", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-[15px] leading-7 [&_p]:leading-7 [&_p]:text-[17px]", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
