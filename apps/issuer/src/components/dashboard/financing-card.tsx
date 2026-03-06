import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export function FinancingCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="w-full bg-muted/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold">
          Financing
        </CardTitle>
      </CardHeader>

      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}