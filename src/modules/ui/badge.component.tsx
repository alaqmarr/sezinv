import React from "react";
import { cn } from "@sezsec/shared";

export type BadgeTone =
  | "maroon"
  | "brass"
  | "sage"
  | "amber"
  | "crimson"
  | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  maroon: "bg-[#6A1B1B]/10 text-[#6A1B1B] border-[#6A1B1B]/20",
  brass: "bg-[#FBF6EB] text-[#78551B] border-[#D9C398]",
  sage: "bg-[#EAF5EE] text-[#23583A] border-[#B7DBC3]",
  amber: "bg-[#FEF7E6] text-[#925708] border-[#EED294]",
  crimson: "bg-[#FDF0F0] text-[#991B1B] border-[#EEC2C2]",
  neutral: "bg-[#F3EFE6] text-[#5E4F4A] border-[#DFD6C7]",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
