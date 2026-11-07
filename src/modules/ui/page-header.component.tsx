import React from "react";
import { cn } from "@sezsec/shared";
import { FatimidRosette } from "./arabesque.component";

export function PageHeader({
  title,
  subtitle,
  arabicBadge,
  actions,
  backLink,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  arabicBadge?: string;
  actions?: React.ReactNode;
  backLink?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-[#E5DDD0] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {backLink ? <div className="mb-1">{backLink}</div> : null}
        <div className="flex flex-wrap items-center gap-2.5">
          <FatimidRosette size={18} />
          <h1 className="text-xl font-bold tracking-tight text-[#231917] sm:text-2xl">
            {title}
          </h1>
          {arabicBadge ? (
            <span
              dir="rtl"
              className="font-arabic rounded-full border border-[#D9C398] bg-[#FBF6EB] px-3 py-0.5 text-base text-[#6A1B1B]"
            >
              {arabicBadge}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p className="text-sm text-[#6E5D55]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D8CEBE] bg-[#FAF7F2]/60 px-6 py-12 text-center">
      {icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FBF6EB] text-[#6A1B1B]">
          {icon}
        </div>
      ) : null}
      <h4 className="text-base font-semibold text-[#231917]">{title}</h4>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-[#7B6B63]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-[#EAE2D6]/70",
        className
      )}
    />
  );
}
