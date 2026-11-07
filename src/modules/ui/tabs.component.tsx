"use client";

import React from "react";
import { cn } from "@sezsec/shared";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export function Tabs({
  tabs,
  activeId,
  onChange,
  className,
}: {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-[#E5DDD0] bg-[#F3EFE6]/80 p-1.5",
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer",
              active
                ? "bg-white text-[#6A1B1B] shadow-xs border border-[#D9C398]"
                : "text-[#5E4F4A] hover:text-[#231917] hover:bg-white/60 border border-transparent"
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px]",
                  active
                    ? "bg-[#6A1B1B]/10 text-[#6A1B1B]"
                    : "bg-[#E5DDD0] text-[#5E4F4A]"
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
