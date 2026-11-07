import React, { Suspense } from "react";
import { connection } from "next/server";
import { listInventoryLedger } from "@sezsec/logs";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader, Skeleton } from "@sezsec/ui";
import { LedgerRegisterClient } from "./ledger-register.client";

async function LedgerContent() {
  await connection();
  await requireServerPageAccess("/ledger");
  const entries = await listInventoryLedger(2500);
  return <LedgerRegisterClient entries={entries} />;
}

export default function StockRegisterPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movement Book"
        arabicBadge="دفتر المخزن"
        subtitle="Complete register of vessels and items given out for functions, returned to the store, or updated."
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        }
      >
        <LedgerContent />
      </Suspense>
    </div>
  );
}
