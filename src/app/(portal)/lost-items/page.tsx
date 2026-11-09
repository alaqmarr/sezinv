import { connection } from "next/server";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { listMissingItems } from "@sezsec/inventory/inventory.service";
import { MissingItemsClient } from "./missing-items.client";

export default async function LostItemsPage() {
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
