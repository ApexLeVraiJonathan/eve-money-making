import Link from "next/link";
import { getApps } from "@/app/apps.config";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const descriptions: Record<string, string> = {
  brokerage:
    "Create and track consignments, and view delivery and earnings reports.",
  arbitrage:
    "Track your invested capital and profit share across arbitrage cycles.",
};

export default function LandingPage() {
  const apps = getApps();

  return (
    <div className="container mx-auto max-w-6xl p-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">EVE Money Making</h1>
        <p className="text-muted-foreground">Choose an app to get started.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {apps.map((app) => (
          <Card key={app.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <app.icon className="h-5 w-5" />
                <CardTitle>{app.label}</CardTitle>
              </div>
              <CardDescription>
                {descriptions[app.id] || "Open the app to explore features."}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Link href={app.basePath} className="inline-block">
                <Button>Enter {app.label}</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
