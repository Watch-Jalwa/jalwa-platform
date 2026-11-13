export function hashPassword(password: string): Promise<string>;
export function verifyPassword(input: { hash: string; password: string }): Promise<boolean>;
export function validateLearnerPassword(password: string): boolean;
