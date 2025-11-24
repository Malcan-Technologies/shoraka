"use client";

import * as React from "react";
import { StatsCard } from "../components/stats-card";
import { RecentLoans } from "../components/recent-loans";
import { UserSignupsChart } from "../components/user-signups-chart";
import { usePageTitle } from "../components/page-title-provider";
import { formatCurrency, formatNumber } from "@cashsouk/config";
import {
  CurrencyDollarIcon as DollarSign,
  UsersIcon as Users,
  ArrowTrendingUpIcon as TrendingUp,
  DocumentTextIcon as FileText,
} from "@heroicons/react/24/outline";

export default function AdminHomePage() {
  const [loading, setLoading] = React.useState(true);
  const { setTitle } = usePageTitle();

  React.useEffect(() => {
    setTitle("Dashboard");
  }, [setTitle]);

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Loans"
          value={formatNumber(124, 0)}
          icon={FileText}
          trend="+12% from last month"
          loading={loading}
        />
        <StatsCard
          title="Active Users"
          value={formatNumber(1832, 0)}
          icon={Users}
          trend="+18% from last month"
          loading={loading}
        />
        <StatsCard
          title="Total Investments"
          value={formatCurrency(284500, { decimals: 0 })}
          icon={TrendingUp}
          trend="+24% from last month"
          loading={loading}
        />
        <StatsCard
          title="Platform Revenue"
          value={formatCurrency(12420, { decimals: 0 })}
          icon={DollarSign}
          trend="+8% from last month"
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <UserSignupsChart />
        </div>
        <div className="lg:col-span-3">
          <RecentLoans loading={loading} />
        </div>
      </div>
    </div>
  );
}
