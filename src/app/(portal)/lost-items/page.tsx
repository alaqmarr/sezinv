import React, { Suspense } from "react";
import { connection } from "next/server";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { listMissingItems } from "@sezsec/inventory/inventory.service";
import { Skeleton } from "@sezsec/ui";
import { MissingItemsClient } from "./missing-items.client";

async function LostItemsContent() {
  await connection();
  const user = await requireServerPageAccess("/lost-items");
  const records = await listMissingItems();

  return (
    <MissingItemsClient
      records={records}
      canResolve={canPerformAction("inventory:issue-return", user.role)}
    />
  );
}

export default function LostItemsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      }
    >
      <LostItemsContent />
    </Suspense>
  );
}
