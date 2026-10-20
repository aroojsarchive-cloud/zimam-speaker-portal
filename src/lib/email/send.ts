import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
}

/**
 * Sends through Resend. Without RESEND_API_KEY nothing is sent: `sent` is false
 * (and in local dev the email is printed to the terminal instead).
 */
export async function sendEmail(mail: OutgoingEmail): Promise<{ id: string | null; sent: boolean }> {
  const key = env.resendKey();
  if (!key) {
    if (process.env.NODE_ENV !== "production")
      console.log(`\n✉️  [dev email, not sent] to ${mail.to}: ${mail.subject}\n${mail.text}\n`);
    return { id: null, sent: false };
  }
  const { data, error } = await new Resend(key).emails.send({
    from: env.emailFrom(),
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: mail.replyTo ?? undefined,
  });
  if (error) throw new Error(`Email failed: ${error.message}`);
  return { id: data?.id ?? null, sent: true };
}
