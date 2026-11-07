"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@sezsec/shared";

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 select-none",
        disabled ? "opacity-55 cursor-not-allowed" : "cursor-pointer",
        className
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer",
          checked
            ? "border-[#6A1B1B] bg-[#6A1B1B] text-white"
            : "border-[#C9BCAA] bg-white hover:border-[#6A1B1B]"
        )}
      >
        {checked ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : null}
      </button>
      {(label || description) && (
        <div className="min-w-0">
          {label ? (
            <div className="text-sm font-medium text-[#231917]">{label}</div>
          ) : null}
          {description ? (
            <div className="text-xs text-[#7B6B63]">{description}</div>
          ) : null}
        </div>
      )}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-[#E5DDD0] bg-white px-3.5 py-2.5 transition-colors select-none",
        checked ? "border-[#D9C398] bg-[#FBF8F1]" : "hover:bg-[#FAF7F2]",
        disabled ? "opacity-55 cursor-not-allowed" : "cursor-pointer",
        className
      )}
    >
      <div className="min-w-0">
        {label ? (
          <div className="text-sm font-medium text-[#231917]">{label}</div>
        ) : null}
        {description ? (
          <div className="text-xs text-[#7B6B63]">{description}</div>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onChange(!checked);
        }}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer",
          checked ? "bg-[#6A1B1B]" : "bg-[#D5C9B8]"
        )}
      >
        <span
          className={cn(
            "inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition-transform",
            checked ? "translate-x-5.5" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
