import { NextResponse } from "next/server";
import { db } from "@sezsec/db";
import { issueEmailOtp } from "@sezsec/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();
    if (!username) {
      return NextResponse.json(
        { error: "Please enter your username." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user || !user.email) {
      return NextResponse.json(
        {
          error:
            "No email address is linked to that username. Please ask an Administrator to reset your password.",
        },
        { status: 404 }
      );
    }

    const otpInfo = await issueEmailOtp({
      email: user.email,
      userId: user.id,
      recipientName: user.name || user.username,
      purpose: "PASSWORD_RESET",
    });

    return NextResponse.json({
      ok: true,
      maskedEmail: otpInfo.maskedEmail,
      emailSent: otpInfo.emailSent,
      devPreviewCode: otpInfo.devPreviewCode,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not send reset code right now." },
      { status: 500 }
    );
  }
}
