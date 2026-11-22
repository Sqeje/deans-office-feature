import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../shared/utils";
const variants = cva(
  "ui-button inline-flex items-center justify-center text-sm font-semibold",
  {
    variants: {
      variant: {
        default: "ui-button-primary",
        primary: "ui-button-primary",
        secondary: "ui-button-secondary",
        outline: "ui-button-outline",
        ghost: "ui-button-ghost",
        danger: "ui-button-danger",
      },
      size: {
        default: "",
        compact: "ui-button-compact",
        icon: "ui-button-icon",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export function Button({
  className,
  variant,
  size,
  asChild = false,
  pending = false,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof variants> & { asChild?: boolean; pending?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(variants({ variant, size }), className)}
      aria-busy={pending || undefined}
      disabled={!asChild && (disabled || pending) ? true : undefined}
      {...props}
    />
  );
}
