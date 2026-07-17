import nodemailer from "nodemailer";

/**
 * Email delivery, tried in order:
 * 1. SMTP  — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (e.g. Gmail app
 *    password or the office mail server). Recommended for office-wide use.
 * 2. Resend — set RESEND_API_KEY (requires a verified sender domain to email
 *    arbitrary recipients).
 * 3. Console fallback — logs the message to the server console (visible in
 *    `npm run dev` output or Vercel function logs). Fine for testing.
 */
export async function sendEmail(to: string, subject: string, text: string) {
  const from =
    process.env.EMAIL_FROM ?? "Sports Day League <no-reply@opshub.com>";

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({ from, to, subject, text });
    return;
  }

  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
    }
    return;
  }

  console.log(
    `\n📧 [email fallback — configure SMTP_* or RESEND_API_KEY to actually send]\n` +
      `To: ${to}\nSubject: ${subject}\n${text}\n`
  );
}

export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
