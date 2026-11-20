export type UserMembership = {
  planName: string;
  planCode: string;
  status: string;
  currentPeriodEnd: string | null;
  canUnsubscribe: boolean;
  subscriptionId: string | null;
};

export function getUserMembership(userId: string): Promise<UserMembership>;
