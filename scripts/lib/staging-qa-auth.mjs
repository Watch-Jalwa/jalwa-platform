const required = (name) => {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`Missing required staging QA setting: ${name}`);
  return value;
};

export function qaConfig() {
  return {
    baseUrl: required("STAGING_BASE_URL").replace(/\/$/, ""),
    supabaseUrl: required("STAGING_SUPABASE_URL").replace(/\/$/, ""),
    anonKey: required("STAGING_SUPABASE_ANON_KEY"),
    serviceRoleKey: required("STAGING_SUPABASE_SERVICE_ROLE_KEY"),
  };
}

async function adminFetch(config, path, init = {}) {
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return response;
}

export async function ensureQaUser(config, email, role = null) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error("Invalid staging QA email address.");

  let userId = null;
  const list = await adminFetch(config, "/auth/v1/admin/users?page=1&per_page=1000");
  if (!list.ok) throw new Error(`Supabase QA user lookup failed with HTTP ${list.status}.`);
  const users = (await list.json()).users ?? [];
  userId = users.find((user) => user.email?.toLowerCase() === normalizedEmail)?.id ?? null;

  if (!userId) {
    const create = await adminFetch(config, "/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail, email_confirm: true, user_metadata: { qa_identity: true } }),
    });
    if (!create.ok) throw new Error(`Supabase QA user creation failed with HTTP ${create.status}.`);
    userId = (await create.json()).id;
  }

  if (!userId) throw new Error("Supabase QA user ID was not returned.");

  if (role) {
    let updated = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await adminFetch(config, `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ role }),
      });
      if (response.ok) {
        const rows = await response.json();
        if (Array.isArray(rows) && rows.length > 0) {
          updated = true;
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!updated) throw new Error(`Could not assign staging QA role ${role}.`);
  }

  return { id: userId, email: normalizedEmail };
}

export async function generateMagicLink(config, email, nextPath = "/") {
  const redirectTo = `${config.baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  const response = await adminFetch(config, "/auth/v1/admin/generate_link", {
    method: "POST",
    body: JSON.stringify({ type: "magiclink", email: email.trim().toLowerCase(), options: { redirect_to: redirectTo } }),
  });
  if (!response.ok) throw new Error(`Supabase QA magic-link generation failed with HTTP ${response.status}.`);
  const payload = await response.json();
  const actionLink = payload?.properties?.action_link ?? payload?.action_link;
  if (!actionLink || !/^https?:\/\//.test(actionLink)) throw new Error("Supabase QA magic link was not returned.");
  return actionLink;
}

export async function authenticatePage(page, config, email, nextPath = "/") {
  const actionLink = await generateMagicLink(config, email, nextPath);
  const response = await page.goto(actionLink, { waitUntil: "domcontentloaded" });
  if (!response || response.status() >= 500) throw new Error("Staging QA authentication navigation failed.");
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname === "/login") throw new Error("Staging QA authentication did not create a session.");
}
