import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getFreshSessionUser } from "@sezsec/auth";
import { ForgotPasswordClient } from "./forgot-password-client";

export default async function ForgotPasswordPage() {
  await connection();
  const session = await getFreshSessionUser();
  if (session) {
    redirect("/");
  }

  return <ForgotPasswordClient />;
}
