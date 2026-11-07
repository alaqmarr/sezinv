"use client";

import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@sezsec/shared";

export interface PaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

function buildPageNumbers(current: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const windowStart = Math.max(2, current - 1);
  const windowEnd = Math.min(totalPages - 1, current + 1);

  if (windowStart > 2) {
    pages.push("ellipsis");
  }

  for (let p = windowStart; p <= windowEnd; p++) {
    pages.push(p);
  }

  if (windowEnd < totalPages - 1) {
    pages.push("ellipsis");
  }

  pages.push(totalPages);
  return pages;
}

export function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [15, 25, 50, 100],
  itemLabel = "records",
  className,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const fromIdx = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toIdx = Math.min(totalItems, safePage * pageSize);

  const pageTokens = useMemo(
    () => buildPageNumbers(safePage, totalPages),
    [safePage, totalPages]
  );

  if (totalItems === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-[#EAE2D6] bg-[#FAF7F2]/85 px-4 py-3 text-xs text-[#5E4F4A]",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing{" "}
          <strong className="font-semibold text-[#231917]">
            {fromIdx.toLocaleString("en-IN")}
          </strong>
          {" – "}
          <strong className="font-semibold text-[#231917]">
            {toIdx.toLocaleString("en-IN")}
          </strong>{" "}
          of{" "}
          <strong className="font-semibold text-[#6A1B1B]">
            {totalItems.toLocaleString("en-IN")}
          </strong>{" "}
          {itemLabel}
        </span>

        {onPageSizeChange ? (
          <label className="inline-flex items-center gap-1.5 text-xs text-[#6E5D55]">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-lg border border-[#DCD2C2] bg-white px-2 text-xs font-semibold text-[#231917] focus:border-[#6A1B1B] focus:outline-none cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DCD2C2] bg-white px-2.5 text-xs font-semibold text-[#3D2E2A] transition-colors hover:border-[#B8924A] hover:bg-[#FBF6EB] disabled:pointer-events-none disabled:opacity-45 cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Prev</span>
          </button>

          {pageTokens.map((token, idx) =>
            token === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1.5 text-xs font-semibold text-[#8C7B73]"
              >
                …
              </span>
            ) : (
              <button
                key={token}
                type="button"
                onClick={() => onPageChange(token)}
                aria-current={token === safePage ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors cursor-pointer",
                  token === safePage
                    ? "border-[#6A1B1B] bg-[#6A1B1B] text-white shadow-xs"
                    : "border-[#DCD2C2] bg-white text-[#3D2E2A] hover:border-[#B8924A] hover:bg-[#FBF6EB]"
                )}
              >
                {token}
              </button>
            )
          )}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DCD2C2] bg-white px-2.5 text-xs font-semibold text-[#3D2E2A] transition-colors hover:border-[#B8924A] hover:bg-[#FBF6EB] disabled:pointer-events-none disabled:opacity-45 cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
