import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-xl border border-border/80 bg-transparent px-4 py-3 text-base shadow-sm placeholder:text-muted-foreground hover:border-primary/30 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:border-border md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }

