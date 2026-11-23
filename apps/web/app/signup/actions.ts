"use server";

import { redirect } from "next/navigation";

/** Signup uses `/signup` with phone + password fields. */
export async function requestSignupLink() {
  redirect("/signup?next=/onboarding");
}
