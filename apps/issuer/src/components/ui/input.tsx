import * as React from "react"

import { cn } from "@/lib/utils"
import {
  issuerFieldChromeClassName,
  issuerFieldFocusClassName,
  issuerFieldHeightClassName,
} from "@/lib/issuer-input-chrome"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full px-3 py-1 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:border-input md:text-sm",
          issuerFieldHeightClassName,
          issuerFieldChromeClassName,
          issuerFieldFocusClassName,
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

