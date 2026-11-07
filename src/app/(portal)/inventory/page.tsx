import React, { Suspense } from "react";
import { connection } from "next/server";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { listStoreItems } from "@sezsec/inventory/inventory.service";
import { Skeleton } from "@sezsec/ui";
import { InventoryStoreClient } from "./inventory-store.client";

async function InventoryContent() {
  await connection();
  const user = await requireServerPageAccess("/inventory");
  const items = await listStoreItems();

  return (
    <InventoryStoreClient
      items={items}
      canManage={canPerformAction("inventory:manage", user.role)}
      canDelete={canPerformAction("inventory:delete", user.role)}
    />
  );
}

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      }
    >
      <InventoryContent />
    </Suspense>
  );
}
