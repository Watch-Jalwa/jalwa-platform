export function isFrontendPreview() {
  return process.env.NEXT_PUBLIC_FRONTEND_PREVIEW === "true" || process.env.VERCEL_ENV === "preview";
}

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function safeInternalPath(value: string | null | undefined, fallback = "/profile") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
