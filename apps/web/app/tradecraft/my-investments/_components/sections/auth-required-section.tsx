import { Button, Card, CardContent, Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@eve/ui";
import { LogIn } from "lucide-react";

type AuthRequiredSectionProps = {
  onSignIn: () => void;
};

export function AuthRequiredSection({ onSignIn }: AuthRequiredSectionProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Empty className="min-h-64">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LogIn className="size-6" />
            </EmptyMedia>
            <EmptyTitle>Sign in to view your investments</EmptyTitle>
            <EmptyDescription>
              Connect your EVE Online character to see your participation history,
              returns, and investment performance.
            </EmptyDescription>
            <Button onClick={onSignIn} className="mt-4 gap-2">
              <LogIn className="h-4 w-4" />
              Sign in with EVE Online
            </Button>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}
