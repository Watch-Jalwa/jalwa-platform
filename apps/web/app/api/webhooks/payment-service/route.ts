import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { verifyPaymentSignature } from "@/lib/payments/signature.mjs";
import { PAYMENT_SERVICE_EVENT_TYPES, reconcilePaymentServiceEvent, type ProductPaymentEvent } from "@/lib/payments/payment-service-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_PAYMENT_SERVICE_WEBHOOK_BYTES = 64 * 1024;

function validEvent(value: unknown): value is ProductPaymentEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return typeof event.eventId === "string" && event.eventId.length >= 1 && event.eventId.length <= 200 &&
    typeof event.type === "string" && PAYMENT_SERVICE_EVENT_TYPES.has(event.type) &&
    typeof event.userId === "string" && event.userId.length >= 1 && event.userId.length <= 128 &&
    typeof event.createdAt === "string" && Number.isFinite(Date.parse(event.createdAt)) &&
    typeof event.data === "object" && event.data !== null && !Array.isArray(event.data);
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_PAYMENT_SERVICE_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Payment event is too large." }, { status: 413 });
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return NextResponse.json({ error: "JSON required." }, { status: 415 });

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_PAYMENT_SERVICE_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Payment event is too large." }, { status: 413 });
  }
  const secret = process.env.PAYMENT_SERVICE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Payment webhook is unavailable." }, { status: 503 });
  if (!verifyPaymentSignature(rawBody, request.headers.get("x-payment-signature"), secret)) {
    return NextResponse.json({ error: "Invalid payment signature." }, { status: 401 });
  }

  let payload: unknown;
  try { payload = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 }); }
  if (!validEvent(payload)) return NextResponse.json({ error: "Invalid payment event." }, { status: 400 });
  const eventHeader = request.headers.get("x-payment-event");
  if (!eventHeader || eventHeader !== payload.type) {
    return NextResponse.json({ error: "Payment event header does not match payload." }, { status: 400 });
  }

  const result = await reconcilePaymentServiceEvent(rawBody, payload);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
