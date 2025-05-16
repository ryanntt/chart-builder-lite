
"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center justify-start border-b border-[var(--border-color-secondary)] text-muted-foreground", // Ensure justify-start for content-wrapping width
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap px-4 pb-[calc(0.5rem-2px)] pt-2 text-sm font-medium transition-all", // Adjusted padding
      "text-[var(--lg-gray-dark-1)] dark:text-[var(--lg-gray-light-1)]", // Inactive text color
      "border-b-2 border-transparent", // Base transparent border for inactive state
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:rounded-t-sm", // Focus state
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:text-[var(--lg-green-dark-2)] dark:data-[state=active]:text-[var(--lg-green-dark-2)]", // Active text color
      "data-[state=active]:border-[var(--lg-green-dark-1)] dark:data-[state=active]:border-[var(--lg-green-dark-1)]", // Active border color
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }

