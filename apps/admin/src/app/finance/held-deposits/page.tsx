import { GatewayPaymentsTable } from "@/components/gateway-payments-table";

export default function HeldDepositsPage() {
  return (
    <GatewayPaymentsTable
      queue="held"
      title="Held Deposits"
      description="Deposits held for name mismatch or pending manual name verification."
    />
  );
}
