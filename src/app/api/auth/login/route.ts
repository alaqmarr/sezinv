import { NextResponse } from "next/server";
import { db } from "@sezsec/db";
import { loginWithPassword } from "@sezsec/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawUsername = String(body?.username || "").trim();
    const result = await loginWithPassword(
      rawUsername,
      String(body?.password || "")
    );

    if (!result.ok) {
      let accountNotFound = Boolean(result.accountNotFound);
      if (
        !accountNotFound &&
        rawUsername &&
        Boolean(process.env.NEON_DATABASE_URL?.trim())
      ) {
        const existing = await db.user.findUnique({
          where: { username: rawUsername },
          select: { id: true },
        });
        if (!existing) {
          accountNotFound = true;
        }
      }

      return NextResponse.json(
        {
          error: accountNotFound
            ? "This account is not in the local database yet. Sync from the previous database below and sign in again."
            : result.error,
          accountNotFound,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true, user: result.user });
  } catch {
    return NextResponse.json(
      { error: "Could not sign in right now. Please try again." },
      { status: 500 }
    );
  }
}
