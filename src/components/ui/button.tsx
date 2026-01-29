import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles with Tier S micro-interactions
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-button hover:bg-primary/90 hover:shadow-button-hover hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-button hover:bg-destructive/90 hover:shadow-button-hover hover:-translate-y-0.5",
        success:
          "bg-emerald-600 text-white shadow-button hover:bg-emerald-700 hover:shadow-button-hover hover:-translate-y-0.5",
        outline:
          "border-2 border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent",
        secondary:
          "bg-secondary text-secondary-foreground shadow-button hover:bg-secondary/80 hover:shadow-button-hover hover:-translate-y-0.5",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto",
        // Premium variants for enterprise feel
        premium:
          "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-elegant hover:shadow-glow hover:-translate-y-0.5 hover:from-primary/90 hover:to-primary/70",
      },
      size: {
        xs: "h-8 rounded-lg px-3 text-xs",
        sm: "h-9 rounded-lg px-4 text-sm",
        default: "h-11 px-5 py-2",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-11 w-11",
        "icon-sm": "h-9 w-9 rounded-lg",
        "icon-xs": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Loading spinner component
const ButtonSpinner = () => (
  <Loader2 className="h-4 w-4 animate-spin" />
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    // When loading, show spinner and optionally loading text
    const content = loading ? (
      <>
        <ButtonSpinner />
        {loadingText && <span>{loadingText}</span>}
        {!loadingText && <span className="opacity-0">{children}</span>}
      </>
    ) : (
      children
    );

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {asChild ? children : content}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
