"use client";

import React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@sezsec/shared";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { label, hint, error, leftAddon, rightAddon, className, id, ...props },
    ref
  ) {
    const reactId = React.useId();
    const inputId = id || reactId;

    return (
      <div className="min-w-0 space-y-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold tracking-wide text-[#3D2E2A]"
          >
            {label}
            {props.required ? (
              <span className="ml-0.5 text-[#991B1B]">*</span>
            ) : null}
          </label>
        ) : null}
        <div className="relative flex items-center">
          {leftAddon ? (
            <div className="pointer-events-none absolute left-3 flex items-center text-[#8C7B73]">
              {leftAddon}
            </div>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-10 min-w-0 w-full rounded-xl border bg-white px-3.5 text-sm text-[#231917] placeholder:text-[#9E8E85] transition-colors focus:border-[#6A1B1B] focus:outline-none focus:ring-2 focus:ring-[#6A1B1B]/12 disabled:bg-[#F5F1E9] disabled:text-[#8C7B73]",
              error ? "border-[#B91C1C]" : "border-[#DCD2C2]",
              leftAddon ? "pl-9" : "",
              rightAddon ? "pr-9" : "",
              className
            )}
            {...props}
          />
          {rightAddon ? (
            <div className="absolute right-3 flex items-center text-[#8C7B73]">
              {rightAddon}
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="text-xs font-medium text-[#B91C1C]">{error}</p>
        ) : hint ? (
          <p className="text-xs text-[#7B6B63]">{hint}</p>
        ) : null}
      </div>
    );
  }
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hint, error, className, id, ...props }, ref) {
    const reactId = React.useId();
    const areaId = id || reactId;

    return (
      <div className="min-w-0 space-y-1.5">
        {label ? (
          <label
            htmlFor={areaId}
            className="block text-xs font-semibold tracking-wide text-[#3D2E2A]"
          >
            {label}
            {props.required ? (
              <span className="ml-0.5 text-[#991B1B]">*</span>
            ) : null}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={areaId}
          className={cn(
            "min-h-[88px] min-w-0 w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-[#231917] placeholder:text-[#9E8E85] transition-colors focus:border-[#6A1B1B] focus:outline-none focus:ring-2 focus:ring-[#6A1B1B]/12 disabled:bg-[#F5F1E9]",
            error ? "border-[#B91C1C]" : "border-[#DCD2C2]",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs font-medium text-[#B91C1C]">{error}</p>
        ) : hint ? (
          <p className="text-xs text-[#7B6B63]">{hint}</p>
        ) : null}
      </div>
    );
  }
);

export function NumericStepper({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 99999,
  step = 1,
  suffix,
  disabled,
}: {
  label?: string;
  hint?: string;
  value: number;
  onChange: (nextValue: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));

  return (
    <div className="min-w-0 space-y-1.5">
      {label ? (
        <label className="block text-xs font-semibold tracking-wide text-[#3D2E2A]">
          {label}
        </label>
      ) : null}
      <div className="flex h-10 min-w-0 items-center overflow-hidden rounded-xl border border-[#DCD2C2] bg-white focus-within:border-[#6A1B1B] focus-within:ring-2 focus-within:ring-[#6A1B1B]/12">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - step))}
          aria-label="Decrease"
          className="flex h-full w-9 shrink-0 items-center justify-center border-r border-[#EAE2D6] text-[#5E4F4A] hover:bg-[#F6F1E7] disabled:opacity-40 cursor-pointer"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="relative flex min-w-0 flex-1 items-center">
          <input
            type="text"
            inputMode="numeric"
            disabled={disabled}
            value={String(value ?? 0)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, "");
              onChange(clamp(digits === "" ? 0 : parseInt(digits, 10)));
            }}
            className="min-w-0 w-full bg-transparent px-2 text-center text-sm font-semibold text-[#231917] focus:outline-none"
          />
          {suffix ? (
            <span className="shrink-0 pr-2 text-xs text-[#8C7B73]">{suffix}</span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + step))}
          aria-label="Increase"
          className="flex h-full w-9 shrink-0 items-center justify-center border-l border-[#EAE2D6] text-[#5E4F4A] hover:bg-[#F6F1E7] disabled:opacity-40 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {hint ? <p className="text-xs text-[#7B6B63]">{hint}</p> : null}
    </div>
  );
}
