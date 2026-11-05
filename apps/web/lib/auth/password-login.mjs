import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { databasePool } from "@/lib/database/pool";
import { normalizePakistaniMobile, validateDisplayName } from "./identity.mjs";
import { hashPassword, validateLearnerPassword, verifyPassword } from "./password-hash.mjs";

function tempEmailForPhone(e164) {
  return `${String(e164).replace(/\D/g, "")}@msisdn.jalwa.local`;
}

async function ensureProfile(userId, displayName) {
  await databasePool.query(
    `insert into public.profiles (id, display_name, preferred_language)
     values ($1, $2, 'en')
     on conflict (id) do update
       set display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name),
           updated_at = now()`,
    [userId, displayName],
  );
}

async function ensureCredentialPassword(userId, passwordHash) {
  const existing = await databasePool.query(
    `select id, password from public."account"
     where "userId" = $1 and "providerId" = 'credential'
     order by "createdAt" asc
     limit 1`,
    [userId],
  );
  if (existing.rows[0]) {
    await databasePool.query(
      `update public."account"
       set password = $2,
           "accountId" = $3,
           "updatedAt" = now()
       where id = $1`,
      [existing.rows[0].id, passwordHash, userId],
    );
    return;
  }
  await databasePool.query(
    `insert into public."account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     values ($1, $2, 'credential', $3, $4, now(), now())`,
    [randomUUID(), userId, userId, passwordHash],
  );
}

async function signInWithEmailPassword(email, password) {
  return auth.api.signInEmail({
    body: { email, password, rememberMe: true },
    headers: await headers(),
    asResponse: true,
  });
}

/**
 * SkillUp-compatible phone + password login.
 * Signup requires displayName; sign-in is phone + password only.
 */
export async function passwordLogin({ displayName, phone, password }) {
  const e164 = normalizePakistaniMobile(phone);
  if (!e164) return { ok: false, error: "invalid-phone", status: 400 };
  if (!validateLearnerPassword(password)) return { ok: false, error: "invalid-password", status: 400 };

  const email = tempEmailForPhone(e164);
  const name = validateDisplayName(displayName ?? "");
  const existing = await databasePool.query(
    `select id, name, email, "phoneNumber" as phone_number
     from public."user"
     where "phoneNumber" = $1 or lower(email) = lower($2)
     limit 1`,
    [e164, email],
  );

  if (!existing.rows[0]) {
    if (!name) {
      return {
        ok: false,
        error: "invalid-name",
        status: 400,
        message: "Enter your full name to create an account.",
      };
    }

    const signupResponse = await auth.api.signUpEmail({
      body: { email, password, name },
      headers: await headers(),
      asResponse: true,
    });
    if (!signupResponse.ok) {
      const body = await signupResponse.json().catch(() => ({}));
      return {
        ok: false,
        error: "signup-failed",
        status: signupResponse.status || 400,
        message: body.message ?? "Could not create your account.",
      };
    }

    const created = await databasePool.query(
      `select id from public."user" where lower(email) = lower($1) limit 1`,
      [email],
    );
    const userId = created.rows[0]?.id;
    if (userId) {
      await databasePool.query(
        `update public."user"
         set "phoneNumber" = $2,
             "phoneNumberVerified" = true,
             name = coalesce(nullif(name, ''), $3),
             "updatedAt" = now()
         where id = $1`,
        [userId, e164, name],
      );
      await ensureProfile(userId, name);
      // Ensure credential row uses accountId = user.id for future sign-ins.
      const hash = await hashPassword(password);
      await ensureCredentialPassword(userId, hash);
    }

    // signUpEmail may already have set the session cookie.
    return {
      ok: true,
      created: true,
      response: signupResponse,
      learner: { phone: e164, displayName: name, email },
    };
  }

  const user = existing.rows[0];
  const account = await databasePool.query(
    `select id, password, "accountId"
     from public."account"
     where "userId" = $1 and "providerId" = 'credential'
     order by "createdAt" asc
     limit 1`,
    [user.id],
  );

  if (!account.rows[0]?.password) {
    // JazzCash guest / OTP user without password: require name once to claim account.
    if (!name) {
      return {
        ok: false,
        error: "invalid-name",
        status: 400,
        message: "Enter your full name to create an account.",
      };
    }
    const hash = await hashPassword(password);
    await ensureCredentialPassword(user.id, hash);
    await databasePool.query(
      `update public."user"
       set "phoneNumber" = coalesce("phoneNumber", $2),
           "phoneNumberVerified" = true,
           name = case when name is null or name like 'Jalwa %' then $3 else name end,
           "updatedAt" = now()
       where id = $1`,
      [user.id, e164, name],
    );
    await ensureProfile(user.id, name);
  } else {
    const valid = await verifyPassword({ hash: account.rows[0].password, password });
    if (!valid) return { ok: false, error: "invalid-credentials", status: 401 };
    // Keep accountId aligned with Better Auth email/password expectation.
    if (account.rows[0].accountId !== user.id) {
      await databasePool.query(
        `update public."account" set "accountId" = $2, "updatedAt" = now() where id = $1`,
        [account.rows[0].id, user.id],
      );
    }
  }

  const signInResponse = await signInWithEmailPassword(user.email || email, password);
  if (!signInResponse.ok) {
    return {
      ok: false,
      error: "invalid-credentials",
      status: 401,
      message: "Mobile number or password is incorrect.",
    };
  }

  return {
    ok: true,
    created: false,
    response: signInResponse,
    learner: {
      phone: e164,
      displayName: name || user.name,
      email: user.email || email,
    },
  };
}

/** Staging helper: set the same password on every credential account. */
export async function setDefaultPasswordForAllUsers(plainPassword = "Abc@123") {
  if (!validateLearnerPassword(plainPassword)) {
    throw new Error("invalid_default_password");
  }
  const hash = await hashPassword(plainPassword);
  const users = await databasePool.query(`select id, email from public."user"`);
  let updated = 0;
  for (const user of users.rows) {
    await ensureCredentialPassword(user.id, hash);
    updated += 1;
  }
  return { users: users.rows.length, updated, passwordSet: true };
}
