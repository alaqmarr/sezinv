import nodemailer from "nodemailer";
import { getResolvedSmtpCredentials } from "./smtp-config.helper";

export interface SendEmailPayload {
  to: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

export interface EmailSendResult {
  sent: boolean;
  smtpConfigured: boolean;
  error?: string;
}

export async function isSmtpConfigured(): Promise<boolean> {
  const creds = await getResolvedSmtpCredentials();
  return creds.configured;
}

export async function sendPortalEmail(
  payload: SendEmailPayload
): Promise<EmailSendResult> {
  const creds = await getResolvedSmtpCredentials();
  const smtpUser = creds.smtpEmail;
  // Normalize app passwords (e.g. "ukud wsjx lfdo ewag" -> "ukudwsjxlfdoewag")
  const smtpPass = creds.smtpPassword.replace(/\s+/g, "");

  if (!smtpUser || !smtpPass) {
    console.info(
      `[SEZSEC Email] Outgoing email password not configured yet. Would have sent "${payload.subject}" to ${Array.isArray(payload.to) ? payload.to.join(", ") : payload.to}`
    );
    return {
      sent: false,
      smtpConfigured: false,
      error:
        "Outgoing email address or app password is not configured in Office Settings yet.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `"Anjuman-e-Mohammedi Secunderabad" <${smtpUser}>`,
      to: payload.to,
      bcc: payload.bcc,
      subject: payload.subject,
      html: payload.html,
      attachments: payload.attachments,
    });

    return { sent: true, smtpConfigured: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send email";
    console.error("[SEZSEC Email] Send error:", msg);
    return { sent: false, smtpConfigured: true, error: msg };
  }
}
