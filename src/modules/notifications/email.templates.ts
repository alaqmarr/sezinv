import { formatIST } from "@sezsec/shared";

function wrapArabicFrame(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:24px;background-color:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#231917;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #D9C398;border-radius:14px;overflow:hidden;">
    <div style="height:4px;background:linear-gradient(90deg,#6A1B1B,#B8924A,#6A1B1B);"></div>
    <div style="padding:22px 28px;background:#FBF6EB;border-bottom:1px solid #EAE2D6;text-align:center;">
      <div style="font-size:18px;color:#6A1B1B;font-weight:700;">بسم الله الرحمن الرحيم</div>
      <div style="margin-top:4px;font-size:13px;font-weight:600;color:#231917;">Anjuman-e-Mohammedi, Secunderabad</div>
      <div style="font-size:11px;color:#7B6B63;">Dawoodi Bohra Jamaat Trust • Hall &amp; Store Office</div>
    </div>
    <div style="padding:26px 28px;">
      <h2 style="margin:0 0 14px 0;font-size:18px;color:#6A1B1B;">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:14px 28px;background:#FAF7F2;border-top:1px solid #EAE2D6;text-align:center;font-size:11px;color:#8C7B73;">
      Shababul Eidiz Zahabi, Secunderabad • Automated Office Notification
    </div>
  </div>
</body>
</html>`;
}

export function buildOtpEmailHtml(params: {
  recipientName?: string | null;
  code: string;
  purposeLabel: string;
  expiryMinutes?: number;
}): string {
  const mins = params.expiryMinutes ?? 10;
  return wrapArabicFrame(
    params.purposeLabel,
    `
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#3D2E2A;">
      Salaam ${params.recipientName || "Member"},
    </p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3D2E2A;">
      Please enter the 6-digit verification code below for <strong>${params.purposeLabel}</strong>:
    </p>
    <div style="margin:20px 0;padding:18px;background:#FBF6EB;border:1px solid #D9C398;border-radius:12px;text-align:center;">
      <span style="font-size:30px;font-weight:700;letter-spacing:8px;color:#6A1B1B;">${params.code}</span>
    </div>
    <p style="margin:0;font-size:12px;color:#7B6B63;">
      This code is valid for ${mins} minutes. Please do not share this code with anyone.
    </p>
    `
  );
}

export function buildBookingConfirmationHtml(event: {
  id: string;
  reference?: string | null;
  name: string;
  mobile: string;
  description: string;
  occasionDate: Date | string;
  occasionTime: string;
  halls: string[];
  thaalCount: number;
  catererName?: string | null;
  decoratorName?: string | null;
}): string {
  const dateText = formatIST(event.occasionDate, "EEEE, dd MMMM yyyy");
  const hallsText = event.halls.join(", ") || "Self / Outside";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return wrapArabicFrame(
    "Hall Booking Recorded",
    `
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#3D2E2A;">
      Salaam <strong>${event.name}</strong>, your event booking has been recorded at the Jamaat office.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;color:#7B6B63;">Booking No.</td><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;font-weight:600;text-align:right;">${event.reference || event.id}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;color:#7B6B63;">Occasion</td><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;font-weight:600;text-align:right;">${event.description}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;color:#7B6B63;">Date &amp; Time</td><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;font-weight:600;text-align:right;">${dateText} at ${event.occasionTime}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;color:#7B6B63;">Hall / Venue</td><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;font-weight:600;text-align:right;">${hallsText}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;color:#7B6B63;">Thaals</td><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;font-weight:600;text-align:right;">${event.thaalCount}</td></tr>
      ${event.catererName ? `<tr><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;color:#7B6B63;">Caterer</td><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;font-weight:600;text-align:right;">${event.catererName}</td></tr>` : ""}
      ${event.decoratorName ? `<tr><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;color:#7B6B63;">Decorator</td><td style="padding:8px 0;border-bottom:1px solid #EAE2D6;font-weight:600;text-align:right;">${event.decoratorName}</td></tr>` : ""}
    </table>
    <div style="margin-top:20px;text-align:center;">
      <a href="${appUrl}/public/events/${encodeURIComponent(event.id)}" style="display:inline-block;padding:10px 20px;background:#6A1B1B;color:#FAF7F2;text-decoration:none;border-radius:10px;font-size:13px;font-weight:600;">View Public Booking Pass</a>
    </div>
    `
  );
}

export function buildMissingItemAlertHtml(params: {
  eventName: string;
  eventDescription: string;
  itemName: string;
  quantity: number;
  reportedBy: string;
}): string {
  return wrapArabicFrame(
    "Missing Store Item Reported",
    `
    <p style="margin:0 0 12px;font-size:14px;color:#3D2E2A;">
      A store item was marked missing during event return check:
    </p>
    <div style="padding:14px;background:#FDF0F0;border:1px solid #EEC2C2;border-radius:10px;font-size:13px;">
      <div><strong>Item:</strong> ${params.itemName}</div>
      <div style="margin-top:4px;"><strong>Missing Quantity:</strong> ${params.quantity}</div>
      <div style="margin-top:4px;"><strong>Booking:</strong> ${params.eventDescription} (${params.eventName})</div>
      <div style="margin-top:4px;"><strong>Reported By:</strong> ${params.reportedBy}</div>
    </div>
    `
  );
}

export function buildWelcomeUserHtml(params: {
  name: string;
  username: string;
  roleLabel: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return wrapArabicFrame(
    "Team Account Created",
    `
    <p style="margin:0 0 14px;font-size:14px;color:#3D2E2A;">
      Salaam <strong>${params.name}</strong>, an account has been created for you on the Jamaat Events &amp; Store Portal.
    </p>
    <p style="margin:0 0 14px;font-size:13px;color:#3D2E2A;">
      <strong>Username:</strong> ${params.username}<br/>
      <strong>Access Level:</strong> ${params.roleLabel}
    </p>
    <div style="margin-top:18px;">
      <a href="${appUrl}/login" style="display:inline-block;padding:10px 20px;background:#6A1B1B;color:#FAF7F2;text-decoration:none;border-radius:10px;font-size:13px;font-weight:600;">Open Portal</a>
    </div>
    `
  );
}
