import * as React from "react"

import { cn } from "@/lib/utils"
import {
  issuerFieldChromeClassName,
  issuerFieldFocusClassName,
} from "@/lib/issuer-input-chrome"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full px-3 py-2 text-base placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:border-input md:text-sm",
        issuerFieldChromeClassName,
        issuerFieldFocusClassName,
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }

