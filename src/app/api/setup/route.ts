import { connection, NextResponse } from "next/server";
import {
  isInitialSetupRequired,
  setupInitialAdministrator,
} from "@sezsec/auth";

export async function GET() {
  await connection();
  const setupRequired = await isInitialSetupRequired();
  const neonConfigured = Boolean(process.env.NEON_DATABASE_URL?.trim());
  return NextResponse.json({ setupRequired, neonConfigured });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, username, email, mobile, password } = body || {};

    if (!name || !username || !email || !password) {
      return NextResponse.json(
        { error: "Please fill in name, username, email, and password." },
        { status: 400 }
      );
    }
    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "Password should be at least 6 characters long." },
        { status: 400 }
      );
    }

    const result = await setupInitialAdministrator({
      name: String(name),
      username: String(username),
      email: String(email),
      mobile: String(mobile || ""),
      password: String(password),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, user: result.user });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not complete setup.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
