import nodemailer from "nodemailer";

/**
 * Hostinger SMTP. Port 465 is implicit TLS (secure), 587 is STARTTLS.
 * All values come from the environment — there is no development fallback that
 * silently swallows mail, because a signup that never receives its code is a
 * dead account.
 */
const host = process.env.EMAIL_HOST ?? "";
const port = Number(process.env.EMAIL_PORT ?? 465);
const user = process.env.EMAIL_USER ?? "";
const pass = process.env.EMAIL_PASSWORD ?? "";

export const MAIL_FROM = process.env.EMAIL_FROM ?? "support@hooks247.com";
const FROM_DISPLAY = `"Hook247" <${MAIL_FROM}>`;

const globalForMail = globalThis as unknown as {
  mailer?: nodemailer.Transporter;
};

function transporter() {
  if (!host || !user || !pass) {
    throw new Error(
      "SMTP is not configured — set EMAIL_HOST, EMAIL_USER and EMAIL_PASSWORD."
    );
  }
  globalForMail.mailer ??= nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return globalForMail.mailer;
}

export function mailConfigured() {
  return Boolean(host && user && pass);
}

type Mail = { to: string; subject: string; html: string; text: string };

export async function sendMail({ to, subject, html, text }: Mail) {
  await transporter().sendMail({ from: FROM_DISPLAY, to, subject, html, text });
}

/** Shared shell so every Hook247 email looks like it came from the same place. */
function layout(heading: string, body: string) {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:24px;background:#0b0710;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#f4eef7">
    <div style="max-width:560px;margin:0 auto;overflow:hidden;border-radius:24px;border:1px solid #2a1f33;background:#120c1a">
      <div style="background:linear-gradient(135deg,#ff2d78,#ff6b2c);padding:28px;text-align:center">
        <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;letter-spacing:-.5px">Hook247</h1>
      </div>
      <div style="padding:32px">
        <h2 style="margin:0 0 14px;font-size:20px;color:#fff">${heading}</h2>
        ${body}
      </div>
      <div style="padding:18px;text-align:center;border-top:1px solid #2a1f33;color:#8d7f99;font-size:12px">
        You are receiving this because someone used this address on Hook247.
      </div>
    </div>
  </body>
</html>`;
}

function codeBlock(code: string) {
  return `<div style="margin:22px 0;padding:22px;border-radius:16px;background:#0b0710;border:1px solid #ff2d78;text-align:center">
    <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:38px;font-weight:700;letter-spacing:10px;color:#ff5d52">${code}</span>
  </div>`;
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  minutes: number
) {
  await sendMail({
    to,
    subject: "Confirm your Hook247 account",
    html: layout(
      "Confirm your email",
      `<p style="margin:0;color:#c9bcd4;line-height:1.6">Enter this code to finish setting up your account.</p>
       ${codeBlock(code)}
       <p style="margin:0;color:#8d7f99;font-size:13px">The code expires in ${minutes} minutes. If you did not sign up, ignore this email.</p>`
    ),
    text: `Confirm your Hook247 email.\n\nCode: ${code}\n\nExpires in ${minutes} minutes. If you did not sign up, ignore this email.`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  code: string,
  minutes: number
) {
  await sendMail({
    to,
    subject: "Reset your Hook247 password",
    html: layout(
      "Reset your password",
      `<p style="margin:0;color:#c9bcd4;line-height:1.6">Use this code to choose a new password.</p>
       ${codeBlock(code)}
       <p style="margin:0;color:#8d7f99;font-size:13px">The code expires in ${minutes} minutes. If you did not ask for a reset, your password is unchanged and you can ignore this email.</p>`
    ),
    text: `Reset your Hook247 password.\n\nCode: ${code}\n\nExpires in ${minutes} minutes. If you did not ask for a reset, ignore this email.`,
  });
}

export async function sendReceiptEmail(
  to: string,
  description: string,
  amountKobo: number,
  reference: string
) {
  const naira = `₦${(amountKobo / 100).toLocaleString("en-NG")}`;
  await sendMail({
    to,
    subject: `Payment received — ${description}`,
    html: layout(
      "Payment received",
      `<p style="margin:0 0 18px;color:#c9bcd4;line-height:1.6">Your payment went through and <strong style="color:#fff">${description}</strong> is now active.</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px;color:#c9bcd4">
         <tr><td style="padding:8px 0;border-bottom:1px solid #2a1f33">Amount</td><td style="padding:8px 0;border-bottom:1px solid #2a1f33;text-align:right;color:#fff;font-weight:600">${naira}</td></tr>
         <tr><td style="padding:8px 0">Reference</td><td style="padding:8px 0;text-align:right;font-family:ui-monospace,monospace">${reference}</td></tr>
       </table>`
    ),
    text: `Payment received — ${description}\n\nAmount: ${naira}\nReference: ${reference}`,
  });
}

export async function sendMatchEmail(to: string, matchName: string) {
  await sendMail({
    to,
    subject: `You matched with ${matchName} 🔥`,
    html: layout(
      "It's a match!",
      `<p style="margin:0 0 20px;color:#c9bcd4;line-height:1.6"><strong style="color:#fff">${matchName}</strong> liked you back. Say something before the moment passes.</p>
       <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/matches" style="display:inline-block;padding:13px 26px;border-radius:999px;background:linear-gradient(135deg,#ff2d78,#ff6b2c);color:#fff;font-weight:700;text-decoration:none">Open chat</a>`
    ),
    text: `You matched with ${matchName}! Open Hook247 to start chatting.`,
  });
}
