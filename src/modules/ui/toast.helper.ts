"use client";

import { sileo } from "sileo";

const BASE_TOAST_OPTIONS = {
  fill: "#231917",
  roundness: 14,
  styles: {
    title: "!text-[#FAF7F2] !font-semibold",
    description: "!text-[#DFD5C5]",
  },
} as const;

export const notify = {
  success(title: string, description?: string) {
    return sileo.success({
      ...BASE_TOAST_OPTIONS,
      title,
      description,
    });
  },
  error(title: string, description?: string) {
    return sileo.error({
      ...BASE_TOAST_OPTIONS,
      title,
      description,
    });
  },
  warning(title: string, description?: string) {
    return sileo.warning({
      ...BASE_TOAST_OPTIONS,
      title,
      description,
    });
  },
  info(title: string, description?: string) {
    return sileo.info({
      ...BASE_TOAST_OPTIONS,
      title,
      description,
    });
  },
  promise<T>(
    promise: Promise<T> | (() => Promise<T>),
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ) {
    return sileo.promise(promise, {
      loading: { ...BASE_TOAST_OPTIONS, title: messages.loading },
      success: (data) => ({
        ...BASE_TOAST_OPTIONS,
        title:
          typeof messages.success === "function"
            ? messages.success(data)
            : messages.success,
      }),
      error: (err) => ({
        ...BASE_TOAST_OPTIONS,
        title:
          typeof messages.error === "function"
            ? messages.error(err)
            : messages.error,
      }),
    });
  },
};
