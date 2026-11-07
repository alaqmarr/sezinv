"use client";

import React, { useRef } from "react";
import { cn } from "@sezsec/shared";

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
}: {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, idx) => value[idx] || "");

  const updateAt = (index: number, char: string) => {
    const clean = char.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = clean;
    onChange(next.join(""));
    if (clean && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2.5">
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            refs.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={idx === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digit}
          onChange={(e) => updateAt(idx, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[idx] && idx > 0) {
              refs.current[idx - 1]?.focus();
            }
            if (e.key === "ArrowLeft" && idx > 0) {
              refs.current[idx - 1]?.focus();
            }
            if (e.key === "ArrowRight" && idx < length - 1) {
              refs.current[idx + 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, length);
            if (pasted) {
              onChange(pasted);
              const targetIdx = Math.min(pasted.length, length - 1);
              refs.current[targetIdx]?.focus();
            }
          }}
          className={cn(
            "h-11 w-9 sm:h-12 sm:w-11 rounded-xl border bg-white text-center text-lg font-bold text-[#231917] transition-all focus:border-[#6A1B1B] focus:outline-none focus:ring-2 focus:ring-[#6A1B1B]/15 disabled:opacity-50",
            digit ? "border-[#B8924A] bg-[#FBF6EB]/60" : "border-[#DCD2C2]"
          )}
        />
      ))}
    </div>
  );
}
