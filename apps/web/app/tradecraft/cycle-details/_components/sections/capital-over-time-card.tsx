import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from "@eve/ui";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { chartConfig } from "../lib/chart-config";
import type { CapitalTrendPoint } from "../lib/types";

type Props = {
  data: CapitalTrendPoint[];
};

export function CapitalOverTimeCard({ data }: Props) {
  return data.length > 0 ? (
    <Card>
      <CardHeader>
        <CardTitle>Capital Over Time</CardTitle>
        <CardDescription>
          Historical progression of cycle capital (in millions ISK)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `${Number(value).toFixed(2)}M ISK`}
                  />
                }
              />
              <ChartLegend />
              <Line
                type="monotone"
                dataKey="cash"
                stroke={chartConfig.cash.color}
                strokeWidth={2}
                name="Cash"
              />
              <Line
                type="monotone"
                dataKey="inventory"
                stroke={chartConfig.inventory.color}
                strokeWidth={2}
                name="Inventory"
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#2563eb"
                strokeWidth={2}
                name="Total"
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  ) : (
    <Card>
      <CardHeader>
        <CardTitle>Capital Over Time</CardTitle>
        <CardDescription>
          Historical progression of cycle capital (in millions ISK)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center">
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          No snapshot data available yet
        </div>
      </CardContent>
    </Card>
  );
}
