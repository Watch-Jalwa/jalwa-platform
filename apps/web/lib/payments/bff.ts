import { NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { paymentServiceErrorResponse } from "@/lib/payments/payment-service";

export async function requirePaymentUserId() {
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  return user?.id ?? null;
}

export function paymentErrorResponse(error: unknown) {
  const mapped = paymentServiceErrorResponse(error);
  return NextResponse.json(mapped.body, { status: mapped.status });
}

export function validMsisdn(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{11,15}$/.test(value);
}

export function validPlanCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

export function validRemoteId(value: string) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
