"use client";

import { Toaster } from "sileo";

export function SezsecToaster() {
  return (
    <Toaster
      position="top-center"
      theme="light"
      options={{
        fill: "#231917",
        roundness: 14,
        duration: 4200,
      }}
    />
  );
}
