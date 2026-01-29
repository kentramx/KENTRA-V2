import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  // Base styles with Tier S focus animation
  "flex w-full rounded-xl border bg-background px-4 text-base ring-offset-background transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-input focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:shadow-input-focus",
        error:
          "border-destructive focus-visible:ring-2 focus-visible:ring-destructive/20 focus-visible:border-destructive text-destructive",
        success:
          "border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500",
        ghost:
          "border-transparent bg-muted focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary",
      },
      inputSize: {
        sm: "h-9 px-3 text-sm rounded-lg",
        default: "h-11 py-2",
        lg: "h-12 py-3 text-base",
        xl: "h-14 py-4 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, inputVariants };
