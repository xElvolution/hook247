/**
 * SMTP preflight. Run with `npm run mail:check` to confirm the mailbox
 * credentials work, or `npm run mail:check -- you@example.com` to also send a
 * real verification email to that address.
 *
 * This exists because every mail failure in the app is silent from the user's
 * side — a signup that never receives its code just looks broken. Better to
 * find out here than from a member who cannot get in.
 */
import nodemailer from "nodemailer";

const host = process.env.EMAIL_HOST ?? "";
const port = Number(process.env.EMAIL_PORT ?? 465);
const user = process.env.EMAIL_USER ?? "";
const pass = process.env.EMAIL_PASSWORD ?? "";
const from = process.env.EMAIL_FROM ?? user;

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function main() {
  const missing = [
    ["EMAIL_HOST", host],
    ["EMAIL_PORT", process.env.EMAIL_PORT],
    ["EMAIL_USER", user],
    ["EMAIL_PASSWORD", pass],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    fail(`Not set in .env: ${missing.join(", ")}`);
  }

  // Never print the password itself — this output tends to end up pasted into
  // chats and issue trackers.
  console.log(`\nHost      ${host}:${port} (${port === 465 ? "implicit TLS" : "STARTTLS"})`);
  console.log(`User      ${user}`);
  console.log(`From      ${from}`);
  console.log(`Password  ${"•".repeat(Math.min(pass.length, 24))} (${pass.length} chars)`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  console.log("\nConnecting…");

  try {
    await transporter.verify();
    console.log("✓ SMTP accepted the credentials.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n✗ SMTP rejected the connection:\n  ${message}`);

    // The three failures that actually happen with Hostinger, and what each means.
    if (/invalid login|authentication failed|535/i.test(message)) {
      console.error(
        "\n  The host answered but refused the login. Check EMAIL_USER is the full\n" +
          "  mailbox address and that EMAIL_PASSWORD is the mailbox password — not\n" +
          "  the Hostinger account password."
      );
    } else if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(message)) {
      console.error(
        "\n  Could not reach the host. Verify EMAIL_HOST, and try port 587 instead\n" +
          "  of 465 — some networks block 465 outright."
      );
    } else if (/self.signed|certificate/i.test(message)) {
      console.error("\n  TLS problem. Confirm the port matches the mode (465 implicit, 587 STARTTLS).");
    }
    process.exit(1);
  }

  const to = process.argv[2];
  if (!to) {
    console.log("\nPass an address to send a live test:  npm run mail:check -- you@example.com\n");
    return;
  }

  console.log(`\nSending test email to ${to}…`);

  try {
    const info = await transporter.sendMail({
      from: `"Hooks247" <${from}>`,
      to,
      subject: "Hooks247 SMTP test",
      text: "If you are reading this, Hooks247 can send email.",
      html: '<p style="font-family:sans-serif">If you are reading this, Hooks247 can send email.</p>',
    });
    console.log(`✓ Accepted for delivery — ${info.messageId}`);
    console.log("\n  Check the inbox, and the spam folder. Landing in spam means the");
    console.log("  domain still needs SPF, DKIM and DMARC records in DNS.\n");
  } catch (err) {
    fail(`Send failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

main();
