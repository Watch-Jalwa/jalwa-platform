import { PaymentStatusPoller } from "@/components/payment-status-poller";

export const metadata = { title: "Confirm Premium" };

export default function WalletReturnPage() {
  return <div className="page-shell narrow-page"><PaymentStatusPoller /></div>;
}
