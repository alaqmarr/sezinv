"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@sezsec/shared";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "brass"
  | "ghost"
  | "danger"
  | "success";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[#6A1B1B] text-[#FAF7F2] border border-[#561414] hover:bg-[#521313] shadow-xs",
  secondary:
    "bg-[#FFFFFF] text-[#231917] border border-[#D8CEBE] hover:bg-[#F6F1E7] hover:border-[#C5B397]",
  brass:
    "bg-[#FBF6EB] text-[#5C3D10] border border-[#D9C398] hover:bg-[#F5EBD4]",
  ghost:
    "bg-transparent text-[#5E4F4A] border border-transparent hover:bg-[#F3EFE6] hover:text-[#231917]",
  danger:
    "bg-[#991B1B] text-white border border-[#7F1D1D] hover:bg-[#7F1D1D]",
  success:
    "bg-[#2A6041] text-white border border-[#1F4A31] hover:bg-[#214D34]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs rounded-lg gap-1.5",
  sm: "h-8.5 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-11.5 px-5 text-sm rounded-xl gap-2.5",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6A1B1B] disabled:pointer-events-none disabled:opacity-55 cursor-pointer select-none",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);
