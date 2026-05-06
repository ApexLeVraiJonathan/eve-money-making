import Link from "next/link";
import { Button } from "@eve/ui";

export default function NotFound() {
  return (
    <div className="container mx-auto max-w-3xl p-8 space-y-4">
      <h2 className="text-2xl font-semibold">Page not found</h2>
      <p className="text-muted-foreground">
        The page you requested does not exist or is no longer available.
      </p>
      <Link href="/">
        <Button>Back to home</Button>
      </Link>
    </div>
  );
}
