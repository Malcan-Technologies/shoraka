import { GatewayPaymentsTable } from "@/components/gateway-payments-table";

export default function GatewayPaymentsPage() {
  return (
    <GatewayPaymentsTable
      title="Gateway Payments"
      description="All Curlec money-in payments including investor deposits."
    />
  );
}
