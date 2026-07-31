import { createClient } from "@/lib/supabase/server";

export type AppRole = "viewer" | "subscriber" | "editor" | "rights_reviewer" | "support" | "finance" | "admin";
export type PremiumCapability =
  | "premium:read"
  | "premium:plans:manage"
  | "premium:subscriptions:adjust"
  | "premium:reconciliation:run"
  | "premium:reports:read"
  | "premium:reports:export";

const ROLE_CAPABILITIES: Record<AppRole, readonly PremiumCapability[]> = {
  viewer: [],
  subscriber: ["premium:read"],
  editor: [],
  rights_reviewer: [],
  support: [],
  finance: ["premium:read", "premium:reports:read", "premium:reports:export", "premium:reconciliation:run"],
  admin: [
    "premium:read",
    "premium:plans:manage",
    "premium:subscriptions:adjust",
    "premium:reconciliation:run",
    "premium:reports:read",
    "premium:reports:export",
  ],
};

export function capabilitiesForRole(role: string | null | undefined): PremiumCapability[] {
  return role && role in ROLE_CAPABILITIES ? [...ROLE_CAPABILITIES[role as AppRole]] : [];
}

export function roleHasCapability(role: string | null | undefined, capability: PremiumCapability) {
  return capabilitiesForRole(role).includes(capability);
}

export class StudioAccessError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "StudioAccessError";
    this.status = status;
  }
}

export async function requirePremiumApiCapability(capability: PremiumCapability) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new StudioAccessError(401, "Authentication required.");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role,display_name").eq("id", user.id).maybeSingle();
  if (profileError || !profile) throw new StudioAccessError(403, "Staff access required.");
  const capabilities = capabilitiesForRole(profile.role);
  if (!capabilities.includes(capability)) throw new StudioAccessError(403, "This report capability is not available to your role.");
  return { user, profile, capabilities };
}
