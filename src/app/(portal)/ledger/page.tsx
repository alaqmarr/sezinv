import { connection } from "next/server";
import { listInventoryLedger } from "@sezsec/logs";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader } from "@sezsec/ui";
import { LedgerRegisterClient } from "./ledger-register.client";

export default async function StockRegisterPage() {
  await connection();
  await requireServerPageAccess("/ledger");
  const entries = await listInventoryLedger(2500);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movement Book"
        arabicBadge="دفتر المخزن"
        subtitle="Complete register of vessels and items given out for functions, returned to the store, or updated."
      />
      <LedgerRegisterClient entries={entries} />
    </div>
  );
}
