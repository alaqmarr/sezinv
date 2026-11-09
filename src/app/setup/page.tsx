import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getFreshSessionUser } from "@sezsec/auth";
import { SyncSetupClient } from "./setup-client";

export default async function SyncSetupPage() {
  await connection();
  const session = await getFreshSessionUser();
  if (session) {
    redirect("/");
  }

  return <SyncSetupClient />;
}
