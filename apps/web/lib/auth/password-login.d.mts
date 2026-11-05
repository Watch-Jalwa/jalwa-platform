export type PasswordLoginResult =
  | {
      ok: true;
      created: boolean;
      response: Response;
      learner: { phone: string; displayName?: string | null; email: string };
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
