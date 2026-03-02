import { formatIsk } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@eve/ui";
import { Cell, Pie, PieChart } from "recharts";
import { chartConfig } from "../lib/chart-config";
import type { CapitalDistributionDatum } from "../lib/types";

type Props = {
  pieData: CapitalDistributionDatum[];
};

export function CapitalDistributionCard({ pieData }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Capital Distribution</CardTitle>
        <CardDescription>
          Current breakdown of cash vs inventory
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center">
        {pieData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value) => formatIsk(Number(value))}
                  />
                }
              />
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(1)}%`
                }
                outerRadius={100}
                innerRadius={60}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
