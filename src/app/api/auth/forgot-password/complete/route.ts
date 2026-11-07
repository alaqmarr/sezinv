import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db, withWriteLock } from "@sezsec/db";
import { verifyEmailOtp } from "@sezsec/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();
    const code = String(body?.code || "").trim();
    const newPassword = String(body?.newPassword || "");

    if (!username || !code || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Please enter the 6-digit code and a password of at least 6 characters." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user || !user.email) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const verification = await verifyEmailOtp({
      email: user.email,
      code,
      purpose: "PASSWORD_RESET",
    });

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.reason || "Invalid code." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await withWriteLock(() =>
      db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      })
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not reset password." },
      { status: 500 }
    );
  }
}
