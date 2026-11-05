export type JazzcashClaimResult = {
  attempted: number;
  granted: number;
  mockChargeAllowed?: boolean;
  phoneMatched?: boolean;
  errors?: Array<{ requestId?: string; message: string }>;
  error?: string;
};

export type PasswordLoginResult =
  | {
      ok: true;
      created: boolean;
      response: Response;
      learner: { phone: string; displayName?: string | null; email: string };
      jazzcashClaim?: JazzcashClaimResult;
    }
  | {
      ok: false;
      error: string;
      status: number;
      message?: string;
    };

export function passwordLogin(input: {
  displayName?: string;
  phone: string;
  password: string;
}): Promise<PasswordLoginResult>;

export function setDefaultPasswordForAllUsers(
  plainPassword?: string,
): Promise<{ users: number; updated: number; passwordSet: true }>;
