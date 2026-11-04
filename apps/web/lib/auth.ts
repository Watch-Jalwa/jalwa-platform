import { betterAuth } from "better-auth";
import { admin, emailOTP, magicLink, phoneNumber } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import nodemailer from "nodemailer";
import { databasePool } from "@/lib/database/pool";

function smtpTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP_HOST is required to send authentication email.");
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
  });
}

function socialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.google = { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET };
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) providers.apple = { clientId: process.env.APPLE_CLIENT_ID, clientSecret: process.env.APPLE_CLIENT_SECRET };
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) providers.facebook = { clientId: process.env.FACEBOOK_CLIENT_ID, clientSecret: process.env.FACEBOOK_CLIENT_SECRET };
  return providers;
}

function qaAllowed(email: string) {
  const allowlist = (process.env.STAGING_QA_ALLOWED_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return process.env.DEPLOYMENT_ENVIRONMENT === "staging" && allowlist.includes(email.toLowerCase());
}

export const auth = betterAuth({
  appName: "Jalwa",
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: databasePool,
  advanced: { database: { generateId: "uuid", joins: true } },
  socialProviders: socialProviders(),
  plugins: [
    magicLink({
      expiresIn: 10 * 60,
      sendMagicLink: async ({ email, url, metadata }) => {
        const qaSecret = typeof metadata?.qaSecret === "string" ? metadata.qaSecret : "";
        const qaRunId = typeof metadata?.qaRunId === "string" ? metadata.qaRunId.slice(0, 160) : "";
        if (qaRunId && qaSecret && qaSecret === process.env.STAGING_QA_SECRET && qaAllowed(email)) {
          await databasePool.query(
            `insert into public.qa_magic_links (email, qa_run_id, url, expires_at)
             values ($1,$2,$3,now()+interval '10 minutes')
             on conflict (email, qa_run_id) do update set url=excluded.url, expires_at=excluded.expires_at, created_at=now()`,
            [email.toLowerCase(), qaRunId, url],
          );
          return;
        }
        await smtpTransport().sendMail({
          from: process.env.SMTP_FROM ?? "Jalwa <no-reply@watch-jalwa.com>",
          to: email,
          subject: "Your Jalwa sign-in link",
          text: `Sign in to Jalwa: ${url}\n\nThis link expires in 10 minutes.`,
          html: `<p>Sign in to Jalwa:</p><p><a href="${url.replaceAll('"', '&quot;')}">Continue to Jalwa</a></p><p>This link expires in 10 minutes.</p>`,
        });
      },
    }),
    emailOTP({
      otpLength: 4,
      expiresIn: 5 * 60,
      allowedAttempts: 5,
      // Temporary fixed code for staging/dev auth testing. Replace before production.
      generateOTP: () => "1234",
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "sign-in") return;
        await smtpTransport().sendMail({
          from: process.env.SMTP_FROM ?? "Jalwa <no-reply@watch-jalwa.com>",
          to: email,
          subject: "Your Jalwa sign-in code",
          text: `Your Jalwa code is ${otp}.\n\nIt expires in 5 minutes and stops working after five unsuccessful attempts.`,
          html: `<p>Your Jalwa code is <strong>${otp}</strong>.</p><p>It expires in 5 minutes and stops working after five unsuccessful attempts.</p>`,
        });
      },
    }),
    phoneNumber({
      otpLength: 4,
      expiresIn: 5 * 60,
      allowedAttempts: 5,
      // Temporary fixed code for JazzCash pay-first → OTP sign-in. Replace with SMS provider before production.
      sendOTP: async () => {},
      verifyOTP: async ({ code }) => code === "1234",
      phoneNumberValidator: async (value) => /^\+923\d{9}$/.test(value) || /^03\d{9}$/.test(value),
      signUpOnVerification: {
        getTempEmail: (phone) => `${String(phone).replace(/\D/g, "")}@msisdn.jalwa.local`,
        getTempName: (phone) => `Jalwa ${phone}`,
      },
    }),
    admin(),
    nextCookies(),
  ],
});
