
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "bg-[var(--lg-white)] dark:bg-[var(--lg-gray-dark-4)]",
          "border-[var(--lg-gray-base)] dark:border-[var(--lg-gray-base)]",
          "placeholder:text-[var(--lg-gray-dark-1)] dark:placeholder:text-[var(--lg-gray-light-1)]",
          "text-[var(--lg-black)] dark:text-[var(--lg-gray-light-2)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          "px-3 py-2 text-base md:text-sm",
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
