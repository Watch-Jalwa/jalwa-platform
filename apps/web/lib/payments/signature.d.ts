export function signPaymentPayload(payload: string, secret: string): string;
export function verifyPaymentSignature(payload: string, signature: string | null | undefined, secret: string): boolean;
