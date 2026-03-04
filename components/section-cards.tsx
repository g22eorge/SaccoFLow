import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface DashboardData {
  kpis: {
    membersTotal: number
    membersActive: number
    loansOpen: number
    loansCleared: number
    pendingApprovals: number
    outstandingPrincipal: string
    savingsBalance: string
    totalShareCapital: string
  }
  monitors: {
    portfolioRiskPercent: number
    defaultedLoans: number
    auditEvents24h: number
    monthlySavingsNet: string
    monthlyLoanNet: string
    monthlyDisbursed: string
    monthlyRepaid: string
  }
}

interface SectionCardsProps {
  dashboard: DashboardData
}

export function SectionCards({ dashboard }: SectionCardsProps) {
  const netSavingsPositive = Number(dashboard.monitors.monthlySavingsNet) >= 0

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Members</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {dashboard.kpis.membersTotal}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-400">
              {dashboard.kpis.membersActive} active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            SACCO Members
          </div>
          <div className="text-muted-foreground">
            {dashboard.kpis.membersActive} active members
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Savings Balance</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {dashboard.kpis.savingsBalance}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className={netSavingsPositive ? "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400" : "border-red-200 text-red-700 dark:border-red-800 dark:text-red-400"}>
              {netSavingsPositive ? <IconTrendingUp className="size-3" /> : <IconTrendingDown className="size-3" />}
              {dashboard.monitors.monthlySavingsNet}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Net 30 day flow
          </div>
          <div className="text-muted-foreground">
            Total deposits
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Loan Portfolio</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {dashboard.kpis.outstandingPrincipal}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-400">
              {dashboard.kpis.loansOpen} active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Outstanding principal
          </div>
          <div className="text-muted-foreground">{dashboard.kpis.loansCleared} cleared</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Share Capital</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {dashboard.kpis.totalShareCapital}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-400">
              Member equity
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Total subscribed shares
          </div>
          <div className="text-muted-foreground">Capital base from member shares</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Pending Approvals</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {dashboard.kpis.pendingApprovals}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className={dashboard.kpis.pendingApprovals > 0 ? "border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400" : "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"}>
              {dashboard.kpis.pendingApprovals > 0 ? "Needs attention" : "All clear"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Awaiting review
          </div>
          <div className="text-muted-foreground">{dashboard.kpis.loansCleared} processed today</div>
        </CardFooter>
      </Card>
    </div>
  )
}
