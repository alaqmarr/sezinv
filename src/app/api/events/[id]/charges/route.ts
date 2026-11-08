import { NextResponse } from "next/server";
import { getEventAmountUnlockStatus } from "@sezsec/auth/booking-print-unlock.helper";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import { updateEventCharges } from "@sezsec/events/events.service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["ADMIN", "ADMIN_CUSTOM", "MANAGER"]);
  if (!auth.ok) return auth.response;

  if (!auth.user.canViewCharges) {
    return NextResponse.json(
      {
        error:
          "You do not have access to Event Charges. Please ask an Administrator to enable the Event Charges module on your account.",
      },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const unlock = await getEventAmountUnlockStatus(
    auth.user.id,
    id,
    auth.user.canViewCharges
  );
  if (!unlock.unlocked) {
    return NextResponse.json(
      {
        error:
          "Please verify your Email Code first before viewing or editing booking charges.",
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const updated = await updateEventCharges(id, body || {}, {
      id: auth.user.id,
      name: auth.user.name || auth.user.username,
    });

    return NextResponse.json({ ok: true, event: updated });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not save booking charges.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
