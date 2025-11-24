import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
} from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";

interface Loan {
  id: string;
  borrower: string;
  amount: number;
  status: "pending" | "approved" | "funded" | "active";
  date: string;
}

const mockLoans: Loan[] = [
  { id: "L001", borrower: "John Doe", amount: 5000, status: "active", date: "2024-01-15" },
  { id: "L002", borrower: "Jane Smith", amount: 10000, status: "funded", date: "2024-01-14" },
  { id: "L003", borrower: "Bob Wilson", amount: 3500, status: "approved", date: "2024-01-13" },
  { id: "L004", borrower: "Alice Brown", amount: 7200, status: "pending", date: "2024-01-12" },
  { id: "L005", borrower: "Charlie Davis", amount: 4800, status: "active", date: "2024-01-11" },
];

const statusColors = {
  pending: "secondary",
  approved: "default",
  funded: "default",
  active: "default",
} as const;

interface RecentLoansProps {
  loading?: boolean;
}

export function RecentLoans({ loading }: RecentLoansProps) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Recent Loans</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex flex-col space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            ))
          ) : (
            mockLoans.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{loan.borrower}</p>
                  <p className="text-xs text-muted-foreground">
                    {loan.id} • {loan.date}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(loan.amount, { decimals: 0 })}
                  </p>
                  <Badge variant={statusColors[loan.status]} className="capitalize">
                    {loan.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

