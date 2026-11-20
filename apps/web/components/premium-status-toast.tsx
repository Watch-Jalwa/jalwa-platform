"use client";

import { PostJazzcashAuthPrompt } from "@/components/post-jazzcash-auth-prompt";

/** Kept as layout entry; JazzCash return UX now prompts signup/signin for guests. */
export function PremiumStatusToast({ signedIn = false }: { signedIn?: boolean }) {
  return <PostJazzcashAuthPrompt signedIn={signedIn} />;
}
