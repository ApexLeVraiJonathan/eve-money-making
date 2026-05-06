import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@eve/ui";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { chartConfig } from "../lib/chart-config";
import type { ProfitTrendPoint } from "../lib/types";

type Props = {
  data: ProfitTrendPoint[];
};

export function ProfitOverTimeCard({ data }: Props) {
  return data.length > 0 ? (
    <Card>
      <CardHeader>
        <CardTitle>Realized Cash Profit</CardTitle>
        <CardDescription>
          Profit from completed sales (in millions ISK)
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
              <ReferenceLine y={0} stroke="#666" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `${Number(value).toFixed(2)}M ISK`}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke={chartConfig.profit.color}
                strokeWidth={3}
                name="Profit"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  ) : (
    <Card>
      <CardHeader>
        <CardTitle>Realized Cash Profit</CardTitle>
        <CardDescription>
          Profit from completed sales (in millions ISK)
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
