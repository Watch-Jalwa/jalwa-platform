import { randomUUID } from "node:crypto";
import { databasePool } from "@/lib/database/pool";

function nationalMsisdn(msisdn) {
  const digits = String(msisdn ?? "").replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith("3") && digits.length === 10) return `0${digits}`;
  return digits;
}

function e164FromMsisdn(msisdn) {
  const national = nationalMsisdn(msisdn);
  if (/^03\d{9}$/.test(national)) return `+92${national.slice(1)}`;
  if (/^\+92\d{10}$/.test(msisdn)) return msisdn;
  return null;
}

function tempEmailForPhone(e164) {
  return `${e164.replace(/\D/g, "")}@msisdn.jalwa.local`;
}

/** Resolve or create a phone-bound Better Auth user without opening a browser session. */
export async function resolveOrCreatePhoneLearnerForCheckout(msisdn) {
  const national = nationalMsisdn(msisdn);
  const e164 = e164FromMsisdn(national);
  if (!e164 || !/^03\d{9}$/.test(national)) {
    throw new Error("invalid_msisdn");
  }

  const existing = await databasePool.query(
    `select id, email, name, "phoneNumber" as phone_number
     from public."user"
     where "phoneNumber" = $1
        or email = $2
     limit 1`,
    [e164, tempEmailForPhone(e164)],
  );
  if (existing.rows[0]) {
    const row = existing.rows[0];
    if (!row.phone_number) {
      await databasePool.query(
        `update public."user" set "phoneNumber" = $2, "phoneNumberVerified" = true, "updatedAt" = now() where id = $1`,
        [row.id, e164],
      );
    }
    return { userId: row.id, msisdn: national, e164, created: false };
  }

  const userId = randomUUID();
  const email = tempEmailForPhone(e164);
  const name = `Jalwa ${national}`;
  await databasePool.query(
    `insert into public."user" (id, name, email, "emailVerified", "phoneNumber", "phoneNumberVerified", "createdAt", "updatedAt")
     values ($1, $2, $3, false, $4, true, now(), now())`,
    [userId, name, email, e164],
  );
  await databasePool.query(
    `insert into public."account" (id, "accountId", "providerId", "userId", "createdAt", "updatedAt")
     values ($1, $2, 'credential', $3, now(), now())`,
    [randomUUID(), email, userId],
  );
  await databasePool.query(
    `insert into public.profiles (id, display_name, preferred_language)
     values ($1, $2, 'en')
     on conflict (id) do update set display_name = coalesce(public.profiles.display_name, excluded.display_name)`,
    [userId, name],
  );

  return { userId, msisdn: national, e164, created: true };
}

export { nationalMsisdn, e164FromMsisdn };
