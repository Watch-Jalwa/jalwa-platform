"use server";

import { redirect } from "next/navigation";

/** @deprecated Signup now uses the unified passwordless `/login` OTP flow. */
export async function requestSignupLink() {
  redirect("/login?next=/onboarding");
}
