"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@sezsec/shared";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export function Select({
  label,
  hint,
  error,
  value,
  onChange,
  options,
  placeholder = "Choose an option",
  disabled,
  required,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((opt) => opt.value === value);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const maxMenuHeight = 256;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;

    const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));

    if (openUpward) {
      setMenuStyle({
        position: "fixed",
        left,
        width,
        bottom: window.innerHeight - rect.top + 6,
        maxHeight: Math.min(maxMenuHeight, Math.max(140, spaceAbove)),
      });
    } else {
      setMenuStyle({
        position: "fixed",
        left,
        width,
        top: rect.bottom + 6,
        maxHeight: Math.min(maxMenuHeight, Math.max(140, spaceBelow)),
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <div ref={containerRef} className={cn("relative space-y-1.5", className)}>
      {label ? (
        <label className="block text-xs font-semibold tracking-wide text-[#3D2E2A]">
          {label}
          {required ? <span className="ml-0.5 text-[#991B1B]">*</span> : null}
        </label>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border bg-white px-3.5 text-left text-sm transition-colors focus:border-[#6A1B1B] focus:outline-none focus:ring-2 focus:ring-[#6A1B1B]/12 disabled:bg-[#F5F1E9] cursor-pointer",
          error ? "border-[#B91C1C]" : "border-[#DCD2C2]"
        )}
      >
        <span className={cn("truncate", selected ? "text-[#231917]" : "text-[#9E8E85]")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[#8C7B73] transition-transform duration-150",
            open ? "rotate-180" : ""
          )}
        />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              className="no-print z-[130] overflow-y-auto rounded-xl border border-[#D8CEBE] bg-white p-1.5 shadow-xl"
            >
              {options.length === 0 ? (
                <div className="px-3 py-2.5 text-xs text-[#8C7B73]">
                  No options available
                </div>
              ) : (
                options.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                        isSelected
                          ? "bg-[#FBF6EB] font-medium text-[#6A1B1B]"
                          : "text-[#231917] hover:bg-[#F6F2EA]"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate">{opt.label}</div>
                        {opt.sublabel ? (
                          <div className="truncate text-xs text-[#8C7B73]">
                            {opt.sublabel}
                          </div>
                        ) : null}
                      </div>
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-[#6A1B1B]" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>,
            document.body
          )
        : null}

      {error ? (
        <p className="text-xs font-medium text-[#B91C1C]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[#7B6B63]">{hint}</p>
      ) : null}
    </div>
  );
}

export function MultiSelectPills({
  label,
  hint,
  error,
  options,
  values,
  onChange,
  disabled,
}: {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  values: string[];
  onChange: (nextValues: string[]) => void;
  disabled?: boolean;
}) {
  const toggleValue = (val: string) => {
    if (disabled) return;
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  return (
    <div className="space-y-2">
      {label ? (
        <label className="block text-xs font-semibold tracking-wide text-[#3D2E2A]">
          {label}
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = values.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => toggleValue(opt.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all cursor-pointer",
                active
                  ? "border-[#6A1B1B] bg-[#6A1B1B] text-[#FAF7F2] shadow-xs"
                  : "border-[#DCD2C2] bg-white text-[#3D2E2A] hover:border-[#B8924A] hover:bg-[#FBF6EB]"
              )}
            >
              {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              <span>{opt.label}</span>
              {opt.sublabel ? (
                <span
                  className={cn(
                    "text-[11px]",
                    active ? "text-[#EAE0D0]" : "text-[#8C7B73]"
                  )}
                >
                  ({opt.sublabel})
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="text-xs font-medium text-[#B91C1C]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[#7B6B63]">{hint}</p>
      ) : null}
    </div>
  );
}
