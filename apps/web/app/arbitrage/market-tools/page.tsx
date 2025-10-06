import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MarketToolsPage() {
  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Market Tools</h1>
        <p className="text-sm text-muted-foreground">
          Utilities to help you price items and maintain competitive orders.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Sell Appraiser</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste a list of items and get the suggested sell price at the
              selected station.
            </p>
            <div>
              <Button asChild>
                <Link href="/market-tools/sell-appraiser">
                  Open <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Undercut Checker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Check your linked characters&#39; active orders for listings that
              have been undercut, and see the price to update to.
            </p>
            <div>
              <Button asChild>
                <Link href="/market-tools/undercut-checker">
                  Open <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
