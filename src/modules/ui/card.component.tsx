import React from "react";
import { cn } from "@sezsec/shared";

export function Card({
  children,
  className,
  accentTop = false,
}: {
  children: React.ReactNode;
  className?: string;
  accentTop?: boolean;
}) {
  return (
    <div
      className={cn(
        "jadwal-card relative rounded-2xl bg-white",
        accentTop ? "border-t-2 border-t-[#6A1B1B]" : "",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  arabicRight,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  arabicRight?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-[#EAE2D6] px-4 py-3.5 sm:px-5 sm:py-4",
        className
      )}
    >
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-[#231917]">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-[#7B6B63]">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {arabicRight ? (
          <span dir="rtl" className="font-arabic text-lg text-[#6A1B1B]">
            {arabicRight}
          </span>
        ) : null}
        {action}
      </div>
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}

export function CardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-[#EAE2D6] bg-[#FAF7F2]/70 px-4 py-3 sm:px-5 sm:py-3.5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "maroon" | "brass" | "sage" | "crimson";
}) {
  const toneIconBg: Record<string, string> = {
    default: "bg-[#F3EFE6] text-[#5E4F4A]",
    maroon: "bg-[#6A1B1B]/10 text-[#6A1B1B]",
    brass: "bg-[#FBF6EB] text-[#8A6421]",
    sage: "bg-[#E8F3EC] text-[#2A6041]",
    crimson: "bg-[#FEE2E2] text-[#991B1B]",
  };

  return (
    <div className="jadwal-card flex items-start justify-between gap-3 rounded-2xl bg-white p-4 sm:p-4.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#7B6B63]">{label}</p>
        <div className="mt-1.5 text-2xl font-bold tracking-tight text-[#231917]">
          {value}
        </div>
        {hint ? <p className="mt-1 text-xs text-[#8C7B73]">{hint}</p> : null}
      </div>
      {icon ? (
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            toneIconBg[tone]
          )}
        >
          {icon}
        </div>
      ) : null}
    </div>
  );
}
