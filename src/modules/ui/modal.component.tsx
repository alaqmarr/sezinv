"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@sezsec/shared";
import { Button } from "./button.component";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="no-print fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#1B1210]/55 backdrop-blur-[2px] transition-opacity"
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-[#D9C398] bg-white shadow-2xl",
          maxWidth
        )}
      >
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-[#6A1B1B] via-[#B8924A] to-[#6A1B1B]" />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#EAE2D6] px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#231917]">{title}</h3>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-[#7B6B63]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-[#7B6B63] hover:bg-[#F3EFE6] hover:text-[#231917] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-[#EAE2D6] bg-[#FAF7F2] px-4 py-3 sm:px-5 sm:py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClass = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="no-print fixed inset-0 z-[100] flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#1B1210]/45 backdrop-blur-[2px]"
      />
      <div
        className={cn(
          "relative z-10 flex h-full max-w-[100vw] w-full flex-col border-l border-[#D9C398] bg-white shadow-2xl",
          widthClass
        )}
      >
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-[#6A1B1B] via-[#B8924A] to-[#6A1B1B]" />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#EAE2D6] px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#231917]">{title}</h3>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-[#7B6B63]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="shrink-0 rounded-lg p-1.5 text-[#7B6B63] hover:bg-[#F3EFE6] hover:text-[#231917] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-[#EAE2D6] bg-[#FAF7F2] px-4 py-3 sm:px-5 sm:py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-[#4A3B36]">{message}</div>
    </Modal>
  );
}
