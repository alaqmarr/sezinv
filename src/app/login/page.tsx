import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getFreshSessionUser, isInitialSetupRequired } from "@sezsec/auth";
import { LoginClient } from "./login-client";

export default async function LoginPage() {
  await connection();
  const [session, setupRequired] = await Promise.all([
    getFreshSessionUser(),
    isInitialSetupRequired(),
  ]);

  if (session) {
    redirect("/");
  }

  const neonConfigured = Boolean(process.env.NEON_DATABASE_URL?.trim());

  return (
    <LoginClient
      initialNoAccountsLocally={setupRequired}
      neonConfigured={neonConfigured}
    />
  );
}
