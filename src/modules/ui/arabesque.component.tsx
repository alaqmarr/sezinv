import React from "react";
import { cn } from "@sezsec/shared";

export function FatimidRosette({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0 text-[#B8924A]", className)}
    >
      <path
        d="M16 1.5L19.1 8.9L26.3 5.7L23.1 12.9L30.5 16L23.1 19.1L26.3 26.3L19.1 23.1L16 30.5L12.9 23.1L5.7 26.3L8.9 19.1L1.5 16L8.9 12.9L5.7 5.7L12.9 8.9L16 1.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="3.5" stroke="currentColor" strokeWidth="1.15" />
    </svg>
  );
}

export function ArabesqueDivider({
  label,
  arabicLabel,
  className,
}: {
  label?: string;
  arabicLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 py-1", className)}>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#D9C398] to-[#B8924A]/60" />
      <div className="flex items-center gap-2 text-[#8C7B73]">
        <FatimidRosette size={14} />
        {label ? (
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#6A1B1B]">
            {label}
          </span>
        ) : null}
        {arabicLabel ? (
          <span dir="rtl" className="font-arabic text-base text-[#6A1B1B]">
            {arabicLabel}
          </span>
        ) : null}
        {(label || arabicLabel) && <FatimidRosette size={14} />}
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#D9C398] to-[#B8924A]/60" />
    </div>
  );
}

export function KeelArchBanner({
  arabicTitle = "بسم الله الرحمن الرحيم",
  subtitle,
  className,
}: {
  arabicTitle?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-[#D9C398] bg-gradient-to-b from-[#FBF6EB] to-[#FFFFFF] px-5 py-3.5 text-center",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#6A1B1B] to-transparent opacity-80" />
      <p dir="rtl" className="font-arabic text-xl text-[#6A1B1B] sm:text-2xl">
        {arabicTitle}
      </p>
      {subtitle ? (
        <p className="mt-0.5 text-xs tracking-wide text-[#5E4F4A]">{subtitle}</p>
      ) : null}
    </div>
  );
}
