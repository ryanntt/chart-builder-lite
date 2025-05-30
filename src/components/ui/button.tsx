
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        lgPrimary:
          "border px-3 gap-1.5 bg-[var(--btn-primary-lg-bg)] text-[var(--btn-primary-lg-fg)] border-[var(--btn-primary-lg-border)] hover:bg-[var(--btn-primary-lg-hover-bg)] hover:text-[var(--btn-primary-lg-hover-fg)] hover:border-[var(--btn-primary-lg-hover-border)] hover:shadow-[var(--btn-primary-lg-hover-shadow)] focus-visible:ring-[var(--btn-primary-lg-focus-ring)] [&_svg]:text-[hsl(var(--btn-primary-lg-icon-hsl))]",
        lgDisabled:
          "border px-3 gap-1.5 bg-[var(--btn-primary-lg-disabled-bg)] text-[var(--btn-primary-lg-disabled-fg)] border-[var(--btn-primary-lg-disabled-border)] [&_svg]:text-[hsl(var(--btn-primary-lg-disabled-icon-hsl))] cursor-not-allowed opacity-100",
        themedSystem: 
          "bg-neutral-200 text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600",
        lgDefault:
          "border px-3 gap-1.5 bg-[var(--btn-default-lg-bg)] text-[var(--btn-default-lg-fg)] border-[var(--btn-default-lg-border)] hover:bg-[var(--btn-default-lg-hover-bg)] focus-visible:ring-[var(--btn-primary-lg-focus-ring)] [&_svg]:text-[hsl(var(--btn-default-lg-icon-hsl))]",
        lgDefaultNoText:
          "border px-3 bg-[var(--btn-default-notext-lg-bg)] text-[var(--btn-default-notext-lg-fg)] border-[var(--btn-default-notext-lg-border)] hover:bg-[var(--btn-default-notext-lg-hover-bg)] focus-visible:ring-[var(--btn-primary-lg-focus-ring)] [&_svg]:text-[hsl(var(--btn-default-notext-lg-icon-hsl))]",
      },
      size: {
        default: "h-9 px-3", // 36px height, 12px horizontal padding
        sm: "h-7 px-3",    // 28px height, 12px horizontal padding
        icon: "h-9 w-9",   // Adjusted to align with default height
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
