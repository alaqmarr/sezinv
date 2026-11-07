import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionFromCookies } from "@sezsec/auth";
import { recordActivity } from "@sezsec/logs";

export async function POST() {
  const user = await getSessionFromCookies();
  await clearSessionCookie();

  if (user) {
    await recordActivity({
      action: "USER_LOGOUT",
      summary: `${user.name || user.username} signed out`,
      userId: user.id,
      userName: user.name || user.username,
    });
  }

  return NextResponse.json({ ok: true });
}
