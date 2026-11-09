import { connection } from "next/server";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { listStoreItems } from "@sezsec/inventory/inventory.service";
import { InventoryStoreClient } from "./inventory-store.client";

export default async function InventoryPage() {
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
